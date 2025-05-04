// Replace a device with another device in your Homey.

// This script checks all flows for any occurance of the old device,
// and replaces those occurances with the new device.

// Based on fix-flows-by-id.js by Martijn Poppe
// Script: https://gist.github.com/martijnpoppen/dcf0b8fd3f7fe63dec087c87dbc66090#file-fix-flows-by-id-js
// Info: https://community.homey.app/t/how-to-pro-cloud-tool-to-fix-advanced-flows-after-removing-and-re-adding-devices/65018
// That script has been improved to be explicit in what to changed (at the cost of a little bit overhead)
// and it now catches and reports about exceptions.

import { HomeyAPI } from 'homey-api';
import CONFIG from "./config.json" with { type: "json" };;

const Homey = await HomeyAPI.createLocalAPI(CONFIG.homey);

// idTranslation is a mapping from old to new device UUID
const idTranslation = {
    "758520db-b1af-49b9-84b1-234e03ba5300": "c827aef8-c786-45b6-b0e8-c41a786a6ae0",
    "d8a94782-391f-44a2-bbf3-e08e9efaf53a": "5624b568-3c18-4d25-be3a-87d30b3af98a",
    "bfabcc76-6dbd-4365-a938-ad7dca6b8fc9": "0e43504e-52f4-48dd-9ce3-8753ace4a3ff",
    "57a77bc3-0911-43d7-8c08-7a282d9ceceb": "e5635c2b-08a3-4f4e-afbb-5b535e1a7123",
    "75dc5462-1870-4026-91fa-8ec3702f9017": "f16ff193-ec67-467b-8a4c-72769c3f14df",
    "d53e7ff4-5e06-4b34-8690-255792122a1b": "a3a0cddc-a0e5-4f37-a33c-cde902445918",
    "781b843d-b68b-48cd-972c-b4b804b5201e": "cf6172bb-5919-4ed1-a7a0-e7f9ca8a0fa0",
    "d269023b-921e-4b8b-b7f1-b7fe9c818cb8": "c00748bd-b3c0-48de-951a-de8fcd137271"
}

// Set the softRun variable to true or false to determine whether changes should be logged or actually executed
const softRun = true; // true | false

// If you run this script in a webbrowser, make sure to open the console
// in your browser as the result will be shown there.
// Howto open console: https://balsamiq.com/support/faqs/browserconsole/

