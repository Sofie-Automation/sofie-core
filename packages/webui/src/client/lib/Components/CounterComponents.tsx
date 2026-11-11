import Moment from 'react-moment'
import { RundownUtils } from '../rundown.js'

import { Countdown } from '../../ui/RundownView/RundownHeader/Countdown.js'

interface OverUnderProps {
	value: number
}

export const OverUnderClockComponent = (props: OverUnderProps): JSX.Element => {
	return (
		<div className="counter-component__over-under">
			<span className={props.value < 0 ? 'under' : 'over'}>
				{RundownUtils.formatDiffToTimecodeOverUnder(props.value, true)}
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

export const TimeToFromPlannedEndComponent = (props: OverUnderProps): JSX.Element => {
	// over from the planned end on, not 0.1 s before it
	const isOver = props.value >= 0
	return (
		<Countdown
			className={isOver ? 'counter-component__time-since-planned-end' : 'counter-component__time-to-planned-end'}
			ms={props.value}
		>
			{`${isOver ? '+' : ''}${RundownUtils.formatDiffToTimecode(
				props.value, // restored to match Rem. Dur math (negative value triggers Math.ceil)
				false,
				false, // disable hardcoded showHours
				true,
				false, // no smart floor: the time left rounds up, also in its last 0.1 s
				true, // useSmartHours automatically shows hours if > 0
				'',
				true,
				true
			)}`}
		</Countdown>
	)
}
