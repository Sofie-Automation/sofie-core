import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import {
	DBRundownPlaylist,
	QuickLoopMarker,
	QuickLoopMarkerType,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { assertNever, literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { SelectedPartInstances } from '../collections/partInstancesHandler.js'
import { ShowStyleBaseExt } from '../collections/showStyleBaseHandler.js'
import { WebSocketTopicBase, WebSocketTopic } from '../wsHandler.js'
import { calculateCurrentSegmentTiming } from './helpers/segmentTiming.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import _ from 'underscore'
import { calculateCurrentPartTiming } from './helpers/partTiming.js'
import { getCurrentSegmentParts } from './helpers/segmentParts.js'
import { SelectedPieceInstances, PieceInstanceMin } from '../collections/pieceInstancesHandler.js'
import { toPieceStatus } from './helpers/pieceStatus.js'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { normalizeArray } from '@sofie-automation/corelib/dist/lib'
import {
	PartStatus,
	CurrentPartStatus,
	CurrentSegment,
	ActivePlaylistEvent,
	ActivePlaylistTimingMode,
	ActivePlaylistQuickLoop,
	QuickLoopMarker as QuickLoopMarkerStatus,
	QuickLoopMarkerType as QuickLoopMarkerStatusType,
} from '@sofie-automation/live-status-gateway-api'

import { CollectionHandlers } from '../liveStatusServer.js'
import areElementsShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'

const THROTTLE_PERIOD_MS = 100

const PLAYLIST_KEYS = [
	'_id',
	'activationId',
	'name',
	'rundownIdsInOrder',
	'publicData',
	'currentPartInfo',
	'nextPartInfo',
	'timing',
	'startedPlayback',
	'quickLoop',
] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

const PART_INSTANCES_KEYS = ['current', 'next', 'inCurrentSegment', 'firstInSegmentPlayout'] as const
type PartInstances = PickKeys<SelectedPartInstances, typeof PART_INSTANCES_KEYS>

const PIECE_INSTANCES_KEYS = ['currentPartInstance', 'nextPartInstance'] as const
type PieceInstances = PickKeys<SelectedPieceInstances, typeof PIECE_INSTANCES_KEYS>

const SEGMENT_KEYS = ['_id', 'segmentTiming'] as const
type Segment = PickKeys<DBSegment, typeof SEGMENT_KEYS>

export class ActivePlaylistTopic extends WebSocketTopicBase implements WebSocketTopic {
	private _activePlaylist: Playlist | undefined
	private _currentPartInstance: DBPartInstance | undefined
	private _nextPartInstance: DBPartInstance | undefined
	private _firstInstanceInSegmentPlayout: DBPartInstance | undefined
	private _partInstancesInCurrentSegment: DBPartInstance[] = []
	private _partsBySegmentId: Record<string, DBPart[]> = {}
	private _partsById: Record<string, DBPart | undefined> = {}
	private _segmentsById: Record<string, DBSegment | undefined> = {}
	private _pieceInstancesInCurrentPartInstance: PieceInstanceMin[] | undefined
	private _pieceInstancesInNextPartInstance: PieceInstanceMin[] | undefined
	private _showStyleBaseExt: ShowStyleBaseExt | undefined
	private _currentSegment: Segment | undefined

	constructor(logger: Logger, handlers: CollectionHandlers) {
		super(ActivePlaylistTopic.name, logger, THROTTLE_PERIOD_MS)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
		handlers.partsHandler.subscribe(this.onPartsUpdate)
		handlers.partInstancesHandler.subscribe(this.onPartInstancesUpdate, PART_INSTANCES_KEYS)
		handlers.pieceInstancesHandler.subscribe(this.onPieceInstancesUpdate, PIECE_INSTANCES_KEYS)
		handlers.showStyleBaseHandler.subscribe(this.onShowStyleBaseUpdate)
		handlers.segmentHandler.subscribe(this.onSegmentUpdate, SEGMENT_KEYS)
		handlers.segmentsHandler.subscribe(this.onSegmentsUpdate)
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		if (this.isDataInconsistent()) {
			// data is inconsistent, let's wait
			this._logger.debug('Encountered inconsistent data.')
			return
		}

		const currentPart = this._currentPartInstance ? this._currentPartInstance.part : null
		const nextPart = this._nextPartInstance ? this._nextPartInstance.part : null
		const currentSegmentParts =
			(currentPart && this._partsBySegmentId[unprotectString(currentPart.segmentId)]) ?? []

		const message = this._activePlaylist
			? literal<ActivePlaylistEvent>({
					event: 'activePlaylist',
					id: unprotectString(this._activePlaylist._id),
					name: this._activePlaylist.name,
					rundownIds: this._activePlaylist.rundownIdsInOrder.map((r) => unprotectString(r)),
					currentPart:
						this._currentPartInstance && currentPart
							? literal<CurrentPartStatus>({
									id: unprotectString(currentPart._id),
									name: currentPart.title,
									autoNext: currentPart.autoNext,
									segmentId: unprotectString(currentPart.segmentId),
									timing: calculateCurrentPartTiming(
										this._currentPartInstance,
										this._partInstancesInCurrentSegment
									),
									pieces:
										this._pieceInstancesInCurrentPartInstance?.map((piece) =>
											toPieceStatus(piece, this._showStyleBaseExt)
										) ?? [],
									publicData: currentPart.publicData,
								})
							: null,
					currentSegment:
						this._currentPartInstance && currentPart && this._currentSegment
							? literal<CurrentSegment>({
									id: unprotectString(currentPart.segmentId),
									timing: calculateCurrentSegmentTiming(
										this._currentSegment.segmentTiming,
										this._currentPartInstance,
										this._firstInstanceInSegmentPlayout,
										this._partInstancesInCurrentSegment,
										currentSegmentParts
									),
									parts: getCurrentSegmentParts(
										this._partInstancesInCurrentSegment,
										currentSegmentParts
									),
								})
							: null,
					nextPart: nextPart
						? literal<PartStatus>({
								id: unprotectString(nextPart._id),
								name: nextPart.title,
								autoNext: nextPart.autoNext,
								segmentId: unprotectString(nextPart.segmentId),
								pieces:
									this._pieceInstancesInNextPartInstance?.map((piece) =>
										toPieceStatus(piece, this._showStyleBaseExt)
									) ?? [],
								publicData: nextPart.publicData,
							})
						: null,
					quickLoop: this.transformQuickLoopStatus(),
					publicData: this._activePlaylist.publicData,
					timing: {
						timingMode: translatePlaylistTimingType(this._activePlaylist.timing.type),
						startedPlayback: this._activePlaylist.startedPlayback,
						expectedDurationMs: this._activePlaylist.timing.expectedDuration,
						expectedStart:
							this._activePlaylist.timing.type !== PlaylistTimingType.None
								? this._activePlaylist.timing.expectedStart
								: undefined,
						expectedEnd:
							this._activePlaylist.timing.type !== PlaylistTimingType.None
								? this._activePlaylist.timing.expectedEnd
								: undefined,
					},
				})
			: literal<ActivePlaylistEvent>({
					event: 'activePlaylist',
					id: null,
					name: '',
					rundownIds: [],
					currentPart: null,
					currentSegment: null,
					nextPart: null,
					quickLoop: undefined,
					publicData: undefined,
					timing: {
						timingMode: ActivePlaylistTimingMode.NONE,
					},
				})

		this.sendMessage(subscribers, message)
	}

	private transformQuickLoopStatus(): ActivePlaylistQuickLoop | undefined {
		if (!this._activePlaylist) return

		const quickLoopProps = this._activePlaylist.quickLoop
		if (!quickLoopProps) return undefined

		return {
			locked: quickLoopProps.locked,
			running: quickLoopProps.running,
			start: this.transformQuickLoopMarkerStatus(quickLoopProps.start),
			end: this.transformQuickLoopMarkerStatus(quickLoopProps.end),
		}
	}

	private transformQuickLoopMarkerStatus(marker: QuickLoopMarker | undefined): QuickLoopMarkerStatus | undefined {
		if (!marker) return undefined

		switch (marker.type) {
			case QuickLoopMarkerType.PLAYLIST:
				return {
					markerType: QuickLoopMarkerStatusType.PLAYLIST,
					rundownId: undefined,
					segmentId: undefined,
					partId: undefined,
				}
			case QuickLoopMarkerType.RUNDOWN:
				return {
					markerType: QuickLoopMarkerStatusType.RUNDOWN,
					rundownId: unprotectString(marker.id),
					segmentId: undefined,
					partId: undefined,
				}
			case QuickLoopMarkerType.SEGMENT: {
				const segment = this._segmentsById[unprotectString(marker.id)]

				return {
					markerType: QuickLoopMarkerStatusType.SEGMENT,
					rundownId: unprotectString(segment?.rundownId),
					segmentId: unprotectString(marker.id),
					partId: undefined,
				}
			}
			case QuickLoopMarkerType.PART: {
				const part = this._partsById[unprotectString(marker.id)]

				return {
					markerType: QuickLoopMarkerStatusType.PART,
					rundownId: unprotectString(part?.rundownId),
					segmentId: unprotectString(part?.segmentId),
					partId: unprotectString(marker.id),
				}
			}
			default:
				assertNever(marker)
				return undefined
		}
	}

	private isDataInconsistent() {
		return (
			this._currentPartInstance?._id !== this._activePlaylist?.currentPartInfo?.partInstanceId ||
			this._currentPartInstance?.segmentId !== this._currentSegment?._id ||
			this._nextPartInstance?._id !== this._activePlaylist?.nextPartInfo?.partInstanceId ||
			(this._pieceInstancesInCurrentPartInstance?.[0] &&
				this._pieceInstancesInCurrentPartInstance?.[0].partInstanceId !== this._currentPartInstance?._id) ||
			(this._pieceInstancesInNextPartInstance?.[0] &&
				this._pieceInstancesInNextPartInstance?.[0].partInstanceId !== this._nextPartInstance?._id)
		)
	}

	private onPlaylistUpdate = (rundownPlaylist: Playlist | undefined): void => {
		this.logUpdateReceived(
			'playlist',
			`rundownPlaylistId ${rundownPlaylist?._id}, activationId ${rundownPlaylist?.activationId}`
		)
		this._activePlaylist = unprotectString(rundownPlaylist?.activationId) ? rundownPlaylist : undefined

		this.throttledSendStatusToAll()
	}

	private onPartsUpdate = (parts: DBPart[] | undefined): void => {
		const previousParts = this._partsBySegmentId
		this._partsBySegmentId = _.groupBy(parts ?? [], 'segmentId')
		this.logUpdateReceived('parts')

		const currentSegmentId = unprotectString(this._currentPartInstance?.segmentId)
		if (
			currentSegmentId &&
			!areElementsShallowEqual(
				previousParts[currentSegmentId] ?? [],
				this._partsBySegmentId[currentSegmentId] ?? []
			)
		) {
			// we have to collect all the parts, but only when those from the current segment change, we should update status
			this.throttledSendStatusToAll()
		}
	}

	private onPartInstancesUpdate = (partInstances: PartInstances | undefined): void => {
		this.logUpdateReceived('partInstances', `${partInstances?.inCurrentSegment.length} instances in segment`)

		if (!partInstances) return
		this._currentPartInstance = partInstances.current
		this._nextPartInstance = partInstances.next
		this._firstInstanceInSegmentPlayout = partInstances.firstInSegmentPlayout
		this._partInstancesInCurrentSegment = partInstances.inCurrentSegment
		this.throttledSendStatusToAll()
	}

	private onPieceInstancesUpdate = (pieceInstances: PieceInstances | undefined): void => {
		this.logUpdateReceived('pieceInstances')
		if (!pieceInstances) return

		this._pieceInstancesInCurrentPartInstance = pieceInstances.currentPartInstance
		this._pieceInstancesInNextPartInstance = pieceInstances.nextPartInstance
		this.throttledSendStatusToAll()
	}

	private onShowStyleBaseUpdate = (showStyleBase: ShowStyleBaseExt | undefined): void => {
		this.logUpdateReceived('showStyleBase')
		this._showStyleBaseExt = showStyleBase
		this.throttledSendStatusToAll()
	}

	private onSegmentUpdate = (segment: Segment | undefined): void => {
		this.logUpdateReceived('segment')
		this._currentSegment = segment
		this.throttledSendStatusToAll()
	}

	private onSegmentsUpdate = (segments: DBSegment[] | undefined): void => {
		this.logUpdateReceived('segments')
		this._segmentsById = segments ? normalizeArray(segments, '_id') : {}
		this.throttledSendStatusToAll() // TODO: can this be smarter?
	}
}

function translatePlaylistTimingType(type: PlaylistTimingType): ActivePlaylistTimingMode {
	switch (type) {
		case PlaylistTimingType.None:
			return ActivePlaylistTimingMode.NONE
		case PlaylistTimingType.BackTime:
			return ActivePlaylistTimingMode.BACK_MINUS_TIME
		case PlaylistTimingType.ForwardTime:
			return ActivePlaylistTimingMode.FORWARD_MINUS_TIME
		default:
			assertNever(type)
			// Cast and return the value anyway, so that the application works
			return type as any as ActivePlaylistTimingMode
	}
}
