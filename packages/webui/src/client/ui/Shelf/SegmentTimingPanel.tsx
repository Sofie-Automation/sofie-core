import _ from 'underscore'
import ClassNames from 'classnames'
import {
	DashboardLayoutSegmentCountDown,
	RundownLayoutBase,
	RundownLayoutSegmentTiming,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { RundownUtils } from '../../lib/rundown.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { SegmentDuration } from '../RundownView/RundownTiming/SegmentDuration.js'
import { PartExtended } from '../../lib/RundownResolver.js'
import { memoizedIsolatedAutorun } from '../../lib/memoizedIsolatedAutorun.js'
import { slowDownReactivity } from '../../lib/reactiveData/reactiveDataHelper.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { dashboardElementStyle } from './DashboardPanel.js'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { getIsFilterActive } from '../../lib/rundownLayouts.js'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { PartId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylistCollectionUtil } from '../../collections/rundownPlaylistUtil.js'
import { RundownPlaylistClientUtil } from '../../lib/rundownPlaylistUtil.js'
import { useTranslation } from 'react-i18next'

interface ISegmentTimingPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutSegmentTiming
	playlist: DBRundownPlaylist
	showStyleBase: UIShowStyleBase
}

interface ISegmentTimingPanelTrackedProps {
	liveSegment?: DBSegment
	parts?: PartExtended[]
	active: boolean
}

function SegmentTimingPanelInner({
	layout,
	panel,
	liveSegment,
	parts,
	active,
}: ISegmentTimingPanelProps & ISegmentTimingPanelTrackedProps) {
	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)
	const { t } = useTranslation()

	return (
		<div
			className={ClassNames(
				'segment-timing-panel timing',
				isDashboardLayout ? (panel as DashboardLayoutSegmentCountDown).customClasses : undefined
			)}
			style={isDashboardLayout ? dashboardElementStyle(panel as DashboardLayoutSegmentCountDown) : {}}
		>
			<span className="timing-clock left">
				{!panel.hideLabel && (
					<span className="timing-clock-label">
						{panel.timingType === 'count_down' ? t('Segment Count Down') : t('Segment Count Up')}
					</span>
				)}
				{active && liveSegment && parts && (
					<SegmentDuration
						segment={liveSegment}
						parts={parts}
						countUp={panel.timingType === 'count_up'}
						className="segment-duration"
					/>
				)}
			</span>
		</div>
	)
}

export const SegmentTimingPanel = withTracker<ISegmentTimingPanelProps, {}, ISegmentTimingPanelTrackedProps>(
	(props: ISegmentTimingPanelProps) => {
		if (props.playlist.currentPartInfo) {
			const livePart = RundownPlaylistClientUtil.getActivePartInstances(props.playlist, {
				_id: props.playlist.currentPartInfo.partInstanceId,
			})[0]
			const liveSegment = livePart
				? RundownPlaylistClientUtil.getSegments(props.playlist, { _id: livePart.segmentId })[0]
				: undefined

			const { active } = getIsFilterActive(props.playlist, props.showStyleBase, props.panel)

			if (!liveSegment) return { active }

			const [orderedAllPartIds, { currentPartInstance, nextPartInstance }] = slowDownReactivity(
				() =>
					[
						memoizedIsolatedAutorun(
							(_playlistId: RundownPlaylistId) =>
								(
									RundownPlaylistClientUtil.getSegmentsAndPartsSync(props.playlist, undefined, undefined, undefined, {
										fields: { _id: 1 },
									}).parts as Pick<DBPart, '_id'>[]
								).map((part) => part._id),
							'playlist.getAllOrderedParts',
							props.playlist._id
						),
						memoizedIsolatedAutorun(
							(_playlistId: RundownPlaylistId, _currentPartInstanceId, _nextPartInstanceId) =>
								RundownPlaylistClientUtil.getSelectedPartInstances(props.playlist),
							'playlist.getSelectedPartInstances',
							props.playlist._id,
							props.playlist.currentPartInfo?.partInstanceId,
							props.playlist.nextPartInfo?.partInstanceId
						),
					] as [
						PartId[],
						{ currentPartInstance: PartInstance | undefined; nextPartInstance: PartInstance | undefined },
					],
				// if the rundown isn't active, run the changes ASAP, we don't care if there's going to be jank
				// if this is the current or next segment (will have those two properties defined), run the changes ASAP,
				// otherwise, trigger the updates in a window of 500-2500 ms from change
				props.playlist.activationId === undefined ? 0 : Math.random() * 2000 + 500
			)

			const orderedSegmentsAndParts = RundownPlaylistClientUtil.getSegmentsAndPartsSync(props.playlist)
			const rundownOrder = RundownPlaylistCollectionUtil.getRundownOrderedIDs(props.playlist)
			const rundownIndex = rundownOrder.indexOf(liveSegment.rundownId)
			const rundowns = RundownPlaylistCollectionUtil.getRundownsOrdered(props.playlist)
			const rundown = rundowns.find((r) => r._id === liveSegment.rundownId)
			const segmentIndex = orderedSegmentsAndParts.segments.findIndex((s) => s._id === liveSegment._id)

			if (!rundown) return { active }

			const rundownsToShowstyles = new Map()
			for (const rundown of rundowns) {
				rundownsToShowstyles.set(rundown._id, rundown.showStyleBaseId)
			}

			const o = RundownUtils.getResolvedSegment(
				props.showStyleBase,
				props.playlist,
				rundown,
				liveSegment,
				new Set(orderedSegmentsAndParts.segments.map((s) => s._id).slice(0, segmentIndex)),
				rundownOrder.slice(0, rundownIndex),
				rundownsToShowstyles,
				orderedAllPartIds,
				currentPartInstance,
				nextPartInstance,
				true,
				true
			)

			return { active, liveSegment, parts: o.parts }
		}
		return { active: false }
	},
	(_data, props: ISegmentTimingPanelProps, nextProps: ISegmentTimingPanelProps) => {
		return !_.isEqual(props, nextProps)
	}
)(SegmentTimingPanelInner)
