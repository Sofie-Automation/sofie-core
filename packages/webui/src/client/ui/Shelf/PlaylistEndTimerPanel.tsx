import ClassNames from 'classnames'
import type {
	DashboardLayoutPlaylistEndTimer,
	RundownLayoutBase,
	RundownLayoutPlaylistEndTimer,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { dashboardElementStyle } from './DashboardPanel.js'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { PlaylistEndTiming } from '../RundownView/RundownTiming/PlaylistEndTiming.js'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { isLoopRunning } from '@sofie-automation/corelib/src/playout/stateCacheResolver.js'

interface IPlaylistEndTimerPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutPlaylistEndTimer
	playlist: DBRundownPlaylist
}

export function PlaylistEndTimerPanel({ playlist, panel, layout }: Readonly<IPlaylistEndTimerPanelProps>): JSX.Element {
	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)

	return (
		<div
			className={ClassNames(
				'playlist-end-time-panel timing',
				isDashboardLayout ? (panel as DashboardLayoutPlaylistEndTimer).customClasses : undefined
			)}
			style={isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutPlaylistEndTimer) : {}}
		>
			<PlaylistEndTiming
				rundownPlaylist={playlist}
				loop={isLoopRunning(playlist)}
				expectedStart={PlaylistTiming.getExpectedStart(playlist.timing)}
				expectedEnd={PlaylistTiming.getExpectedEnd(playlist.timing)}
				expectedDuration={PlaylistTiming.getExpectedDuration(playlist.timing)}
				endLabel={panel.plannedEndText}
				hidePlannedEndLabel={panel.hidePlannedEndLabel}
				hideDiffLabel={panel.hideDiffLabel}
				hideCountdown={panel.hideCountdown}
				hideDiff={panel.hideDiff}
				hidePlannedEnd={panel.hidePlannedEnd}
			/>
		</div>
	)
}
