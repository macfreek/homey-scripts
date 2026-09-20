// Log in to Homey and find broken flows.

// Written by Freek Dijkstra, 2025-2026
// No copyright claimed.
// Based on isBroken() method by AtHom,
// as published in homey-api npm package.

// Broken flows are printed to the console.
// An error field is added to these flows to indicate what's wrong.

// To run standalone:
// - npm install homey-api@latest
// - node broken-flows.cjs
// - node broken-flows.cjs --max=4
// - node broken-flows.cjs --max=all
// - node broken-flows.cjs --json
// Note: the extension must be .cjs (CommonJS), to allow the 
// script to return a result.

// To run in a flow:
// - Install HomeyScript app
// - Open https://my.homey.app/scripts and save this script
// - Create a new flow, with Trigger e.g. "every day"
// - Add a "Run Script" card in the "and" section, with the saved script.
//   The script sets the tag [[BrokenFlowsReport]].
//   If no broken flows are found, returns an empty string and the script
//   is aborted.
// - Add an action card, e.g. Send notification with [[BrokenFlowsReport]]
//   as the contents.

// Version history:
// 28-04-2025: first version
// 13-09-2026: script can run on a remote computer; in the HomeyScript 
//             window; or as a flow card.
// 20-09-2026: fix: support bare-token references


const isHomeyScript = typeof Homey !== 'undefined';

async function main() {
  // negative or 'all': list every broken flow; 0: single summary line
  let MAX_LIST_LENGTH = 4;
  // print full flow JSON per broken flow instead of "<name>: <error>"
  let JSON_OUTPUT = false;

  if (!isHomeyScript) {
    // No global Homey variable found; log in ourselves.
    const { HomeyAPI } = await import('homey-api');
    const { default: CONFIG } = await import('./config.json', { with: { type: 'json' } });
    globalThis.Homey = await HomeyAPI.createLocalAPI(CONFIG.homey);

    ({ MAX_LIST_LENGTH, JSON_OUTPUT } = parseArgs(process.argv.slice(2)));
  }

  const flows = await Homey.flow.getFlows();

  // Fill the cache
  const flowTokens = await Homey.flowtoken.getFlowTokens();
  await Homey.flow.getFlowCardTriggers();
  await Homey.flow.getFlowCardConditions();
  await Homey.flow.getFlowCardActions();

  // Since filter must be synchronous, run in two steps.
  // Store boolean results in an array, and await those result
  const asyncFilter = async (arr, predicate) => {
    const results = await Promise.all(arr.map(predicate));
    return arr.filter((_v, index) => results[index]);
  };

  const flowIds = new Set(Object.keys(flows));

  const brokenFlows = await asyncFilter(Object.values(flows), flow => IsBroken(flow, flowTokens, flowIds));

  const report = buildReport(brokenFlows, Object.values(flows).length, MAX_LIST_LENGTH, JSON_OUTPUT);

  if (isHomeyScript) {
    // Set broken flow report as a tag, so any later flow card can use
    // [[BrokenFlowsReport]] as text.
    // This text is also returned: a "Run Script"/"Run Code" condition card
    // decides if the actions are excuted: not if the report is empty ("" is falsy),
    // any non-empty report is truthy and executed any action cards.
    const text = brokenFlows.length === 0 ? '' : report;
    await tag('BrokenFlowsReport', text);
    await log('Output is stored in tag BrokenFlowsReport for use in other cards.');
    return text;
  }
  console.log(report);
}

function parseArgs(argv) {
  let JSON_OUTPUT = false;
  let MAX_LIST_LENGTH;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') {
      JSON_OUTPUT = true;
    } else if (argv[i] === '--max') {
      MAX_LIST_LENGTH = argv[++i] === 'all' ? -1 : Number(argv[i]);
    } else if (argv[i].startsWith('--max=')) {
      const value = argv[i].slice('--max='.length);
      MAX_LIST_LENGTH = value === 'all' ? -1 : Number(value);
    }
  }

  // Default length depends on --json, so it must be resolved after the loop
  if (MAX_LIST_LENGTH === undefined) {
    MAX_LIST_LENGTH = JSON_OUTPUT ? -1 : 4;
  }

  return { MAX_LIST_LENGTH, JSON_OUTPUT };
}

