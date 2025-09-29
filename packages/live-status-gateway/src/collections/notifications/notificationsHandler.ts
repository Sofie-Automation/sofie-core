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
import { unprotectString } from '@sofie-automation/server-core-integration'

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

		if (this._playlistNotificationsHandler) {
			this._playlistNotificationsHandler.subscribe(this.onSourceUpdated)
		}
		if (this._rundownNotificationsHandler) {
			this._rundownNotificationsHandler.subscribe(this.onSourceUpdated)
		}
	}

	protected changed(): void {
		this.updateAndNotify()
	}

	private onSourceUpdated = (): void => {
		this.changed()
	}

	private updateCollectionData(): boolean {
		const merged = new Map<string, DBNotificationObj>()

		// Pull data from the playlist notifications handler's collection
		if (this._playlistNotificationsHandler) {
			const playlistDocs = this._playlistNotificationsHandler.getPublishedDocs()
			for (const d of playlistDocs) {
				if (d._id && !merged.has(unprotectString(d._id))) {
					merged.set(unprotectString(d._id), d)
				}
			}
		}

		// Pull data from the rundown notifications handler's collection
		if (this._rundownNotificationsHandler) {
			const rundownDocs = this._rundownNotificationsHandler.getPublishedDocs()
			for (const d of rundownDocs) {
				if (d._id && !merged.has(unprotectString(d._id))) {
					merged.set(unprotectString(d._id), d)
				}
			}
		}

		const newNotifications = Array.from(merged.values())

		const hasAnythingChanged = !_.isEqual(this._collectionData, newNotifications)
		if (hasAnythingChanged) {
			this._collectionData = newNotifications
		}

		return hasAnythingChanged
	}

	private updateAndNotify() {
		if (this.updateCollectionData()) this.throttledNotify(this._collectionData ?? [])
	}
}
