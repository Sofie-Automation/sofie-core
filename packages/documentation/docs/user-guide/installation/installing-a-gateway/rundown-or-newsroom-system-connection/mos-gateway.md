# MOS Gateway

The MOS Gateway communicates with a device that supports the [MOS protocol](http://mosprotocol.com/wp-content/MOS-Protocol-Documents/MOS-Protocol-2.8.4-Current.htm) to ingest and remain in sync with a rundown. It can connect to any editorial system \(NRCS\) that uses version 2.8.4 of the MOS protocol, such as ENPS, and sync their rundowns with the _Sofie&nbsp;Core_. The rundowns are kept updated in real time and any changes made will be seen in the Sofie GUI.

The setup for the MOS Gateway is handled in the Docker Compose in the [Quick Install](../../installing-sofie-server-core.md) page.

An example setup for the MOS Gateway is included in the example Docker Compose file found in the [Quick install](../../installing-sofie-server-core.md) with the `mos-gateway` profile.

You can activate the profile by setting `COMPOSE_PROFILES=mos-gateway` as an environment variable or by writing that to a file called `.env` in the same folder as the docker-compose file. For more information, see the [docker documentation on Compose profiles](https://docs.docker.com/compose/how-tos/profiles/).

Development of the MOS gateway is done as a package in the [sofie-core repository on GitHub](https://github.com/nrkno/sofie-core/tree/master/packages/mos-gateway).

One thing to note if managing the mos-gateway manually: It needs a few ports open \(10540, 10541\) for MOS-messages to be pushed to it from the NCS.

## Status Reporting

:::warning
Behaviour of this has changed In R53 as part of expanding the reporting ability.  
If you were using this prior to that change, you can restore previous behaviour by enabling `Write Statuses to NRCS` and `Only send PLAY statuses` in the MOS gateway settings.
:::

Sofie is able to report statuses back to stories and objects in the NRCS. It does this by having the blueprints define some properties on the Part during ingest, and the mos-gateway to consolidate this and send messages.

:::tip
This functionality requires blueprints which set some properties to enable the various states and behaviours. You can read more about that in the [developer guide](../../../../for-developers/for-blueprint-developers/mos-statuses.md)
:::

### Gateway settings

- `Write Statuses to NRCS` - This is the core setting that must be enabled for any statuses to be checked or sent.
- `Send when in Rehearsal mode` - By default statuses are not reported when in rehearsal mode.
- `Only send PLAY statuses` - In some environments it can be desirable to only send `PLAY` messages and not `STOP`. Enabling this will stop Sofie from sending anything other than `PLAY`
