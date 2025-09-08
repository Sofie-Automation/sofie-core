import {
	DashboardLayoutPartCountDown,
	RundownLayoutBase,
	RundownLayoutPartTiming,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { dashboardElementStyle } from './DashboardPanel.js'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { getAllowSpeaking, getAllowVibrating } from '../../lib/localStorage.js'
import { CurrentPartOrSegmentRemaining } from '../RundownView/RundownTiming/CurrentPartOrSegmentRemaining.js'
import { CurrentPartElapsed } from '../RundownView/RundownTiming/CurrentPartElapsed.js'
import { getIsFilterActive } from '../../lib/rundownLayouts.js'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { RundownPlaylistClientUtil } from '../../lib/rundownPlaylistUtil.js'
import { useTranslation } from 'react-i18next'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface IPartTimingPanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutPartTiming
	playlist: DBRundownPlaylist
	showStyleBase: UIShowStyleBase
}

interface IPartTimingPanelTrackedProps {
	livePartId?: PartId
	active: boolean
}

export function PartTimingPanel({ layout, panel, playlist, showStyleBase }: IPartTimingPanelProps): JSX.Element {
	const { t } = useTranslation()

	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)

	const { active, livePartId } = useTracker<IPartTimingPanelTrackedProps>(
		() => {
			if (!playlist.currentPartInfo) return { active: false }

			const livePartId: PartId | undefined = RundownPlaylistClientUtil.getActivePartInstances(playlist, {
				_id: playlist.currentPartInfo.partInstanceId,
			})[0]?.part?._id

			const { active } = getIsFilterActive(playlist, showStyleBase, panel)

			return { active, livePartId }
		},
		[playlist, showStyleBase, panel],
		{ active: false }
	)

	return (
		<div
			className="part-timing-panel timing"
			style={isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutPartCountDown) : {}}
		>
			<span className="timing-clock left">
				{!panel.hideLabel && (
					<span className="timing-clock-label">
						{panel.timingType === 'count_down' ? t('Part Count Down') : t('Part Count Up')}
					</span>
				)}
				{active &&
					(panel.timingType === 'count_down' ? (
						<CurrentPartOrSegmentRemaining
							currentPartInstanceId={playlist.currentPartInfo?.partInstanceId ?? null}
							speaking={getAllowSpeaking() && panel.speakCountDown}
							vibrating={getAllowVibrating() && panel.speakCountDown}
							heavyClassName="overtime"
							className="part-remaining"
							preferSegmentTime={true}
						/>
					) : (
						<CurrentPartElapsed currentPartId={livePartId} className="part-elapsed" />
					))}
			</span>
		</div>
	)
}
