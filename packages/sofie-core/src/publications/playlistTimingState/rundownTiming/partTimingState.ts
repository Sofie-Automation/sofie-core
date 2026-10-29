/**
 * Assembles the per-part timing values as TimerStates (PartTimingStateDocs).
 *
 * Like the playlist and segment states these are anchors rather than evaluated values, so a consumer
 * keeps them current between recomputes and the server only republishes when playout or ingest state
 * changes.
 *
 * The statics here are the *resolved* durations - the whole fallback cascade
 * (see `resolvePartTimings.ts`) has already been applied, which is the point: a consumer of the
 * publication should never have to reimplement it to arrive at the same numbers the UI shows.
 */

import type { TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import type { PartTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
import type { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { type RundownTimingContext, getPartInstanceTimingId } from './index'
import type { CalculateTimingsPartInstance } from './resolvePartTimings'

/** The timing value fields of a PartTimingStateDoc (without the document envelope) */
export type PartTimingStateValues = Omit<
	PartTimingStateDoc,
	'_id' | 'type' | 'playlistId' | 'segmentId' | 'partId' | 'partInstanceId'
>

/**
 * Calculate the timing values for every part of the playlist.
 *
 * Unlike the playlist and segment states these need no `now` of their own: every anchor comes from
 * the PartInstances' own timestamps and from `timingContext`, which was calculated at some instant
 * already.
 *
 * @param timingContext The context calculated for the same inputs
 * @param partInstances Sorted PartInstances, as fed to the RundownTimingCalculator
 */
export function calculatePartTimingStates(
	timingContext: RundownTimingContext,
	partInstances: CalculateTimingsPartInstance[]
): Map<PartId, PartTimingStateValues> {
	const states = new Map<PartId, PartTimingStateValues>()

	partInstances.forEach((partInstance, rank) => {
		states.set(partInstance.part._id, calculateOnePartTimingStates(timingContext, partInstance, rank))
	})

	return states
}

function calculateOnePartTimingStates(
	timingContext: RundownTimingContext,
	partInstance: CalculateTimingsPartInstance,
	rank: number
): PartTimingStateValues {
	const timingId = getPartInstanceTimingId(partInstance)
	const partId = unprotectString(partInstance.part._id)

	const expectedDuration = timingContext.partExpectedDurations?.[timingId]
	const displayDurationNoPlayback = timingContext.partDisplayDurationsNoPlayback?.[timingId]
	const liveDisplayDuration = timingContext.partDisplayDurations?.[timingId]
	const duration = timingContext.partDurations?.[timingId]
	const durationNoPlayback = timingContext.partDurationsNoPlayback?.[timingId]
	const played = timingContext.partPlayed?.[timingId]

	// A part's values grow with the clock while it is the on-air part and has not finished. An
	// invalid part is pinned to the default duration regardless of playback, so it never grows.
	//
	// Note that the start is deliberately *not* required to have passed: after a take in a
	// multi-gateway studio it is a little way in the future, and putting it in `resumesAt` means the
	// values are right from the moment it arrives rather than only once this has been republished.
	const startedPlayback = partInstance.timings?.plannedStartedPlayback
	const playOffset = partInstance.timings?.playOffset || 0
	const isRunning =
		partInstance._id === timingContext.currentPartInstanceId &&
		startedPlayback !== undefined &&
		!partInstance.timings?.duration

	// An invalid part's *display* duration and played time are pinned to preset values regardless of
	// playback, so they never grow. Its plain duration is not pinned, and does.
	const isGrowing = isRunning && !(partInstance.part.invalid && !partInstance.part.gap)

	// `partCountdown` is keyed by PartId, unlike every other map here, and so is this
	const countdownOffset = timingContext.partCountdownOffsets?.[partId]

	// adlibbed, or its Part has been removed from the rundown since; either way there is no Part for it
	const isOrphaned = partInstance.orphaned !== undefined

	const values: PartTimingStateValues = {
		rank,
		isInQuickLoop: timingContext.partsInQuickLoop?.[timingId] ?? false,
		countsTowardsTiming: timingContext.partCountsTowardsTiming?.[timingId] ?? false,
		untimed: partInstance.part.untimed ?? false,
		orphaned: isOrphaned,
	}

	// A value the part does not have is left out, rather than set to undefined (see
	// `computeTimingState` in publication.ts for why)
	if (expectedDuration !== undefined) values.expectedDuration = { paused: true, duration: expectedDuration }
	if (displayDurationNoPlayback !== undefined) {
		values.displayDuration = { paused: true, duration: displayDurationNoPlayback }
	}

	// A null offset means "will probably not be played out, if played in order", which the displays
	// render as no countdown at all - so it is simply absent from the document
	const hasCountdownOffset = countdownOffset !== undefined && countdownOffset !== null
	if (hasCountdownOffset) values.countdownOffset = countdownOffset

	// The played time grows from the moment the part starts, from zero
	if (played !== undefined) {
		values.played = isGrowing ? countUp(0, startedPlayback) : countUp(played, undefined)
	}

	// Same shape as the display duration below: holds at the as-planned value, then grows
	if (duration !== undefined) {
		values.duration =
			isRunning && durationNoPlayback !== undefined && startedPlayback !== undefined
				? countUp(durationNoPlayback, startedPlayback + durationNoPlayback + playOffset)
				: countUp(duration, undefined)
	}

	// The display duration holds at its static value and only starts growing once the part passes
	// it, so that is where the slope changes
	if (liveDisplayDuration !== undefined) {
		values.liveDisplayDuration =
			isGrowing && displayDurationNoPlayback !== undefined && startedPlayback !== undefined
				? countUp(displayDurationNoPlayback, startedPlayback + displayDurationNoPlayback)
				: countUp(liveDisplayDuration, undefined)
	}

	return values
}

/**
 * A value that holds at `staticValue` and then grows 1:1 with the clock from `growsFrom` onwards,
 * expressed as a duration read that holds and then falls - a TimerState's reads can never rise, so
 * a growing quantity is published negated (the convention `playedOut` on the Segment doc also uses).
 *
 * @param staticValue The value while it is not growing
 * @param growsFrom When it starts growing, or `undefined` if it never does
 */
function countUp(staticValue: number, growsFrom: number | undefined): TimerState {
	// subtracting rather than negating, so that a zero value gives 0 rather than -0
	return { paused: true, duration: 0 - staticValue, resumesAt: growsFrom ?? null }
}
