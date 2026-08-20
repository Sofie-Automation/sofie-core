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
import { PartInstanceId, RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PartInstancesInPlaylist } from './partInstancesInPlaylistHandler.js'

/** Playlist fields needed to scope piece-instances to active playlist context. */
const PLAYLIST_KEYS = ['rundownIdsInOrder', 'activationId'] as const
type Playlist = Pick<DBRundownPlaylist, (typeof PLAYLIST_KEYS)[number]>

/**
 * Publishes piece instances for the active playlist.
 * Scope is derived from both rundown ids and currently available part-instance ids.
 */
export class PieceInstancesInPlaylistHandler extends PublicationCollection<
	PieceInstance[],
	CorelibPubSub.pieceInstances,
	CollectionName.PieceInstances
> {
	private _currentRundownIds: Playlist['rundownIdsInOrder'] | undefined
	private _currentActivationId: RundownPlaylistActivationId | undefined
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
		const prevRundownIds = this._currentRundownIds
		const prevActivationId = this._currentActivationId

		const newActivationId = playlist?.activationId
		if (newActivationId !== prevActivationId) {
			// Ensure no stale piece instances from the previous activation leak through
			this.stopSubscription()
			this.clearAndNotify()
		}

		this._currentRundownIds = playlist?.rundownIdsInOrder
		this._currentActivationId = newActivationId
		this.resubscribe(prevRundownIds, this._partInstanceIds, prevActivationId)
	}

	private onPartInstancesInPlaylistUpdate = (data: PartInstancesInPlaylist | undefined): void => {
		const prevPartInstanceIds = this._partInstanceIds
		const prevActivationId = this._currentActivationId
		this._partInstanceIds = data?.all?.flatMap((pi: any) => (pi._id ? [pi._id] : [])).sort() ?? []
		this.resubscribe(this._currentRundownIds, prevPartInstanceIds, prevActivationId)
	}

	private resubscribe(
		prevRundownIds: Playlist['rundownIdsInOrder'] | undefined,
		prevPartInstanceIds: PartInstanceId[],
		prevActivationId: RundownPlaylistActivationId | undefined
	): void {
		// No rundown scope -> nothing should be published.
		if (!this._currentRundownIds || this._currentRundownIds.length === 0) {
			this.stopSubscription()
			this.clearAndNotify()
			return
		}
		// No active playlist context -> nothing should be published.
		if (!this._currentActivationId) {
			this.stopSubscription()
			this.clearAndNotify()
			return
		}
		// No active/derived part instances -> no matching piece instances can exist.
		if (!this._partInstanceIds.length) {
			this.stopSubscription()
			this.clearAndNotify()
			return
		}

		const sameSubscription =
			_.isEqual(prevRundownIds, this._currentRundownIds) &&
			_.isEqual(prevPartInstanceIds, this._partInstanceIds) &&
			prevActivationId === this._currentActivationId

		if (!sameSubscription) {
			// Subscription arguments changed; recreate the server-side observer with new filters.
			this.stopSubscription()
			this.setupSubscription(this._currentRundownIds, this._partInstanceIds, {})
		} else if (this._subscriptionId) {
			// Filter scope is unchanged and subscription is alive; just republish latest local snapshot.
			this.updateAndNotify()
		} else {
			this.clearAndNotify()
		}
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
