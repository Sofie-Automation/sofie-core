import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { CollectionBase } from '../collectionBase.js'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

export class RundownsHandler extends CollectionBase<DBRundown[], CollectionName.Rundowns> {
	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.Rundowns, logger, coreHandler)
	}

	setRundowns(rundowns: DBRundown[]): void {
		this.logUpdateReceived('rundowns', rundowns.length)
		this._collectionData = rundowns
		this.notify(this._collectionData)
	}
}
