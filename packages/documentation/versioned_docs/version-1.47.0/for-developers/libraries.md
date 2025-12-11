---
description: List of all repositories related to Sofie
sidebar_position: 5
---

# Applications & Libraries

## Main Application

[**Sofie&nbsp;Core**](https://github.com/nrkno/sofie-core) is the main application that serves the web GUI and handles the core logic.

## Gateways

Together with the _Sofie&nbsp;Core_ there are several _gateways_ which are separate applications, but which connect to _Sofie&nbsp;Core_ and are managed from within the Core's web UI.

- [**Playout Gateway**](https://github.com/nrkno/sofie-core/tree/master/packages/playout-gateway) Handles the playout from _Sofie_. Connects to and controls a multitude of devices, such as vision mixers, graphics, light controllers, audio mixers etc..
- [**MOS Gateway**](https://github.com/nrkno/sofie-core/tree/master/packages/mos-gateway) Connects _Sofie_ to a newsroom system \(NRCS\) and ingests rundowns via the [MOS protocol](http://mosprotocol.com/).
- [**iNEWS Gateway**](https://github.com/tv2/inews-ftp-gateway) Connects _Sofie_ to an Avid iNEWS newsroom system.
- [**Quantel Gateway**](https://github.com/nrkno/sofie-quantel-gateway) CORBA to REST gateway for _Quantel/ISA_ playback.
- [**Spreadsheet Gateway**](https://github.com/SuperFlyTV/spreadsheet-gateway) Connects _Sofie_ to a _Google Drive_ folder and ingests rundowns from _Google Sheets_.
- [**Input Gateway**](https://github.com/nrkno/sofie-input-gateway)

## Libraries

There are a number of libraries used in the Sofie ecosystem:

- [**ATEM Connection**](https://github.com/nrkno/sofie-atem-connection) Library for communicating with Blackmagic Design's ATEM mixers
- [**ATEM State**](https://github.com/nrkno/sofie-atem-state) Used in TSR to tracks the state of ATEMs and generate commands to control them.
- [**CasparCG&nbsp;Server Connection**](https://github.com/SuperFlyTV/casparcg-connection) developed by **[_SuperFly.tv_](https://github.com/SuperFlyTV)** Library to connect and interact with CasparCG&nbsp;Servers.
- [**CasparCG State**](https://github.com/superflytv/casparcg-state) developed by **[_SuperFly.tv_](https://github.com/SuperFlyTV)** Used in TSR to tracks the state of CasparCG&nbsp;Servers and generate commands to control them.
- [**Ember+ Connection**](https://github.com/nrkno/sofie-emberplus-connection) Library to communicate with _Ember+_ control protocol
- [**HyperDeck Connection**](https://github.com/nrkno/sofie-hyperdeck-connection) Library for connecting to Blackmagic Design's HyperDeck recorders.
- [**MOS Connection**](https://github.com/nrkno/sofie-mos-connection/) A [_MOS protocol_](http://mosprotocol.com/) library for acting as a MOS device and connecting to an newsroom control system.
- [**Quantel Gateway Client**](https://github.com/nrkno/sofie-quantel-gateway-client) An interface that talks to the Quantel-Gateway application.
- [**Sofie&nbsp;Core Integration**](https://github.com/nrkno/sofie-core-integration) Used to connect to the [Sofie&nbsp;Core](https://github.com/nrkno/sofie-core) by the Gateways.
- [**Sofie Blueprints Integration**](https://github.com/nrkno/sofie-sofie-blueprints-integration) Common types and interfaces used by both Sofie&nbsp;Core and the user-defined blueprints.
- [**SuperFly-Timeline**](https://github.com/SuperFlyTV/supertimeline) developed by **[_SuperFly.tv_](https://github.com/SuperFlyTV)** Resolver and rules for placing objects on a virtual timeline.
- [**ThreadedClass**](https://github.com/nytamin/threadedClass) developed by **[_Nytamin_](https://github.com/nytamin)** Used in TSR to spawn device controllers in separate processes.
- [**Timeline State Resolver**](https://github.com/nrkno/sofie-timeline-state-resolver) \(TSR\) The main driver in **Playout Gateway,** handles connections to playout-devices and sends commands based on a **Timeline** received from **Core**.

There are also a few typings-only libraries that define interfaces between applications:

- [**Blueprints Integration**](https://www.npmjs.com/package/@sofie-automation/blueprints-integration) Defines the interface between [**Blueprints**](../user-guide/concepts-and-architecture.md#blueprints) and **Sofie&nbsp;Core**.
- [**Timeline State Resolver types**](https://www.npmjs.com/package/timeline-state-resolver-types) Defines the interface between [**Blueprints**](../user-guide/concepts-and-architecture.md#blueprints) and the timeline that will be fed into **TSR** for playout.

## Other Sofie-related Repositories

- [**CasparCG&nbsp;Server** \(NRK fork\)](https://github.com/nrkno/sofie-casparcg-server) Sofie-specific fork of CasparCG&nbsp;Server.
- [**CasparCG Launcher**](https://github.com/nrkno/sofie-casparcg-launcher) Launcher, controller, and logger for CasparCG&nbsp;Server.
- [**CasparCG Media Scanner** \(NRK fork\)](https://github.com/nrkno/sofie-casparcg-server) Sofie-specific fork of CasparCG&nbsp;Server 2.2 Media&nbsp;Scanner.
- [**Package Manager**](https://github.com/nrkno/sofie-package-manager) Handles media asset transfer and media file management for pulling new files and deleting expired files on playout devices in a more performant, and possibly distributed, way. Can smartly figure out how to get a file on storage A to playout server B.
- [**Media Manager**](https://github.com/nrkno/sofie-media-management) _(deprecated)_ Handles media transfer and media file management for pulling new files and deleting expired files on playout devices.
- [**Quantel Browser Plugin**](https://github.com/nrkno/sofie-quantel-browser-plugin) MOS-compatible Quantel video clip browser for use with Sofie.
- [**Sisyfos Audio Controller**](https://github.com/nrkno/sofie-sisyfos-audio-controller) _developed by [*olzzon*](https://github.com/olzzon/)_
