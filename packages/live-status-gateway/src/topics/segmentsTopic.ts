import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { WebSocketTopicBase, WebSocketTopic } from '../wsHandler.js'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { groupByToMap } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import _ from 'underscore'
import { calculateSegmentTiming } from './helpers/segmentTiming.js'
import { SegmentsEvent } from '@sofie-automation/live-status-gateway-api'
import { CollectionHandlers } from '../liveStatusServer.js'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'

const THROTTLE_PERIOD_MS = 200

const PLAYLIST_KEYS = ['_id', 'rundownIdsInOrder', 'activationId'] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

export class SegmentsTopic extends WebSocketTopicBase implements WebSocketTopic {
	private _activePlaylist: Playlist | undefined
	private _segments: DBSegment[] = []
	private _partsBySegment: Record<string, DBPart[]> = {}
	private _orderedSegments: DBSegment[] = []

	constructor(logger: Logger, handlers: CollectionHandlers) {
		super(SegmentsTopic.name, logger, THROTTLE_PERIOD_MS)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
		handlers.segmentsHandler.subscribe(this.onSegmentsUpdate)
		handlers.partsHandler.subscribe(this.onPartsUpdate)
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		const segmentsStatus: SegmentsEvent = {
			event: 'segments',
			rundownPlaylistId: this._activePlaylist ? unprotectString(this._activePlaylist._id) : null,
			segments: this._orderedSegments.map((segment) => {
				const segmentId = unprotectString(segment._id)
				return {
					id: segmentId,
					rundownId: unprotectString(segment.rundownId),
					name: segment.name,
					timing: calculateSegmentTiming(segment.segmentTiming, this._partsBySegment[segmentId] ?? []),
					identifier: segment.identifier,
					publicData: segment.publicData,
				}
			}),
		}

		this.sendMessage(subscribers, segmentsStatus)
	}

	private onPlaylistUpdate = (rundownPlaylist: Playlist | undefined): void => {
		this.logUpdateReceived(
			'playlist',
			`rundownPlaylistId ${rundownPlaylist?._id}, activationId ${rundownPlaylist?.activationId}`
		)
		this._activePlaylist = rundownPlaylist
		this.updateAndSendStatusToAll()
	}

	private onSegmentsUpdate = (segments: DBSegment[] | undefined): void => {
		this.logUpdateReceived('segments')
		this._segments = segments ?? []
		this.updateAndSendStatusToAll()
	}

	private onPartsUpdate = (parts: DBPart[] | undefined): void => {
		this.logUpdateReceived('parts')
		this._partsBySegment = _.groupBy(parts ?? [], 'segmentId')
		this.updateAndSendStatusToAll()
	}

	private updateAndSendStatusToAll() {
		const segmentsByRundownId = groupByToMap(this._segments, 'rundownId')
		this._orderedSegments =
			this._activePlaylist?.rundownIdsInOrder.flatMap((rundownId) => {
				return segmentsByRundownId.get(rundownId)?.sort((a, b) => a._rank - b._rank) ?? []
			}) ?? []
		this.throttledSendStatusToAll()
	}
}
