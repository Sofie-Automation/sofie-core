---
sidebar_label: Introduction
sidebar_position: 1
---
# Introduction: Installing a Gateway

#### Prerequisites

* [Installed and running Sofie&nbsp;Core](../installing-sofie-server-core.md)

The _Sofie&nbsp;Core_ is the primary application for managing the broadcast, but it doesn't play anything out on it's own. A Gateway will establish the connection from _Sofie&nbsp;Core_ to other pieces of hardware or remote software. A basic setup may include the [Spreadsheet Gateway](rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support.md) which will ingest a rundown from Google Sheets then, use the [Playout Gateway](playout-gateway.md) send commands to a CasparCG&nbsp;Server graphics playout, an ATEM vision mixer, and / or the [Sisyfos audio controller](https://github.com/olzzon/sisyfos-audio-controller).

Installing a gateway is a two part process. To begin, you will [add the required Blueprints](../installing-blueprints.md), or mini plug-in programs, to _Sofie&nbsp;Core_ so it can manipulate the data from the Gateway. Then you will install the Gateway itself. Each Gateway follows a similar installation pattern but, each one does differ slightly. The links below will help you navigate to the correct Gateway for the piece of hardware / software you are using.

### Rundown & Newsroom Gateways

* [Google Spreadsheet Gateway](rundown-or-newsroom-system-connection/installing-sofie-with-google-spreadsheet-support.md)
* [iNEWS Gateway](rundown-or-newsroom-system-connection/inews-gateway.md)
* [MOS Gateway](rundown-or-newsroom-system-connection/mos-gateway.md)

### Playout & Media Manager Gateways

* [Playout Gateway](playout-gateway.md)
* [Media Manager](../media-manager.md)

