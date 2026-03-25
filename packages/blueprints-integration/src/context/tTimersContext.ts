export type IPlaylistTTimerIndex = 1 | 2 | 3

export type RundownTTimerMode = RundownTTimerModeFreeRun | RundownTTimerModeCountdown | RundownTTimerModeTimeOfDay

export interface RundownTTimerModeFreeRun {
	readonly type: 'freeRun'
}
export interface RundownTTimerModeCountdown {
	readonly type: 'countdown'
	/**
	 * The original duration of the countdown in milliseconds, so that we know what value to reset to
	 */
	readonly duration: number

	/**
	 * If the countdown should stop at zero, or continue into negative values
	 */
	readonly stopAtZero: boolean
}
export interface RundownTTimerModeTimeOfDay {
	readonly type: 'timeOfDay'

	/**
	 * The raw target string of the timer, as provided when setting the timer
	 * (e.g. "14:30", "2023-12-31T23:59:59Z", or a timestamp number)
	 */
	readonly targetRaw: string | number

	/**
	 * If the countdown should stop at zero, or continue into negative values
	 */
	readonly stopAtZero: boolean
}

/**
 * Timing state for a timer, optimized for efficient client rendering.
 * When running, the client calculates current time from zeroTime.
 * When paused, the duration is frozen and sent directly.
 * pauseTime indicates when the timer should automatically pause (when current part ends and overrun begins).
 *
 * Client rendering logic:
 * ```typescript
 * if (state.paused === true) {
 *   // Manually paused by user or already pushing/overrun
 *   duration = state.duration
 * } else if (state.pauseTime && now >= state.pauseTime) {
 *   // Auto-pause at overrun (current part ended)
 *   duration = state.zeroTime - state.pauseTime
 * } else {
 *   // Running normally
 *   duration = state.zeroTime - now
 * }
 * ```
 */
export type TimerState =
	| {
			/** Whether the timer is paused */
			paused: false
			/** The absolute timestamp (ms) when the timer reaches/reached zero */
			zeroTime: number
			/** Optional timestamp when the timer should pause (when current part ends) */
			pauseTime?: number | null
	  }
	| {
			/** Whether the timer is paused */
			paused: true
			/** The frozen duration value in milliseconds */
			duration: number
			/** Optional timestamp when the timer should pause (null when already paused/pushing) */
			pauseTime?: number | null
	  }

export interface ITTimersContext {
	/**
	 * Get a T-timer by its index
	 * Note: Index is 1-based (1, 2, 3)
	 * @param index Number of the timer to retrieve
	 */
	getTimer(index: IPlaylistTTimerIndex): IPlaylistTTimer

	/**
	 * Clear all T-timers
	 */
	clearAllTimers(): void
}

export interface IPlaylistTTimer {
	readonly index: IPlaylistTTimerIndex

	/** The label of the T-timer */
	readonly label: string

	/**
	 * The current mode of the T-timer
	 * Null if the T-timer is not initialized
	 * This defines how the timer behaves
	 */
	readonly mode: RundownTTimerMode | null

	/**
	 * The current state of the T-timer
	 * Null if the T-timer is not initialized
	 * This contains the timing information needed to calculate the current time of the timer
	 */
	readonly state: TimerState | null

	/** Set the label of the T-timer */
	setLabel(label: string): void

	/** Clear the T-timer back to an uninitialized state */
	clearTimer(): void

	/**
	 * Start a countdown timer
	 * @param duration Duration of the countdown in milliseconds
	 * @param options Options for the countdown
	 */
	startCountdown(duration: number, options?: { stopAtZero?: boolean; startPaused?: boolean }): void

	/**
	 * Start a timeOfDay timer, counting towards the target time
	 * This will throw if it is unable to parse the target time
	 * @param targetTime The target time, as a string (e.g. "14:30", "2023-12-31T23:59:59Z") or a timestamp number
	 */
	startTimeOfDay(targetTime: string | number, options?: { stopAtZero?: boolean }): void

	/**
	 * Start a free-running timer
	 */
	startFreeRun(options?: { startPaused?: boolean }): void

	/**
	 * If the current mode supports being paused, pause the timer
	 * Note: This is supported by the countdown and freerun modes
	 * @returns True if the timer was paused, false if it could not be paused
	 */
	pause(): boolean

	/**
	 * If the current mode supports being paused, resume the timer
	 * This is the opposite of `pause()`
	 * @returns True if the timer was resumed, false if it could not be resumed
	 */
	resume(): boolean

