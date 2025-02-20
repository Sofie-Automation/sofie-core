import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { assertNever, literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnes } from '@sofie-automation/corelib/dist/mongo'
import { UISegmentPartNote } from '@sofie-automation/meteor-lib/dist/api/rundownNotifications'
import { PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { getIgnorePieceContentStatus } from '../../lib/localStorage'
import { UIPartInstances, UIPieceContentStatuses, UISegmentPartNotes } from '../Collections'
import { SegmentNoteCounts, SegmentUi } from './withResolvedSegment'
import { Notifications } from '../../collections'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { DBNotificationObj } from '@sofie-automation/corelib/dist/dataModel/Notifications'
import { UIPieceContentStatus } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'

export function getReactivePieceNoteCountsForSegment(segment: SegmentUi): SegmentNoteCounts {
	const segmentNoteCounts: SegmentNoteCounts = {
		criticial: 0,
		warning: 0,
	}

	const rawNotes = UISegmentPartNotes.find({ segmentId: segment._id }, { fields: { note: 1 } }).fetch() as Pick<
		UISegmentPartNote,
		'note'
	>[]
	for (const note of rawNotes) {
		if (note.note.type === NoteSeverity.ERROR) {
			segmentNoteCounts.criticial++
		} else if (note.note.type === NoteSeverity.WARNING) {
			segmentNoteCounts.warning++
		}
	}

	const mediaObjectStatuses = UIPieceContentStatuses.find(
		{
			rundownId: segment.rundownId,
			segmentId: segment._id,
		},
		{
			fields: literal<MongoFieldSpecifierOnes<UIPieceContentStatus>>({
				_id: 1,
				// @ts-expect-error deep property
				'status.status': 1,
			}),
		}
	).fetch() as Array<Pick<UIPieceContentStatus, '_id'> & { status: Pick<UIPieceContentStatus['status'], 'status'> }>

	if (!getIgnorePieceContentStatus()) {
		for (const obj of mediaObjectStatuses) {
			switch (obj.status.status) {
				case PieceStatusCode.OK:
				case PieceStatusCode.SOURCE_NOT_READY:
				case PieceStatusCode.UNKNOWN:
					// Ignore
					break
				case PieceStatusCode.SOURCE_NOT_SET:
					segmentNoteCounts.criticial++
					break
				case PieceStatusCode.SOURCE_HAS_ISSUES:
				case PieceStatusCode.SOURCE_BROKEN:
				case PieceStatusCode.SOURCE_MISSING:
				case PieceStatusCode.SOURCE_UNKNOWN_STATE:
					segmentNoteCounts.warning++
					break
				default:
					assertNever(obj.status.status)
					segmentNoteCounts.warning++
					break
			}
		}
	}

	// Find any relevant notifications
	const partInstancesForSegment = UIPartInstances.find(
		{ segmentId: segment._id, reset: { $ne: true } },
		{
			fields: {
				_id: 1,
			},
		}
	).fetch() as Array<Pick<PartInstance, '_id'>>
	const rawNotifications = Notifications.find(
		{
			$or: [
				{ 'relatedTo.segmentId': segment._id },
				{
					'relatedTo.partInstanceId': { $in: partInstancesForSegment.map((p) => p._id) },
				},
			],
		},
		{
			fields: {
				severity: 1,
			},
		}
	).fetch() as Array<Pick<DBNotificationObj, 'severity'>>
	for (const notification of rawNotifications) {
		if (notification.severity === NoteSeverity.ERROR) {
			segmentNoteCounts.criticial++
		} else if (notification.severity === NoteSeverity.WARNING) {
			segmentNoteCounts.warning++
		}
	}

	return segmentNoteCounts
}
