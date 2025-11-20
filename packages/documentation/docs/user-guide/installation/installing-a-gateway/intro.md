---
sidebar_label: Introduction
sidebar_position: 10
---
# Introduction: Installing a Gateway

#### Prerequisites

* [Installed and running Sofie&nbsp;Core](../quick-install.md)

The _Sofie&nbsp;Core_ is the primary application for managing the broadcast, but it doesn't play anything out on it's own. A Gateway will establish the connection from _Sofie&nbsp;Core_ to other pieces of hardware or remote software. A basic setup may include the [Spreadsheet Gateway](rundown-or-newsroom-system-connection/google-spreadsheet.md) which will ingest a rundown from Google Sheets then, use the [Playout Gateway](playout-gateway.md) send commands to a CasparCG&nbsp;Server graphics playout, an ATEM vision mixer, and / or the [Sisyfos audio controller](https://github.com/olzzon/sisyfos-audio-controller).

<!-- 
Installing a gateway is a two part process. To begin, you will [add the required Blueprints](../installing-blueprints.md), or mini plug-in programs, to _Sofie&nbsp;Core_ so it can manipulate the data from the Gateway. Then you will install the Gateway itself. Each Gateway follows a similar installation pattern but, each one does differ slightly. The links below will help you navigate to the correct Gateway for the piece of hardware / software you are using.
-->

Setting up a gateway (also called Peripheral Device) from scratch generally is a five-step process:
1. Start the executable image and have it connect to Sofie Core
2. Assign the new Peripheral Device to a Studio
3. Configure the gateway inside the Sofie user interface, configure *sub-devices* \(MOS primary & secondary, video mixers, playout servers, HMI devices\) if applicable
4. Restart the gateway to apply the new settings
5. Verify connection on the *Status* page in Sofie

:::tip
You can expect the initial connection in Step 1 to fail. This is expected. Peripheral Devices cannot be connected to Sofie unless they are assigned to a Studio. This initial connection is required to inform Sofie about the capabilities of the gateway and set up authorization tokens that will be expected by Sofie in subsequent connections. Do not be discouraged by the gateway shutting down or restarting and just follow the steps above as described.
:::

### Gateways and their types and functions

* [Playout Gateway](playout-gateway.md) - sends commands and modifies the state of devices in your Control Room and Studio: video servers, mixers, LED screens, lighting controllers & graphics systems
* [Package Manager](../installing-package-manager.md) - checks if media required for a successful production is where it should be, produces proxy versions for preview inside of Rundown View, does quality control of the media and provides feedback to the Blueprints and the User
* [Input Gateway](input-gateway.md) - receives signals from and provides support for *Human Interface Devices* devices such as Stream Decks, Skaarhoj panels and MIDI devices
* Live Status Gateway - provides support for external services that would like to know about the state of a Studio in Sofie, incl. currently playing Parts and Pieces, available AdLibs, etc.

### Rundown & Newsroom Gateways

* [Google Spreadsheet Gateway](rundown-or-newsroom-system-connection/google-spreadsheet.md) - supports creating Rundowns inside of Google Spreadsheet cloud service
* [iNEWS Gateway](rundown-or-newsroom-system-connection/inews-gateway.md) - integrates with Avid iNEWS via FTP
* [MOS Gateway](rundown-or-newsroom-system-connection/mos-gateway.md) - integrates with MOS-compatible NRCS systems (AP ENPS, CGI OpenMedia, Octopus Newsroom, Saga, among others)
* [Rundown Editor](../rundown-editor.md) - a minimal, self-contained Rundown creation utility

