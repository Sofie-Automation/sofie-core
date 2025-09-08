import ClassNames from 'classnames'
import { RundownUtils } from '../../lib/rundown.js'

export function Timediff({ time: rawTime }: { time: number }): JSX.Element {
	const time = -rawTime
	const isNegative = Math.floor(time / 1000) > 0
	const timeString = RundownUtils.formatDiffToTimecode(time, true, false, true, false, true, '', false, true)

	return (
		<span
			className={ClassNames({
				'clocks-segment-countdown-red': isNegative,
				'clocks-counter-heavy': time / 1000 > -30,
			})}
		>
			{timeString}
		</span>
	)
}
