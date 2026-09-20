#!/usr/bin/env node

// Convert a single basic (standard) Homey flow into an advanced flow.

// Written by Freek Dijkstra, 2026. No copyright claimed.

// Background: Homey has no built-in or official way to convert a basic
// flow into an advanced flow. This script does a best-effort structural
// conversion, based on reverse-engineering the JSON shape of both flow
// types via the homey-api package (see README.md of this repo).

// Usage (flowRef is a flow's id, or its exact name if unambiguous):
//   node basic-to-advanced-flow.js [options] <flowRef>
// 
// With options:
//   --dry-run    # prints the result instead of creating it
//   --force      # allow creating a flow with the same name as another flow
//   --serial     # chain conditions serially
//   --parallel   # wire conditions in parallel (default)

// Homey does not enforce unique advanced-flow names; creating two flows
// named e.g. "Foo (advanced)" succeeds silently and leaves them
// indistinguishable except by id. Writing refuses to do this by default.
// Pass --force to create a duplicate anyway.

// Supports: device-capability tokens, global variables, local tag
// references (those listed under "This flow"), delay, duration, 
// then/else actions, references to other flows, and OR-groups in
// conditions.
//
// Most of these features use the exact same JSON syntax in both flow types.
// Local tag references differ in syntax between basic and advanced flows.
// For basic flow, it looks like [[tag]] without a "homey:...|" prefix.
// For advanced-flow, it looks like "trigger::<id>::<tag>";
// This script rewrites them accordingly (see rewriteBareToken).

// Disclaimer: this code was partially written by AI-assistence from Claude Code.

import { randomUUID } from 'node:crypto';
import { HomeyAPI } from 'homey-api';
import CONFIG from './config.json' with { type: 'json' };

// Execution order:
// 'serial': translate "IF A AND B AND C THEN D ELSE E" as a chain
//   (A -> B -> C -> D -> E), and chains
//   D's own actions (and E's) one after another too.
// 'parallel': same condition logic via "all"/"any" combiner cards instead
//   of a chain (trigger fans out to A, B, C at once; "all" ANDs their true
//   outputs, "any" ORs their false outputs) - and, similarly actions are
//   also executed at the same time.
const EXEC_ORDER = 'parallel';

// --- Layout ------------------------------------------------------------

const GRID = 20;
const BASE_X = 60;
const Y_THEN = 80;
const ACTION_ROW_GAP = 160;              // fallback then/else vertical gap when there's no combiner
const CONDITION_ROW_GAP = 120;           // vertical spacing between stacked parallel conditions
const ALL_HEIGHT_PER_CONNECTION = 1.25 * GRID; // how much taller "all" gets per inbound condition
const SPACING_AFTER_ALL = 60;            // gap between "all"'s bottom and the "any"/else row
const COMBINER_EXIT_GAP = 200;           // fixed (not item-count-based) gap leaving an all/any column

function toGrid(value) { return Math.floor(value / GRID) * GRID; }

// Horizontal gap for a column holding up to `n` stacked cards.
function columnSpacing(n) { return toGrid(380 + 30 * n); }

function allHeight(n) { return toGrid(n * ALL_HEIGHT_PER_CONNECTION); }

// --- CLI entry point -------------------------------------------------------

const KNOWN_FLAGS = ['--dry-run', '--force', '--serial', '--parallel'];
const USAGE = 'Usage: node basic-to-advanced-flow.js <flowRef> [--dry-run] [--force] [--serial|--parallel]';

function parseArgs(argv) {
  const unknown = argv.filter(a => a.startsWith('--') && !KNOWN_FLAGS.includes(a));
  if (unknown.length) {
    throw new Error(`Unknown option(s): ${unknown.join(', ')}\n${USAGE}`);
  }

  const flowRef = argv.find(a => !a.startsWith('--'));
  const write = !argv.includes('--dry-run');
  const force = argv.includes('--force');
  const serial = argv.includes('--serial');
  const parallel = argv.includes('--parallel');
  if (serial && parallel) {
    throw new Error(`Cannot pass both --serial and --parallel\n${USAGE}`);
  }
  const execOrder = serial ? 'serial' : parallel ? 'parallel' : EXEC_ORDER;

  if (!flowRef) {
    throw new Error(USAGE);
  }
  return { flowRef, write, force, execOrder };
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const Homey = await HomeyAPI.createLocalAPI(CONFIG.homey);
  await convert_to_advanced(Homey, options.flowRef, options);
}

