# TSR Integration API

:::info
As of version 1.50, there still exists a legacy API for device integrations. In this documentation we will only consider the more modern variant informally known as the _StateHandler_ format.
:::

## Setup and status

There are essentially 2 parts to the TSR API, the first thing you need to do is set up a connection with the device you are integrating with. This is done in the `init` method. It takes a parameter with the Device options as specified in the config schema. Additionally a `terminate` call is to be implemented to tear down the connection and prepare any timers to be garbage collected.

Regarding status there are 2 important methods to be implemented, one is a getter for the `connected` status of the integration and the other is `getStatus` which should inform a TSR user of the status of device. You can add messages in this status as well.

## State and commands

The second part is where the bulk of the work happens. First your implementation for `convertTimelineStateToDeviceState` will be called with a Timeline State and the mappings for your integration. You are ought to return a "Device State" here which is an object representing the state of your device as inferred from the Timeline State and mappings. Then the next implementation is  of the `diffStates` method, which will be called with 2 Device States as you've generated them earlier. The purpose of this method is to generate commands such that a state change from Device State A to Device State B can be executed. Hence it is called a "diff". The last important method here is `sendCommand` which will be called with the commands you've generated earlier when the TSR wants to transitition from State A to State B.

Another thing to implement is the `actions` property. You can leave it as an empty object initially or read more about it in [TSR Actions](./tsr-actions.md).

## Logging and emitting events

Logging is done through an event emitter as is described in the DeviceEvents interface. You should also emit an event any time the connection status should change. There is an event you can emit to rerun the resolving process in TSR as well, this will more or less create new Timeline States from the timeline, diff them and see if they should be executed.

## Best practices

 - The `init` method is asynchronous but you should not use it to wait for timeouts in your connection to reject it. Instead the rest of your integration should gracefully deal with a (initially) disconnected device.
 - The result of the `getStatus` method is displayed in the UI of Sofie so try to put helpful information in the messages and only elevate to a "bad" status if something is really wrong, like being fully disconnected from a device.
 - Be aware for side effects in your implementations of `convertTimelineStateToDeviceState` and `diffStates` they are _not_ guaranteed to be chronological and the states changes may never actually be executed.
 - If you need to do any time aware commands (such as seeking in a media file) use the time from the Timeline State to do your calculations for these