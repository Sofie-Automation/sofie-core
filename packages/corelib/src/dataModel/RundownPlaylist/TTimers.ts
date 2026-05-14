import { PartId } from '../Ids.js'

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

/**
 * Calculate the current duration for a timer state.
 * Handles paused, auto-pause (pauseTime), and running states.
 *
 * @param state The timer state
 * @param now Current timestamp in milliseconds
 * @returns The current duration in milliseconds
 */
export function timerStateToDuration(state: TimerState, now: number): number {
	if (state.paused) {
		// Manually paused by user or already pushing/overrun
		return state.duration
	} else if (state.pauseTime != null && now >= state.pauseTime) {
		// Auto-pause at overrun (current part ended)
		return state.zeroTime - state.pauseTime
	} else {
		// Running normally
		return state.zeroTime - now
	}
}

/**
 * Get the zero time (reference timestamp) for a timer state.
 * - For countdown/timeOfDay timers: when the timer reaches zero
 * - For freeRun timers: when the timer started (what it counts from)
 * For paused timers, calculates when zero would be if resumed now.
 *
 * @param state The timer state
 * @param now Current timestamp in milliseconds
 * @returns The zero time timestamp in milliseconds
 */
export function timerStateToZeroTime(state: TimerState, now: number): number {
	if (state.paused) {
		// Calculate when zero would be if we resumed now
		return now + state.duration
	} else if (state.pauseTime && now >= state.pauseTime) {
		// Auto-pause at overrun (current part ended)
		return state.zeroTime - state.pauseTime + now
	} else {
		// Already have the zero time
		return state.zeroTime
	}
}

export type RundownTTimerIndex = 1 | 2 | 3

export function isRundownTTimerIndex(index: unknown): index is RundownTTimerIndex {
	return typeof index === 'number' && (index === 1 || index === 2 || index === 3)
}

export interface RundownTTimer {
	readonly index: RundownTTimerIndex

	/** A label for the timer */
	label: string

	/** The current mode of the timer, or null if not configured
	 *
	 * This defines how the timer behaves
	 */
	mode: RundownTTimerMode | null

	/** The current state of the timer, or null if not configured
	 *
	 * This contains the information needed to calculate the current time of the timer
	 */
	state: TimerState | null

	/** The projected time when we expect to reach the anchor part, for calculating over/under diff.
	 *
	 * Based on scheduled durations of remaining parts and segments up to the anchor.
	 * The over/under diff is calculated as the difference between this projection and the timer's target (state.zeroTime).
	 *
	 * Running means we are progressing towards the anchor (projection moves with real time)
	 * Paused means we are pushing (e.g. overrunning the current segment, so the anchor is being delayed)
	 *
	 * Calculated automatically when anchorPartId is set, or can be set manually by a blueprint if custom logic is needed.
	 */
	projectedState?: TimerState

	/** The target Part that this timer is counting towards (the "timing anchor")
	 *
	 * This is typically a "break" part or other milestone in the rundown.
	 * When set, the server calculates projectedState based on when we expect to reach this part.
	 * If not set, projectedState is not calculated automatically but can still be set manually by a blueprint.
	 */
	anchorPartId?: PartId

	/*
	 * Future ideas:
	 * allowUiControl: boolean
	 * display: { ... } // some kind of options for how to display in the ui
	 */
}
