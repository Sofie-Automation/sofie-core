import type { RundownTTimer } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/TTimers'
import { RundownUtils } from '../../lib/rundown.js'
import { calculateTTimerDiff, calculateTTimerOverUnder } from '../../lib/tTimerUtils.js'
import { useTimingNow } from '../RundownView/RundownTiming/usePlaylistTimingValue.js'
import { OverUnderChip } from '../../lib/Components/OverUnderChip.js'
import { Countdown } from '../RundownView/RundownHeader/Countdown.js'

interface TTimerDisplayProps {
	timer: RundownTTimer
}

export function TTimerDisplay({ timer }: Readonly<TTimerDisplayProps>): JSX.Element | null {
	const now = useTimingNow()

	if (!timer.mode) return null

	const diff = calculateTTimerDiff(timer, now)
	const overUnder = calculateTTimerOverUnder(timer, now)
	const timeStr = RundownUtils.formatDiffToTimecodeHours(Math.abs(diff))
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
