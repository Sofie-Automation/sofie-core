import ClassNames from 'classnames'
import { ReactNode } from 'react'
import { withTiming, WithTiming } from './withTiming'
import { RundownUtils } from '../../../lib/rundown'
import { PartUi } from '../../SegmentTimeline/SegmentTimelineContainer'
import { getPartInstanceTimingId } from '../../../lib/rundownTiming'

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
export const PartDisplayDuration = withTiming<IPartDurationProps, {}>((props) => ({
	filter: (context) => {
		return context.partExpectedDurations && context.partExpectedDurations[getPartInstanceTimingId(props.part.instance)]
	},
}))(function PartDisplayDuration(props: WithTiming<IPartDurationProps>) {
	let duration: number | undefined = undefined
	let budget = 0
	let playedOut = 0

	const part = props.part

	if (props.timingDurations.partPlayed && props.timingDurations.partExpectedDurations) {
		const { partPlayed, partExpectedDurations } = props.timingDurations
		budget =
			part.instance.orphaned || part.instance.part.untimed
				? 0
				: partExpectedDurations[getPartInstanceTimingId(part.instance)] || 0
		playedOut = (!part.instance.part.untimed ? partPlayed[getPartInstanceTimingId(part.instance)] : 0) || 0
	}

	duration = budget - playedOut

	if (duration !== undefined) {
		return (
			<>
				{props.label}
				{props.fixed ? (
					<span className={ClassNames(props.className)} role="timer">
						{RundownUtils.formatDiffToTimecode(budget, false, false, true, false, true, '+')}
					</span>
				) : props.countUp ? (
					<span className={ClassNames(props.className)} role="timer">
						{RundownUtils.formatDiffToTimecode(playedOut, false, false, true, false, true, '+')}
					</span>
				) : (
					<span className={ClassNames(props.className, duration < 0 ? 'negative' : undefined)} role="timer">
						{RundownUtils.formatDiffToTimecode(duration, false, false, true, false, true, '+')}
					</span>
				)}
			</>
		)
	}

	return null
})
