---
sidebar_position: 10
---
# Getting Started

_Sofie_ can be installed in many different ways, depending on which platforms, needs, and features you desire. The _Sofie_ system consists of several applications that work together to provide complete broadcast automation system. Each of these components' installation will be covered in this guide. Additional information about the products or services mentioned alongside the Sofie Installation can be found on the [Further Reading](../further-reading.md).

:::tip Quick Install
If you're looking to quickly evaluate Sofie to see if it's a good match for your needs, you can jump into our **[Quick Install guide](./quick-install.md)**.
:::

There are four minimum required components to get a Sofie system up and running. First you need the [_Sofie Core_](quick-install.md), which is the brains of the operation. Then a set of [_Blueprints_](installing-blueprints.md) to handle and interpret incoming and outgoing data. Next, an [_Ingest Gateway_](installing-a-gateway/rundown-or-newsroom-system-connection/intro.md) to fetch the data for the Blueprints. Then finally, a [_Playout Gateway_](installing-a-gateway/playout-gateway.md) to send commands and change the state of your playout devices while you run your show.

## Sofie Core Overview

The _Sofie&nbsp;Core_ is the primary application for managing the broadcast but, it doesn't play anything out on it's own. You need to use Gateways to establish the connection from the _Sofie&nbsp;Core_ to other pieces of hardware or remote software. 

### Gateways

Gateways are separate applications that bridge the gap between the _Sofie&nbsp;Core_ and other pieces of hardware or software services. At a minimum, you will need a _Playout Gateway_ so your timeline can interact with your playout system of choice. To install the _Playout Gateway_, visit the [Installing a Gateway](installing-a-gateway/intro.md) section of this guide and for a more in-depth look, please see [Gateways](../concepts-and-architecture.md#gateways). 

### Blueprints

Blueprints can be described as the logic that determines how a studio and show should interact with one another. They interpret the data coming in from the rundowns and transform them into a rich set of playable elements \(_Segments_, _Parts_, _AdLibs,_ etc.\). The _Sofie&nbsp;Core_ has three main blueprint types, _System Blueprints_, _Studio Blueprints_, and _Showstyle Blueprints_. Installing _Sofie_ does not require you understand what these blueprints do, just that they are required for the _Sofie&nbsp;Core_ to work. If you would like to gain a deeper understanding of how _Blueprints_ work, please visit the [Blueprints](../../for-developers/for-blueprint-developers/intro.md) section.

