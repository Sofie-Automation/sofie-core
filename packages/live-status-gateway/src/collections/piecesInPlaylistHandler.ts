import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { PublicationCollection } from '../publicationCollection.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import _ from 'underscore'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { CollectionHandlers } from '../liveStatusServer.js'
import throttleToNextTick from '@sofie-automation/shared-lib/dist/lib/throttleToNextTick'

const PLAYLIST_KEYS = ['rundownIdsInOrder'] as const
type Playlist = Pick<DBRundownPlaylist, (typeof PLAYLIST_KEYS)[number]>

/** Publishes all pieces belonging to rundowns in the currently selected playlist. */
export class PiecesInPlaylistHandler extends PublicationCollection<
	Piece[],
	CorelibPubSub.pieces,
	CollectionName.Pieces
> {
	private _currentRundownIds: Playlist['rundownIdsInOrder'] | undefined

	private _throttledUpdateAndNotify = throttleToNextTick(() => {
		this.updateAndNotify()
	})

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.Pieces, CorelibPubSub.pieces, logger, coreHandler)
		this._collectionData = []
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)
		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
	}

	protected changed(): void {
		this._throttledUpdateAndNotify()
	}

	private updateAndNotify() {
		const collection = this.getCollectionOrFail()
		const pieces = collection.find(undefined)
		this._collectionData = pieces
		this.notify(this._collectionData)
	}

	private onPlaylistUpdate = (playlist: Playlist | undefined): void => {
		const rundownIds = playlist?.rundownIdsInOrder
		const prevRundownIds = this._currentRundownIds
		this._currentRundownIds = rundownIds

		if (rundownIds && rundownIds.length) {
			const sameSubscription = _.isEqual(prevRundownIds, rundownIds) && this._subscriptionId
			if (!sameSubscription) {
				this.setupSubscription(rundownIds, null)
			} else if (this._subscriptionId) {
				this.updateAndNotify()
			} else {
				this.clearAndNotify()
			}
		} else {
			this.stopSubscription()
			this.clearAndNotify()
		}
	}

	private clearAndNotify() {
		this._collectionData = []
		this.notify(this._collectionData)
	}
}
