import * as React from 'react'
import _ from 'underscore'
import { ISourceLayer, NoteSeverity, PieceLifespan } from '@sofie-automation/blueprints-integration'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data.js'
import { IOutputLayerExtended, ISourceLayerExtended, PartExtended, SegmentExtended } from '../../lib/RundownResolver.js'
import { IContextMenuContext } from '../RundownView.js'
import { equalSets } from '@sofie-automation/shared-lib/dist/lib/lib'
import { RundownUtils } from '../../lib/rundown.js'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { slowDownReactivity } from '../../lib/reactiveData/reactiveDataHelper.js'
import { memoizedIsolatedAutorun } from '../../lib/memoizedIsolatedAutorun.js'
import { getIsFilterActive } from '../../lib/rundownLayouts.js'
import {
	RundownLayoutFilterBase,
	RundownViewLayout,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { getReactivePieceNoteCountsForSegment } from './getReactivePieceNoteCountsForSegment.js'
import { SegmentViewMode } from './SegmentViewModes.js'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { AdlibSegmentUi } from '../../lib/shelf.js'
import { UIShowStyleBase } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { UIStudio } from '@sofie-automation/meteor-lib/dist/api/studios'
import {
	PartId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstances, Segments } from '../../collections/index.js'
import { RundownPlaylistCollectionUtil } from '../../collections/rundownPlaylistUtil.js'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { RundownPlaylistClientUtil } from '../../lib/rundownPlaylistUtil.js'
import type { PieceUi } from '@sofie-automation/meteor-lib/dist/uiTypes/Piece'

export type { PieceUi } from '@sofie-automation/meteor-lib/dist/uiTypes/Piece'

export interface SegmentUi extends SegmentExtended {
	/** Output layers available in the installation used by this segment */
	outputLayers: {
		[key: string]: IOutputLayerUi
	}
	/** Source layers used by this segment */
	sourceLayers: {
		[key: string]: ISourceLayerUi
	}
}
export type PartUi = PartExtended
export interface IOutputLayerUi extends IOutputLayerExtended {
	/** Is output layer group collapsed */
	collapsed?: boolean
}
export type ISourceLayerUi = ISourceLayerExtended

export type MinimalRundown = Pick<Rundown, '_id' | 'name' | 'timing' | 'showStyleBaseId' | 'endOfRundownIsShowBreak'>

export const FREEZE_FRAME_FLASH = 5000

export interface IResolvedSegmentProps {
	// id: string
	rundownId: RundownId
	segmentId: SegmentId
	segmentsIdsBefore: Set<SegmentId>
	rundownIdsBefore: RundownId[]
	rundownsToShowstyles: ReadonlyMap<RundownId, ShowStyleBaseId>
	studio: UIStudio
	showStyleBase: UIShowStyleBase
	playlist: DBRundownPlaylist
	rundown: MinimalRundown
	timeScale: number
	onPieceDoubleClick?: (item: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onPieceClick?: (piece: PieceUi, e: React.MouseEvent<HTMLDivElement>) => void
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	onSegmentScroll?: () => void
	onHeaderNoteClick?: (segmentId: SegmentId, level: NoteSeverity) => void
	onSwitchViewMode?: (newViewMode: SegmentViewMode) => void
	followLiveSegments: boolean
	segmentRef?: (el: React.ComponentClass, sId: string) => void
	isLastSegment: boolean
	ownCurrentPartInstance: PartInstance | undefined
	ownNextPartInstance: PartInstance | undefined
	adLibSegmentUi?: AdlibSegmentUi
	miniShelfFilter: RundownLayoutFilterBase | undefined
	isFollowingOnAirSegment: boolean
	rundownViewLayout: RundownViewLayout | undefined
	countdownToSegmentRequireLayers: string[] | undefined
	fixedSegmentDuration: boolean | undefined
	studioMode: boolean
	showDurationSourceLayers?: Set<ISourceLayer['_id']>
}

export interface SegmentNoteCounts {
	criticial: number
	warning: number
}

export interface ITrackedResolvedSegmentProps {
	segmentui: SegmentUi | undefined
	parts: Array<PartUi>
	segmentNoteCounts: SegmentNoteCounts
	hasRemoteItems: boolean
	hasGuestItems: boolean
	hasAlreadyPlayed: boolean
	isAdlibTestingSegment: boolean
	lastValidPartIndex: number | undefined
	budgetDuration: number | undefined
	displayLiveLineCounter: boolean
	showCountdownToSegment: boolean
}

export function withResolvedSegment<T extends IResolvedSegmentProps, IState = {}>(
	WrappedComponent: React.ComponentType<T & ITrackedResolvedSegmentProps>
): React.ComponentType<T> {
	return withTracker<T, IState, ITrackedResolvedSegmentProps>(
		(props: T) => {
			const segment = Segments.findOne(props.segmentId) as SegmentUi | undefined

			// We need the segment to do anything
			if (!segment) {
				return {
					segmentui: undefined,
					parts: [],
					pieces: new Map(),
					segmentNoteCounts: { criticial: 0, warning: 0 },
					hasRemoteItems: false,
					hasGuestItems: false,
					hasAlreadyPlayed: false,
					lastValidPartIndex: undefined,
					budgetDuration: undefined,
					displayLiveLineCounter: true,
					showCountdownToSegment: true,
					isAdlibTestingSegment: false,
				}
			}

			// This registers a reactive dependency on infinites-capping pieces, so that the segment can be
			// re-evaluated when a piece like that appears.
			PieceInstances.find({
				rundownId: segment.rundownId,
				dynamicallyInserted: {
					$exists: true,
				},
				'infinite.fromPreviousPart': false,
				'piece.lifespan': {
					$in: [
						PieceLifespan.OutOnRundownEnd,
						PieceLifespan.OutOnRundownChange,
						PieceLifespan.OutOnShowStyleEnd,
					],
				},
				reset: {
					$ne: true,
				},
			}).fetch()

			const [orderedAllPartIds, { currentPartInstance, nextPartInstance }] = slowDownReactivity(
				() =>
					[
						memoizedIsolatedAutorun(
							(_playlistId: RundownPlaylistId) =>
								(
									RundownPlaylistClientUtil.getSegmentsAndPartsSync(
										props.playlist,
										undefined,
										undefined,
										undefined,
										{
											fields: { _id: 1 },
										}
									).parts as Pick<DBPart, '_id' | 'segmentId' | '_rank'>[]
								).map((part) => part._id),
							'playlist.getSegmentsAndPartsSync',
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
				props.playlist.activationId === undefined || props.ownCurrentPartInstance || props.ownNextPartInstance
					? 0
					: props.isFollowingOnAirSegment
						? 150
						: Math.random() * 2000 + 500
			)

			const rundownOrder = RundownPlaylistCollectionUtil.getRundownOrderedIDs(props.playlist)
			const rundownIndex = rundownOrder.indexOf(segment.rundownId)

			const o = RundownUtils.getResolvedSegment(
				props.showStyleBase,
				props.studio,
				props.playlist,
				props.rundown,
				segment,
				props.segmentsIdsBefore,
				rundownOrder.slice(0, rundownIndex),
				props.rundownsToShowstyles,
				orderedAllPartIds,
				currentPartInstance,
				nextPartInstance,
				true,
				true
			)

			if (props.rundownViewLayout && o.segmentExtended) {
				if (props.rundownViewLayout.visibleSourceLayers) {
					const visibleSourceLayers = props.rundownViewLayout.visibleSourceLayers
					Object.entries<ISourceLayerExtended>(o.segmentExtended.sourceLayers).forEach(
						([id, sourceLayer]) => {
							sourceLayer.isHidden = !visibleSourceLayers.includes(id)
						}
					)
				}
				if (props.rundownViewLayout.visibleOutputLayers) {
					const visibleOutputLayers = props.rundownViewLayout.visibleOutputLayers
					Object.entries<IOutputLayerExtended>(o.segmentExtended.outputLayers).forEach(
						([id, outputLayer]) => {
							outputLayer.used = visibleOutputLayers.includes(id)
						}
					)
				}
			}

			const segmentNoteCounts = getReactivePieceNoteCountsForSegment(segment)

			let lastValidPartIndex = o.parts.length - 1

			for (let i = lastValidPartIndex; i > 0; i--) {
				if (o.parts[i].instance.part.invalid) {
					lastValidPartIndex = i - 1
				} else {
					break
				}
			}

			const budgetDuration = segment.segmentTiming?.budgetDuration

			let displayLiveLineCounter = true
			if (props.rundownViewLayout && props.rundownViewLayout.liveLineProps?.requiredLayerIds) {
				const { active } = getIsFilterActive(
					props.playlist,
					props.showStyleBase,
					props.rundownViewLayout.liveLineProps
				)
				displayLiveLineCounter = active
			}

			let showCountdownToSegment = true
			if (props.countdownToSegmentRequireLayers?.length) {
				const sourcelayersInSegment = o.parts
					.map((pa) => pa.pieces.map((pi) => pi.sourceLayer?._id))
					.flat()
					.filter((s) => !!s) as string[]
				showCountdownToSegment = props.countdownToSegmentRequireLayers.some((s) =>
					sourcelayersInSegment.includes(s)
				)
			}

			const isAdlibTestingSegment = segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING

			return {
				segmentui: o.segmentExtended,
				parts: o.parts,
				segmentNoteCounts,
				hasAlreadyPlayed: o.hasAlreadyPlayed,
				hasRemoteItems: o.hasRemoteItems,
				hasGuestItems: o.hasGuestItems,
				lastValidPartIndex,
				budgetDuration,
				displayLiveLineCounter,
				showCountdownToSegment,
				isAdlibTestingSegment,
			}
		},
		(
			data: ITrackedResolvedSegmentProps,
			props: IResolvedSegmentProps,
			nextProps: IResolvedSegmentProps
		): boolean => {
			// This is a potentially very dangerous hook into the React component lifecycle. Re-use with caution.
			// Check obvious primitive changes
			if (
				props.followLiveSegments !== nextProps.followLiveSegments ||
				props.onContextMenu !== nextProps.onContextMenu ||
				props.onSegmentScroll !== nextProps.onSegmentScroll ||
				props.segmentId !== nextProps.segmentId ||
				props.segmentRef !== nextProps.segmentRef ||
				props.timeScale !== nextProps.timeScale ||
				props.isFollowingOnAirSegment !== nextProps.isFollowingOnAirSegment ||
				!_.isEqual(props.ownCurrentPartInstance, nextProps.ownCurrentPartInstance) ||
				!_.isEqual(props.ownNextPartInstance, nextProps.ownNextPartInstance) ||
				!equalSets(props.segmentsIdsBefore, nextProps.segmentsIdsBefore) ||
				!_.isEqual(props.countdownToSegmentRequireLayers, nextProps.countdownToSegmentRequireLayers) ||
				!_.isEqual(props.rundownViewLayout, nextProps.rundownViewLayout) ||
				props.fixedSegmentDuration !== nextProps.fixedSegmentDuration ||
				!_.isEqual(props.adLibSegmentUi?.pieces, nextProps.adLibSegmentUi?.pieces) ||
				props.adLibSegmentUi?.showShelf !== nextProps.adLibSegmentUi?.showShelf
			) {
				return true
			}
			// Check RundownViewLayout changes that are important to the segment
			if (
				!_.isEqual(
					props.rundownViewLayout?.visibleSourceLayers,
					nextProps.rundownViewLayout?.visibleSourceLayers
				) ||
				!_.isEqual(
					props.rundownViewLayout?.visibleOutputLayers,
					nextProps.rundownViewLayout?.visibleOutputLayers
				) ||
				!_.isEqual(props.rundownViewLayout?.liveLineProps, nextProps.rundownViewLayout?.liveLineProps)
			) {
				return true
			}
			const findNextOrCurrentPart = (parts: PartUi[]) => {
				return (
					parts.find(
						(i) =>
							i.instance._id === props.playlist.currentPartInfo?.partInstanceId ||
							i.instance._id === nextProps.playlist.currentPartInfo?.partInstanceId
					) ||
					parts.find(
						(i) =>
							i.instance._id === props.playlist.nextPartInfo?.partInstanceId ||
							i.instance._id === nextProps.playlist.nextPartInfo?.partInstanceId
					)
				)
			}
			// Check rundown changes that are important to the segment
			if (
				typeof props.playlist !== typeof nextProps.playlist ||
				(props.playlist.queuedSegmentId !== nextProps.playlist.queuedSegmentId &&
					(props.playlist.queuedSegmentId === props.segmentId ||
						nextProps.playlist.queuedSegmentId === props.segmentId)) ||
				((props.playlist.currentPartInfo?.partInstanceId !==
					nextProps.playlist.currentPartInfo?.partInstanceId ||
					props.playlist.nextPartInfo?.partInstanceId !== nextProps.playlist.nextPartInfo?.partInstanceId) &&
					data.parts &&
					findNextOrCurrentPart(data.parts)) ||
				props.playlist.holdState !== nextProps.playlist.holdState ||
				props.playlist.nextTimeOffset !== nextProps.playlist.nextTimeOffset ||
				props.playlist.activationId !== nextProps.playlist.activationId ||
				!_.isEqual(props.playlist.quickLoop?.start, nextProps.playlist.quickLoop?.start) ||
				!_.isEqual(props.playlist.quickLoop?.end, nextProps.playlist.quickLoop?.end) ||
				PlaylistTiming.getExpectedStart(props.playlist.timing) !==
					PlaylistTiming.getExpectedStart(nextProps.playlist.timing)
			) {
				return true
			}
			// Check studio installation changes that are important to the segment.
			// We also could investigate just skipping this and requiring a full reload if the studio installation is changed
			if (
				typeof props.studio !== typeof nextProps.studio ||
				!_.isEqual(props.studio.settings, nextProps.studio.settings) ||
				!_.isEqual(props.showStyleBase.sourceLayers, nextProps.showStyleBase.sourceLayers) ||
				!_.isEqual(props.showStyleBase.outputLayers, nextProps.showStyleBase.outputLayers)
			) {
				return true
			}

			return false
		},
		true
	)(WrappedComponent)
}
