/**
 * Assembles the per-segment timing values as TimerStates (SegmentTimingStateDocs).
 *
 * These are the numbers the segment duration displays show. Like the playlist states they are
 * anchors rather than evaluated values, so a consumer keeps them current between recomputes and the
 * server only republishes when playout or ingest state changes.
 */

import type { TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import type { SegmentTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { calculatePartInstanceExpectedDurationWithTransition } from '@sofie-automation/corelib/dist/playout/timings'
import { CountdownType } from '@sofie-automation/blueprints-integration'
import { type RundownTimingContext, getPartInstanceTimingId } from './index'

type CalculateTimingsPartInstance = Pick<
	PartInstance,
	'_id' | 'isTemporary' | 'segmentId' | 'segmentPlayoutId' | 'orphaned' | 'timings' | 'part'
>

/** The timing value fields of a SegmentTimingStateDoc (without the document envelope) */
export type SegmentTimingStateValues = Omit<SegmentTimingStateDoc, '_id' | 'type' | 'playlistId' | 'segmentId'>

/**
 * Calculate the timing values for every segment of the playlist.
 *
 * @param now Current timestamp, which the returned states are anchored to
 * @param timingContext The context calculated at `now` for the same inputs
 * @param partInstances Sorted PartInstances, as fed to the RundownTimingCalculator
 * @param segmentsMap Segments of the playlist, in playlist order
 */
export function calculateSegmentTimingStates(
	now: number,
	timingContext: RundownTimingContext,
	partInstances: CalculateTimingsPartInstance[],
	segmentsMap: Map<SegmentId, DBSegment>
): Map<SegmentId, SegmentTimingStateValues> {
	const partInstancesBySegment = new Map<SegmentId, CalculateTimingsPartInstance[]>()
	for (const partInstance of partInstances) {
		const existing = partInstancesBySegment.get(partInstance.segmentId)
		if (existing) {
			existing.push(partInstance)
		} else {
			partInstancesBySegment.set(partInstance.segmentId, [partInstance])
		}
	}

	const states = new Map<SegmentId, SegmentTimingStateValues>()
	for (const segment of segmentsMap.values()) {
		states.set(
			segment._id,
			calculateOneSegmentTimingStates(now, timingContext, segment, partInstancesBySegment.get(segment._id) ?? [])
		)
	}

	return states
}

function calculateOneSegmentTimingStates(
	now: number,
	timingContext: RundownTimingContext,
	segment: DBSegment,
	partInstances: CalculateTimingsPartInstance[]
): SegmentTimingStateValues {
	const budgetDuration = segment.segmentTiming?.budgetDuration
	const countdownType = segment.segmentTiming?.countdownType ?? CountdownType.PART_EXPECTED_DURATION
	const onAirPartInstance = partInstances.find(
		(partInstance) => partInstance._id === timingContext.currentPartInstanceId
	)
	const onAirPartScheduledStart = scheduledStartOf(onAirPartInstance, now)

	if (countdownType === CountdownType.SEGMENT_BUDGET_DURATION) {
		const plannedDuration = budgetDuration ?? 0

		// Only the on-air segment's budget is actually counting down
		const isOnAir = timingContext.currentSegmentId === segment._id
		const budgetCountdown = isOnAir ? timingContext.remainingBudgetOnCurrentSegmentState : undefined
		// The budget counts down from the segment's start, and holds while that is not known. If the
		// on-air part is then still waiting for its planned start, the segment starts with that part,
		// so the budget carries that start as its `resumesAt`, as the part's own countdown does.
		let remaining: TimerState
		if (budgetCountdown?.paused && onAirPartScheduledStart !== undefined) {
			remaining = { paused: true, duration: budgetCountdown.duration, resumesAt: onAirPartScheduledStart }
		} else {
			remaining = budgetCountdown ?? { paused: true, duration: plannedDuration }
		}

		return {
			countdownType,
			plannedDuration: { paused: true, duration: plannedDuration },
			// A budgeted segment has never reported a played-out time - the display's count-up mode
			// reads zero for one today, and this preserves that rather than quietly changing it
			playedOut: { paused: true, duration: 0 },
			remaining,
		}
	}

	const { playedOut, isAccumulating } = sumPlayedOut(now, timingContext, partInstances)
	const plannedDuration = budgetDuration ?? sumExpectedDurations(partInstances)
	const remainingDuration = plannedDuration - playedOut
	// The segment's time grows with its on-air part's, so while that part is still waiting for its
	// planned start - the window after a take in a multi-gateway studio - the timers hold, and
	// `resumesAt` carries that start, as the part's own countdown does. An untimed part adds no
	// time to its segment, so the timers hold for it without a start to resume at.
	const isOnAirPartTimed = onAirPartInstance !== undefined && !onAirPartInstance.part.untimed
	const startsAccumulatingAt = isOnAirPartTimed ? onAirPartScheduledStart : undefined

	// Counting up is a value going negative, per the usual convention
	// (subtracting rather than negating, so that nothing played gives 0 rather than -0)
	let playedOutState: TimerState
	let remainingState: TimerState
	if (isAccumulating) {
		playedOutState = { paused: false, zeroTime: now - playedOut }
		remainingState = { paused: false, zeroTime: now + remainingDuration }
	} else if (startsAccumulatingAt !== undefined) {
		playedOutState = { paused: true, duration: 0 - playedOut, resumesAt: startsAccumulatingAt }
		remainingState = { paused: true, duration: remainingDuration, resumesAt: startsAccumulatingAt }
	} else {
		playedOutState = { paused: true, duration: 0 - playedOut }
		remainingState = { paused: true, duration: remainingDuration }
	}

	return {
		countdownType,
		plannedDuration: { paused: true, duration: plannedDuration },
		playedOut: playedOutState,
		remaining: remainingState,
	}
}

/**
 * When a part is planned to start, while that is still to come: in a multi-gateway studio a take
 * plans the start of the taken part a moment ahead. Undefined once the part has started, and for a
 * part with no planned start.
 */
function scheduledStartOf(partInstance: CalculateTimingsPartInstance | undefined, now: number): number | undefined {
	const plannedStart = partInstance?.timings?.plannedStartedPlayback
	const isStillToCome = plannedStart !== undefined && plannedStart > now
	return isStillToCome ? plannedStart : undefined
}

/**
 * The segment's played-out time at `now`, and whether it is still growing - which it is exactly
 * when the segment holds the on-air part and that part has started.
 */
function sumPlayedOut(
	now: number,
	timingContext: RundownTimingContext,
	partInstances: CalculateTimingsPartInstance[]
): { playedOut: number; isAccumulating: boolean } {
	const partPlayed = timingContext.partPlayed ?? {}

	let playedOut = 0
	let isAccumulating = false

	for (const partInstance of partInstances) {
		if (partInstance.part.untimed) continue

		playedOut += partPlayed[getPartInstanceTimingId(partInstance)] || 0

		if (partInstance._id === timingContext.currentPartInstanceId) {
			// note: a start in the future means the part has not begun, so nothing is accumulating yet
			const startedPlayback = partInstance.timings?.plannedStartedPlayback
			if (startedPlayback !== undefined && startedPlayback <= now) isAccumulating = true
		}
	}

	return { playedOut, isAccumulating }
}

/** The planned length of a segment with no budget: the sum of its parts' expected durations */
function sumExpectedDurations(partInstances: CalculateTimingsPartInstance[]): number {
	let total = 0
	for (const partInstance of partInstances) {
		if (partInstance.orphaned || partInstance.part.untimed) continue
		total += calculatePartInstanceExpectedDurationWithTransition(partInstance) || 0
	}
	return total
}
