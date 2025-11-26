import ClassNames from 'classnames'
import {
	DashboardLayoutPlaylistStartTimer,
	RundownLayoutBase,
	RundownLayoutPlaylistStartTimer,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { dashboardElementStyle } from './DashboardPanel.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PlaylistStartTiming } from '../RundownView/RundownTiming/PlaylistStartTiming.js'

interface IPlaylistStartTimerPanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutPlaylistStartTimer
	playlist: DBRundownPlaylist
}

export function PlaylistStartTimerPanel({
	playlist,
	panel,
	layout,
}: Readonly<IPlaylistStartTimerPanelProps>): JSX.Element {
	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)

	return (
		<div
			className={ClassNames(
				'playlist-start-time-panel timing',
				isDashboardLayout ? (panel as DashboardLayoutPlaylistStartTimer).customClasses : undefined
			)}
			style={isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutPlaylistStartTimer) : {}}
		>
			<PlaylistStartTiming
				rundownPlaylist={playlist}
				hideDiff={panel.hideDiff}
				hidePlannedStart={panel.hidePlannedStart}
				plannedStartText={panel.plannedStartText}
			/>
		</div>
	)
}
