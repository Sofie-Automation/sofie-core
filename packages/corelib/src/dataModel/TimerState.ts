/**
 * Timing state for a timer, optimized for efficient client rendering.
 * When running, the client calculates current time from zeroTime.
 * When paused, the duration is frozen and sent directly.
 *
 * Each variant carries the timestamp of its transition into the *other* state, so that a transition
 * whose time is known in advance does not depend on a new state being published at that moment
 * (which would cost accuracy - the value would be stale until the message lands, then jump):
 * - `pauseTime` on a running timer: when it freezes (e.g. when the current part ends and overrun begins)
 * - `resumesAt` on a paused timer: when it starts running (e.g. a scheduled start)
 *
 * The other one is always null/absent, and a state therefore has at most one transition. Anything
 * with further transitions relies on an updated state being published in between; there is a
 * multi-second window to do so in practice, so that is safe.
 *
 * Client rendering logic:
 * ```typescript
 * if (state.paused === true) {
 *   if (state.resumesAt != null && now >= state.resumesAt) {
 *     // Scheduled start has passed, running since then
 *     duration = state.duration - (now - state.resumesAt)
 *   } else {
 *     // Manually paused by user, already pushing/overrun, or waiting for a scheduled start
 *     duration = state.duration
 *   }
 * } else if (state.pauseTime != null && now >= state.pauseTime) {
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
			/** Not applicable while running - a running timer has no scheduled start */
			resumesAt?: null
	  }
	| {
			/** Whether the timer is paused */
			paused: true
			/** The frozen duration value in milliseconds */
			duration: number
			/** Not applicable while paused - a paused timer has already stopped */
			pauseTime?: null
			/** Optional timestamp when the timer should start running, if that is known in advance */
			resumesAt?: number | null
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
		if (state.resumesAt != null && now >= state.resumesAt) {
			// Scheduled start has passed, so it has been running since then
			return state.duration - (now - state.resumesAt)
		}
		// Manually paused by user, already pushing/overrun, or waiting for a scheduled start
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
 * Shift a timer state by a constant amount, giving a state whose duration read is always `offset`
 * greater than the original's, and whose zero time is always `offset` later.
 *
 * This is how a whole family of timers that differ only by a fixed head start is expressed as
 * offsets from a single running one - e.g. the countdown to each upcoming Part, which is that Part's
 * static wait plus the one countdown that is actually ticking. Only the one live state has to be
 * derived; the rest are shifts of it, so they cannot drift apart from it or from each other.
 *
 * The breakpoint (`pauseTime`/`resumesAt`) is deliberately not shifted: it is the moment the timer
 * changes slope, which is the same moment for every member of the family.
 *
 * @param state The timer state to shift
 * @param offset Milliseconds to add to the state's duration
 */
export function offsetTimerState(state: TimerState, offset: number): TimerState {
	if (state.paused) {
		return { ...state, duration: state.duration + offset }
	} else {
		return { ...state, zeroTime: state.zeroTime + offset }
	}
}

/**
 * Get the zero time (reference timestamp) for a timer state.
 * - For countdown/timeOfDay timers: when the timer reaches zero
 * - For freeRun timers: when the timer started (what it counts from)
 * For paused timers, calculates when zero would be if resumed now - unless a scheduled start
 * (`resumesAt`) has already passed, in which case zero is a fixed point measured from it.
 *
 * @param state The timer state
 * @param now Current timestamp in milliseconds
 * @returns The zero time timestamp in milliseconds
 */
export function timerStateToZeroTime(state: TimerState, now: number): number {
	if (state.paused) {
		if (state.resumesAt != null && now >= state.resumesAt) {
			// Scheduled start has passed, so zero is a fixed point measured from it
			return state.resumesAt + state.duration
		}
		// Calculate when zero would be if we resumed now
		return now + state.duration
	} else if (state.pauseTime != null && now >= state.pauseTime) {
		// Auto-pause at overrun (current part ended)
		// (note: `!= null` rather than a truthiness check, so that this agrees with
		// timerStateToDuration for the degenerate pauseTime of 0)
		return state.zeroTime - state.pauseTime + now
	} else {
		// Already have the zero time
		return state.zeroTime
	}
}
