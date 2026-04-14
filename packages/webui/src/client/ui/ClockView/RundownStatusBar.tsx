import ClassNames from 'classnames'
import { getDefaultTTimer } from '../../lib/tTimerUtils.js'
import { TTimerDisplay } from './TTimerDisplay.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/src/dataModel/RundownPlaylist/RundownPlaylist.js'

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
}: Readonly<RundownStatusBarProps>): JSX.Element {
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
			</div>
		</div>
	)
}
