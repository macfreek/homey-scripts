#!/usr/bin/env node

// Log in to Homey and print info on found flows.

// Output is valid JSON

import { HomeyAPI } from 'homey-api';
import CONFIG from "./config.json" with { type: "json" };;

const Homey = await HomeyAPI.createLocalAPI(CONFIG.homey);
const flows = await Homey.flow.getFlows();

// console.log(flows);
console.log(JSON.stringify(flows, null, 2));
