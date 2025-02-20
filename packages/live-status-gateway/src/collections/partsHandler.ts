import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase } from '../collectionBase'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import _ = require('underscore')
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

const THROTTLE_PERIOD_MS = 200

export class PartsHandler extends CollectionBase<DBPart[], CollectionName.Parts> {
	private throttledNotify: (data: DBPart[]) => void

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.Parts, logger, coreHandler)
		this.throttledNotify = _.throttle(this.notify.bind(this), THROTTLE_PERIOD_MS, { leading: true, trailing: true })
	}

	setParts(parts: DBPart[]): void {
		this.logUpdateReceived('parts', parts.length)
		this._collectionData = parts
		this.throttledNotify(this._collectionData)
	}
}
