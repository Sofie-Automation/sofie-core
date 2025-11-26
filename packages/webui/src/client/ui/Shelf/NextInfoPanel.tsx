import _ from 'underscore'
import ClassNames from 'classnames'
import {
	RundownLayoutBase,
	DashboardLayoutNextInfo,
	RundownLayoutNextInfo,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { dashboardElementStyle } from './DashboardPanel.js'
import { Segments } from '../../collections/index.js'
import { UIPartInstances } from '../Collections.js'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'

interface INextInfoPanelProps {
	visible?: boolean
	layout: RundownLayoutBase
	panel: RundownLayoutNextInfo
	playlist: DBRundownPlaylist
}

export function NextInfoPanel({ visible, layout, panel, playlist }: INextInfoPanelProps): JSX.Element {
	const isDashboardLayout = RundownLayoutsAPI.isDashboardLayout(layout)

	const nextPartInstanceId = playlist.nextPartInfo?.partInstanceId
	const nextPartInstance = useTracker(
		() =>
			nextPartInstanceId &&
			(UIPartInstances.findOne(nextPartInstanceId, {
				projection: {
					segmentId: 1,
					orphaned: 1,
					part: 1,
				},
			}) as Pick<DBPartInstance, 'segmentId' | 'orphaned' | 'part'>),
		[nextPartInstanceId]
	)

	const nextSegmentId = nextPartInstance?.segmentId
	const nextSegment = useTracker(
		() => nextSegmentId && (Segments.findOne(nextSegmentId, { projection: { name: 1 } }) as Pick<DBSegment, 'name'>),
		[nextSegmentId]
	)

	const showAny = !panel.hideForDynamicallyInsertedParts || nextPartInstance?.orphaned !== 'adlib-part'
	const segmentName = showAny && panel.showSegmentName && nextSegment?.name
	const partTitle = showAny && panel.showPartTitle && nextPartInstance?.part.title

	return (
		<div
			className={ClassNames(
				'next-info-panel',
				isDashboardLayout ? (panel as DashboardLayoutNextInfo).customClasses : undefined
			)}
			style={_.extend(
				isDashboardLayout ? dashboardElementStyle({ ...(panel as DashboardLayoutNextInfo), height: 1 }) : {},
				{
					visibility: visible ? 'visible' : 'hidden',
				}
			)}
		>
			<div className="dashboard__panel--font-scaled">
				<span className="next-info-panel__name">{showAny && panel.name} </span>
				{segmentName && <span className="next-info-panel__segment">{segmentName}</span>}
				{partTitle && <span className="next-info-panel__part">{partTitle}</span>}
			</div>
		</div>
	)
}