// --- Main function entry point: convert a flow -----------------------------

// Reads, converts and (optionally) writes one flow. Homey is an already-
// connected HomeyAPI instance, so this can be called repeatedly (e.g. in a
// loop over many flow ids) without reconnecting or re-parsing CLI args.
async function convert_to_advanced(Homey, flowRef, { write, force, execOrder }) {
  let flow;
  try {
    flow = await readBasicFlow(Homey, flowRef);
  } catch (err) {
    console.error(err.message);
    return null;
  }

  const { advancedflow, warnings, skipped } = convertFlowToAdvanced(flow, execOrder);
  for (const w of warnings) console.warn(`Warning: ${w}`);
  if (skipped) {
    console.error(`Flow "${flow.name}" was not converted: ${skipped}`);
    return null;
  }

  return writeAdvancedFlow(Homey, advancedflow, { write, force });
}

async function readBasicFlow(Homey, flowRef) {
  const flows = await Homey.flow.getFlows();
  const flow = flows[flowRef] || findFlowByName(Object.values(flows), flowRef);
  if (!flow) throw new Error(`No basic flow found with id or name "${flowRef}"`);
  if (flow.broken) throw new Error(`Flow "${flow.name}" is marked broken; fix it first (see broken-flows.cjs)`);
  return flow;
}

// Homey doesn't enforce unique flow names either, so an ambiguous name
// refuses to guess - use the id instead.
function findFlowByName(flows, name) {
  const matches = flows.filter(f => f.name === name);
  if (matches.length > 1) {
    throw new Error(`Multiple flows named "${name}" (${matches.map(f => f.id).join(', ')}); use the id instead`);
  }
  return matches[0] || null;
}

async function writeAdvancedFlow(Homey, advancedflow, { write, force }) {
  if (!write) {
    console.log(JSON.stringify(advancedflow, null, 2));
    console.log('\n(dry run; pass --write to actually create this advanced flow)');
    return null;
  }

  if (!force) {
    const existing = await findAdvancedFlowByName(Homey, advancedflow.name);
    if (existing) {
      console.error(`An advanced flow named "${advancedflow.name}" already exists (${existing.id}). Delete it first, or pass --force to create a duplicate anyway.`);
      return null;
    }
  }

  const result = await Homey.flow.createAdvancedFlow({ advancedflow });
  console.log(`Created advanced flow "${result.name}" (${result.id})`);
  return result;
}

async function findAdvancedFlowByName(Homey, name) {
  const advancedFlows = await Homey.flow.getAdvancedFlows();
  return Object.values(advancedFlows).find(f => f.name === name) || null;
}

// --- Conversion logic ------------------------------------------------------

function convertFlowToAdvanced(flow, execOrder) {
  if (execOrder !== 'serial' && execOrder !== 'parallel') {
    return { advancedflow: null, warnings: [], skipped: `exec-order "${execOrder}" is not recognized` };
  }

  const cards = {};
  const warnings = [];
  const triggerCard = { id: flow.trigger.id, args: flow.trigger.args || {}, type: 'trigger' };
  if (flow.trigger.droptoken) triggerCard.droptoken = flow.trigger.droptoken;
  const triggerId = addCard(cards, triggerCard, BASE_X, Y_THEN);

  const conditions = flow.conditions || [];
  const thenActions = (flow.actions || []).filter(a => a.group === 'then');
  const elseActions = (flow.actions || []).filter(a => a.group === 'else');
  const hasElse = elseActions.length > 0;

  const groupsList = groupConditionsByGroup(conditions);
  let { elseTargets, thenTargets, nextX, combinerHeight, pendingElse } =
    buildConditions(cards, groupsList, execOrder, triggerId, hasElse, warnings);

  // The else-row must clear both "all" (if any) and the then-stack -
  // actions only actually stack vertically in 'parallel' mode (in
  // 'serial' they chain at a single y, so there's nothing to clear). See
  // buildConditionCombiners and resolvePendingElse for why "any" can't be
  // placed until this is known.
  const thenIsStacked = execOrder === 'parallel' && thenActions.length > 1;
  const thenStackHeight = thenIsStacked ? (thenActions.length - 1) * ACTION_ROW_GAP : 0;
  const elseGap = Math.max(ACTION_ROW_GAP, combinerHeight + thenStackHeight + SPACING_AFTER_ALL);
  const elseY = Y_THEN + elseGap;
  if (pendingElse) elseTargets = resolvePendingElse(cards, pendingElse, elseY);

  const { thenFirstIds, elseFirstIds } = buildActionBranches(cards, execOrder, thenActions, elseActions, hasElse, nextX, elseY, triggerId);

  if (thenFirstIds.length) {
    for (const target of thenTargets) cards[target.id][target.key] = thenFirstIds;
  }
  if (hasElse && elseFirstIds.length) {
    for (const target of elseTargets) cards[target.id][target.key] = elseFirstIds;
  }

  const advancedflow = { name: `${flow.name} (advanced)`, folder: flow.folder, enabled: false, cards };
  return { advancedflow, warnings, skipped: null };
}

