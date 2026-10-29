export interface TimeEventArgs {
	currentTime: number
}

export type TimingEvent = CustomEvent<TimeEventArgs>

declare global {
	interface WindowEventMap {
		[RundownTiming.Events.timeupdateSynced]: TimingEvent
		[RundownTiming.Events.timeupdateLowResolution]: TimingEvent
		[RundownTiming.Events.timeupdateHighResolution]: TimingEvent
	}
}

export namespace RundownTiming {
	/**
	 * Events used by the RundownTimingProvider
	 * @export
	 * @enum {number}
	 */
	export enum Events {
		/** Event is emitted once a second, to update displays in a synced manner */
		'timeupdateSynced' = 'sofie:rundownTimeUpdateSynced',
		/** Event is emitted every now-and-then, generally to be used for simple displays */
		'timeupdateLowResolution' = 'sofie:rundownTimeUpdateLowResolution',
		/** event is emitted with a very high frequency (60 Hz), to be used sparingly as
		 * hooking up Components to it will cause a lot of renders
		 */
		'timeupdateHighResolution' = 'sofie:rundownTimeUpdateHighResolution',
	}
}

/** How often a component wants to be re-rendered by the timing clock */
export enum TimingTickResolution {
	/** Not re-rendered by the clock at all, for things drawn only from values that hold until something new is published. */
	None = -1,
	/**
	 * Used for things that we want to change in step with the rest of the GUI. A plain read of the clock
	 * (`useTimingNow`) ticks at every full second. A published timing value is drawn again at the
	 * moment its own whole second changes, so values that count from the same moment change together.
	 */
	Synced = 0,
	/** Updated with Low accuracy (ie about 4 times a second - based on LOW_RESOLUTION_TIMING_DECIMATOR). */
	Low = 1,
	/** Updated with high accuracy (ie many times per second), to be used for things like countdowns. */
	High = 2,
}

/** The window event that fires at the requested rate, or undefined if there is none to listen to */
export function rundownTimingEventFromTickResolution(
	tickResolution: TimingTickResolution
): RundownTiming.Events | undefined {
	switch (tickResolution) {
		case TimingTickResolution.None:
			return undefined
		case TimingTickResolution.High:
			return RundownTiming.Events.timeupdateHighResolution
		case TimingTickResolution.Low:
			return RundownTiming.Events.timeupdateLowResolution
		case TimingTickResolution.Synced:
		default:
			return RundownTiming.Events.timeupdateSynced
	}
}
