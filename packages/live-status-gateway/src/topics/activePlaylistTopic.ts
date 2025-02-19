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
import { SelectedPartInstances } from '../collections/partInstancesHandler'
import { ShowStyleBaseExt } from '../collections/showStyleBaseHandler'
import { WebSocketTopicBase, WebSocketTopic } from '../wsHandler'
import { CurrentSegmentTiming, calculateCurrentSegmentTiming } from './helpers/segmentTiming'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import _ = require('underscore')
import { PartTiming, calculateCurrentPartTiming } from './helpers/partTiming'
import { SelectedPieceInstances, PieceInstanceMin } from '../collections/pieceInstancesHandler'
import { PieceStatus, toPieceStatus } from './helpers/pieceStatus'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { normalizeArray } from '@sofie-automation/corelib/dist/lib'
import { CollectionHandlers } from '../liveStatusServer'
import areElementsShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'

const THROTTLE_PERIOD_MS = 100

interface PartStatus {
	id: string
	segmentId: string
	name: string
	autoNext: boolean | undefined
	pieces: PieceStatus[]
	publicData: unknown
}

interface CurrentPartStatus extends PartStatus {
	timing: PartTiming
}

interface CurrentSegmentStatus {
	id: string
	timing: CurrentSegmentTiming
}

interface ActivePlaylistQuickLoopMarker {
	type: 'playlist' | 'rundown' | 'segment' | 'part'
	rundownId: string | undefined
	segmentId: string | undefined
	partId: string | undefined
}

interface ActivePlaylistQuickLoopStatus {
	locked: boolean
	running: boolean
	start: ActivePlaylistQuickLoopMarker | undefined
	end: ActivePlaylistQuickLoopMarker | undefined
}

export interface ActivePlaylistStatus {
	event: string
	id: string | null
	name: string
	rundownIds: string[]
	currentPart: CurrentPartStatus | null
	currentSegment: CurrentSegmentStatus | null
	nextPart: PartStatus | null
	quickLoop: ActivePlaylistQuickLoopStatus | undefined
	publicData: unknown
	timing: {
		timingMode: PlaylistTimingType
		startedPlayback?: number
		expectedStart?: number
		expectedDurationMs?: number
		expectedEnd?: number
	}
}

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

		const message = this._activePlaylist
			? literal<ActivePlaylistStatus>({
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
							? literal<CurrentSegmentStatus>({
									id: unprotectString(currentPart.segmentId),
									timing: calculateCurrentSegmentTiming(
										this._currentSegment.segmentTiming,
										this._currentPartInstance,
										this._firstInstanceInSegmentPlayout,
										this._partInstancesInCurrentSegment,
										this._partsBySegmentId[unprotectString(currentPart.segmentId)] ?? []
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
						timingMode: this._activePlaylist.timing.type,
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
			: literal<ActivePlaylistStatus>({
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
						timingMode: PlaylistTimingType.None,
					},
			  })

		this.sendMessage(subscribers, message)
	}

	private transformQuickLoopStatus(): ActivePlaylistQuickLoopStatus | undefined {
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

	private transformQuickLoopMarkerStatus(
		marker: QuickLoopMarker | undefined
	): ActivePlaylistQuickLoopMarker | undefined {
		if (!marker) return undefined

		switch (marker.type) {
			case QuickLoopMarkerType.PLAYLIST:
				return {
					type: 'playlist',
					rundownId: undefined,
					segmentId: undefined,
					partId: undefined,
				}
			case QuickLoopMarkerType.RUNDOWN:
				return {
					type: 'rundown',
					rundownId: unprotectString(marker.id),
					segmentId: undefined,
					partId: undefined,
				}
			case QuickLoopMarkerType.SEGMENT: {
				const segment = this._segmentsById[unprotectString(marker.id)]

				return {
					type: 'segment',
					rundownId: unprotectString(segment?.rundownId),
					segmentId: unprotectString(marker.id),
					partId: undefined,
				}
			}
			case QuickLoopMarkerType.PART: {
				const part = this._partsById[unprotectString(marker.id)]

				return {
					type: 'part',
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
