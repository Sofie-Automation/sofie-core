/**
 * A subscription to a single named event on a TSR playout device.
 *
 * Typed loosely (plain `string` fields) so that shared-lib does not depend on blueprints-integration or TSR.
 */
export interface PeripheralDeviceExternalTSREventSubscription {
	type: 'tsr'
	/** The id of the playout device, e.g. `'atem0'` */
	deviceId: string
	/**
	 * The type of the playout device, e.g. `'ATEM'`.
	 * Typed as `string` rather than `TSR.DeviceType` to accommodate custom plugin device types.
	 */
	deviceType: string
	/** The event key, e.g. `'me.0.programInput'` */
	event: string
}

/**
 * A subscription to an external device event, as declared by a blueprint.
 *
 * This is the shared-lib mirror of `BlueprintExternalEventSubscription`.
 */
export type PeripheralDeviceExternalEventSubscription = PeripheralDeviceExternalTSREventSubscription

/**
 * A TSR device state event as reported over the wire from a gateway.
 *
 * Extends the subscription type by adding the event payload.
 * `deviceType` is a plain `string` rather than `TSR.DeviceType` because TSR plugins can define
 * custom device types, and shared-lib deliberately avoids a hard dependency on TSR types.
 */
export interface PeripheralDeviceExternalTSREvent extends PeripheralDeviceExternalTSREventSubscription {
	/** The event payload. Opaque on the wire; cast to the appropriate type in the job-worker. */
	payload: unknown
}

/**
 * An external event received from a gateway over the DDP wire.
 *
 * This is a discriminated union so that additional event sources can be added in future
 * without breaking existing consumers.
 */
export type PeripheralDeviceExternalEvent = PeripheralDeviceExternalTSREvent
