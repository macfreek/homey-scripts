#!/usr/bin/env node

// Log in to Homey and print info on found variables.

// Output is valid JSON

import { HomeyAPI } from 'homey-api';
import CONFIG from "./config.json" with { type: "json" };;

const Homey = await HomeyAPI.createLocalAPI(CONFIG.homey);
const variables = await Homey.logic.getVariables();

// console.log(variables);
console.log(JSON.stringify(variables, null, 2));
