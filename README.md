Homey Scripts
=============

Miscellaneous code for interacting with a Homey smart home controller.

You can run these scripts on your computer, when it is in the same local network as your Homey.
It uses the HomeyAPIV3Local API, and have been tested with a Homey Pro 2023.

Applicability and Copyright
---------------------------

These scripts are provided as-is. They worked for me, but were not tested in other settings.
Sadly, I do not provide support if they don't work for you. Small contributions with bug fixes will be merged, if possible, but other than that: you are on your own.

The scripts are written in 2025 by Freek Dijkstra.

No copyright is claimed (attribution is appreciated, but not required). However, beware that some scripts are based on work of other authors. Were applicable, I've listed those sources. Check the original copyright, and give proper attribution to those authors when requested.

Getting started
---------------

First, make sure that nodejs and npm are installed on your local computer.

Next, download these scripts, and install the required `homey-api` package:

    $ git clone https://github.com/macfreek/homey-scripts
    $ cd homey-scripts
    $ npm install homey-api

Configure your credentials to interact with your Homey in a file `config.js`:

    {
        "homey": {
            "address": "http://198.51.100.113",
            "token": "[YOUR API KEY]"
        }
    }

In here, replace the `address` and `token` with the values for your Homey.

The address can be found at https://my.homey.app/settings/system/general. Either use the IP address listed under `address` (e.g. http://198.51.100.113), or use the hostname listed under `hostname` (e.g. http://homey-a3fbb2bd9dea497f8afef190.local), and append them with "`http://`" (beware, not `https://`!). In theory, using the link-local hostname is best, because it is based on the serial number, and is fixed. In practice, multicast DNS (mDNS) is sometimes unreliable and the hostname-to-IP-address fails. Hence, using the IP address is perhaps more robust. Just beware that the IP address may frequently change.

The token can be generated on your local Homey and found at https://my.homey.app/settings/system/api-keys. Click "New API Key" if none is listed.

Once set, run any script on your local computer:

    $ node devices.js

Scripts
-------

* `devices.js`: List all devices
* `flows.js`: List all flows
* `variables.js`: List all variables
* `broken-flows.js`: Detect and report about broken flows
* `no-nbsp.js`: Replace non-breaking spaces in names with regular spaces


Other Useful links
------------------

* https://my.homey.app/: Webinterface to your Homey
* https://tools.developer.homey.app/: Developer interface to your Homey
* https://tools.developer.homey.app/tools/api-playground: API playground om your Homey. Note that you can not run asynchronous function calls here.
* https://athombv.github.io/node-homey-api/: Homey API reference
