import React from 'react'
import { RundownTTimer } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/TTimers'
import { useTiming } from '../RundownTiming/withTiming'
import { RundownUtils } from '../../../lib/rundown.js'
import { calculateTTimerDiff, calculateTTimerOverUnder } from '../../../lib/tTimerUtils'
import classNames from 'classnames'
import { getCurrentTime } from '../../../lib/systemTime'
import { Countdown } from './Countdown'
import { OverUnderChip } from '../../../lib/Components/OverUnderChip'

interface IProps {
	tTimers: [RundownTTimer, RundownTTimer, RundownTTimer]
}

export const RundownHeaderTimers: React.FC<IProps> = ({ tTimers }) => {
	useTiming()

	const activeTimers = tTimers.filter((t) => t.mode).slice(0, 2)
	if (activeTimers.length == 0) return null

	return (
		<div className="rundown-header__clocks-timers">
			{activeTimers.map((timer) => (
				<div key={timer.index} className="rundown-header__clocks-timers__row">
					<SingleTimer timer={timer} />
				</div>
			))}
		</div>
	)
}

interface ISingleTimerProps {
	timer: RundownTTimer
}

function SingleTimer({ timer }: Readonly<ISingleTimerProps>) {
	const now = getCurrentTime()
	const mode = timer.mode
	if (!mode) return null
	const isRunning = !!timer.state && !timer.state.paused

	const diff = calculateTTimerDiff(timer, now)
	const overUnder = calculateTTimerOverUnder(timer, now)
	const timeStr = RundownUtils.formatDiffToTimecode(Math.abs(diff), false, true, true, false, true)
	const isCountingDown = mode.type === 'countdown' && diff < 0 && isRunning

	return (
		<Countdown
			label={timer.label}
			className={classNames('rundown-header__clocks-timers__timer', 'rundown-header__show-timers-countdown', {
				'countdown--counter': mode.type !== 'timeOfDay',
				'countdown--timeofday': mode.type === 'timeOfDay',
				'rundown-header__clocks-timers__timer__countdown': mode.type === 'countdown',
				'rundown-header__clocks-timers__timer__freeRun': mode.type === 'freeRun',
				'rundown-header__clocks-timers__timer__isRunning': isRunning,
				'rundown-header__clocks-timers__timer__isPaused': !isRunning,
				'rundown-header__clocks-timers__timer__isCountingDown': mode.type === 'countdown' && isCountingDown,
				'rundown-header__clocks-timers__timer__isCountingUp': mode.type === 'countdown' && !isCountingDown,
				'rundown-header__clocks-timers__timer__isComplete':
					mode.type === 'countdown' && timer.state !== null && diff >= 0,
			})}
			ms={mode.type === 'timeOfDay' ? undefined : diff}
			postfix={overUnder ? <OverUnderChip valueMs={overUnder} format="timerPostfix" /> : undefined}
		>
			{timeStr}
		</Countdown>
	)
}