// Local tag references in a basic-flow always reference a tag produced by
// the flow's own trigger. Advanced flows require these to be qualified by the
// producing card's id instead. This function convert these references.
function rewriteBareToken(tokenId, triggerId) {
  // e.g. convert "target_temperature" to "trigger::<triggerCardId>::target_temperature"
  return tokenId.includes('|') ? tokenId : `trigger::${triggerId}::${tokenId}`;
}

function rewriteDroptoken(droptoken, triggerId) {
  return droptoken ? rewriteBareToken(droptoken, triggerId) : droptoken;
}

// Rewrites every bare [[tag]] found in a card's string-valued args; other
// arg value types (numbers, nested objects like a device/variable
// reference) never contain tag references, so are left untouched.
function rewriteArgs(args, triggerId) {
  const result = { ...args };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value !== 'string') continue;
    result[key] = value.replace(/\[\[(.*?)\]\]/g, (_match, tokenId) => `[[${rewriteBareToken(tokenId, triggerId)}]]`);
  }
  return result;
}

function addCard(cards, card, x, y) {
  const id = randomUUID();
  cards[id] = { ...card, x, y };
  return id;
}

// Builds a single condition card, shared by the chain (serial) and
// fan-out (parallel) layouts.
function buildConditionCard(condition, triggerId) {
  const card = { id: condition.id, args: rewriteArgs(condition.args || {}, triggerId), type: 'condition' };
  if (condition.droptoken) card.droptoken = rewriteDroptoken(condition.droptoken, triggerId);
  if (condition.inverted) card.inverted = true;
  return card;
}

// Chains conditions serially (A.true -> B.true -> C ...), AND-ing them -
// one card per column, so every step uses columnSpacing(1). elseTargets
// lists, for each condition, the {id, key} (its outputFalse) to wire an
// else-action chain onto later.
function buildConditionChain(cards, conditions, triggerId, hasElse) {
  let prevId = triggerId;
  let prevKey = 'outputSuccess';
  const elseTargets = [];
  let x = BASE_X;

  for (const condition of conditions) {
    x += columnSpacing(1);
    const condId = addCard(cards, buildConditionCard(condition, triggerId), x, Y_THEN);
    cards[prevId][prevKey] = [condId];
    elseTargets.push({ id: condId, key: 'outputFalse' });
    prevId = condId;
    prevKey = 'outputTrue';
  }

  const nextX = x + columnSpacing(hasElse ? 2 : 1);
  return { elseTargets, lastId: prevId, lastKey: prevKey, nextX, combinerHeight: 0, pendingElse: null };
}

