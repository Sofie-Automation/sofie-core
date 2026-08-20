import type { TSR } from '@sofie-automation/shared-lib/dist/tsr'

/**
 * A TSR state event, wrapped with a `type` discriminant so it can be distinguished
 * from other future event sources in the {@link BlueprintExternalEvent} union.
 */
export type BlueprintExternalTSREvent = TSR.SomeTSRStateEvent & { type: 'tsr' }

/**
 * An event from an external source, received by the blueprint's {@link onExternalEvent} handler.
 *
 * Currently only TSR state events are supported. This union will be extended in future to cover
 * other event sources
 */
export type BlueprintExternalEvent = BlueprintExternalTSREvent

export type TSREventDeviceType = {
	[K in keyof TSR.TSREventTypesMap]: TSR.TSREventTypesMap[K] extends never ? never : K
}[keyof TSR.TSREventTypesMap]

/** A subscription to a single named event on a TSR playout device */
export type TSRExternalEventSubscription<TDevice extends TSREventDeviceType> = {
	type: 'tsr'
	/** The id of the playout device, e.g. `'atem0'` */
	deviceId: string
	/** The type of the playout device */
	deviceType: TDevice
	/** The event key to subscribe to, e.g. `'me.0.programInput'` */
	event: keyof TSR.TSREventTypesMap[TDevice]
}

/**
 * A subscription to a named event on any TSR playout device.
 *
 * This is a discriminated union over all known device types, so `deviceType` and `event`
 * are always correlated — the compiler will reject an ATEM event key on an Abstract device, etc.
 */
export type BlueprintExternalEventSubscription = {
	[TDevice in TSREventDeviceType]: TSRExternalEventSubscription<TDevice>
}[TSREventDeviceType]
