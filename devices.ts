#!/usr/bin/env node

// Log in to Homey and print info on found devices.
// Order by Zone (location)

// Output is YAML-like, but not guaranteed (names are not escaped).

import { HomeyAPI } from 'homey-api';
import CONFIG from "./config.json" with { type: "json" };;

const Homey = await HomeyAPI.createLocalAPI(CONFIG.homey);
const devices = await Homey.devices.getDevices();

// If you want the output in Javascript or in valid JSON, 
// uncomment one of these lines, and delete the rest of the script.
// console.log(devices);
// console.log(JSON.stringify(devices, null, 2));

const zones = await Homey.zones.getZones();
add_devices_to_zones(zones, devices);
add_children_to_zones(zones);
let zone = get_root_zone(zones);
print_zone(zone);

function add_devices_to_zones(zones, devices) {
  for (const zone of Object.values(zones)) {
    zone.devices = [];
  }
  for (const device of Object.values(devices)) {
    if (device.zone) {
      const zone = zones[device.zone];
      zone.devices.push(device);
    }
  }
}

function add_children_to_zones(zones) {
  for (const zone of Object.values(zones)) {
    zone.children = [];
  }
  for (const zone of Object.values(zones)) {
    if (zone.parent) {
      const parent = zones[zone.parent];
      parent.children.push(zone);
    }
  }
}

function get_root_zone(zones) {
  for (const zone of Object.values(zones)) {
    if (!zone.parent) {
      return zone
    }
  }
}

function print_zone(zone, indent=0) {
  console.log(" ".repeat(indent) + zone.name + ":");
  
  zone.devices.sort(function(a, b){
    let x = a.name.toLowerCase();
    let y = b.name.toLowerCase();
    if (x < y) {return -1;}
    if (x > y) {return 1;}
    return 0;
  });
  zone.devices.forEach(function (device) {
    print_device(device, indent+2);
  });
  if (zone.devices.length || !zone.children.length) {
    console.log("");
  }
  zone.children.sort(function(a, b){
    let x = a.name.toLowerCase();
    let y = b.name.toLowerCase();
    if (x < y) {return -1;}
    if (x > y) {return 1;}
    return 0;
  });
  zone.children.forEach(function (child) {
    print_zone(child, indent+2);
  });
  if (zone.children.length) {
    console.log("");
  }
}

function print_device(device, indent=0) {
  console.log(" ".repeat(indent) + device.name + ":");
  indent += 2;
  console.log(" ".repeat(indent) + "Id: " + device.id);
  console.log(" ".repeat(indent) + "Driver: " + device.driverId);
  let flags = device.flags;
  if (device.repair) { flags.push("repair"); }
  if (device.unpair) { flags.push("unpair"); }
  if (!device.available) { flags.push("unavailable"); }
  console.log(" ".repeat(indent) + "Flags: " + device.flags);
  if (!device.ready) {
    console.log(" ".repeat(indent) + "Warning: Device not ready");
  }
  if (device.warningMessage) {
    console.log(" ".repeat(indent) + 'Warning: "' + device.warningMessage + '"');
  }
  if (device.unavailableMessage) {
    console.log(" ".repeat(indent) + 'Unavailable: "' + device.unavailableMessage + '"');
  }
  if (device.note) {
    console.log(" ".repeat(indent) + "Note: " + device.note);
  }
  if (device.settings.zw_node_id) {
    console.log(" ".repeat(indent) + "Z-Wave ID: " + device.settings.zw_node_id);
  }
}