// Wires conditions in parallel: the trigger fans out to every condition
// at once (no short-circuiting), stacked in one column. With 0 or 1
// conditions there's nothing to combine, so this behaves like
// buildConditionChain's single-column case. With 2+, delegates the
// "all"/"any" combiners to buildConditionCombiners.
function buildConditionParallel(cards, conditions, triggerId, hasElse) {
  const nLanes = hasElse ? 2 : 1;
  const base = { combinerHeight: 0, pendingElse: null };
  if (conditions.length === 0) {
    return { ...base, lastId: triggerId, lastKey: 'outputSuccess', elseTargets: [], nextX: BASE_X + columnSpacing(nLanes) };
  }

  const step = columnSpacing(conditions.length);
  const condX = BASE_X + step;
  const condIds = conditions.map((condition, i) =>
    addCard(cards, buildConditionCard(condition, triggerId), condX, Y_THEN + i * CONDITION_ROW_GAP));
  cards[triggerId].outputSuccess = condIds;

  if (condIds.length === 1) {
    const target = { id: condIds[0], key: 'outputFalse' };
    return { ...base, lastId: condIds[0], lastKey: 'outputTrue', elseTargets: [target], nextX: condX + columnSpacing(nLanes) };
  }
  return buildConditionCombiners(cards, condIds, condX + step, hasElse);
}

// ANDs 2+ conditions' true outputs via an "all" card, placed level with
// the then-row; its height depends on how many conditions feed it (see
// allHeight). The "any" combiner (if there's an else-branch to reach) is
// NOT created here: its y must also clear a stacked then-action branch,
// which isn't known until the caller has sized that branch - see
// resolvePendingElse, called once elseY is known.
function buildConditionCombiners(cards, condIds, x, hasElse) {
  const allId = addCard(cards, { type: 'all', input: condIds.map(id => `${id}::outputTrue`) }, x, Y_THEN);
  condIds.forEach(id => { cards[id].outputTrue = [allId]; });

  const combinerHeight = allHeight(condIds.length);
  const pendingElse = hasElse ? { kind: 'any', combinerX: x, condIds } : null;
  return { lastId: allId, lastKey: 'outputSuccess', elseTargets: [], combinerHeight, pendingElse, nextX: x + COMBINER_EXIT_GAP };
}

// Creates the else-branch combiner deferred by buildConditionCombiners or
// buildConditionGroups, now that elseY (which also accounts for a stacked
// then-branch) is known. A single condition group defers an "any" (ORs its
// conditions' failures); 2+ OR'd groups defer an "all" (the else-branch
// only fires once every group has failed) - see buildConditionGroups.
function resolvePendingElse(cards, pending, elseY) {
  if (pending.kind === 'any') {
    const anyId = addCard(cards, { type: 'any' }, pending.combinerX, elseY);
    pending.condIds.forEach(id => { cards[id].outputFalse = [anyId]; });
    return [{ id: anyId, key: 'outputSuccess' }];
  }
  const allId = addCard(cards, {
    type: 'all',
    input: pending.falseSources.map(fs => `${fs.id}::${fs.key}`),
  }, pending.x, elseY);
  return [{ id: allId, key: 'outputSuccess' }];
}

// Splits a basic flow's conditions into its OR-groups (the "OR" tabs in
// the condition list), preserving the order groups first appear in.
function groupConditionsByGroup(conditions) {
  const groups = new Map();
  for (const condition of conditions) {
    if (!groups.has(condition.group)) groups.set(condition.group, []);
    groups.get(condition.group).push(condition);
  }
  return [...groups.values()];
}

// Dispatches to the right condition-wiring strategy: a single group uses
// the chosen execOrder (chain for 'serial', fan-out+combiner for
// 'parallel'); 2+ OR'd groups always use the fan-out+combiner approach per
// group, since a serial chain has no way to represent independent OR
// branches.
function buildConditions(cards, groupsList, execOrder, triggerId, hasElse, warnings) {
  if (groupsList.length > 1) {
    if (execOrder === 'serial') {
      warnings.push('flow has multiple OR condition groups: conditions are wired using parallel-style combiners regardless of --serial');
    }
    return buildConditionGroups(cards, groupsList, triggerId, hasElse);
  }

  const conditions = groupsList[0] || [];
  const { elseTargets, lastId, lastKey, nextX, combinerHeight, pendingElse } = execOrder === 'serial'
    ? buildConditionChain(cards, conditions, triggerId, hasElse)
    : buildConditionParallel(cards, conditions, triggerId, hasElse);
  return { thenTargets: [{ id: lastId, key: lastKey }], elseTargets, nextX, combinerHeight, pendingElse };
}

