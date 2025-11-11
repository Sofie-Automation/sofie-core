import ClassNames from 'classnames'
import {
	DashboardLayoutSegmentName,
	RundownLayoutBase,
	RundownLayoutSegmentName,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { dashboardElementStyle } from './DashboardPanel.js'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { RundownPlaylistClientUtil } from '../../lib/rundownPlaylistUtil.js'
import { useTranslation } from 'react-i18next'

interface ISegmentNamePanelProps {
	layout: RundownLayoutBase
	panel: RundownLayoutSegmentName
	playlist: DBRundownPlaylist
}

export function SegmentNamePanel({ layout, panel, playlist }: ISegmentNamePanelProps): JSX.Element {
	const { t } = useTranslation()

	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)

	const segmentName = useTracker(() => getSegmentName(panel.segment, playlist), [panel.segment, playlist])

	return (
		<div
			className={ClassNames(
				'segment-name-panel',
				isDashboardLayout ? (panel as DashboardLayoutSegmentName).customClasses : undefined
			)}
			style={isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutSegmentName) : {}}
		>
			<div className="wrapper">
				<span className="segment-name-title">
					{panel.segment === 'current' ? t('Current Segment') : t('Next Segment')}
				</span>
				<span className="segment-name">{segmentName}</span>
			</div>
		</div>
	)
}

function getSegmentName(selectedSegment: 'current' | 'next', playlist: DBRundownPlaylist): string | undefined {
	const currentPartInstance = playlist.currentPartInfo
		? (RundownPlaylistClientUtil.getActivePartInstances(playlist, {
				_id: playlist.currentPartInfo.partInstanceId,
			})[0] as PartInstance | undefined)
		: undefined

	if (!currentPartInstance) return

	if (selectedSegment === 'current') {
		if (currentPartInstance) {
			const segment = RundownPlaylistClientUtil.getSegments(playlist, { _id: currentPartInstance.segmentId })[0] as
				| DBSegment
				| undefined
			return segment?.name
		}
	} else {
		if (playlist.nextPartInfo) {
			const nextPartInstance = RundownPlaylistClientUtil.getActivePartInstances(playlist, {
				_id: playlist.nextPartInfo.partInstanceId,
			})[0] as PartInstance | undefined
			if (nextPartInstance && nextPartInstance.segmentId !== currentPartInstance.segmentId) {
				const segment = RundownPlaylistClientUtil.getSegments(playlist, { _id: nextPartInstance.segmentId })[0] as
					| DBSegment
					| undefined
				return segment?.name
			}
		}

		// Current and next part are same segment, or next is not set
		// Find next segment in order
		const orderedSegmentsAndParts = RundownPlaylistClientUtil.getSegmentsAndPartsSync(playlist)
		const segmentIndex = orderedSegmentsAndParts.segments.findIndex((s) => s._id === currentPartInstance.segmentId)
		if (segmentIndex === -1) return

		const nextSegment = orderedSegmentsAndParts.segments.slice(segmentIndex + 1)[0] as DBSegment | undefined
		return nextSegment?.name
	}
}
