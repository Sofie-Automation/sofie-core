# MOS Gateway

The MOS Gateway communicates with a device that supports the [MOS protocol](http://mosprotocol.com/wp-content/MOS-Protocol-Documents/MOS-Protocol-2.8.4-Current.htm) to ingest and remain in sync with a rundown. It can connect to any editorial system \(NRCS\) that uses version 2.8.4 of the MOS protocol, such as ENPS, and sync their rundowns with the _Sofie&nbsp;Core_. The rundowns are kept updated in real time and any changes made will be seen in the Sofie GUI.

MOS 2.8.4 uses TCP Sockets to send XML messages between the NRCS and the Automation Systems. This is done via two open ports on the Automation System side (the *upper* and *lower* port) and two ports on the NRCS side (*upper* and *lower* as well).

The setup for the MOS Gateway is handled in the Docker Compose in the [Quick Install](../../quick-install.md) page. Remove the _\#_ symbols from the start of the section labelled `mos-gateway:` and make sure that other ingest gateway sections have a _\#_ prefix.

You will also need to configure your NRCS to connect to Sofie. Refer to your NRCS's documentation on how that needs to be done.

After the Gateway is deployed, you will need to assign it to a Studio and you will need to go into *Settings* 🡒 *Studios* 🡒 *Your studio name* -> *Peripheral Devices* 🡒 *MOS gateway* 🡒 Edit and configure the MOS ID that this Gateway will use when talking to the NRCS. This needs to match the configuration within your NRCS.

Then, in the *Ingest Devices* section of the *Peripheral Devices* page, use the **+** button to add a new *MOS device*. In *Peripheral Device ID* select *MOS gateway* and in *Device Type* select *MOS Device*. You will then be able to provide the MOS ID of your Primary and Secondary NRCS servers and enter their Hostname/IP Address and Upper and Lower Port information.

:::warning
One thing to note if managing the `mos-gateway` manually: It needs a few ports open \(10540, 10541 by default\) for MOS-messages to be pushed to it from the NRCS. If the defaults are changed in Peripheral Device settings, this needs to be reflected by Docker configuration changes.
:::