const main = async function () {
    console.log('Starting main function...');

    // Retrieve all of the existing flows
    const flows = await Homey.flow.getFlows();

    // Iterate through each flow
    Object.values(flows).forEach(async (f) => {
        let cardsChanged = false;
        let actions = null;
        let conditions = null;
        let trigger = null;

        console.log(`Checking flow "${f.name}"...`);

        for (const [oldId, newId] of Object.entries(idTranslation)) {
            const replacer = new RegExp(oldId, 'g');
            trigger = f.trigger;

            // Replace the old device ID with the corresponding new device ID in the trigger
            if (trigger.uri) {
                const oldToken = trigger.uri;
                trigger.uri = oldToken.replace(replacer, newId);

                if (oldToken !== trigger.uri) {
                    console.log(`Found old device ID in URI of trigger card in flow "${f.name}"`);
                    console.log(`Replace "${oldId}" with "${newId}"`)
                    cardsChanged = true;
                }
            } else if (trigger.id) {
                const oldToken = trigger.id;
                trigger.id = oldToken.replace(replacer, newId);

                if (oldToken !== trigger.id) {
                    console.log(`Found old device ID in ID of trigger card in flow "${f.name}"`);
                    console.log(`Replace "${oldId}" with "${newId}"`)
                    cardsChanged = true;
                }
            }

            // Replace the old device ID with the corresponding new device ID in the trigger droptoken
            if (trigger.droptoken) {
                const oldToken = trigger.droptoken;
                trigger.droptoken = oldToken.replace(replacer, newId);

                if (oldToken !== trigger.droptoken) {
                    console.log(`Found old device ID in droptoken of trigger card in flow "${f.name}"`);
                    console.log(`Replace "${oldId}" with "${newId}"`)
                    cardsChanged = true;
                }
            }
        }

        // Iterate through each action in the flow
        f.actions.forEach(async (a, i) => {

            for (const [oldId, newId] of Object.entries(idTranslation)) {
                const replacer = new RegExp(oldId, 'g');
                actions = f.actions;

                // Replace the old device ID with the corresponding new device ID in the action
                if (actions[i].uri) {
                    const oldToken = actions[i].uri;
                    actions[i].uri = oldToken.replace(replacer, newId);

                    if (oldToken !== actions[i].uri) {
                        console.log(`Found old device ID in URI of action card in flow "${f.name}"`);
                        console.log(`Replace "${oldId}" with "${newId}"`)
                        cardsChanged = true;
                    }
                } else if (actions[i].id) {
                    const oldToken = actions[i].id;
                    actions[i].id = oldToken.replace(replacer, newId);

                    if (oldToken !== actions[i].id) {
                        console.log(`Found old device ID in ID of action card in flow "${f.name}"`);
                        console.log(`Replace "${oldId}" with "${newId}"`)
                        cardsChanged = true;
                    }
                }

                // Replace the old device ID with the corresponding new device ID in the action droptoken
                if (actions[i].args && actions[i].args.value && typeof actions[i].args.value === 'string') {
                    const oldToken = actions[i].args.value;
                    actions[i].args.value = oldToken.replace(replacer, newId);

                    if (oldToken !== actions[i].args.value) {
                        console.log(`Found old device ID in ID of action card in flow "${f.name}"`);
                        console.log(`Replace "${oldId}" with "${newId}"`)
                        cardsChanged = true;
                    }
                }

                if (actions[i].args && actions[i].args.text && typeof actions[i].args.text === 'string') {
                    const oldToken = actions[i].args.text;
                    actions[i].args.text = oldToken.replace(replacer, newId);

                    if (oldToken !== actions[i].args.text) {
                        console.log(`Found old device ID in ID of action card in flow "${f.name}"`);
                        console.log(`Replace "${oldId}" with "${newId}"`)
                        cardsChanged = true;
                    }
                }

                if (actions[i].args && actions[i].args.message && typeof actions[i].args.message === 'string') {
                    const oldToken = actions[i].args.message;
                    actions[i].args.message = oldToken.replace(replacer, newId);

                    if (oldToken !== actions[i].args.message) {
                        console.log(`Found old device ID in ID of action card in flow "${f.name}"`);
                        console.log(`Replace "${oldId}" with "${newId}"`)
                        cardsChanged = true;
                    }
                }
            }
        });

        // Iterate through each condition in the flow
        f.conditions.forEach(async (a, i) => {
            for (const [oldId, newId] of Object.entries(idTranslation)) {
                const replacer = new RegExp(oldId, 'g');

                conditions = f.conditions;

                // Replace the old device ID with the corresponding new device ID in the condition
                if (conditions[i].uri) {
                    const oldToken = conditions[i].uri;
                    conditions[i].uri = oldToken.replace(replacer, newId);

                    if (oldToken !== conditions[i].uri) {
                        console.log(`Found old device ID in URI of condition card in flow "${f.name}"`);
                        console.log(`Replace "${oldId}" with "${newId}"`)
                        cardsChanged = true;
                    }
                } else if (conditions[i].id) {
                    const oldToken = conditions[i].id;
                    conditions[i].id = oldToken.replace(replacer, newId);

                    if (oldToken !== conditions[i].id) {
                        console.log(`Found old device ID in ID of condition card in flow "${f.name}"`);
                        console.log(`Replace "${oldId}" with "${newId}"`)
                        cardsChanged = true;
                    }
                }

                // Replace the old device ID with the corresponding new device ID in the condition droptoken
                if (conditions[i].droptoken) {
                    const oldToken = conditions[i].droptoken;
                    conditions[i].droptoken = oldToken.replace(replacer, newId);

                    if (oldToken !== conditions[i].droptoken) {
                        console.log(`Found old device ID in Droptoken of condition card in flow "${f.name}"`);
                        console.log(`Replace "${oldId}" with "${newId}"`)
                        cardsChanged = true;
                    }
                }
            }
        });

        // If softRun is false, update the flow with the new trigger
        // If any cards in the advanced flow were changed
        if (cardsChanged) {
            // If softRun is false, update the advanced flow with the new cards

            const newCardData = {
                id: f.id,
                flow: {
                    id: f.id,
                    ...(trigger && { trigger: trigger }),
                    ...(actions && { actions: actions }),
                    ...(conditions && { conditions: conditions })
                }
            }

            if (!softRun) {
                console.log(`Updating flow "${f.name}" with new cards...`);
                console.log(JSON.stringify(newCardData, null, 2));
                try {
                    // await Homey.flow.updateFlow(newCardData);
                    const response = await Homey.flow.updateFlow(newCardData);
                    console.log(`Update response: ${JSON.stringify(response)}`);
                } catch (err) {
                    console.log(`Exception updating "${f.name}": ${err.message}`);
                }
            } else {
                // If softRun is true, log the change that would be made
                console.log(`Would update flow "${f.name}" with new data:`, newCardData);
            }
        }
    });

    // --------------------------------------

    // Retrieve all of the existing advanced flows
    const advanced_flows = Object.values(await Homey.flow.getAdvancedFlows());

    // Iterate through each advanced flow
    advanced_flows.forEach(async (af) => {
        console.log(`Checking advanced flow "${af.name}"...`);

        const cards = af.cards;
        let cardsChanged = false;

        // Iterate through each card in the advanced flow
        for (const c in af.cards) {
            for (const [oldId, newId] of Object.entries(idTranslation)) {
                const replacer = new RegExp(oldId, 'g');

                if (cards[c].args && cards[c].droptoken) {
                    const oldToken = cards[c].droptoken;
                    cards[c].droptoken = cards[c].droptoken.replace(replacer, newId);

                    if (oldToken !== cards[c].droptoken) {
                        console.log(`Found old device ID in droptoken of card in advanced flow "${af.name}"`);
                        console.log(`Replace "${oldId}" with "${newId}"`)
                        cardsChanged = true;
                    }
                }

                if (cards[c].args && cards[c].args.value && typeof cards[c].args.value === 'string') {
                    const oldToken = cards[c].args.value;
                    cards[c].args.value = cards[c].args.value.replace(replacer, newId);

                    if (oldToken !== cards[c].args.value) {
                        console.log(`Found old device ID in value of card in advanced flow "${af.name}"`);
                        console.log(`Replace "${oldId}" with "${newId}"`)
                        cardsChanged = true;
                    }
                }

                if (cards[c].args && cards[c].args.text && typeof cards[c].args.text === 'string') {
                    const oldToken = cards[c].args.text;
                    cards[c].args.text = cards[c].args.text.replace(replacer, newId);

                    if (oldToken !== cards[c].args.text) {
                        console.log(`Found old device ID in test of card in advanced flow "${af.name}"`);
                        console.log(`Replace "${oldId}" with "${newId}"`)
                        cardsChanged = true;
                    }
                }

                if (cards[c].args && cards[c].args.message && typeof cards[c].args.message === 'string') {
                    const oldToken = cards[c].args.message;
                    cards[c].args.message = cards[c].args.message.replace(replacer, newId);

                    if (oldToken !== cards[c].args.message) {
                        console.log(`Found old device ID in message of card in advanced flow "${af.name}"`);
                        console.log(`Replace "${oldId}" with "${newId}"`)
                        cardsChanged = true;
                    }
                }

                if (cards[c].ownerUri) {
                    const oldToken = cards[c].ownerUri;
                    cards[c].ownerUri = cards[c].ownerUri.replace(replacer, newId);

                    if (oldToken !== cards[c].ownerUri) {
                        console.log(`Found old device ID in ownerUri of card in advanced flow "${af.name}"`);
                        console.log(`Replace "${oldId}" with "${newId}"`)
                        cardsChanged = true;
                    }
                }

                if (cards[c].id) {
                    const oldToken = cards[c].id;
                    cards[c].id = cards[c].id.replace(replacer, newId);

                    if (oldToken !== cards[c].id) {
                        console.log(`Found old device ID in ownerUri of card in advanced flow "${af.name}"`);
                        console.log(`Replace "${oldId}" with "${newId}"`)
                        cardsChanged = true;
                    }
                }
            }
        }

        // If any cards in the advanced flow were changed
        if (cardsChanged) {
            // If softRun is false, update the advanced flow with the new cards

            const newCardData = {
                id: af.id,
                advancedflow: { cards: cards }
            }

            if (!softRun) {
                console.log(`Updating advanced flow "${af.name}" with new cards...`);
                console.log(JSON.stringify(newCardData, null, 2));
                try {
                    const response = await Homey.flow.updateAdvancedFlow(newCardData);
                    console.log(`Update response: ${JSON.stringify(response)}`);
                } catch (err) {
                    console.log(`Exception updating "${af.name}": ${err.message}`);
                }
            } else {
                console.log(`Would update advanced flow "${af.name}" with new cards:`, newCardData);
            }
        }
    });
};

// Call the main function to execute the flow ID replacements
main();
