import { DashboardLayout, DashboardLayoutFilter } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts.js'
import { TimelineDashboardPanel } from './TimelineDashboardPanel.js'
import { DashboardPanel } from './DashboardPanel.js'
import { ExternalFramePanel } from './ExternalFramePanel.js'
import { DashboardActionButtonGroup } from './DashboardActionButtonGroup.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { AdLibRegionPanel } from './AdLibRegionPanel.js'
import { PieceCountdownPanel } from './PieceCountdownPanel.js'
import { BucketAdLibItem } from './RundownViewBuckets.js'
import { IAdLibListItem } from './AdLibListItem.js'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer.js'
import { AdLibPieceUi } from '../../lib/shelf.js'
import { MiniRundownPanel } from './MiniRundownPanel.js'
import { NextInfoPanel } from './NextInfoPanel.js'
import { PlaylistStartTimerPanel } from './PlaylistStartTimerPanel.js'
import { EndWordsPanel } from './EndWordsPanel.js'
import { PlaylistEndTimerPanel } from './PlaylistEndTimerPanel.js'
import { SegmentTimingPanel } from './SegmentTimingPanel.js'
import { PartTimingPanel } from './PartTimingPanel.js'
import { TextLabelPanel } from './TextLabelPanel.js'
import { PlaylistNamePanel } from './PlaylistNamePanel.js'
import { TimeOfDayPanel } from './TimeOfDayPanel.js'
import { SystemStatusPanel } from './SystemStatusPanel.js'
import { ShowStylePanel } from './ShowStylePanel.js'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { StudioNamePanel } from './StudioNamePanel.js'
import { SegmentNamePanel } from './SegmentNamePanel.js'
import { PartNamePanel } from './PartNamePanel.js'
import { ColoredBoxPanel } from './ColoredBoxPanel.js'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'

export interface IShelfDashboardLayoutProps {
	rundownLayout: DashboardLayout
	playlist: DBRundownPlaylist
	// buckets: Bucket[] | undefined
	showStyleBase: UIShowStyleBase
	showStyleVariant: DBShowStyleVariant
	studioMode: boolean
	shouldQueue: boolean
	studio: UIStudio
	onChangeQueueAdLib?: (isQueue: boolean, e: any) => void

	selectedPiece: BucketAdLibItem | IAdLibListItem | PieceUi | undefined
	onSelectPiece?: (piece: AdLibPieceUi | PieceUi) => void
}

