import Moment from 'react-moment'
import { RundownUtils } from '../rundown.js'

interface OverUnderProps {
	value: number
}

export const OverUnderClockComponent = (props: OverUnderProps): JSX.Element => {
	return (
		<div className="counter-component__over-under">
			<span className={props.value < 0 ? 'under' : 'over'}>
				{RundownUtils.formatDiffToTimecode(props.value, true, false, true, true, true, undefined, true, true)}
			</span>
		</div>
	)
}

export const PlannedEndComponent = (props: OverUnderProps): JSX.Element => {
	return (
		<span className="counter-component__planned-end">
			<Moment interval={0} format="HH:mm:ss" date={props.value} />
		</span>
	)
}

export const TimeToPlannedEndComponent = (props: OverUnderProps): JSX.Element => {
	return (
		<span className="counter-component__time-to-planned-end">
			{RundownUtils.formatDiffToTimecode(props.value, true, false, true, true, true, undefined, true, true)}
		</span>
	)
}

export const TimeSincePlannedEndComponent = (props: OverUnderProps): JSX.Element => {
	return (
		<span className="counter-component__time-since-planned-end">
			{RundownUtils.formatDiffToTimecode(props.value, true, false, true, true, true, undefined, true, true)}
		</span>
	)
}
