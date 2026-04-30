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

	export function getExpectedEnd(timing: RundownPlaylistTiming, startedPlayback?: number): number | undefined {
		if (PlaylistTiming.isPlaylistTimingBackTime(timing)) {
			return timing.expectedEnd
		} else if (PlaylistTiming.isPlaylistTimingForwardTime(timing)) {
			return (
				timing.expectedEnd ||
				(timing.expectedDuration ? timing.expectedStart + timing.expectedDuration : undefined)
			)
		} else if (PlaylistTiming.isPlaylistDurationTimed(timing)) {
			if (!startedPlayback) {
				// before the show, estimate the end from start + dur
				return timing.expectedStart ? timing.expectedStart + timing.expectedDuration : undefined
			} else {
				// after starting the show, project the end from startedPlayback + dur
				return startedPlayback + timing.expectedDuration
			}
		} else {
			return undefined
		}
	}

	export function getExpectedDuration(timing: RundownPlaylistTiming): number | undefined {
		if (PlaylistTiming.isPlaylistTimingForwardTime(timing)) {
			return timing.expectedDuration
		} else if (PlaylistTiming.isPlaylistTimingBackTime(timing)) {
			return timing.expectedDuration
		} else {
			return undefined
		}
	}

	export function getEstimatedEnd(
		timing: RundownPlaylistTiming,
		now: number,
		remainingPlaylistDuration?: number,
		startedPlayback?: number
	): number | undefined {
		if (remainingPlaylistDuration !== undefined) {
			const frontAnchor = startedPlayback ? now : Math.max(now, PlaylistTiming.getExpectedStart(timing) ?? now)

			return frontAnchor + remainingPlaylistDuration
		}
		return undefined
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
