import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { WebSocketTopicBase, WebSocketTopic } from '../wsHandler.js'
import { ShowStyleBaseExt } from '../collections/showStyleBaseHandler.js'
import { SelectedPieceInstances, PieceInstanceMin } from '../collections/pieceInstancesHandler.js'
import { toPieceStatus } from './helpers/pieceStatus.js'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionHandlers } from '../liveStatusServer.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'
import { ActivePiecesEvent } from '@sofie-automation/live-status-gateway-api'

const THROTTLE_PERIOD_MS = 100

const PLAYLIST_KEYS = ['_id', 'activationId'] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

const PIECE_INSTANCES_KEYS = ['active'] as const
type PieceInstances = PickKeys<SelectedPieceInstances, typeof PIECE_INSTANCES_KEYS>

export class ActivePiecesTopic extends WebSocketTopicBase implements WebSocketTopic {
	private _activePlaylistId: RundownPlaylistId | undefined
	private _activePieceInstances: PieceInstanceMin[] | undefined
	private _showStyleBaseExt: ShowStyleBaseExt | undefined

	constructor(logger: Logger, handlers: CollectionHandlers) {
		super(ActivePiecesTopic.name, logger, THROTTLE_PERIOD_MS)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
		handlers.showStyleBaseHandler.subscribe(this.onShowStyleBaseUpdate)
		handlers.pieceInstancesHandler.subscribe(this.onPieceInstancesUpdate, PIECE_INSTANCES_KEYS)
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		const message = this._activePlaylistId
			? literal<ActivePiecesEvent>({
					event: 'activePieces',
					rundownPlaylistId: unprotectString(this._activePlaylistId),
					activePieces:
						this._activePieceInstances?.map((piece) => toPieceStatus(piece, this._showStyleBaseExt)) ?? [],
				})
			: literal<ActivePiecesEvent>({
					event: 'activePieces',
					rundownPlaylistId: null,
					activePieces: [],
				})

		this.sendMessage(subscribers, message)
	}

	private onShowStyleBaseUpdate = (showStyleBase: ShowStyleBaseExt | undefined): void => {
		this.logUpdateReceived('showStyleBase')
		this._showStyleBaseExt = showStyleBase
		this.throttledSendStatusToAll()
	}

	private onPlaylistUpdate = (rundownPlaylist: Playlist | undefined): void => {
		this.logUpdateReceived(
			'playlist',
			`rundownPlaylistId ${rundownPlaylist?._id}, activationId ${rundownPlaylist?.activationId}`
		)
		const previousActivePlaylistId = this._activePlaylistId
		this._activePlaylistId = unprotectString(rundownPlaylist?.activationId) ? rundownPlaylist?._id : undefined

		if (previousActivePlaylistId !== this._activePlaylistId) {
			this.throttledSendStatusToAll()
		}
	}

	private onPieceInstancesUpdate = (pieceInstances: PieceInstances | undefined): void => {
		this.logUpdateReceived('pieceInstances')
		const prevPieceInstances = this._activePieceInstances
		this._activePieceInstances = pieceInstances?.active
		if (prevPieceInstances !== this._activePieceInstances) {
			this.throttledSendStatusToAll()
		}
	}
}
