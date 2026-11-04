import type { SegmentTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
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
 */
export function calculateSegmentTiming(
	segmentTimingInfo: SegmentTimingInfo | undefined,
	timing: SegmentTimingStateDoc | undefined
): SegmentTiming {
	return {
		// The Segment's `expectedDuration` rather than its `targetDuration`: for a Segment with a budget
		// duration that is the budget, whereas this field has always meant the length of the content,
		// with the budget reported separately below.
		expectedDurationMs: timing?.expectedDuration ?? 0,
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
	now: number
): CurrentSegmentTiming {
	const segmentTiming = calculateSegmentTiming(segmentTimingInfo, timing)

	return {
		...segmentTiming,
		projectedEndTime: timing?.remaining ? projectedZeroTime(timing.remaining, now) : now,
	}
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
