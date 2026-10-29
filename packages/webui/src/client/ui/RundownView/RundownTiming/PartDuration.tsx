import ClassNames from 'classnames'
import type { ReactNode } from 'react'
import { RundownUtils } from '../../../lib/rundown.js'
import type { PartUi } from '../../SegmentTimeline/SegmentTimelineContainer.js'
import { TimerValueMode, usePartTimingValue } from './usePlaylistTimingValue.js'

interface IPartDurationProps {
	part: PartUi
	label?: ReactNode
	className?: string
	/** If set, the timer will display just the played out duration */
	countUp?: boolean
	/** Always show planned segment duration instead of counting up/down */
	fixed?: boolean
}

/**
 * A presentational component that will render a duration for a Part
 * @function PartDisplayDuration
 * @extends React.Component<WithTiming<IPartDurationProps>>
 */
export function PartDisplayDuration(props: IPartDurationProps): JSX.Element | null {
	const part = props.part
	const expectedDuration = usePartTimingValue(part.instance.part._id, 'expectedDuration', TimerValueMode.Duration)
	const budget = part.instance.orphaned || part.instance.part.untimed ? 0 : (expectedDuration ?? 0)
	// drawn again when the shown number changes its second: the time left is the budget minus the played time,
	// and the budget is not always a whole number of seconds
	const played = usePartTimingValue(part.instance.part._id, 'played', TimerValueMode.CountUp, {
		drawnAs: props.countUp || props.fixed || part.instance.part.untimed ? undefined : (playedNow) => budget - playedNow,
	})

	const playedOut = (!part.instance.part.untimed ? played : 0) ?? 0

	const duration = budget - playedOut

	if (duration !== undefined) {
		return (
			<>
				{props.label}
				{props.fixed ? (
					<span className={ClassNames(props.className)} role="timer">
						{RundownUtils.formatDiffToTimecodeWithSign(budget)}
					</span>
				) : props.countUp ? (
					<span className={ClassNames(props.className)} role="timer">
						{RundownUtils.formatDiffToTimecodeElapsed(playedOut)}
					</span>
				) : (
					<span className={ClassNames(props.className, duration < 0 ? 'negative' : undefined)} role="timer">
						{/* a countdown: the time left rounds up, and the overrun rounds down */}
						{RundownUtils.formatDiffToTimecodeCountdown(0 - duration)}
					</span>
				)}
			</>
		)
	}

	return null
}
