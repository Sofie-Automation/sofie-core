import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { CustomCollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { RundownContentHandlerBase } from './rundownContentHandlerBase.js'

export class AdLibActionsHandler extends RundownContentHandlerBase<CorelibPubSub.uiAdLibActions> {
	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CustomCollectionName.UIAdLibActions, CorelibPubSub.uiAdLibActions, logger, coreHandler)
	}
}
