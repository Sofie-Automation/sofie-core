import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { CustomCollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { RundownContentHandlerBase } from './rundownContentHandlerBase.js'

export class GlobalAdLibsHandler extends RundownContentHandlerBase<CorelibPubSub.uiRundownBaselineAdLibPieces> {
	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(
			CustomCollectionName.UIRundownBaselineAdLibPieces,
			CorelibPubSub.uiRundownBaselineAdLibPieces,
			logger,
			coreHandler
		)
	}
}
