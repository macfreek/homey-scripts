#!/usr/bin/env node
// Replace non-breaking spaces (nbsp) in names with a regular space.
// Examines device-, flow- and variable names, and in flow conditions and actions.
// For some reason, these nbsp (U+00A0) pop up in names (I suspect from a webinterface).
// But this makes searching for a flow by name harder.

import { HomeyAPI } from 'homey-api';
import CONFIG from "./config.json" with { type: "json" };;

// Set the softRun variable to true or false to determine whether changes should be logged or actually executed
const softRun = false; // true | false

const homeyApi = await HomeyAPI.createLocalAPI(CONFIG.homey);

console.log("Devices:")
const devices = await homeyApi.devices.getDevices();
let replace_count = 0;
for (const device of Object.values(devices)) {
  if (device.name.indexOf("\u00a0") > -1) {
    let oldname = device.name
    let newname = oldname.replace(/\u00a0/g, " ");
    console.log("Device " + device.id + ": " + oldname + " -> " + newname);
    if (!softRun) {
      homeyApi.devices.updateDevice({id: device.id, device: {name: newname}});
    }
    replace_count += 1;
  }
}
console.log(replace_count + " of " + Object.values(devices).length + " devices changed");

console.log("Variables:")
const variables = await homeyApi.logic.getVariables();
replace_count = 0;
for (const variable of Object.values(variables)) {
  if (variable.name.indexOf("\u00a0") > -1) {
    let oldname = variable.name
    let newname = oldname.replace(/\u00a0/g, " ");
    console.log("Variable " + variable.id + ": " + oldname + " -> " + newname);
    if (!softRun) {
      homeyApi.logic.updateVariable({id: variable.id, variable: {name: newname}});
    }
    replace_count += 1;
  }
}
console.log(replace_count + " of " + Object.values(variables).length + " variables changed");

console.log("Flows:")
const flows = await homeyApi.flow.getFlows();
replace_count = 0;
let replace_trigger_count = 0;
let total_trigger_count = 0;
let replace_condition_count = 0;
let total_condition_count = 0;
let replace_action_count = 0;
let total_action_count = 0;
let nameHasChanged = false;
let triggerHasChanged = false;
let conditionHasChanged = false;
let actionHasChanged = false;
for (const flow of Object.values(flows)) {
  if (flow.name.indexOf("\u00a0") > -1) {
    let oldname = flow.name
    let newname = oldname.replace(/\u00a0/g, " ");
    console.log(flow.id + ": " + oldname + " -> " + newname);
    if (!softRun) {
      homeyApi.flow.updateFlow({id: flow.id, flow: {name: newname}});
    }
    replace_count += 1;
    nameHasChanged = true;
  };
  // Examine trigger of the flow
  if (flow.trigger.id.indexOf('homey:manager:flow:') == 0 && 
      flow.trigger.args.flow && flow.trigger.args.flow.name && 
      typeof flow.trigger.args.flow.name === 'string'
  ) {
    total_trigger_count += 1;
    if (flow.trigger.args.flow.name.indexOf("\u00a0") > -1) {
      let oldname = flow.trigger.args.flow.name;
      let newname = oldname.replace(/\u00a0/g, " ");
      console.log("Flow triggered by " + flow.name + ": " + oldname + " -> " + newname);
      flow.trigger.args.flow.name = newname;
      replace_trigger_count += 1;
      triggerHasChanged = true;
    }
  }
  if (flow.trigger.id.indexOf('homey:manager:logic:variable') == 0 && 
      flow.trigger.args.variable.name && 
      typeof flow.trigger.args.variable.name === 'string'
  ) {
    total_trigger_count += 1;
    if (flow.trigger.args.variable.name.indexOf("\u00a0") > -1) {
      let oldname = flow.trigger.args.variable.name;
      let newname = oldname.replace(/\u00a0/g, " ");
      console.log("Variable triggered by " + flow.name + ": " + oldname + " -> " + newname);
      flow.trigger.args.variable.name = newname;
      replace_trigger_count += 1;
      triggerHasChanged = true;
    }
  }
  // Iterate through each condition in the flow
  flow.conditions.forEach((condition, idx) => {
    if (condition.id.indexOf('homey:manager:flow:') == 0 && 
        condition.args.flow.name && 
        typeof condition.args.flow.name === 'string'
    ) {
      total_condition_count += 1;
      if (condition.args.flow.name.indexOf("\u00a0") > -1) {
        let oldname = condition.args.flow.name;
        let newname = oldname.replace(/\u00a0/g, " ");
        console.log("Flow checked in " + flow.name + ": " + oldname + " -> " + newname);
        flow.conditions[idx].args.flow.name = newname;
        replace_condition_count += 1;
        conditionHasChanged = true;
      }
    }
    if (condition.id.indexOf('homey:manager:logic:variable') == 0 && 
        condition.args.variable.name && 
        typeof condition.args.variable.name === 'string'
    ) {
      total_condition_count += 1;
      if (condition.args.variable.name.indexOf("\u00a0") > -1) {
        let oldname = condition.args.variable.name;
        let newname = oldname.replace(/\u00a0/g, " ");
        console.log("Variable checked in " + flow.name + ": " + oldname + " -> " + newname);
        flow.conditions[idx].args.variable.name = newname;
        replace_condition_count += 1;
        conditionHasChanged = true;
      }
    }
  });
  // Iterate through each action in the flow
  flow.actions.forEach((action, idx) => {
    if (action.id.indexOf('homey:manager:flow:') == 0 && 
        action.args.flow.name && 
        typeof action.args.flow.name === 'string'
    ) {
      total_action_count += 1;
      if (action.args.flow.name.indexOf("\u00a0") > -1) {
        let oldname = action.args.flow.name;
        let newname = oldname.replace(/\u00a0/g, " ");
        console.log("Flow called in " + flow.name + ": " + oldname + " -> " + newname);
        flow.actions[idx].args.flow.name = newname;
        replace_action_count += 1;
        actionHasChanged = true;
      }
    }
    if (action.id.indexOf('homey:manager:logic:variable') == 0 && 
        action.args.variable.name && 
        typeof action.args.variable.name === 'string'
    ) {
      total_action_count += 1;
      if (action.args.variable.name.indexOf("\u00a0") > -1) {
        let oldname = action.args.variable.name;
        let newname = oldname.replace(/\u00a0/g, " ");
        console.log("Variable set in " + flow.name + ": " + oldname + " -> " + newname);
        flow.actions[idx].args.variable.name = newname;
        replace_action_count += 1;
        actionHasChanged = true;
      }
    }
  });
  if (triggerHasChanged || conditionHasChanged || actionHasChanged) {
    // console.log(flow);
    // console.log("Flow:");
    // console.log(JSON.stringify(flow, null, 2));
    let newflow = {}
    if (triggerHasChanged) {
      newflow['trigger'] = flow.trigger;
    }
    if (conditionHasChanged) {
      newflow['conditions'] = flow.conditions;
    }
    if (actionHasChanged) {
      newflow['actions'] = flow.actions;
    }
    if (!softRun) {
      homeyApi.flow.updateFlow({id: flow.id, flow: newflow});
    }
    break;
  }
}
console.log(replace_count + " of " + Object.values(flows).length + " flow names changed");
console.log(replace_trigger_count + " of " + total_trigger_count + " flow triggers changed");
console.log(replace_condition_count + " of " + total_condition_count + " flow conditions changed");
console.log(replace_action_count + " of " + total_action_count + " flow actions changed");
