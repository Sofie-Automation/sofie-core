/**
 * A GENERAL COMMENT ON THIS MODULE
 * ==
 *
 * During the lifecycle of a Rundown, it, along with all of it's Parts & PartInstances undergoes thousands of mutations
 * on it's timing properties. Because of that, it's very difficult to accurately simulate what's going on in one for the
 * purposes of automated testing. It also means that debugging any bugs here is very time consuming and difficult.
 *
 * Please be very cautious when introducing changes here and make sure to try and exhaustively explain any changes made
 * here by answering both How and Why of a particular change, since it may not be clearly evident to the next person,
 * without knowing what particular case you are trying to solve.
 */

import {
	PlaylistTimingBackTime,
	PlaylistTimingDuration,
	PlaylistTimingForwardTime,
	PlaylistTimingNone,
	PlaylistTimingType,
	RundownPlaylistTiming,
} from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { TimerState, timerStateToDuration, timerStateToZeroTime } from '../dataModel/TimerState.js'

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace PlaylistTiming {
	export function isPlaylistTimingNone(timing: RundownPlaylistTiming): timing is PlaylistTimingNone {
		return timing.type === PlaylistTimingType.None
	}

	export function isPlaylistTimingForwardTime(timing: RundownPlaylistTiming): timing is PlaylistTimingForwardTime {
		return timing.type === PlaylistTimingType.ForwardTime
	}

	export function isPlaylistTimingBackTime(timing: RundownPlaylistTiming): timing is PlaylistTimingBackTime {
		return timing.type === PlaylistTimingType.BackTime
	}

	export function isPlaylistDurationTimed(timing: RundownPlaylistTiming): timing is PlaylistTimingDuration {
		return timing.type === PlaylistTimingType.Duration
	}

	export function getExpectedStart(timing: RundownPlaylistTiming): number | undefined {
		if (PlaylistTiming.isPlaylistTimingForwardTime(timing)) {
			return timing.expectedStart
		} else if (PlaylistTiming.isPlaylistTimingBackTime(timing)) {
			return (
				timing.expectedStart ||
				(timing.expectedDuration ? timing.expectedEnd - timing.expectedDuration : undefined)
			)
		} else if (PlaylistTiming.isPlaylistDurationTimed(timing)) {
			return timing.expectedStart
		} else {
			return undefined
		}
	}

	export function getExpectedEnd(timing: RundownPlaylistTiming): number | undefined {
		if (PlaylistTiming.isPlaylistTimingBackTime(timing)) {
			return timing.expectedEnd
		} else if (PlaylistTiming.isPlaylistTimingForwardTime(timing)) {
			return (
				timing.expectedEnd ||
				(timing.expectedDuration ? timing.expectedStart + timing.expectedDuration : undefined)
			)
		} else if (PlaylistTiming.isPlaylistDurationTimed(timing)) {
			return timing.expectedStart && timing.expectedDuration
				? timing.expectedStart + timing.expectedDuration
				: undefined
		} else {
			return undefined
		}
	}

	export function getExpectedDuration(timing: RundownPlaylistTiming): number | undefined {
		return timing.expectedDuration
	}

	/**
	 * The estimated end of the playlist, as a TimerState (read via `timerStateToZeroTime`).
	 * This is THE implementation of the estimated end; `getEstimatedEnd` is its evaluation at `now`.
	 *
	 * @param contentRemainingState The remaining content duration of the playlist as a TimerState
	 * (e.g. `RundownTimingContext.remainingPlaylistDurationState`)
	 * @param startedPlayback When the playlist started playing (if active)
	 */
	export function getEstimatedEndState(
		timing: RundownPlaylistTiming,
		now: number,
		contentRemainingState: TimerState | undefined,
		startedPlayback?: number
	): TimerState | undefined {
		if (PlaylistTiming.isPlaylistDurationTimed(timing) && timing.expectedDuration) {
			if (startedPlayback) {
				return { paused: false, zeroTime: startedPlayback + timing.expectedDuration }
			} else if (timing.expectedStart) {
				return { paused: false, zeroTime: timing.expectedStart + timing.expectedDuration }
			}
		}

		if (contentRemainingState === undefined) return undefined

		// The remaining duration counts down while the on-air Part (or the on-air segment's budget) runs
		// within its planned length, and then now + remaining holds. That can be so before the playlist
		// has started too: from the first take until the start of its Part is reported, when the take
		// plans that start (a take in a multi-gateway studio schedules it a little ahead, and a take with
		// a time offset plans it in the past), and while an untimed opening Part plays in a segment with a
		// budget.
		const remainingIsCountingDown = !contentRemainingState.paused

		if (startedPlayback || remainingIsCountingDown) {
			// estimatedEnd = now + remaining: this is exactly the remaining-duration state read
			// through timerStateToZeroTime (fixed while remaining counts down, pushing 1:1 with
			// time once remaining freezes)
			return contentRemainingState
		}

		// Not started: estimatedEnd = max(now, expectedStart ?? now) + remaining
		// (remaining is constant while nothing counts it down)
		const remaining = timerStateToDuration(contentRemainingState, now)
		const expectedStart = PlaylistTiming.getExpectedStart(timing)
		if (expectedStart !== undefined && expectedStart > now) {
			// Fixed at expectedStart + remaining until the planned start passes, then pushes
			return { paused: false, zeroTime: expectedStart + remaining, pauseTime: expectedStart }
		}
		// Planned start already passed (or none): estimatedEnd = now + remaining, pushing 1:1
		return { paused: true, duration: remaining }
	}

	export function getEstimatedEnd(
		timing: RundownPlaylistTiming,
		now: number,
		remainingPlaylistDuration?: number,
		startedPlayback?: number
	): number | undefined {
		const state = PlaylistTiming.getEstimatedEndState(
			timing,
			now,
			remainingPlaylistDuration !== undefined ? { paused: true, duration: remainingPlaylistDuration } : undefined,
			startedPlayback
		)
		return state ? timerStateToZeroTime(state, now) : undefined
	}

	/**
	 * The remaining duration of the playlist, as a TimerState (read via `timerStateToDuration`).
	 * This is THE implementation of the remaining duration; `getRemainingDuration` is its
	 * evaluation at `now`.
	 *
	 * @param contentRemainingState The remaining content duration of the playlist as a TimerState
	 * (e.g. `RundownTimingContext.remainingPlaylistDurationState`)
	 * @param startedPlayback When the playlist started playing (if active)
	 */
	export function getRemainingDurationState(
		timing: RundownPlaylistTiming,
		contentRemainingState: TimerState | undefined,
		startedPlayback?: number
	): TimerState | undefined {
		if (PlaylistTiming.isPlaylistDurationTimed(timing) && timing.expectedDuration) {
			if (startedPlayback) {
				// Counts down to startedPlayback + expectedDuration (and into negative when over)
				return { paused: false, zeroTime: startedPlayback + timing.expectedDuration }
			} else {
				return { paused: true, duration: timing.expectedDuration }
			}
		}

		return contentRemainingState
	}

	export function getRemainingDuration(
		timing: RundownPlaylistTiming,
		now: number,
		remainingPlaylistDuration?: number,
		startedPlayback?: number
	): number | undefined {
		const state = PlaylistTiming.getRemainingDurationState(
			timing,
			remainingPlaylistDuration !== undefined ? { paused: true, duration: remainingPlaylistDuration } : undefined,
			startedPlayback
		)
		return state ? timerStateToDuration(state, now) : undefined
	}

	export function sortTimings(
		a: ReadonlyDeep<{ timing: RundownPlaylistTiming }>,
		b: ReadonlyDeep<{ timing: RundownPlaylistTiming }>
	): number {
		// Compare start times, then allow rundowns with start time to be first
		if (
			PlaylistTiming.isPlaylistTimingForwardTime(a.timing) &&
			PlaylistTiming.isPlaylistTimingForwardTime(b.timing)
		)
			return a.timing.expectedStart - b.timing.expectedStart
		if (PlaylistTiming.isPlaylistTimingForwardTime(a.timing)) return -1
		if (PlaylistTiming.isPlaylistTimingForwardTime(b.timing)) return 1

		// Compare end times, then allow rundowns with end time to be first
		if (PlaylistTiming.isPlaylistTimingBackTime(a.timing) && PlaylistTiming.isPlaylistTimingBackTime(b.timing))
			return a.timing.expectedEnd - b.timing.expectedEnd
		if (PlaylistTiming.isPlaylistTimingBackTime(a.timing)) return -1
		if (PlaylistTiming.isPlaylistTimingBackTime(b.timing)) return 1

		// No timing
		return 0
	}
}
