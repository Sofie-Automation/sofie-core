import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { UIPieceContentStatus } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { assertNever } from '@sofie-automation/server-core-integration'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'
import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { CollectionHandlers } from '../liveStatusServer.js'
import { WebSocketTopic, WebSocketTopicBase } from '../wsHandler.js'
import { PackagesEvent, PackageStatus } from '@sofie-automation/live-status-gateway-api'

const THROTTLE_PERIOD_MS = 200

const PLAYLIST_KEYS = ['_id', 'activationId'] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

export class PackagesTopic extends WebSocketTopicBase implements WebSocketTopic {
	public observerName = PackagesTopic.name
	private _activePlaylist: Playlist | undefined
	private _pieceContentStatuses: UIPieceContentStatus[] = []

	constructor(logger: Logger, handlers: CollectionHandlers) {
		super(PackagesTopic.name, logger, THROTTLE_PERIOD_MS)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
		handlers.pieceContentStatusesHandler.subscribe(this.onPieceContentStatusUpdate)
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		const packagesStatus: PackagesEvent = {
			event: 'packages',
			rundownPlaylistId: this._activePlaylist ? unprotectString(this._activePlaylist._id) : null,
			packages: this._pieceContentStatuses.map((contentStatus) => ({
				packageName: contentStatus.status.packageName ?? undefined,
				status: this.toStatusString(contentStatus.status.status),
				pieceOrAdLibId: unprotectString(contentStatus.pieceId),
				rundownId: unprotectString(contentStatus.rundownId),
				partId: unprotectString(contentStatus.partId),
				segmentId: unprotectString(contentStatus.segmentId),
				previewUrl: contentStatus.status.previewUrl,
				thumbnailUrl: contentStatus.status.thumbnailUrl,
			})),
		}

		for (const subscriber of subscribers) {
			this.sendMessage(subscriber, packagesStatus)
		}
	}

	private toStatusString(status: PieceStatusCode): PackageStatus {
		switch (status) {
			case PieceStatusCode.UNKNOWN:
				return PackageStatus.UNKNOWN
			case PieceStatusCode.OK:
				return PackageStatus.OK
			case PieceStatusCode.SOURCE_BROKEN:
				return PackageStatus.SOURCE_BROKEN
			case PieceStatusCode.SOURCE_HAS_ISSUES:
				return PackageStatus.SOURCE_HAS_ISSUES
			case PieceStatusCode.SOURCE_MISSING:
				return PackageStatus.SOURCE_MISSING
			case PieceStatusCode.SOURCE_NOT_READY:
				return PackageStatus.SOURCE_NOT_READY
			case PieceStatusCode.SOURCE_NOT_SET:
				return PackageStatus.SOURCE_NOT_SET
			case PieceStatusCode.SOURCE_UNKNOWN_STATE:
				return PackageStatus.SOURCE_UNKNOWN_STATE
			default:
				assertNever(status)
				return PackageStatus.UNKNOWN
		}
	}

	private onPlaylistUpdate = (rundownPlaylist: Playlist | undefined): void => {
		this.logUpdateReceived(
			'playlist',
			`rundownPlaylistId ${rundownPlaylist?._id}, activationId ${rundownPlaylist?.activationId}`
		)
		const prevPlaylist = this._activePlaylist
		this._activePlaylist = rundownPlaylist

		if (prevPlaylist?._id !== this._activePlaylist?._id) {
			this.throttledSendStatusToAll()
		}
	}

	private onPieceContentStatusUpdate = (data: UIPieceContentStatus[] | undefined): void => {
		this.logUpdateReceived('pieceContentStatuses')
		if (!data) return
		this._pieceContentStatuses = data
		this.throttledSendStatusToAll()
	}
}
