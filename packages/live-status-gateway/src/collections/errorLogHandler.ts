import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { PublicationCollection } from '../publicationCollection.js'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { DBErrorLogItem } from '@sofie-automation/corelib/dist/dataModel/ErrorLog'
import { CollectionHandlers } from '../liveStatusServer.js'

/**
 * Handler for the ErrorLog: the most recent errors from all clients.
 * This is intentionally not scoped to the studio of this gateway, all errors are shared with everyone.
 */
export class ErrorLogHandler extends PublicationCollection<
	DBErrorLogItem[],
	CorelibPubSub.errorLog,
	CollectionName.ErrorLog
> {
	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.ErrorLog, CorelibPubSub.errorLog, logger, coreHandler)
	}

	changed(): void {
		const collection = this.getCollectionOrFail()
		this._collectionData = collection.find(undefined)
		this.notify(this._collectionData)
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)
		this.setupSubscription()
	}
}
