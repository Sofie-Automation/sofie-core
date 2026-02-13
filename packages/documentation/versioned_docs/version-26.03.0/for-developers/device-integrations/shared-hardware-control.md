# TSR Shared Hardware Control

TSR (Timeline State Resolver) in Sofie Core is responsible for translating state changes into device commands. Normally, TSR assumes full control over the devices it manages — meaning the device should always be in the expected "State A" before transitioning to "State B." However, in real-world integrations, devices are sometimes externally controlled or adjusted. This documentation describes how a TSR integration can be implemented to detect and reconcile external device changes using the Shared Hardware Control mechanism.

## Overview

TSR’s command generation is based on timeline state diffs. To transition a device from State A to State B, TSR generates commands based on the difference between these two states. If the device is not currently in State A (e.g., due to external control), then TSR’s assumptions break — leading to incorrect command generation.

To support external control while maintaining robustness, we introduce the concept of **tracked address states**. These allow TSR to be aware of and react to externally-triggered changes on a per-address basis.

## Principles of Address States

Address states represent granular, trackable substates for specific device control addresses (e.g., a channel on an audio mixer, a switcher’s ME state). Each address state is tracked in 2 ways:

- **Internal State:** by TSR’s own understanding of what the state should be
- **External State:** via state feedback from the device

This dual tracking allows TSR to understand when a device has been manipulated outside of its control.

## Detecting External Changes

To detect that a device is no longer in the timeline-driven state, you can enable external state tracking in your integration implementation.

The process includes:

1. **Receiving External State Updates:**
   Your integration should listen for incoming updates from the device via its native protocol (e.g., TCP, UDP, HTTP API).

2. **Tracking Updated Address States:**
   Use the `setAddressState` method on the integration context to notify TSR of updated state for specific addresses.

3. **Marking the Address as ahead:**
   After a small debounce time the TSR will call the `diffAddressStates` method on your integration implementation to establish whether the updated External State is different from the Internal State. If it is, then the address will be marked as being ahead of the timeline.

The TSR will take care of tracking the Internal state and modifying the states when necessary through the `applyAddressState` method on your integration implementation.

## When to Reassert Control

Reasserting control means allowing TSR to override the current state of the device to bring it back in line with the timeline. Whether and when to do this is integration-specific, and the system is designed to allow flexible control.

Your integration should implement the `addressStateReassertsControl` method to signal when this happens.

Common use cases include:

- A new timeline object has begun
- The user explicitly re-enables timeline control

## Implementation

A few things need to be added to an existing integration to enable the Shared Hardware Control mechanism:

1. Adjust the `convertTimelineStateToDeviceState` to output Address States
      - Part of this step is to make a design choice in the granularity of your Address States
      - The addresses you return for each Address State must be unique to that Address State and you must be able to connect them with updates you receive from the device
      - The Address State must include the values you want to use to establish when control should be reasserted
2. Process updates from the external device
      - After receiving an update from a device it has to be converted into Address States and Addresses
      - Call `this.context.setAddressState` for each updated Address State
3. Implement `addressStateReassertsControl` method
      - Your implementation will be given an old address state and a new one, it is up to you to tell the TSR whether this change in address state implies that control should be reasserted.
4. Implement `diffAddressStates` method
      - Your implementation must be able to take in 2 Address States and return a boolean value `true` if the 2 Address States are different and `false` if they are equivalent.
5. Implement `applyAddressState` method
      - In this method you should copy the contents from an Address State onto the Device State output of your `convertTimelineStateToDeviceState` implementation

## Notes

The Shared Hardware Control system is opt-in. If your device does not need to support external control, the standard TSR behavior will remain unaffected. In addition, there is a user setting to override the Shared Hardware Control feature.
