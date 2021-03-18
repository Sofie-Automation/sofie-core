import * as React from 'react'
import ClassNames from 'classnames'
import { DBSegment, Segment } from '../../../lib/collections/Segments'
import { PartUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { RundownPlaylistId, RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { ShowStyleBaseId, ShowStyleBases } from '../../../lib/collections/ShowStyleBases'
import { Rundown, RundownId, Rundowns } from '../../../lib/collections/Rundowns'
import { withTranslation, WithTranslation } from 'react-i18next'
import { withTiming, WithTiming } from '../RundownView/RundownTiming/withTiming'
import { withTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { extendMandadory, literal, getCurrentTime, protectStringArray } from '../../../lib/lib'
import { findPartInstanceOrWrapToTemporary, PartInstance } from '../../../lib/collections/PartInstances'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { PubSub } from '../../../lib/api/pubsub'
import { PieceIconContainer } from '../PieceIcons/PieceIcon'
import { PieceNameContainer } from '../PieceIcons/PieceName'
import { Timediff } from './Timediff'
import { RundownUtils } from '../../lib/rundown'
import { PieceInstances } from '../../../lib/collections/PieceInstances'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { Part } from '../../../lib/collections/Parts'

interface SegmentUi extends DBSegment {
	items: Array<PartUi>
}

interface TimeMap {
	[key: string]: number
}

interface RundownOverviewProps {
	playlistId: RundownPlaylistId
	segmentLiveDurations?: TimeMap
}
interface RundownOverviewState {}
export interface RundownOverviewTrackedProps {
	playlist?: RundownPlaylist
	segments: Array<SegmentUi>
	currentSegment: SegmentUi | undefined
	currentPartInstance: PartUi | undefined
	nextSegment: SegmentUi | undefined
	nextPartInstance: PartUi | undefined
	currentShowStyleBaseId: ShowStyleBaseId | undefined
	nextShowStyleBaseId: ShowStyleBaseId | undefined
	showStyleBaseIds: ShowStyleBaseId[]
	rundownIds: RundownId[]
}

function getShowStyleBaseIdSegmentPartUi(
	partInstance: PartInstance,
	playlist: RundownPlaylist,
	orderedSegmentsAndParts: {
		segments: Segment[]
		parts: Part[]
	}
): {
	showStyleBaseId: ShowStyleBaseId | undefined
	segment: SegmentUi | undefined
	partInstance: PartUi | undefined
} {
	let showStyleBaseId: ShowStyleBaseId | undefined = undefined
	let segment: SegmentUi | undefined = undefined
	let partInstanceUi: PartUi | undefined = undefined

	const currentRundown = Rundowns.findOne(partInstance.rundownId, {
		fields: {
			_id: 1,
			_rank: 1,
			showStyleBaseId: 1,
			name: 1,
			expectedStart: 1,
			expectedDuration: 1,
		},
	})
	showStyleBaseId = currentRundown?.showStyleBaseId

	const segmentIndex = orderedSegmentsAndParts.segments.findIndex((segment) => segment._id === partInstance.segmentId)
	if (currentRundown) {
		const showStyleBase = ShowStyleBases.findOne(showStyleBaseId)

		if (showStyleBase) {
			// This registers a reactive dependency on infinites-capping pieces, so that the segment can be
			// re-evaluated when a piece like that appears.

			let o = RundownUtils.getResolvedSegment(
				showStyleBase,
				playlist,
				orderedSegmentsAndParts.segments[segmentIndex],
				new Set(orderedSegmentsAndParts.segments.map((segment) => segment._id).slice(0, segmentIndex)),
				orderedSegmentsAndParts.parts.map((part) => part._id),
				true,
				true
			)

			segment = extendMandadory<DBSegment, SegmentUi>(o.segmentExtended, {
				items: o.parts,
			})

			partInstanceUi = o.parts.find((part) => part.instance._id === partInstance._id)
		}
	}

	return {
		showStyleBaseId: showStyleBaseId,
		segment: segment,
		partInstance: partInstanceUi,
	}
}

export const getPresenterScreenReactive = (props: RundownOverviewProps): RundownOverviewTrackedProps => {
	let playlist: RundownPlaylist | undefined
	if (props.playlistId)
		playlist = RundownPlaylists.findOne(props.playlistId, {
			fields: {
				lastIncorrectPartPlaybackReported: 0,
				modified: 0,
				nextPartManual: 0,
				previousPersistentState: 0,
				rundownRanksAreSetInSofie: 0,
				trackedAbSessions: 0,
				restoredFromSnapshotId: 0,
			},
		})
	let segments: Array<SegmentUi> = []
	let showStyleBaseIds: ShowStyleBaseId[] = []
	let rundowns: { [key: string]: Rundown } = {}
	let rundownIds: RundownId[] = []

	let currentSegment: SegmentUi | undefined = undefined
	let currentPartInstanceUi: PartUi | undefined = undefined
	let currentShowStyleBaseId: ShowStyleBaseId | undefined = undefined

	let nextSegment: SegmentUi | undefined = undefined
	let nextPartInstanceUi: PartUi | undefined = undefined
	let nextShowStyleBaseId: ShowStyleBaseId | undefined = undefined

	if (playlist) {
		rundowns = playlist.getRundownsMap()
		const orderedSegmentsAndParts = playlist.getSegmentsAndPartsSync()
		rundownIds = protectStringArray(Object.keys(rundowns))
		showStyleBaseIds = Object.values(rundowns).map((rundown) => rundown.showStyleBaseId)
		const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()
		const partInstance = currentPartInstance || nextPartInstance
		if (partInstance) {
			// This is to register a reactive dependency on Rundown-spanning PieceInstances, that we may miss otherwise.
			PieceInstances.find({
				rundownId: {
					$in: rundownIds,
				},
				dynamicallyInserted: {
					$exists: true,
				},
				'infinite.fromPreviousPart': false,
				'piece.lifespan': {
					$in: [PieceLifespan.OutOnRundownEnd, PieceLifespan.OutOnRundownChange],
				},
				reset: {
					$ne: true,
				},
			}).fetch()

			if (currentPartInstance) {
				const current = getShowStyleBaseIdSegmentPartUi(currentPartInstance, playlist, orderedSegmentsAndParts)
				currentSegment = current.segment
				currentPartInstanceUi = current.partInstance
				currentShowStyleBaseId = current.showStyleBaseId
			}

			if (nextPartInstance) {
				const next = getShowStyleBaseIdSegmentPartUi(nextPartInstance, playlist, orderedSegmentsAndParts)
				nextSegment = next.segment
				nextPartInstanceUi = next.partInstance
				nextShowStyleBaseId = next.showStyleBaseId
			}
		}
	}
	return {
		segments,
		playlist,
		showStyleBaseIds,
		rundownIds,
		currentSegment,
		currentPartInstance: currentPartInstanceUi,
		currentShowStyleBaseId,
		nextSegment,
		nextPartInstance: nextPartInstanceUi,
		nextShowStyleBaseId,
	}
}

export class PresenterScreenBase extends MeteorReactComponent<
	WithTiming<RundownOverviewProps & RundownOverviewTrackedProps & WithTranslation>,
	RundownOverviewState
> {
	protected bodyClassList: string[] = ['dark', 'xdark']

	componentDidMount() {
		document.body.classList.add(...this.bodyClassList)
		this.subscribeToData()
	}

	protected subscribeToData() {
		this.autorun(() => {
			let playlist = RundownPlaylists.findOne(this.props.playlistId, {
				fields: {
					_id: 1,
				},
			}) as Pick<RundownPlaylist, '_id' | 'getRundownIDs'> | undefined
			if (playlist) {
				this.subscribe(PubSub.rundowns, {
					playlistId: playlist._id,
				})

				this.autorun(() => {
					const rundownIds = playlist!.getRundownIDs()

					this.subscribe(PubSub.segments, {
						rundownId: { $in: rundownIds },
					})
					this.subscribe(PubSub.parts, {
						rundownId: { $in: rundownIds },
					})
					this.subscribe(PubSub.partInstances, {
						rundownId: { $in: rundownIds },
						reset: { $ne: true },
					})
					this.subscribe(PubSub.showStyleBases, {
						_id: {
							$in: this.props.showStyleBaseIds,
						},
					})

					this.autorun(() => {
						let playlist = RundownPlaylists.findOne(this.props.playlistId, {
							fields: {
								_id: 1,
								currentPartInstanceId: 1,
								nextPartInstanceId: 1,
								previousPartInstanceId: 1,
							},
						}) as
							| Pick<
									RundownPlaylist,
									| '_id'
									| 'currentPartInstanceId'
									| 'nextPartInstanceId'
									| 'previousPartInstanceId'
									| 'getSelectedPartInstances'
							  >
							| undefined
						const { nextPartInstance, currentPartInstance } = playlist!.getSelectedPartInstances()
						this.subscribe(PubSub.pieceInstances, {
							partInstanceId: {
								$in: [currentPartInstance?._id, nextPartInstance?._id],
							},
						})
					})
				})
			}
		})
	}

	componentWillUnmount() {
		super.componentWillUnmount()
		document.body.classList.remove(...this.bodyClassList)
	}

	render() {
		const { playlist, segments, currentShowStyleBaseId, nextShowStyleBaseId, playlistId } = this.props

		if (playlist && playlistId && segments) {
			const currentPart = this.props.currentPartInstance
			const currentSegment = this.props.currentSegment

			let currentPartCountdown = 0
			if (currentPart) {
				currentPartCountdown = -1 * (this.props.timingDurations.remainingTimeOnCurrentPart || 0)
			}

			const nextPart = this.props.nextPartInstance
			const nextSegment = this.props.nextSegment

			const overUnderClock = playlist.expectedDuration
				? (this.props.timingDurations.asPlayedRundownDuration || 0) - playlist.expectedDuration
				: (this.props.timingDurations.asPlayedRundownDuration || 0) -
				  (this.props.timingDurations.totalRundownDuration || 0)

			return (
				<div className="clocks-full-screen">
					<div className="clocks-half clocks-top">
						{currentPart && currentShowStyleBaseId ? (
							<React.Fragment>
								<div className="clocks-part-icon clocks-current-segment-icon">
									<PieceIconContainer
										partInstanceId={currentPart.instance._id}
										showStyleBaseId={currentShowStyleBaseId}
										rundownIds={this.props.rundownIds}
									/>
								</div>
								<div className="clocks-part-title clocks-current-segment-title">{currentSegment!.name}</div>
								<div className="clocks-part-title clocks-part-title clocks-current-segment-title">
									<PieceNameContainer
										partName={currentPart.instance.part.title}
										partInstanceId={currentPart.instance._id}
										showStyleBaseId={currentShowStyleBaseId}
										rundownIds={this.props.rundownIds}
									/>
								</div>
								<div className="clocks-current-segment-countdown clocks-segment-countdown">
									<Timediff time={currentPartCountdown} />
								</div>
							</React.Fragment>
						) : playlist.expectedStart ? (
							<div className="clocks-rundown-countdown clocks-segment-countdown">
								<Timediff time={playlist.expectedStart - getCurrentTime()} />
							</div>
						) : null}
					</div>
					<div className="clocks-half clocks-bottom clocks-top-bar">
						<div className="clocks-part-icon">
							{nextPart && nextShowStyleBaseId ? (
								<PieceIconContainer
									partInstanceId={nextPart.instance._id}
									showStyleBaseId={nextShowStyleBaseId}
									rundownIds={this.props.rundownIds}
								/>
							) : null}
						</div>
						<div className="clocks-bottom-top">
							<div className="clocks-part-title">
								{currentPart && currentPart.instance.part.autoNext ? (
									<div style={{ display: 'inline-block', height: '18vh' }}>
										<img style={{ height: '12vh', paddingTop: '2vh' }} src="/icons/auto-presenter-screen.svg" />
									</div>
								) : null}
								{nextSegment && nextSegment.name ? nextSegment.name.split(';')[0] : '_'}
							</div>
							<div className="clocks-part-title clocks-part-title">
								{nextPart && nextShowStyleBaseId && nextPart.instance.part.title ? (
									<PieceNameContainer
										partName={nextPart.instance.part.title}
										partInstanceId={nextPart.instance._id}
										showStyleBaseId={nextShowStyleBaseId}
										rundownIds={this.props.rundownIds}
									/>
								) : (
									'_'
								)}
							</div>
						</div>
						<div className="clocks-rundown-bottom-bar">
							<div className="clocks-rundown-title">{playlist ? playlist.name : 'UNKNOWN'}</div>
							<div
								className={ClassNames('clocks-rundown-total', {
									over: Math.floor(overUnderClock / 1000) >= 0,
								})}>
								{RundownUtils.formatDiffToTimecode(overUnderClock, true, false, true, true, true, undefined, true)}
							</div>
						</div>
					</div>
				</div>
			)
		}
		return null
	}
}

/**
 * This component renders a Countdown screen for a given playlist
 */
export const PresenterScreen = withTranslation()(
	withTracker<RundownOverviewProps & WithTranslation, RundownOverviewState, RundownOverviewTrackedProps>(
		getPresenterScreenReactive
	)(
		withTiming<RundownOverviewProps & RundownOverviewTrackedProps & WithTranslation, RundownOverviewState>()(
			PresenterScreenBase
		)
	)
)