	/**
	 * If the timer can be restarted, restore it to its initial/restarted state
	 * Note: This is supported by the countdown and timeOfDay modes
	 * @returns True if the timer was restarted, false if it could not be restarted
	 */
	restart(): boolean

	/**
	 * Set the duration of a countdown timer
	 * This resets both the original duration (what restart() resets to) and the current countdown value.
	 * @param duration New duration in milliseconds
	 * @throws If timer is not in countdown mode or not initialized
	 */
	setDuration(duration: number): void

	/**
	 * Update the original duration (reset-to value) and/or current duration of a countdown timer
	 * This allows you to independently update:
	 * - `original`: The duration the timer resets to when restart() is called
	 * - `current`: The current countdown value (what's displayed now)
	 *
	 * If only `original` is provided, the current duration is recalculated to preserve elapsed time.
	 * If only `current` is provided, just the current countdown is updated.
	 * If both are provided, both values are updated independently.
	 *
	 * @param options Object with optional `original` and/or `current` duration in milliseconds
	 * @throws If timer is not in countdown mode or not initialized
	 */
	setDuration(options: { original?: number; current?: number }): void

	/**
	 * Clear any projection (manual or anchor-based) for this timer
	 * This removes both manual projections set via setProjectedTime/setProjectedDuration
	 * and automatic projections based on anchor parts set via setProjectedAnchorPart.
	 */
	clearProjected(): void

	/**
	 * Set the anchor part for automatic projection calculation
	 * When set, the server automatically calculates when we expect to reach this part
	 * based on remaining part durations, and updates the projection accordingly.
	 * Clears any manual projection set via setProjectedTime/setProjectedDuration.
	 * @param partId The ID of the part to use as timing anchor
	 */
	setProjectedAnchorPart(partId: string): void

	/**
	 * Set the anchor part for automatic projection calculation, looked up by its externalId.
	 * This is a convenience method when you know the externalId of the part (e.g. set during ingest)
	 * but not its internal PartId. If no part with the given externalId is found, this is a no-op.
	 * Clears any manual projection set via setProjectedTime/setProjectedDuration.
	 * @param externalId The externalId of the part to use as timing anchor
	 */
	setProjectedAnchorPartByExternalId(externalId: string): void

	/**
	 * Manually set the projection as an absolute timestamp
	 * Use this when you have custom logic for calculating when you expect to reach a timing point.
	 * Clears any anchor part set via setAnchorPart.
	 * @param time Unix timestamp (milliseconds) when we expect to reach the timing point
	 * @param paused If true, we're currently delayed/pushing (projection won't update with time passing).
	 *               If false (default), we're progressing normally (projection counts down in real-time).
	 */
	setProjectedTime(time: number, paused?: boolean): void

	/**
	 * Manually set the projection as a relative duration from now
	 * Use this when you want to express the projection as "X milliseconds from now".
	 * Clears any anchor part set via setAnchorPart.
	 * @param duration Milliseconds until we expect to reach the timing point
	 * @param paused If true, we're currently delayed/pushing (projection won't update with time passing).
	 *               If false (default), we're progressing normally (projection counts down in real-time).
	 */
	setProjectedDuration(duration: number, paused?: boolean): void

	/**
	 * Get the current duration of the timer in milliseconds
	 * For countdown timers, this returns how much time is remaining (can be negative if past zero)
	 * For timeOfDay timers, this returns time until/since the target time
	 * For freeRun timers, this returns how much time has elapsed
	 * @returns Current duration in milliseconds, or null if timer is not initialized
	 */
	getDuration(): number | null

	/**
	 * Get the zero time (reference point) for the timer
	 * - For countdown/timeOfDay timers: the absolute timestamp when the timer reaches zero
	 * - For freeRun timers: the absolute timestamp when the timer started (what it counts from)
	 * For paused timers, calculates when zero would be if resumed now.
	 * @returns Unix timestamp in milliseconds, or null if timer is not initialized
	 */
	getZeroTime(): number | null

	/**
	 * Get the projected duration in milliseconds
	 * This returns the projected timer value when we expect to reach the anchor part.
	 * Used to calculate over/under (how far ahead or behind schedule we are).
	 * @returns Projected duration in milliseconds, or null if no projection is set
	 */
	getProjectedDuration(): number | null

	/**
	 * Get the projected zero time (reference point)
	 * This returns when we project the timer will reach zero based on scheduled durations.
	 * For paused projections (when pushing/delayed), calculates when zero would be if resumed now.
	 * @returns Unix timestamp in milliseconds, or null if no projection is set
	 */
	getProjectedZeroTime(): number | null
}
