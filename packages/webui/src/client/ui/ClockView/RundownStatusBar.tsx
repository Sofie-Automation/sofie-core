import ClassNames from 'classnames'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { RundownUtils } from '../../lib/rundown.js'
import { getPlaylistTimingDiff } from '../../lib/rundownTiming.js'
import { getDefaultTTimer } from '../../lib/tTimerUtils.js'
import { useTiming } from '../RundownView/RundownTiming/withTiming.js'
import { TTimerDisplay } from './TTimerDisplay.js'

interface RundownStatusBarProps {
	playlist?: DBRundownPlaylist
	className?: string
	showPlaylistName?: boolean
	showDiff?: boolean
}

export function RundownStatusBar({
	playlist,
	className,
	showPlaylistName = true,
	showDiff = true,
}: Readonly<RundownStatusBarProps>): JSX.Element {
	const timingDurations = useTiming()

	const overUnderClock = playlist ? (getPlaylistTimingDiff(playlist, timingDurations) ?? 0) : 0
	const activeTTimer = playlist ? getDefaultTTimer(playlist.tTimers) : undefined

	return (
		<div
			className={ClassNames('presenter-screen__rundown-status-bar', className, {
				'presenter-screen__rundown-status-bar--no-title': !showPlaylistName,
			})}
		>
			{showPlaylistName && (
				<div className="presenter-screen__rundown-status-bar__rundown-name">{playlist ? playlist.name : 'UNKNOWN'}</div>
			)}
			<div className="presenter-screen__rundown-status-bar__right">
				<div className="presenter-screen__rundown-status-bar__t-timer">
					{!!activeTTimer && <TTimerDisplay timer={activeTTimer} />}
				</div>
				{showDiff && (
					<div
						className={ClassNames('presenter-screen__rundown-status-bar__countdown', {
							'heavy-light': true,
							heavy: Math.floor(overUnderClock / 1000) >= 0,
							light: Math.floor(overUnderClock / 1000) < 0,
						})}
					>
						{RundownUtils.formatDiffToTimecode(overUnderClock, true, false, true, true, true, undefined, true, true)}
					</div>
				)}
			</div>
		</div>
	)
}