export function ShelfDashboardLayout(props: Readonly<IShelfDashboardLayoutProps>): JSX.Element {
	const { rundownLayout } = props
	return (
		<div className="dashboard">
			{rundownLayout.filters &&
				rundownLayout.filters
					.sort((a, b) => a.rank - b.rank)
					.map((panel) => {
						if (RundownLayoutsAPI.isFilter(panel)) {
							return (panel as DashboardLayoutFilter).showAsTimeline ? (
								<TimelineDashboardPanel
									key={panel._id}
									includeGlobalAdLibs={true}
									filter={panel}
									visible={!(panel as DashboardLayoutFilter).hide}
									playlist={props.playlist}
									showStyleBase={props.showStyleBase}
									studioMode={props.studioMode}
									shouldQueue={props.shouldQueue}
									studio={props.studio}
									selectedPiece={props.selectedPiece}
									onSelectPiece={props.onSelectPiece}
								/>
							) : (
								<DashboardPanel
									key={panel._id}
									includeGlobalAdLibs={true}
									filter={panel}
									visible={!(panel as DashboardLayoutFilter).hide}
									playlist={props.playlist}
									showStyleBase={props.showStyleBase}
									studioMode={props.studioMode}
									shouldQueue={props.shouldQueue}
									studio={props.studio}
									selectedPiece={props.selectedPiece}
									onSelectPiece={props.onSelectPiece}
								/>
							)
						} else if (RundownLayoutsAPI.isExternalFrame(panel)) {
							return (
								<ExternalFramePanel
									key={panel._id}
									panel={panel}
									layout={rundownLayout}
									visible={true}
									playlist={props.playlist}
								/>
							)
						} else if (RundownLayoutsAPI.isAdLibRegion(panel)) {
							return (
								<AdLibRegionPanel
									key={panel._id}
									includeGlobalAdLibs={true}
									filter={RundownLayoutsAPI.adLibRegionToFilter(panel)}
									panel={panel}
									adlibRank={panel.adlibRank}
									layout={rundownLayout}
									visible={true}
									playlist={props.playlist}
									showStyleBase={props.showStyleBase}
									studioMode={props.studioMode}
									selectedPiece={props.selectedPiece}
									onSelectPiece={props.onSelectPiece}
									studio={props.studio}
								/>
							)
						} else if (RundownLayoutsAPI.isPieceCountdown(panel)) {
							return (
								<PieceCountdownPanel
									key={panel._id}
									panel={panel}
									layout={rundownLayout}
									playlist={props.playlist}
									showStyleBase={props.showStyleBase}
									visible={true}
								/>
							)
						} else if (RundownLayoutsAPI.isNextInfo(panel)) {
							return (
								<NextInfoPanel
									key={panel._id}
									panel={panel}
									layout={rundownLayout}
									playlist={props.playlist}
									visible={true}
								/>
							)
						} else if (RundownLayoutsAPI.isPlaylistStartTimer(panel)) {
							return (
								<PlaylistStartTimerPanel
									key={panel._id}
									playlist={props.playlist}
									layout={rundownLayout}
									panel={panel}
								/>
							)
						} else if (RundownLayoutsAPI.isPlaylistEndTimer(panel)) {
							return (
								<PlaylistEndTimerPanel key={panel._id} playlist={props.playlist} layout={rundownLayout} panel={panel} />
							)
						} else if (RundownLayoutsAPI.isEndWords(panel)) {
							return (
								<EndWordsPanel
									key={panel._id}
									playlist={props.playlist}
									layout={rundownLayout}
									panel={panel}
									showStyleBase={props.showStyleBase}
								/>
							)
						} else if (RundownLayoutsAPI.isSegmentTiming(panel)) {
							return (
								<SegmentTimingPanel
									key={panel._id}
									playlist={props.playlist}
									layout={rundownLayout}
									panel={panel}
									showStyleBase={props.showStyleBase}
								/>
							)
						} else if (RundownLayoutsAPI.isPartTiming(panel)) {
							return (
								<PartTimingPanel
									key={panel._id}
									playlist={props.playlist}
									layout={rundownLayout}
									panel={panel}
									showStyleBase={props.showStyleBase}
								/>
							)
						} else if (RundownLayoutsAPI.isTextLabel(panel)) {
							return <TextLabelPanel key={panel._id} playlist={props.playlist} layout={rundownLayout} panel={panel} />
						} else if (RundownLayoutsAPI.isPlaylistName(panel)) {
							return (
								<PlaylistNamePanel key={panel._id} playlist={props.playlist} layout={rundownLayout} panel={panel} />
							)
						} else if (RundownLayoutsAPI.isStudioName(panel)) {
							return <StudioNamePanel key={panel._id} studio={props.studio} layout={rundownLayout} panel={panel} />
						} else if (RundownLayoutsAPI.isSegmentName(panel)) {
							return <SegmentNamePanel key={panel._id} playlist={props.playlist} layout={rundownLayout} panel={panel} />
						} else if (RundownLayoutsAPI.isPartName(panel)) {
							return (
								<PartNamePanel
									key={panel._id}
									playlist={props.playlist}
									layout={rundownLayout}
									panel={panel}
									showStyleBase={props.showStyleBase}
								/>
							)
						} else if (RundownLayoutsAPI.isTimeOfDay(panel)) {
							return <TimeOfDayPanel key={panel._id} playlist={props.playlist} layout={rundownLayout} panel={panel} />
						} else if (RundownLayoutsAPI.isSystemStatus(panel)) {
							return (
								<SystemStatusPanel
									key={panel._id}
									playlistId={props.playlist._id}
									layout={rundownLayout}
									panel={panel}
									studioId={props.studio._id}
								/>
							)
						} else if (RundownLayoutsAPI.isShowStyleDisplay(panel)) {
							return (
								<ShowStylePanel
									key={panel._id}
									playlist={props.playlist}
									layout={rundownLayout}
									panel={panel}
									showStyleBase={props.showStyleBase}
									showStyleVariant={props.showStyleVariant}
								/>
							)
						} else if (RundownLayoutsAPI.isColoredBox(panel)) {
							return <ColoredBoxPanel key={panel._id} playlist={props.playlist} layout={rundownLayout} panel={panel} />
						} else if (RundownLayoutsAPI.isMiniRundown(panel)) {
							return (
								<MiniRundownPanel
									key={panel._id}
									panel={panel}
									layout={rundownLayout}
									playlist={props.playlist}
									visible={true}
								/>
							)
						}
					})}
			{rundownLayout.actionButtons && (
				<DashboardActionButtonGroup
					playlist={props.playlist}
					buttons={rundownLayout.actionButtons}
					onChangeQueueAdLib={props.onChangeQueueAdLib}
					studioMode={props.studioMode}
				/>
			)}
		</div>
	)
}
