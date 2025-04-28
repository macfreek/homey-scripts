#!/usr/bin/env node

// Log in to Homey and find broken flows.

// Written by Freek Dijkstra, 28-04-2025
// No copyright claimed.
// Based on isBroken() method by AtHom,
// as published in homey-api npm package.

import { HomeyAPI } from 'homey-api';
import CONFIG from "./config.json" with { type: "json" };;
const Homey = await HomeyAPI.createLocalAPI(CONFIG.homey);

const flows = await Homey.flow.getFlows();

// Fill the cache
const flowTokens = await Homey.flowtoken.getFlowTokens();

// To get false positives, replace the above with:
// const flowTokens = {};

// Since filter must be synchronous, run in two steps.
// Store boolean results in an array, and await those result
const asyncFilter = async (arr, predicate) => {
  const results = await Promise.all(arr.map(predicate));
  return arr.filter((_v, index) => results[index]);
}

const brokenFlows = await asyncFilter(Object.values(flows), flow => IsBroken(flow));

console.log(brokenFlows.length + " of " + Object.values(flows).length + " flows are broken")
console.log(brokenFlows);

async function IsBroken(flow) {
  // Array of local & global Token IDs.
  // For example [ 'foo', 'homey:x:y|abc' ]
  const tokenIds = [];

  const checkToken = async tokenId => {
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

  const checkTokens = async card => {
    // Check droptoken
    if (card.droptoken) {
      await checkToken(card.droptoken);
    }

    if (typeof card.args === 'object') {
      for (const arg of Object.values(card.args)) {
        if (typeof arg !== 'string') continue;
        for (const [tokenMatch, tokenId] of arg.matchAll(/\[\[(.*?)\]\]/g)) {
          await checkToken(tokenId);
        }
      }
    }
  };

  // Check Trigger
  if (flow.trigger) {
    try {
      // getFlowCardTriggers
      // warning: getFlowCardTrigger() is very slow
      const triggerCard = await flow.manager.getFlowCardTrigger({ id: flow.trigger.id });
      await checkTokens(flow.trigger);
      // Add FlowCardTrigger.tokens to internal tokens cache
      if (Array.isArray(triggerCard.tokens)) {
        for (const tokenId of Object.keys(triggerCard.tokens)) {
          tokenIds.push(tokenId);
        }
      }
    } catch (err) {
      flow.error = err.message;
      // flow.broken = true;
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
        await checkTokens(condition);
      } catch (err) {
        flow.error = err.message;
        // flow.broken = true;
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
        await checkTokens(action);
      } catch (err) {
        flow.error = err.message;
        // flow.broken = true;
        return true;
      }
    }
  }

  return false;
}
