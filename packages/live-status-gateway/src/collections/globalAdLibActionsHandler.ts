import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { CustomCollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { RundownContentHandlerBase } from './rundownContentHandlerBase.js'

export class GlobalAdLibActionsHandler extends RundownContentHandlerBase<CorelibPubSub.uiRundownBaselineAdLibActions> {
	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(
			CustomCollectionName.UIRundownBaselineAdLibActions,
			CorelibPubSub.uiRundownBaselineAdLibActions,
			logger,
			coreHandler
		)
	}
}
