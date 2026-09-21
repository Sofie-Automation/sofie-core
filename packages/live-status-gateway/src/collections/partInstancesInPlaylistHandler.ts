import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { PublicationCollection } from '../publicationCollection.js'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { CustomCollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionHandlers } from '../liveStatusServer.js'
import areElementsShallowEqual from '@sofie-automation/shared-lib/dist/lib/isShallowEqual'
import throttleToNextTick from '@sofie-automation/shared-lib/dist/lib/throttleToNextTick'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'

export interface PartInstancesInPlaylist {
	all: DBPartInstance[]
}

const PLAYLIST_KEYS = ['_id', 'activationId'] as const
type Playlist = Pick<DBRundownPlaylist, (typeof PLAYLIST_KEYS)[number]>

/**
 * Maintains part instances for the currently active playlist.
 * Subscription is re-created when the activation id changes.
 */
export class PartInstancesInPlaylistHandler extends PublicationCollection<
	PartInstancesInPlaylist,
	CorelibPubSub.uiPartInstances,
	CustomCollectionName.UIPartInstances
> {
	private _currentPlaylist: Playlist | undefined
	private _activationId: RundownPlaylistActivationId | undefined

	private _throttledUpdateAndNotify = throttleToNextTick(() => {
		this.updateAndNotify()
	})

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CustomCollectionName.UIPartInstances, CorelibPubSub.uiPartInstances, logger, coreHandler)
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
		const prevActivationId = this._activationId

		this._currentPlaylist = data
		this._activationId = this._currentPlaylist?.activationId

		if (this._currentPlaylist && this._activationId) {
			// The publication tracks the Rundowns of the playlist itself, so it only needs re-subscribing
			// when the activation changes
			const sameSubscription = prevActivationId === this._activationId
			if (!sameSubscription) {
				this.stopSubscription()
				this.setupSubscription(this._activationId)
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
		this.clearCollectionData()
		this.notify(this._collectionData)
	}

	private updateAndNotify() {
		const hasAnythingChanged = this.updateCollectionData()
		if (hasAnythingChanged) this.notify(this._collectionData)
	}
}
