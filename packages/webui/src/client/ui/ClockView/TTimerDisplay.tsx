import { RundownTTimer } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/TTimers'
import { RundownUtils } from '../../lib/rundown.js'
import { calculateTTimerDiff, calculateTTimerOverUnder } from '../../lib/tTimerUtils.js'
import { useTiming } from '../RundownView/RundownTiming/withTiming.js'
import { OverUnderChip } from '../../lib/Components/OverUnderChip.js'
import { Countdown } from '../RundownView/RundownHeader/Countdown.js'

interface TTimerDisplayProps {
	timer: RundownTTimer
}

export function TTimerDisplay({ timer }: Readonly<TTimerDisplayProps>): JSX.Element | null {
	useTiming()

	if (!timer.mode) return null

	const now = Date.now()

	const diff = calculateTTimerDiff(timer, now)
	const overUnder = calculateTTimerOverUnder(timer, now)
	const timeStr = RundownUtils.formatDiffToTimecode(Math.abs(diff), false, true, true, false, true)
	const timerSign = diff >= 0 ? '' : '-'

	return (
		<div className="t-timer-display">
			<Countdown
				label={timer.label}
				className="t-timer-display__countdown"
				ms={diff}
				postfix={<OverUnderChip valueMs={overUnder} className="over-under-timer" />}
			>
				{`${timerSign}${timeStr}`}
			</Countdown>
		</div>
	)
}
