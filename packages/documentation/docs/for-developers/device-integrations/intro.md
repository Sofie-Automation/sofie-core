# Introduction

Device integrations in Sofie are part of the Timeline State Resolver (TSR) library. A device integration has a couple of responsibilities in the Sofie eco system. First and foremost it should establish a connection with a foreign device. It should also be able to convert Sofie's idea of what the device should be doing into commands to control the device. And lastly it should export interfaces to be used by the blueprints developer.

In order to understand all about writing TSR integrations there are some concepts to familiarise yourself with, in this documentation we will attempt to explain these.

- [Options and mappings](./options-and-mappings.html)
- [TSR Integration API](./tsr-api.html)
- [TSR Types package](./tsr-types.html)
- [TSR Actions](./tsr-actions.html)

But to start off we will explain the general structure of the TSR. Any user of the TSR will interface primarily with the Conductor class. Primarily the user will input device configurations, mappings and timelines into the TSR. The timeline describes the entire state of all of the devices over time. It does this by putting objects on timeline layers. Every timeline layer maps to a specific part of the device, this is configured through the mappings.

The timeline is converted into disctinct states at different points in time, and these states are fed to the individual integrations. As an integration developer you shouldn't have to worry about keeping track of this. It is most important that you expose \(a\) a method to convert from a Timeline State to a Device State, \(b\) a method for diffing 2 device states and \(c\) a way to send commands to the device. We'll dive deeper into this in [TSR Integration API](./tsr-api.html).

:::info
The information in this section is not a conclusive guide on writing an integration, it should be use more as a guide to use while looking at a TSR integration such as the [OSC integration](https://github.com/Sofie-Automation/sofie-timeline-state-resolver/tree/master/packages/timeline-state-resolver/src/integrations/osc).
:::
