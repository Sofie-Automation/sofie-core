import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { PublicationCollection } from '../publicationCollection.js'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { CollectionHandlers } from '../liveStatusServer.js'

export class BucketsHandler extends PublicationCollection<Bucket[], CorelibPubSub.buckets, CollectionName.Buckets> {
	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.Buckets, CorelibPubSub.buckets, logger, coreHandler)
	}

	changed(): void {
		const collection = this.getCollectionOrFail()
		this._collectionData = collection.find(undefined)
		this.notify(this._collectionData)
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)
		this.setupSubscription(this._studioId, null)
	}
}
