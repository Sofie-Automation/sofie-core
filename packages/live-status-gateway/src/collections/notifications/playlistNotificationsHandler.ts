import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import throttleToNextTick from '@sofie-automation/shared-lib/dist/lib/throttleToNextTick'
import { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'
import { Logger } from 'winston'
import { CoreHandler } from '../../coreHandler.js'
import { CollectionHandlers } from '../../liveStatusServer.js'
import { PublicationCollection } from '../../publicationCollection.js'
import {
	DBNotificationObj,
	DBNotificationTargetRundownPlaylist,
} from '@sofie-automation/corelib/dist/dataModel/Notifications'

const PLAYLIST_KEYS = ['_id'] as const
type Playlist = PickKeys<DBRundownPlaylist, typeof PLAYLIST_KEYS>

/**
 * Handler: playlist-level notifications (notificationsForRundownPlaylist)
 * Publishes the notifications that are attached to the playlist as a whole.
 */
export class PlaylistNotificationsHandler extends PublicationCollection<
	DBNotificationObj[],
	CorelibPubSub.notificationsForRundownPlaylist,
	CollectionName.Notifications
> {
	private _currentPlaylistId: RundownPlaylistId | undefined

	private _throttledUpdateAndNotify = throttleToNextTick(() => {
		this.updateAndNotify()
	})

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.Notifications, CorelibPubSub.notificationsForRundownPlaylist, logger, coreHandler)
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
		this._collectionData = collection.find((doc: DBNotificationObj) => {
			const relatedTo: DBNotificationTargetRundownPlaylist | undefined = (doc.relatedTo as any).playlistId
				? (doc.relatedTo as DBNotificationTargetRundownPlaylist)
				: undefined

			return (
				relatedTo && relatedTo.playlistId === this._currentPlaylistId && this._studioId === relatedTo.studioId
			)
		})
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
				// stop old subscription(s) and set up new one for the new playlist
				this.stopSubscription()
				this.setupSubscription(this._studioId, this._currentPlaylistId)
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

	public getPublishedDocs(): DBNotificationObj[] {
		return this._collectionData ? [...this._collectionData] : []
	}
}
