import { DashboardLayout, DashboardLayoutFilter } from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../lib/rundownLayouts'
import { TimelineDashboardPanel } from './TimelineDashboardPanel'
import { DashboardPanel } from './DashboardPanel'
import { ExternalFramePanel } from './ExternalFramePanel'
import { DashboardActionButtonGroup } from './DashboardActionButtonGroup'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { AdLibRegionPanel } from './AdLibRegionPanel'
import { PieceCountdownPanel } from './PieceCountdownPanel'
import { BucketAdLibItem } from './RundownViewBuckets'
import { IAdLibListItem } from './AdLibListItem'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { AdLibPieceUi } from '../../lib/shelf'
import { MiniRundownPanel } from './MiniRundownPanel'
import { NextInfoPanel } from './NextInfoPanel'
import { PlaylistStartTimerPanel } from './PlaylistStartTimerPanel'
import { EndWordsPanel } from './EndWordsPanel'
import { PlaylistEndTimerPanel } from './PlaylistEndTimerPanel'
import { SegmentTimingPanel } from './SegmentTimingPanel'
import { PartTimingPanel } from './PartTimingPanel'
import { TextLabelPanel } from './TextLabelPanel'
import { PlaylistNamePanel } from './PlaylistNamePanel'
import { TimeOfDayPanel } from './TimeOfDayPanel'
import { SystemStatusPanel } from './SystemStatusPanel'
import { ShowStylePanel } from './ShowStylePanel'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { StudioNamePanel } from './StudioNamePanel'
import { SegmentNamePanel } from './SegmentNamePanel'
import { PartNamePanel } from './PartNamePanel'
import { ColoredBoxPanel } from './ColoredBoxPanel'
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
