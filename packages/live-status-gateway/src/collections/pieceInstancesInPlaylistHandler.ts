import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { PublicationCollection } from '../publicationCollection.js'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import _ from 'underscore'
import throttleToNextTick from '@sofie-automation/shared-lib/dist/lib/throttleToNextTick'
import { CollectionHandlers } from '../liveStatusServer.js'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { PartInstancesInPlaylistHandler } from './partInstancesInPlaylistHandler.js'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PartInstancesInPlaylist } from './partInstancesInPlaylistHandler.js'

const PLAYLIST_KEYS = ['rundownIdsInOrder', 'activationId'] as const
type Playlist = Pick<DBRundownPlaylist, (typeof PLAYLIST_KEYS)[number]>

export class PieceInstancesInPlaylistHandler extends PublicationCollection<
	PieceInstance[],
	CorelibPubSub.pieceInstances,
	CollectionName.PieceInstances
> {
	private _currentRundownIds: Playlist['rundownIdsInOrder'] | undefined
	private _partInstanceIds: PartInstanceId[] = []

	private _throttledUpdateAndNotify = throttleToNextTick(() => {
		this.updateAndNotify()
	})

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.PieceInstances, CorelibPubSub.pieceInstances, logger, coreHandler)
		this._collectionData = []
	}

	init(handlers: CollectionHandlers & { partInstancesInPlaylistHandler: PartInstancesInPlaylistHandler }): void {
		super.init(handlers)
		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
		handlers.partInstancesInPlaylistHandler.subscribe(this.onPartInstancesInPlaylistUpdate, ['all'])
	}

	protected changed(): void {
		this._throttledUpdateAndNotify()
	}

	private onPlaylistUpdate = (playlist: Playlist | undefined): void => {
		this._currentRundownIds = playlist?.rundownIdsInOrder
		this.maybeResubscribe()
	}

	private onPartInstancesInPlaylistUpdate = (data: PartInstancesInPlaylist | undefined): void => {
		this._partInstanceIds = _.compact((data?.all ?? []).map((pi: any) => pi._id)).sort()
		this.maybeResubscribe()
	}

	private maybeResubscribe(): void {
		if (!this._currentRundownIds || this._currentRundownIds.length === 0) {
			this.stopSubscription()
			this.clearAndNotify()
			return
		}
		if (!this._partInstanceIds.length) {
			this.stopSubscription()
			this.clearAndNotify()
			return
		}

		// Always resubscribe when our filter set changes (simple/prototype behavior).
		this.stopSubscription()
		this.setupSubscription(this._currentRundownIds, this._partInstanceIds, {})
	}

	private updateAndNotify(): void {
		const collection = this.getCollectionOrFail()
		this._collectionData = collection.find(undefined)
		this.notify(this._collectionData)
	}

	private clearAndNotify() {
		this._collectionData = []
		this.notify(this._collectionData)
	}
}