// Builds one OR-group's condition column. A single-condition group needs
// no combiner: the condition's own outputTrue/outputFalse serve directly
// as the group's true/false signal. A 2+-condition group is AND'd via
// "all" (true signal) and OR'd via "any" (false signal), placed in a
// shared combiner column (combinerX) so every group's combiners line up.
function buildGroup(cards, groupConditions, x, y, combinerX, triggerId) {
  const condIds = groupConditions.map((condition, i) =>
    addCard(cards, buildConditionCard(condition, triggerId), x, y + i * CONDITION_ROW_GAP));

  if (condIds.length === 1) {
    return {
      condIds,
      trueSource: { id: condIds[0], key: 'outputTrue' },
      falseSource: { id: condIds[0], key: 'outputFalse' },
      height: CONDITION_ROW_GAP,
      hasCombiner: false,
    };
  }

  const allId = addCard(cards, { type: 'all', input: condIds.map(id => `${id}::outputTrue`) }, combinerX, y);
  condIds.forEach(id => { cards[id].outputTrue = [allId]; });
  const combinerHeight = allHeight(condIds.length);
  const anyId = addCard(cards, { type: 'any' }, combinerX, y + combinerHeight + SPACING_AFTER_ALL);
  condIds.forEach(id => { cards[id].outputFalse = [anyId]; });

  return {
    condIds,
    trueSource: { id: allId, key: 'outputSuccess' },
    falseSource: { id: anyId, key: 'outputSuccess' },
    height: Math.max(condIds.length * CONDITION_ROW_GAP, combinerHeight + SPACING_AFTER_ALL + CONDITION_ROW_GAP),
    hasCombiner: true,
  };
}

// Wires 2+ OR'd condition groups: every group's conditions share one
// column (stacked with a gap between groups), each group producing its
// own true/false signal via buildGroup. The groups' true signals are
// wired directly into the then-branch further down (multiple sources into
// the same target already ORs - confirmed via a hand-built advanced flow,
// "Test flow 3"); their false signals are combined by a deferred top-level
// "all" card into the else-branch (see resolvePendingElse) - it can't be
// built yet because its y must also clear a stacked then-action branch,
// not known until the caller has sized that branch.
function buildConditionGroups(cards, groupsList, triggerId, hasElse) {
  const totalConditions = groupsList.reduce((n, g) => n + g.length, 0);
  const condX = BASE_X + columnSpacing(totalConditions);
  const combinerX = condX + columnSpacing(totalConditions);

  let y = Y_THEN;
  const groups = groupsList.map(groupConditions => {
    const result = buildGroup(cards, groupConditions, condX, y, combinerX, triggerId);
    y += result.height + CONDITION_ROW_GAP;
    return result;
  });
  const groupsHeight = y - Y_THEN - CONDITION_ROW_GAP;

  cards[triggerId].outputSuccess = groups.flatMap(g => g.condIds);

  const hasAnyCombiner = groups.some(g => g.hasCombiner);
  const nextX = hasAnyCombiner ? combinerX + COMBINER_EXIT_GAP : condX + columnSpacing(hasElse ? 2 : 1);

  const thenTargets = groups.map(g => g.trueSource);
  const pendingElse = hasElse ? { kind: 'all-groups', x: nextX, falseSources: groups.map(g => g.falseSource) } : null;

  return { thenTargets, elseTargets: [], nextX, combinerHeight: groupsHeight, pendingElse };
}

// Expands each action into 1 or 2 layout "steps" (a delay gets its own
// column before the action it belongs to).
function expandActionSteps(actions) {
  const steps = [];
  for (const action of actions) {
    const delayActive = action.delay && action.delay.number != null && action.delay.enabled !== false;
    if (delayActive) steps.push({ kind: 'delay', action });
    steps.push({ kind: 'action', action });
  }
  return steps;
}

function addDelayCard(cards, action, x, y) {
  const { number, multiplier } = action.delay;
  return addCard(cards, { type: 'delay', args: { delay: { number, multiplier } } }, x, y);
}