function buildReport(brokenFlows, totalFlows, MAX_LIST_LENGTH, JSON_OUTPUT) {
  const showAll = MAX_LIST_LENGTH < 0;
  const shown = showAll ? brokenFlows : brokenFlows.slice(0, MAX_LIST_LENGTH);

  if (JSON_OUTPUT) {
    return JSON.stringify(shown, null, 2);
  }

  if (MAX_LIST_LENGTH === 0) {
    return brokenFlows.length === 0
      ? 'No broken flows found'
      : `${brokenFlows.length} broken flows found`;
  }

  const summary = `${brokenFlows.length} of ${totalFlows} flows are broken`;
  const lines = shown.map(flow => `Flow "${flow.name}" is broken: ${flow.error}`);
  const remaining = brokenFlows.length - shown.length;
  if (remaining > 0) {
    lines.push(`...and ${remaining} more`);
  }

  return [summary, ...lines].join('\n');
}

async function IsBroken(flow, flowTokens, flowIds) {
  // Array of local & global Token IDs.
  // For example [ 'foo', 'homey:x:y|abc' ]
  const tokenIds = [];

  const checkToken = tokenId => {
    // If this is a global Token, fetch all FlowTokens
    if (tokenId.includes('|')) {
      for (const flowTokenId of Object.keys(flowTokens)) {
        tokenIds.push(flowTokenId);
      }
      tokenId = tokenId.replace('|', ':');
    }

    if (!tokenIds.includes(tokenId)) {
      throw new Error(`Missing Token: ${tokenId}`);
    }
  };

  const checkTokens = card => {
    // Check droptoken
    if (card.droptoken) {
      checkToken(card.droptoken);
    }

    if (typeof card.args === 'object') {
      for (const arg of Object.values(card.args)) {
        if (typeof arg !== 'string') continue;
        for (const [tokenMatch, tokenId] of arg.matchAll(/\[\[(.*?)\]\]/g)) {
          checkToken(tokenId);
        }
      }
    }
  };

  const checkFlowReference = card => {
    // Cards like "Enable/Disable Flow" reference another flow by id+name.
    const flowRef = card.args?.flow;
    if (flowRef && typeof flowRef.id === 'string' && !flowIds.has(flowRef.id)) {
      throw new Error(`Referenced flow not found: "${flowRef.name}"`);
    }
  };

  // Check Trigger
  if (flow.trigger) {
    try {
      // getFlowCardTriggers
      // warning: getFlowCardTrigger() is very slow
      const triggerCard = await flow.manager.getFlowCardTrigger({ id: flow.trigger.id });
      checkTokens(flow.trigger);
      checkFlowReference(flow.trigger);
      // Add FlowCardTrigger.tokens to internal tokens cache. tokens is an
      // array of {id, type, title, ...} objects, not a map - Object.keys()
      // here would give array indices ("0", "1", ...) instead of the
      // actual token ids.
      if (Array.isArray(triggerCard.tokens)) {
        for (const token of triggerCard.tokens) {
          tokenIds.push(token.id);
        }
      }
    } catch (err) {
      flow.error = err.message;
      return true;
    }
  }

  // Check Conditions
  if (Array.isArray(flow.conditions)) {
    for (const condition of Object.values(flow.conditions)) {
      try {
        // getFlowCardConditions
        // eslint-disable-next-line no-unused-vars
        const conditionCard = await flow.manager.getFlowCardCondition({ id: condition.id });
        checkTokens(condition);
        checkFlowReference(condition);
      } catch (err) {
        flow.error = err.message;
        return true;
      }
    }
  }

  // Check Actions
  if (Array.isArray(flow.actions)) {
    for (const action of Object.values(flow.actions)) {
      try {
        // getFlowCardActions
        // eslint-disable-next-line no-unused-vars
        const actionCard = await flow.manager.getFlowCardAction({ id: action.id });
        checkTokens(action);
        checkFlowReference(action);
      } catch (err) {
        flow.error = err.message;
        return true;
      }
    }
  }

  return false;
}

return main();
