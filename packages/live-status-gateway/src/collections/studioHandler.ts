import { Logger } from 'winston'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { CoreHandler } from '../coreHandler'
import { PublicationCollection } from '../publicationCollection'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { CollectionHandlers } from '../liveStatusServer'

export class StudioHandler extends PublicationCollection<DBStudio, CorelibPubSub.studios, CollectionName.Studios> {
	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.Studios, CorelibPubSub.studios, logger, coreHandler)
	}

	init(handlers: CollectionHandlers): void {
		super.init(handlers)

		this.setupSubscription([this._studioId])
	}

	protected changed(): void {
		const collection = this.getCollectionOrFail()
		const studio = collection.findOne(this._studioId)
		this._collectionData = studio
		this.notify(this._collectionData)
	}
}
