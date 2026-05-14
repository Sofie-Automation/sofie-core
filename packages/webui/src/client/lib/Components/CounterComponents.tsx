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

export const TimeToFromPlannedEndComponent = (props: OverUnderProps): JSX.Element => {
	const isOver = props.value > -100
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
				true,
				true, // useSmartHours automatically shows hours if > 0
				'',
				true,
				true
			)}`}
		</Countdown>
	)
}
