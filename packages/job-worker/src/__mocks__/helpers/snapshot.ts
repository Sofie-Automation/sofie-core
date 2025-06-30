import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { TimelineObjGeneric, TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { clone } from '@sofie-automation/corelib/dist/lib'
import _ from 'underscore'

// About snapshot testing: https://jestjs.io/docs/en/snapshot-testing

type Data =
	| undefined
	| TimelineObjGeneric
	| TimelineComplete
	| DBRundownPlaylist
	| DBRundown
	| DBSegment
	| DBPart
	| Piece
	| PieceInstance
	| DBPartInstance
/**
 * Remove certain fields from data that change often, so that it can be used in snapshots
 * @param data
 */
export function fixSnapshot(data: Data, sortData?: boolean): Data
export function fixSnapshot(data: Array<Data>, sortData?: boolean): Array<Data>
export function fixSnapshot(data: Data | Array<Data>, sortData?: boolean): Data | Array<Data> {
	if (_.isArray(data)) {
		const dataArray: any[] = _.map(data, (d) => fixSnapshot(d))
		if (sortData) {
			dataArray.sort((a: any, b: any) => {
				if (!a && b) return 1
				if (a && !b) return -1

				if (!a || !b) return 0

				if (a['rank'] < b['rank']) return 1
				if (a['rank'] > b['rank']) return -1

				if (a['_id'] < b['_id']) return 1
				if (a['_id'] > b['_id']) return -1

				if (a['id'] < b['id']) return 1
				if (a['id'] > b['id']) return -1

				return 0
			})
		}
		return dataArray
	} else {
		const o = clone<Data>(data)
		if (!o) return o
		if (isTimelineComplete(o)) {
			if (o.generated) o.generated = 12345

			if (o.generationVersions?.core) {
				// re-write the core version to something static, so tests won't fail just because the version has changed
				o.generationVersions.core = '0.0.0-test'
			}
		} else if (isPlaylist(o)) {
			o['created'] = 0
			o['modified'] = 0
			if (o['lastTakeTime']) o['lastTakeTime'] = 0
			if (o['resetTime']) o['resetTime'] = 0
		} else if (isRundown(o)) {
			o['created'] = 0
			o['modified'] = 0
			if (o.importVersions.core) {
				// re-write the core version so something static, so tests won't fail just because the version has changed
				o.importVersions.core = '0.0.0-test'
			}
			// } else if (isPiece(o)) {
			// } else if (isPart(o)) {
		} else if (isSegment(o)) {
			// } else if (isPieceInstance(o)) {
		}
		return o
	}
}
function isTimelineComplete(o: any): o is TimelineComplete {
	const o2 = o as TimelineComplete
	return !!(o2.timelineBlob && o2._id && o2.generated)
}
// function isTimelineObj(o): o is TimelineObjGeneric {
// 	return o.enable && o._id && o.id && o.studioId
// }
function isPlaylist(o: any): o is DBRundownPlaylist {
	return o._id && (_.has(o, 'currentPartInstanceId') || _.has(o, 'currentPartInfo'))
}
function isRundown(o: any): o is DBRundown {
	return o._id && _.has(o, 'playlistId')
}
function isSegment(o: any): o is DBSegment {
	return o._id && _.has(o, 'rundownId') && _.has(o, 'externalId') && _.has(o, 'name')
}
// function isPart(o): o is Part {
// 	return o._id && _.has(o, 'rundownId') && _.has(o, 'externalId') && _.has(o, 'segmentId') && _.has(o, 'title')
// }
// function isPiece(o): o is Piece {
// 	return o._id && _.has(o, 'rundownId') && _.has(o, 'externalId') && _.has(o, 'partId')
// }
