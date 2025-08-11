import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler.js'
import { CollectionBase } from '../collectionBase.js'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import _ from 'underscore'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'

const THROTTLE_PERIOD_MS = 200

export class SegmentsHandler extends CollectionBase<DBSegment[], CollectionName.Segments> {
	private throttledNotify: (data: DBSegment[]) => void

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(CollectionName.Segments, logger, coreHandler)
		this.throttledNotify = _.throttle(this.notify.bind(this), THROTTLE_PERIOD_MS, { leading: true, trailing: true })
	}

	setSegments(segments: DBSegment[]): void {
		this.logUpdateReceived('segments', segments.length)
		this._collectionData = segments
		this.throttledNotify(this._collectionData)
	}
}
