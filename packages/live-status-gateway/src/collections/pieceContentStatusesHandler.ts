import { CustomCollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIPieceContentStatus } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import throttleToNextTick from '@sofie-automation/shared-lib/dist/lib/throttleToNextTick'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'
import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { CollectionHandlers } from '../liveStatusServer.js'
import { PublicationCollection } from '../publicationCollection.js'

const PLAYLIST_KEYS = ['_id'] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

export class PieceContentStatusesHandler extends PublicationCollection<
	UIPieceContentStatus[],
	CorelibPubSub.uiPieceContentStatuses,
	CustomCollectionName.UIPieceContentStatuses
> {
	private _currentPlaylistId: RundownPlaylistId | undefined

	private _throttledUpdateAndNotify = throttleToNextTick(() => {
		this.updateAndNotify()
	})

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CustomCollectionName.UIPieceContentStatuses, CorelibPubSub.uiPieceContentStatuses, logger, coreHandler)
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)

		handlers.playlistHandler.subscribe(this.onPlaylistUpdated, PLAYLIST_KEYS)
	}

	protected changed(): void {
		this._throttledUpdateAndNotify()
	}

	private updateCollectionData() {
		const collection = this.getCollectionOrFail()
		this._collectionData = collection.find({})
	}

	private clearCollectionData() {
		this._collectionData = []
	}

	onPlaylistUpdated = (playlist: Playlist | undefined): void => {
		this.logUpdateReceived('playlist', `rundownPlaylistId ${playlist?._id}`)
		const prevPlaylistId = this._currentPlaylistId
		this._currentPlaylistId = playlist?._id

		if (this._currentPlaylistId) {
			if (prevPlaylistId !== this._currentPlaylistId) {
				this.stopSubscription()
				this.setupSubscription(this._currentPlaylistId)
			}
		} else {
			this.clearAndNotify()
		}
	}

	private clearAndNotify() {
		this.clearCollectionData()
		this.notify(this._collectionData)
	}

	private updateAndNotify() {
		this.updateCollectionData()
		this.notify(this._collectionData)
	}
}
