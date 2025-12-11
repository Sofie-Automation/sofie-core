// notificationsHandlers.ts
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { RundownPlaylistId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import throttleToNextTick from '@sofie-automation/shared-lib/dist/lib/throttleToNextTick'
import { Logger } from 'winston'
import { CoreHandler } from '../../coreHandler.js'
import { CollectionHandlers } from '../../liveStatusServer.js'
import { PublicationCollection } from '../../publicationCollection.js'
import { DBNotificationObj, DBNotificationTargetRundown } from '@sofie-automation/corelib/dist/dataModel/Notifications'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

const PLAYLIST_KEYS = ['_id', 'rundownIdsInOrder'] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

/**
 * Handler: rundown-level notifications (notificationsForRundown)
 * Subscribes to notifications for each rundown that belongs to the active playlist.
 */
export class RundownNotificationsHandler extends PublicationCollection<
	DBNotificationObj[],
	CorelibPubSub.notificationsForRundown,
	CollectionName.Notifications
> {
	private _currentPlaylistId: RundownPlaylistId | undefined
	private _currentRundownIds: RundownId[] = []

	private _throttledUpdateAndNotify = throttleToNextTick(() => {
		this.updateAndNotify()
	})

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.Notifications, CorelibPubSub.notificationsForRundown, logger, coreHandler)
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)

		// Listen to playlist updates so we can pick up rundown IDs
		handlers.playlistHandler.subscribe(this.onPlaylistUpdated, PLAYLIST_KEYS)
	}

	protected changed(): void {
		this._throttledUpdateAndNotify()
	}

	private updateCollectionData() {
		const collection = this.getCollectionOrFail()
		this._collectionData = collection.find((doc: DBNotificationObj) => {
			const relatedTo: DBNotificationTargetRundown | undefined = (doc.relatedTo as any).rundownId
				? (doc.relatedTo as DBNotificationTargetRundown)
				: undefined

			return (
				relatedTo &&
				this._currentRundownIds.includes(relatedTo.rundownId) &&
				this._studioId === relatedTo.studioId
			)
		})
	}

	private clearCollectionData() {
		this._collectionData = []
	}

	private setupRundownSubscriptionsForPlaylist(playlist: Playlist) {
		this.stopSubscription()

		if (!playlist.rundownIdsInOrder) {
			this._currentRundownIds = []
			return
		}

		this._currentRundownIds = playlist.rundownIdsInOrder

		for (const rundownId of this._currentRundownIds) {
			this.setupSubscription(this._studioId, rundownId)
		}
	}

	onPlaylistUpdated = (playlist: Playlist | undefined): void => {
		this.logUpdateReceived('playlist', `rundownPlaylistId ${playlist?._id}`)

		const prevPlaylistId = this._currentPlaylistId
		this._currentPlaylistId = playlist?._id

		if (playlist && this._currentPlaylistId) {
			if (
				prevPlaylistId !== this._currentPlaylistId ||
				this._currentRundownIds.join(',') !== (playlist.rundownIdsInOrder ?? []).join(',')
			) {
				this.setupRundownSubscriptionsForPlaylist(playlist)
			}
		} else {
			this._currentRundownIds = []
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

	public getPublishedDocs(): DBNotificationObj[] {
		return this._collectionData ? [...this._collectionData] : []
	}
}
