# Options and mappings

For an end user to configure the system from the Sofie UI we have to expose options and mappings from the TSR. This is done through [JSON config schemas](../json-config-schema.html) in the `$schemas` folder of your integration.

## Options

Options are for any configuration the user needs to make for your device integration to work well. Things like IP addresses and ports go here.

## Mappings

A mappings is essentially an addresses into the device you are integrating with. For example, a mapping for CasparCG contains a channel and a layer. And a mapping for an Atem can be a mix effect or a downstream keyer. It is entirely possible for the user to define 2 mappings pointing to the same bit of hardware so keep that in mind while writing your integration. The granularity of the mappings influences both how you write your device as well as the shape of the timeline objects. If, for example, we had not included the layer number in the CasparCG mapping, we would have had to define this separately on every timeline object.