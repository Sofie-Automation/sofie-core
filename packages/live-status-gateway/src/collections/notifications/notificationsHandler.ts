import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { Logger } from 'winston'
import { CoreHandler } from '../../coreHandler.js'
import { CollectionHandlers } from '../../liveStatusServer.js'
import { PublicationCollection } from '../../publicationCollection.js'
import { DBNotificationObj } from '@sofie-automation/corelib/dist/dataModel/Notifications'
import { PlaylistNotificationsHandler } from './playlistNotificationsHandler.js'
import { RundownNotificationsHandler } from './rundownNotificationsHandler.js'
import _ from 'underscore'

const THROTTLE_PERIOD_MS = 100

/**
 * NotificationsHandler
 * Combines playlist-level and rundown-level notifications into a single collection
 *
 * This handler listens to the two lower-level handlers (playlist & rundown notifications)
 * and merges their collection contents on change.
 */
export class NotificationsHandler extends PublicationCollection<
	DBNotificationObj[],
	CorelibPubSub.notificationsForRundownPlaylist | CorelibPubSub.notificationsForRundown,
	CollectionName.Notifications
> {
	private throttledNotify: (data: DBNotificationObj[]) => void

	private _playlistNotificationsHandler?: PlaylistNotificationsHandler
	private _rundownNotificationsHandler?: RundownNotificationsHandler

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.Notifications, CorelibPubSub.notificationsForRundownPlaylist, logger, coreHandler)

		this.throttledNotify = _.throttle(this.notify.bind(this), THROTTLE_PERIOD_MS, {
			leading: false,
			trailing: true,
		})
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)

		this._playlistNotificationsHandler =
			handlers.playlistNotificationsHandler as unknown as PlaylistNotificationsHandler
		this._rundownNotificationsHandler =
			handlers.rundownNotificationsHandler as unknown as RundownNotificationsHandler

		this._playlistNotificationsHandler.subscribe(this.onSourceUpdated)
		this._rundownNotificationsHandler.subscribe(this.onSourceUpdated)
	}

	protected changed(): void {
		this.updateAndNotify()
	}

	private onSourceUpdated = (): void => {
		this.changed()
	}

	private updateCollectionData(): boolean {
		let merged: DBNotificationObj[] = []

		if (this._playlistNotificationsHandler && this._rundownNotificationsHandler) {
			merged = [
				...this._playlistNotificationsHandler.getPublishedDocs(),
				...this._rundownNotificationsHandler.getPublishedDocs(),
			]
		}

		const hasAnythingChanged = !_.isEqual(this._collectionData, merged)
		if (hasAnythingChanged) {
			this._collectionData = merged
		}

		return hasAnythingChanged
	}

	private updateAndNotify() {
		if (this.updateCollectionData()) this.throttledNotify(this._collectionData ?? [])
	}
}
