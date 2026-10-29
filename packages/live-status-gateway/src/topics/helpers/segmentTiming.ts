import type { PartTimingStateDoc, SegmentTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { timerStateToDuration } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import { CountdownType, type SegmentTimingInfo } from '@sofie-automation/blueprints-integration'
import {
	SegmentCountdownType,
	type CurrentSegmentTiming,
	type SegmentTiming,
} from '@sofie-automation/live-status-gateway-api'
import { projectedZeroTime } from './timerState.js'

/**
 * A Segment's timing, taken from the `playlistTimingState` publication.
 *
 * Sofie resolves these itself: the gateway forwards the timers and evaluates only the values the public
 * schema declares as plain numbers, so `remaining` and `playedOut` are the ones the Sofie UI shows.
 * `expectedDurationMs` is the sum of the Parts' resolved expected durations. It is not quite the planned
 * segment length the Sofie UI uses: that is the budget where there is one, and otherwise adds up each
 * Part's own expected duration with its transition, so the two differ for a Part without one of its
 * own, such as one in a display-duration group.
 */
export function calculateSegmentTiming(
	segmentTimingInfo: SegmentTimingInfo | undefined,
	timing: SegmentTimingStateDoc | undefined,
	partTimings: PartTimingStateDoc[] | undefined
): SegmentTiming {
	return {
		// Summed from the Parts rather than taken from the Segment's published `plannedDuration`:
		// for a Segment with a budget duration that is the budget, whereas this field has always
		// meant the length of the content, with the budget reported separately below.
		expectedDurationMs: sumExpectedDurations(partTimings),
		budgetDurationMs: segmentTimingInfo?.budgetDuration,
		countdownType: translateSegmentCountdownType(segmentTimingInfo?.countdownType),
		playedOut: timing?.playedOut,
		remaining: timing?.remaining,
	}
}

/**
 * As {@link calculateSegmentTiming}, plus when the Segment is now projected to end.
 *
 * `projectedEndTime` is the zero time of the remaining-time timer, read as {@link projectedZeroTime}
 * does. Note that it is a plain number in the public schema, so while the Segment is not counting down
 * it is only accurate at the moment it was sent; `remaining` is the value to use for anything that has
 * to stay accurate.
 */
export function calculateCurrentSegmentTiming(
	segmentTimingInfo: SegmentTimingInfo | undefined,
	timing: SegmentTimingStateDoc | undefined,
	partTimings: PartTimingStateDoc[] | undefined,
	now: number
): CurrentSegmentTiming {
	const segmentTiming = calculateSegmentTiming(segmentTimingInfo, timing, partTimings)

	return {
		...segmentTiming,
		projectedEndTime: timing?.remaining ? projectedZeroTime(timing.remaining, now) : now,
	}
}

/**
 * The length of a Segment's content: the sum of its Parts' expected durations as Sofie resolves
 * them - with transitions, and through display-duration groups.
 *
 * Only the Parts that count towards the Segment's expected duration are added up, see
 * {@link countsTowardsSegmentExpectedDuration}.
 */
function sumExpectedDurations(partTimings: PartTimingStateDoc[] | undefined): number {
	if (!partTimings) return 0

	const countedParts = partTimings.filter(countsTowardsSegmentExpectedDuration)

	return countedParts.reduce(
		// a constant state, so any instant reads the same value
		(sum, part) => sum + (part.expectedDuration ? timerStateToDuration(part.expectedDuration, 0) : 0),
		0
	)
}

/**
 * Whether a Part's expected duration counts towards its Segment's, as in Sofie's own segment totals.
 * Every Part is published with its own expected duration, but two kinds do not count:
 * - an untimed Part
 * - an orphaned Part, which is either created by an adlib or no longer in the rundown, and so is not
 *   part of the Segment as planned
 */
function countsTowardsSegmentExpectedDuration(part: PartTimingStateDoc): boolean {
	const isTimed = !part.untimed
	const isPlanned = !part.orphaned

	return isTimed && isPlanned
}

function translateSegmentCountdownType(type: CountdownType | undefined): SegmentCountdownType | undefined {
	switch (type) {
		case undefined:
			return undefined
		case CountdownType.PART_EXPECTED_DURATION:
			return SegmentCountdownType.PART_EXPECTED_DURATION
		case CountdownType.SEGMENT_BUDGET_DURATION:
			return SegmentCountdownType.SEGMENT_BUDGET_DURATION
		default:
			return undefined
	}
}
