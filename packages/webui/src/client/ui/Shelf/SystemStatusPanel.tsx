import ClassNames from 'classnames'
import {
	DashboardLayoutSystemStatus,
	RundownLayoutBase,
	RundownLayoutSytemStatus,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { dashboardElementStyle } from './DashboardPanel.js'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { RundownSystemStatus } from '../RundownView/RundownSystemStatus.js'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownId, RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylists, Rundowns } from '../../collections/index.js'
import { RundownPlaylistCollectionUtil } from '../../collections/rundownPlaylistUtil.js'
import { useTranslation } from 'react-i18next'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

interface ISystemStatusPanelProps {
	studioId: StudioId
	layout: RundownLayoutBase
	panel: RundownLayoutSytemStatus
	playlistId: RundownPlaylistId
}

export function SystemStatusPanel({
	panel,
	layout,
	studioId,
	playlistId,
}: Readonly<ISystemStatusPanelProps>): JSX.Element {
	const { t } = useTranslation()

	const firstRundown = useTracker(() => {
		const playlist = RundownPlaylists.findOne(playlistId, {
			fields: {
				rundownIdsInOrder: 1,
			},
		}) as Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'> | undefined
		if (!playlist) return undefined

		let rundownId: RundownId | undefined = undefined

		if (playlist.rundownIdsInOrder.length > 0) {
			rundownId = playlist.rundownIdsInOrder[0]
		} else {
			rundownId = RundownPlaylistCollectionUtil.getRundownOrderedIDs(playlist)[0]
		}

		if (rundownId) {
			return Rundowns.findOne(
				{
					playlistId: playlistId,
					_id: rundownId,
				},
				{
					fields: {
						source: 1,
					},
				}
			) as Pick<DBRundown, 'source'> | undefined
		} else {
			return undefined
		}
	}, [playlistId])

	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)

	return (
		<div
			className={ClassNames(
				'system-status-panel timing',
				isDashboardLayout ? (panel as DashboardLayoutSystemStatus).customClasses : undefined
			)}
			style={isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutSystemStatus) : {}}
		>
			<span className="timing-clock left">
				<span className="timing-clock-label">{t('System Status')}</span>
				<RundownSystemStatus studioId={studioId} playlistId={playlistId} firstRundown={firstRundown} />
			</span>
		</div>
	)
}
