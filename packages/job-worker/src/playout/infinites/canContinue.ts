import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { JobContext } from '../../jobs/index.js'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutSegmentModel } from '../model/PlayoutSegmentModel.js'

/**
 * We can only continue adlib onEnd infinites if we go forwards in the rundown. Any distance backwards will clear them.
 */
export function candidatePartIsAfterPreviewPartInstance(
	_context: JobContext,
	orderedSegments: readonly PlayoutSegmentModel[],
	previousPartInstance: ReadonlyDeep<DBPartInstance> | undefined,
	candidateInstance: ReadonlyDeep<DBPart>
): boolean {
	if (previousPartInstance) {
		// When in the same segment, we can rely on the ranks to be in order. This is to handle orphaned parts, but is also valid for normal parts
		if (candidateInstance.segmentId === previousPartInstance.segmentId) {
			return candidateInstance._rank > previousPartInstance.part._rank
		} else {
			const previousSegmentIndex = orderedSegments.findIndex(
				(s) => s.segment._id === previousPartInstance.segmentId
			)
			const candidateSegmentIndex = orderedSegments.findIndex(
				(s) => s.segment._id === candidateInstance.segmentId
			)

			if (previousSegmentIndex === -1 || candidateSegmentIndex === -1) {
				return false
			}

			return candidateSegmentIndex >= previousSegmentIndex
		}
	} else {
		return false
	}
}
