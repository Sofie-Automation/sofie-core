import ClassNames from 'classnames'
import { getDefaultTTimer } from '../../lib/tTimerUtils.js'
import { TTimerDisplay } from './TTimerDisplay.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist.js'
import { useTranslation } from 'react-i18next'

interface RundownStatusBarProps {
	playlist?: DBRundownPlaylist
	className?: string
	showPlaylistName?: boolean
}

export function RundownStatusBar({
	playlist,
	className,
	showPlaylistName = true,
}: Readonly<RundownStatusBarProps>): JSX.Element {
	const activeTTimer = playlist ? getDefaultTTimer(playlist.tTimers) : undefined
	const { t } = useTranslation()

	const playlistName = playlist?.name ?? t('Unknown')

	return (
		<div
			className={ClassNames('rundown-status-bar', className, {
				'rundown-status-bar--no-title': !showPlaylistName,
			})}
		>
			{showPlaylistName && <div className="rundown-status-bar__rundown-name">{playlistName}</div>}
			<div className="rundown-status-bar__right">
				<div className="rundown-status-bar__t-timer">{!!activeTTimer && <TTimerDisplay timer={activeTTimer} />}</div>
			</div>
		</div>
	)
}
