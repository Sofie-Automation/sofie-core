import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { WebSocketTopicBase, WebSocketTopic } from '../wsHandler.js'
import { CollectionHandlers } from '../liveStatusServer.js'
import { toResolvedPlaylistStatus } from './helpers/resolvedPlaylistConversion/events/toResolvedPlaylistStatus.js'
import type { ToResolvedPlaylistStatusProps } from './helpers/resolvedPlaylistConversion/context/conversionContext.js'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance, PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { PartInstancesInPlaylist } from '../collections/partInstancesInPlaylistHandler.js'
import { ShowStyleBaseExt } from '../collections/showStyleBaseHandler.js'

const THROTTLE_PERIOD_MS = 100

const PLAYLIST_KEYS = [
	'_id',
	'externalId',
	'activationId',
	'rehearsal',
	'name',
	'rundownIdsInOrder',
	'quickLoop',
	'currentPartInfo',
	'nextPartInfo',
	'publicData',
	'publicPlayoutPersistentState',
	'timing',
	'tTimers',
] as const
type PlaylistState = Pick<DBRundownPlaylist, (typeof PLAYLIST_KEYS)[number]>

/**
 * Aggregates playlist-scoped collections and publishes the `resolvedPlaylist` topic.
 * Data is cached locally and merged into a single event on every source update.
 */
export class ResolvedPlaylistTopic extends WebSocketTopicBase implements WebSocketTopic {
	private _playlist: PlaylistState | undefined
	private _rundowns: DBRundown[] = []
	private _segments: DBSegment[] = []
	private _parts: DBPart[] = []
	private _partInstancesInPlaylist: DBPartInstance[] = []
	private _showStyleBaseExt: ShowStyleBaseExt | undefined
	private _piecesInPlaylist: Piece[] = []
	private _pieceInstancesInPlaylist: PieceInstance[] = []

	constructor(logger: Logger, handlers: CollectionHandlers) {
		super('resolvedPlaylist', logger, THROTTLE_PERIOD_MS)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
		handlers.rundownsHandler.subscribe(this.onRundownsUpdate)
		handlers.showStyleBaseHandler.subscribe(this.onShowStyleBaseUpdate)
		handlers.segmentsHandler.subscribe(this.onSegmentsUpdate)
		handlers.partsHandler.subscribe(this.onPartsUpdate)
		handlers.partInstancesInPlaylistHandler.subscribe(this.onPartInstancesInPlaylistUpdate, ['all'])
		handlers.piecesInPlaylistHandler.subscribe(this.onPiecesInPlaylistUpdate)
		handlers.pieceInstancesInPlaylistHandler.subscribe(this.onPieceInstancesInPlaylistUpdate)
	}

	/** Builds and publishes the current resolved playlist snapshot to all subscribers. */
	sendStatus(subscribers: Iterable<WebSocket>): void {
		const message = toResolvedPlaylistStatus({
			playlistState: this._playlist as ToResolvedPlaylistStatusProps['playlistState'],
			rundownsState: this._rundowns,
			showStyleBaseExtState: this._showStyleBaseExt,
			segmentsState: this._segments,
			partsState: this._parts,
			partInstancesInPlaylistState: this._partInstancesInPlaylist as PartInstance[],
			piecesInPlaylistState: this._piecesInPlaylist,
			pieceInstancesInPlaylistState: this._pieceInstancesInPlaylist,
		})

		this.sendMessage(subscribers, message)
	}

	private onPlaylistUpdate = (playlist: PlaylistState | undefined): void => {
		this.logUpdateReceived('playlist', `rundownPlaylistId ${playlist?._id}`)
		this._playlist = playlist
		this.throttledSendStatusToAll()
	}

	private onRundownsUpdate = (rundowns: ToResolvedPlaylistStatusProps['rundownsState'] | undefined): void => {
		this.logUpdateReceived('rundowns', `${rundowns?.length ?? 0} rundowns`)
		this._rundowns = rundowns ?? []
		this.throttledSendStatusToAll()
	}

	private onShowStyleBaseUpdate = (showStyleBase: ToResolvedPlaylistStatusProps['showStyleBaseExtState']): void => {
		this.logUpdateReceived('showStyleBase')
		this._showStyleBaseExt = showStyleBase
		this.throttledSendStatusToAll()
	}

	private onSegmentsUpdate = (segments: ToResolvedPlaylistStatusProps['segmentsState'] | undefined): void => {
		this.logUpdateReceived('segments')
		this._segments = segments ?? []
		this.throttledSendStatusToAll()
	}

	private onPartsUpdate = (parts: ToResolvedPlaylistStatusProps['partsState'] | undefined): void => {
		this.logUpdateReceived('parts', `${parts?.length ?? 0} parts`)
		this._parts = parts ?? []
		this.throttledSendStatusToAll()
	}

	private onPartInstancesInPlaylistUpdate = (data: Pick<PartInstancesInPlaylist, 'all'> | undefined): void => {
		this.logUpdateReceived('partInstancesInPlaylist')
		this._partInstancesInPlaylist = data?.all ?? []
		this.throttledSendStatusToAll()
	}

	private onPiecesInPlaylistUpdate = (
		pieces: ToResolvedPlaylistStatusProps['piecesInPlaylistState'] | undefined
	): void => {
		this.logUpdateReceived('piecesInPlaylist', `${pieces?.length ?? 0} pieces`)
		this._piecesInPlaylist = pieces ?? []
		this.throttledSendStatusToAll()
	}

	private onPieceInstancesInPlaylistUpdate = (
		pieceInstances: ToResolvedPlaylistStatusProps['pieceInstancesInPlaylistState'] | undefined
	): void => {
		this.logUpdateReceived('pieceInstancesInPlaylist', `${pieceInstances?.length ?? 0} pieceInstances`)
		this._pieceInstancesInPlaylist = pieceInstances ?? []
		this.throttledSendStatusToAll()
	}
}
