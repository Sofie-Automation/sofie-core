import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { PublicationCollection } from '../publicationCollection.js'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { RundownId, RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionHandlers } from '../liveStatusServer.js'
import areElementsShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'
import throttleToNextTick from '@sofie-automation/shared-lib/dist/lib/throttleToNextTick'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'

export interface PartInstancesInPlaylist {
	all: DBPartInstance[]
}

const PLAYLIST_KEYS = ['_id', 'activationId', 'rundownIdsInOrder'] as const
type Playlist = Pick<DBRundownPlaylist, (typeof PLAYLIST_KEYS)[number]>

export class PartInstancesInPlaylistHandler extends PublicationCollection<
	PartInstancesInPlaylist,
	CorelibPubSub.partInstances,
	CollectionName.PartInstances
> {
	private _currentPlaylist: Playlist | undefined
	private _rundownIds: RundownId[] = []
	private _activationId: RundownPlaylistActivationId | undefined

	private _throttledUpdateAndNotify = throttleToNextTick(() => {
		this.updateAndNotify()
	})

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.PartInstances, CorelibPubSub.partInstances, logger, coreHandler)
		this._collectionData = {
			all: [],
		}
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)
		handlers.playlistHandler.subscribe(this.onPlaylistUpdate, PLAYLIST_KEYS)
	}

	protected changed(): void {
		this._throttledUpdateAndNotify()
	}

	private updateCollectionData(): boolean {
		if (!this._collectionData) return false
		const collection = this.getCollectionOrFail()
		const allPartInstances = collection.find(undefined)

		const hasAnythingChanged = !areElementsShallowEqual(this._collectionData.all, allPartInstances)
		if (hasAnythingChanged) this._collectionData.all = allPartInstances

		return hasAnythingChanged
	}

	private clearCollectionData() {
		if (!this._collectionData) return
		this._collectionData.all = []
	}

	private onPlaylistUpdate = (data: Playlist | undefined): void => {
		const prevRundownIds = [...this._rundownIds]
		const prevActivationId = this._activationId

		this._currentPlaylist = data
		this._rundownIds = this._currentPlaylist ? this._currentPlaylist.rundownIdsInOrder : []
		this._activationId = this._currentPlaylist?.activationId

		if (this._currentPlaylist && this._rundownIds.length && this._activationId) {
			const sameSubscription =
				areElementsShallowEqual(this._rundownIds, prevRundownIds) && prevActivationId === this._activationId
			if (!sameSubscription) {
				this.stopSubscription()
				this.setupSubscription(this._rundownIds, this._activationId)
			} else if (this._subscriptionId) {
				this.updateAndNotify()
			} else {
				this.clearAndNotify()
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
		const hasAnythingChanged = this.updateCollectionData()
		if (hasAnythingChanged) this.notify(this._collectionData)
	}
}
