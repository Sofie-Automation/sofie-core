import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { CustomCollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { RundownContentHandlerBase } from './rundownContentHandlerBase.js'

export class AdLibsHandler extends RundownContentHandlerBase<CorelibPubSub.uiAdLibPieces> {
	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CustomCollectionName.UIAdLibPieces, CorelibPubSub.uiAdLibPieces, logger, coreHandler)
	}
}
