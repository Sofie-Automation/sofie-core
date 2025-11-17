import { ITranslatableMessage, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { assertNever } from '@sofie-automation/shared-lib/dist/lib/lib'
import { UISegmentPartNote } from '@sofie-automation/meteor-lib/dist/api/rundownNotifications'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { generateTranslation } from '@sofie-automation/corelib/dist/lib'
import { SegmentFields, PartFields, PartInstanceFields } from './reactiveContentCache'

export function generateNotesForSegment(
	playlistId: RundownPlaylistId,
	segment: Pick<DBSegment, SegmentFields>,
	nrcsName: string,
	parts: Pick<DBPart, PartFields>[],
	partInstances: Pick<DBPartInstance, PartInstanceFields>[]
): Array<UISegmentPartNote> {
	const notes: Array<UISegmentPartNote> = []

	if (segment.notes) {
		notes.push(
			...segment.notes.map((note, i) =>
				literal<UISegmentPartNote>({
					_id: protectString(`${segment._id}_segment_${i}`),
					playlistId,
					rundownId: segment.rundownId,
					segmentId: segment._id,
					note: {
						rank: segment._rank,
						...note,
						origin: {
							...note.origin,
							segmentId: segment._id,
							rundownId: segment.rundownId,
							name: note.origin.name || segment.name,
						},
					},
				})
			)
		)
	}

	if (segment.orphaned) {
		let message: ITranslatableMessage | undefined
		switch (segment.orphaned) {
			case SegmentOrphanedReason.DELETED:
				message = generateTranslation('Segment no longer exists in {{nrcs}}', {
					nrcs: nrcsName,
				})
				break
			case SegmentOrphanedReason.HIDDEN:
				message = generateTranslation('Segment was hidden in {{nrcs}}', {
					nrcs: nrcsName,
				})
				break
			case SegmentOrphanedReason.ADLIB_TESTING:
				// Ignore
				break
			default:
				assertNever(segment.orphaned)
				break
		}
		if (message) {
			notes.push({
				_id: protectString(`${segment._id}_segment_orphaned`),
				playlistId,
				rundownId: segment.rundownId,
				segmentId: segment._id,
				note: {
					type: NoteSeverity.WARNING,
					message,
					rank: segment._rank,
					origin: {
						segmentId: segment._id,
						rundownId: segment.rundownId,
						name: segment.name,
					},
				},
			})
		}
	} else {
		const deletedPartInstances = partInstances.filter((p) => p.orphaned === 'deleted' && !p.reset)
		if (deletedPartInstances.length > 0) {
			notes.push({
				_id: protectString(`${segment._id}_partinstances_deleted`),
				playlistId,
				rundownId: segment.rundownId,
				segmentId: segment._id,
				note: {
					type: NoteSeverity.WARNING,
					message: generateTranslation('The following parts no longer exist in {{nrcs}}: {{partNames}}', {
						nrcs: nrcsName,
						partNames: deletedPartInstances.map((p) => p.part.title).join(', '),
					}),
					rank: segment._rank,
					origin: {
						segmentId: segment._id,
						rundownId: segment.rundownId,
						name: segment.name,
					},
				},
			})
		}
	}

	for (const part of parts) {
		const commonOrigin = {
			segmentId: part.segmentId,
			partId: part._id,
			rundownId: part.rundownId,
			segmentName: segment.name,
		}

		if (part.invalidReason) {
			notes.push({
				_id: protectString(`${segment._id}_part_${part._id}_invalid`),
				playlistId,
				rundownId: segment.rundownId,
				segmentId: segment._id,
				note: {
					type: part.invalidReason.severity ?? NoteSeverity.ERROR,
					message: part.invalidReason.message,
					rank: segment._rank,
					origin: {
						...commonOrigin,
						name: part.title,
					},
				},
			})
		}

		if (part.notes && part.notes.length > 0) {
			notes.push(
				...part.notes.map((n, i) =>
					literal<UISegmentPartNote>({
						_id: protectString(`${segment._id}_part_${part._id}_${i}`),
						playlistId,
						rundownId: segment.rundownId,
						segmentId: segment._id,
						note: {
							...n,
							rank: segment._rank,
							origin: {
								...n.origin,
								...commonOrigin,
								name: n.origin.name || part.title,
							},
						},
					})
				)
			)
		}
	}

	return notes
}
