import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { CollectionBase } from '../collectionBase.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import _ from 'underscore'
import { CustomCollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

const THROTTLE_PERIOD_MS = 200

export class PartsHandler extends CollectionBase<DBPart[], CustomCollectionName.UIParts> {
	private throttledNotify: (data: DBPart[]) => void

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CustomCollectionName.UIParts, logger, coreHandler)
		this.throttledNotify = _.throttle(this.notify.bind(this), THROTTLE_PERIOD_MS, { leading: true, trailing: true })
	}

	setParts(parts: DBPart[]): void {
		this.logUpdateReceived('parts', parts.length)
		this._collectionData = parts
		this.throttledNotify(this._collectionData)
	}
}
