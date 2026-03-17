import { RundownTTimer } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownUtils } from '../../lib/rundown'
import { calculateTTimerDiff, calculateTTimerOverUnder } from '../../lib/tTimerUtils'
import { useTiming } from '../RundownView/RundownTiming/withTiming'
import classNames from 'classnames'

interface TTimerDisplayProps {
	timer: RundownTTimer
}

export function TTimerDisplay({ timer }: Readonly<TTimerDisplayProps>): JSX.Element | null {
	useTiming()

	if (!timer.mode) return null

	const now = Date.now()

	const diff = calculateTTimerDiff(timer, now)
	const overUnder = calculateTTimerOverUnder(timer, now)

	const timerStr = RundownUtils.formatDiffToTimecode(Math.abs(diff), false, true, true, false, true)
	const timerParts = timerStr.split(':')
	const timerSign = diff >= 0 ? '' : '-'

	return (
		<div className="t-timer-display">
			<span className="t-timer-display__label">{timer.label}</span>
			<span className="t-timer-display__value">
				{timerSign}
				{timerParts.map((p, i) => (
					<span
						key={i}
						className={classNames('t-timer-display__part', {
							't-timer-display__part--dimmed': p === '00' && i < timerParts.length - 2,
						})}
					>
						{p}
						{i < timerParts.length - 1 && <span className="t-timer-display__separator">:</span>}
					</span>
				))}
			</span>
			{overUnder !== undefined && (
				<span
					className={classNames('t-timer-display__over-under', {
						't-timer-display__over-under--over': overUnder > 0,
						't-timer-display__over-under--under': overUnder <= 0,
					})}
				>
					{overUnder > 0 ? '+' : '\u2013'}
					{RundownUtils.formatDiffToTimecode(Math.abs(overUnder), false, true, true, false, true)}
				</span>
			)}
		</div>
	)
}
