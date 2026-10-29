/**
 * Main's PlaylistTiming, frozen for the comparison with main: a copy of the start of
 * packages/corelib/src/playout/rundownTiming.ts at main d40ae733fefdd831ce614792b65e8434778b2757, up to and
 * including getRemainingDuration, unchanged. The functions after it are left out, and so is the import only they use.
 *
 * The timing publication rewrote getEstimatedEnd and getRemainingDuration on top of timer states. Main's header
 * computed its estimated end and remaining duration with these two functions, so the comparison computes main's
 * values with this copy. To see that it is unchanged:
 *
 *   git diff d40ae733f:packages/corelib/src/playout/rundownTiming.ts \
 *     HEAD:packages/sofie-core/src/publications/playlistTimingState/__tests__/timing/main/playlistTiming.ts
 */

import {
	PlaylistTimingBackTime,
	PlaylistTimingDuration,
	PlaylistTimingForwardTime,
	PlaylistTimingNone,
	PlaylistTimingType,
	RundownPlaylistTiming,
} from '@sofie-automation/blueprints-integration'

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

	export function getEstimatedEnd(
		timing: RundownPlaylistTiming,
		now: number,
		remainingPlaylistDuration?: number,
		startedPlayback?: number
	): number | undefined {
		if (PlaylistTiming.isPlaylistDurationTimed(timing) && timing.expectedDuration) {
			if (startedPlayback) {
				return startedPlayback + timing.expectedDuration
			} else if (timing.expectedStart) {
				return timing.expectedStart + timing.expectedDuration
			}
		}

		if (remainingPlaylistDuration !== undefined) {
			const frontAnchor = startedPlayback ? now : Math.max(now, PlaylistTiming.getExpectedStart(timing) ?? now)

			return frontAnchor + remainingPlaylistDuration
		}
		return undefined
	}

	export function getRemainingDuration(
		timing: RundownPlaylistTiming,
		now: number,
		remainingPlaylistDuration?: number,
		startedPlayback?: number
	): number | undefined {
		if (PlaylistTiming.isPlaylistDurationTimed(timing) && timing.expectedDuration) {
			if (startedPlayback) {
				return startedPlayback + timing.expectedDuration - now
			} else {
				return timing.expectedDuration
			}
		}

		return remainingPlaylistDuration
	}
}
