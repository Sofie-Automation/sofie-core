import classNames from 'classnames'
import type { ReactNode } from 'react'
import { RundownUtils } from '../../../lib/rundown.js'
import type { PartUi } from '../../SegmentTimeline/SegmentTimelineContainer.js'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { CountdownType } from '@sofie-automation/blueprints-integration'
import { TimerValueMode, useSegmentTimingValue } from './usePlaylistTimingValue.js'

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
	const segmentId = props.segment._id
	const remaining = useSegmentTimingValue(segmentId, 'remaining', TimerValueMode.Duration)
	const plannedDuration = useSegmentTimingValue(segmentId, 'plannedDuration', TimerValueMode.Duration)
	const playedOut = useSegmentTimingValue(segmentId, 'playedOut', TimerValueMode.Duration)

	if (remaining === null) return null

	const showNegativeStyling = !props.fixed && !props.countUp

	let text: string
	if (props.fixed) {
		// a budgeted segment's planned length rounds down, as it always did
		const hardFloor = props.segment.segmentTiming?.countdownType === CountdownType.SEGMENT_BUDGET_DURATION
		text = RundownUtils.formatDiffToTimecode(
			plannedDuration ?? 0,
			false,
			false,
			true,
			false,
			true,
			'+',
			false,
			hardFloor
		)
	} else if (props.countUp) {
		// the published value counts up by going negative; this display is elapsed-positive
		text = RundownUtils.formatDiffToTimecodeElapsed(0 - (playedOut ?? 0))
	} else {
		// a countdown: the time left rounds up, and the overrun rounds down, so 00:00 shows for the first second
		// past zero and each number shows for a full second
		text = RundownUtils.formatDiffToTimecodeCountdown(0 - remaining)
	}

	return (
		<>
			{props.label}
			<span
				className={classNames(props.className, {
					negative: showNegativeStyling && remaining < 0,
				})}
				role="timer"
			>
				{text}
			</span>
		</>
	)
}
