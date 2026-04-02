import { RundownTTimer } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/TTimers'
import { RundownUtils } from '../../lib/rundown.js'
import { calculateTTimerDiff, calculateTTimerOverUnder } from '../../lib/tTimerUtils.js'
import { useTiming } from '../RundownView/RundownTiming/withTiming.js'
import classNames from 'classnames'
import { OverUnderTimer } from '../Prompter/OverUnderTimer.js'

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
			{timer.label ? <span className="t-timer-display__label">{timer.label}</span> : null}
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
			<OverUnderTimer valueMs={overUnder} />
		</div>
	)
}
