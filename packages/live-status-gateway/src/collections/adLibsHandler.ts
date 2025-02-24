import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { RundownContentHandlerBase } from './rundownContentHandlerBase'

export class AdLibsHandler extends RundownContentHandlerBase<CorelibPubSub.adLibPieces> {
	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.AdLibPieces, CorelibPubSub.adLibPieces, logger, coreHandler)
	}
}