// "duration" (distinct from "delay") uses the exact same {number,
// multiplier} shape as "delay", just as a field directly on the action
// card instead of its own card - confirmed against a hand-built advanced
// flow, "Test flow 4".
function addActionCard(cards, action, x, y, triggerId) {
  const card = { id: action.id, args: rewriteArgs(action.args || {}, triggerId), type: 'action' };
  if (action.droptoken) card.droptoken = rewriteDroptoken(action.droptoken, triggerId);
  const durationActive = action.duration && action.duration.number != null && action.duration.enabled !== false;
  if (durationActive) {
    const { number, multiplier } = action.duration;
    card.duration = { number, multiplier };
  }
  return addCard(cards, card, x, y);
}

// Lays out one or two action branches (then/else) column by column, kept
// in step so cards at the same depth share an x - this is what stacks the
// "then" cards above the "else" cards instead of staggering them. The gap
// between columns depends on how many branches are still active there
// (columnSpacing), the same rule used for the condition fan-out. Used for
// 'serial': actions within a branch chain to each other (outputSuccess).
function buildActionColumns(cards, branches, startX, triggerId) {
  const branchSteps = branches.map(b => expandActionSteps(b.actions));
  const maxDepth = Math.max(0, ...branchSteps.map(s => s.length));
  const prevIds = branches.map(() => null);
  const firstIds = branches.map(() => null);
  let x = startX;
  let prevLanes = null;

  for (let d = 0; d < maxDepth; d++) {
    const lanes = branchSteps.filter(s => s.length > d).length;
    if (d > 0) x += columnSpacing(Math.max(prevLanes, lanes));

    branchSteps.forEach((steps, b) => {
      if (d >= steps.length) return;
      const step = steps[d];
      const id = step.kind === 'delay'
        ? addDelayCard(cards, step.action, x, branches[b].y)
        : addActionCard(cards, step.action, x, branches[b].y, triggerId);
      if (prevIds[b]) cards[prevIds[b]].outputSuccess = [id]; else firstIds[b] = id;
      prevIds[b] = id;
    });
    prevLanes = lanes;
  }
  return firstIds;
}

// Used for 'parallel': each action (with its own optional delay) becomes
// an independent mini-chain, stacked vertically at startY (one row per
// action, ACTION_ROW_GAP apart) - the caller wires ALL of the returned ids
// directly from the combiner/condition, mirroring how conditions fan out
// from the trigger rather than chaining to each other.
function buildActionFanOut(cards, actions, startX, startY, triggerId) {
  return actions.map((action, i) => {
    const y = startY + i * ACTION_ROW_GAP;
    let prevId = null;
    let firstId = null;
    let x = startX;
    for (const step of expandActionSteps([action])) {
      const id = step.kind === 'delay'
        ? addDelayCard(cards, step.action, x, y)
        : addActionCard(cards, step.action, x, y, triggerId);
      if (prevId) cards[prevId].outputSuccess = [id]; else firstId = id;
      prevId = id;
      x += columnSpacing(1);
    }
    return firstId;
  });
}

// Lays out the then/else action branches: chained columns for 'serial'
// (buildActionColumns), or an independent fan-out per branch for
// 'parallel' (buildActionFanOut). Always returns arrays of first-step ids
// (one per action for 'parallel', one total for 'serial'), since the
// caller wires ALL of them onto the condition/combiner's output.
function buildActionBranches(cards, execOrder, thenActions, elseActions, hasElse, nextX, elseY, triggerId) {
  if (execOrder === 'parallel') {
    const thenFirstIds = buildActionFanOut(cards, thenActions, nextX, Y_THEN, triggerId);
    const elseFirstIds = hasElse ? buildActionFanOut(cards, elseActions, nextX, elseY, triggerId) : [];
    return { thenFirstIds, elseFirstIds };
  }

  const branches = [{ actions: thenActions, y: Y_THEN }];
  if (hasElse) branches.push({ actions: elseActions, y: elseY });
  const [thenFirstId, elseFirstId] = buildActionColumns(cards, branches, nextX, triggerId);
  return { thenFirstIds: thenFirstId ? [thenFirstId] : [], elseFirstIds: elseFirstId ? [elseFirstId] : [] };
}

main();
