/**
 * Main's segment duration, frozen for the comparison with main: the SegmentDuration component of
 * packages/webui/src/client/ui/RundownView/RundownTiming/SegmentDuration.tsx at main
 * d40ae733fefdd831ce614792b65e8434778b2757. It was a React component, so three things differ, and nothing else:
 * - the timing context is a parameter instead of the useTiming() hook;
 * - a part is only what the component reads of it, its PartInstance, and the props leave out the label and class;
 * - the component returns the value it formatted and the remaining duration its styling read, instead of rendering
 *   them, so the two flags only the formatting and the styling read (hardFloor and showNegativeStyling) are left out.
 * The lines that compute the values are unchanged.
 *
 * The timing publication replaced this with the segment documents. Main's segment headers in the timeline, the list
 * and the storyboard showed this value. To see the unchanged lines:
 *
 *   git diff d40ae733f:packages/webui/src/client/ui/RundownView/RundownTiming/SegmentDuration.tsx \
 *     HEAD:packages/sofie-core/src/publications/playlistTimingState/__tests__/timing/main/SegmentDuration.ts
 */

import type { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { calculatePartInstanceExpectedDurationWithTransition } from '@sofie-automation/corelib/dist/playout/timings'
import { getPartInstanceTimingId, type RundownTimingContext } from '../../../rundownTiming'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { CountdownType } from '@sofie-automation/blueprints-integration'

/** What the component reads of a part of the segment */
export interface PartUi {
	instance: Pick<PartInstance, '_id' | 'isTemporary' | 'orphaned' | 'part' | 'timings'>
}

interface ISegmentDurationProps {
	segment: DBSegment
	parts: PartUi[]
	/** If set, the timer will display just the played out duration */
	countUp?: boolean
	/** Always show planned segment duration instead of counting up/down */
	fixed?: boolean
}

/** What the component formatted: the value it showed, and the remaining duration it styled as negative */
export interface SegmentDurationShown {
	value: number
	duration: number
}

/**
 * A presentational component that will render a counter that will show how much content
 * is left in a segment consisting of given parts
 */
export function SegmentDuration(
	props: ISegmentDurationProps,
	timingDurations: RundownTimingContext
): SegmentDurationShown | null {
	let duration: number | undefined = undefined
	let playedOut = 0

	const segmentBudgetDuration = props.segment.segmentTiming?.budgetDuration
	const segmentTimingType = props.segment.segmentTiming?.countdownType ?? CountdownType.PART_EXPECTED_DURATION

	let budget = segmentBudgetDuration ?? 0

	if (segmentTimingType === CountdownType.SEGMENT_BUDGET_DURATION) {
		if (timingDurations.currentSegmentId === props.segment._id) {
			duration = timingDurations.remainingBudgetOnCurrentSegment ?? segmentBudgetDuration ?? 0
		} else {
			duration = segmentBudgetDuration ?? 0
		}
	} else {
		if (props.parts && timingDurations.partPlayed) {
			const { partPlayed } = timingDurations

			for (const part of props.parts) {
				playedOut += (!part.instance.part.untimed ? partPlayed[getPartInstanceTimingId(part.instance)] : 0) || 0

				if (segmentBudgetDuration === undefined) {
					budget +=
						part.instance.orphaned || part.instance.part.untimed
							? 0
							: calculatePartInstanceExpectedDurationWithTransition(part.instance) || 0
				}
			}
		}

		duration = budget - playedOut
	}

	let value = duration
	if (props.fixed) {
		value = budget
	} else if (props.countUp) {
		value = playedOut
	}

	if (duration !== undefined) {
		return { value, duration }
	}

	return null
}
