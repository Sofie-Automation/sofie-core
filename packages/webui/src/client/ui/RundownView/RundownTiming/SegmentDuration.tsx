import classNames from 'classnames'
import { ReactNode } from 'react'
import { useTiming } from './withTiming.js'
import { RundownUtils } from '../../../lib/rundown.js'
import { PartUi } from '../../SegmentTimeline/SegmentTimelineContainer.js'
import { calculatePartInstanceExpectedDurationWithTransition } from '@sofie-automation/corelib/dist/playout/timings'
import { getPartInstanceTimingId } from '../../../lib/rundownTiming.js'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { CountdownType } from '@sofie-automation/blueprints-integration'

interface ISegmentDurationProps {
	segment: DBSegment
	parts: PartUi[]
	label?: ReactNode
	className?: string
	/** If set, the timer will display just the played out duration */
	countUp?: boolean
	/** Always show planned segment duration instead of counting up/down */
	fixed?: boolean
}

/**
 * A presentational component that will render a counter that will show how much content
 * is left in a segment consisting of given parts
 */
export function SegmentDuration(props: ISegmentDurationProps): JSX.Element | null {
	const timingDurations = useTiming()

	let duration: number | undefined = undefined
	let playedOut = 0

	const segmentBudgetDuration = props.segment.segmentTiming?.budgetDuration
	const segmentTimingType = props.segment.segmentTiming?.countdownType ?? CountdownType.PART_EXPECTED_DURATION

	let budget = segmentBudgetDuration ?? 0
	let hardFloor = false

	if (segmentTimingType === CountdownType.SEGMENT_BUDGET_DURATION) {
		hardFloor = true

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

	const showNegativeStyling = !props.fixed && !props.countUp

	let value = duration
	if (props.fixed) {
		value = budget
	} else if (props.countUp) {
		value = playedOut
	}

	if (duration !== undefined) {
		return (
			<>
				{props.label}
				<span
					className={classNames(props.className, {
						negative: showNegativeStyling && duration < 0,
					})}
					role="timer"
				>
					{RundownUtils.formatDiffToTimecode(value, false, false, true, false, true, '+', false, hardFloor)}
				</span>
			</>
		)
	}

	return null
}
