import { PartInstanceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { AnyBulkWriteOperation } from 'mongodb'
import { JobContext } from '../../../jobs/index.js'
import { PlayoutPartInstanceModelImpl } from './PlayoutPartInstanceModelImpl.js'
import { PlayoutRundownModelImpl } from './PlayoutRundownModelImpl.js'

/**
 * Save any changed AdlibTesting Segments
 * @param context Context from the job queue
 * @param rundowns Rundowns whose AdlibTesting Segment may need saving
 */
export async function writeAdlibTestingSegments(
	context: JobContext,
	rundowns: readonly PlayoutRundownModelImpl[]
): Promise<void> {
	const writeOps: AnyBulkWriteOperation<DBSegment>[] = []

	for (const rundown of rundowns) {
		if (rundown.AdlibTestingSegmentHasChanged) {
			rundown.clearAdlibTestingSegmentChangedFlag()
			const adlibTestingSegment = rundown.getAdlibTestingSegment()?.segment

			// Delete a removed AdlibTesting segment, and any with the non-current id (just in case)
			writeOps.push({
				deleteMany: {
					filter: {
						rundownId: rundown.rundown._id,
						_id: { $ne: adlibTestingSegment?._id ?? protectString('') },
						orphaned: SegmentOrphanedReason.ADLIB_TESTING,
					},
				},
			})

			// Update/insert the segment
			if (adlibTestingSegment) {
				writeOps.push({
					replaceOne: {
						filter: { _id: adlibTestingSegment._id },
						replacement: adlibTestingSegment as DBSegment,
						upsert: true,
					},
				})
			}
		}
	}

	if (writeOps.length) {
		await context.directCollections.Segments.bulkWrite(writeOps)
	}
}

/**
 * Save any changed or deleted PartInstances and their PieceInstances
 * @param context Context from the job queue
 * @param partInstances Map of PartInstances to check for changes or deletion
 */
export function writePartInstancesAndPieceInstances(
	context: JobContext,
	partInstances: Map<PartInstanceId, PlayoutPartInstanceModelImpl | null>
): [Promise<unknown>, Promise<unknown>] {
	const partInstanceOps: AnyBulkWriteOperation<DBPartInstance>[] = []
	const pieceInstanceOps: AnyBulkWriteOperation<PieceInstance>[] = []

	const deletedPartInstanceIds: PartInstanceId[] = []
	const deletedPieceInstanceIds: PieceInstanceId[] = []

	for (const [partInstanceId, partInstance] of partInstances.entries()) {
		if (!partInstance) {
			deletedPartInstanceIds.push(partInstanceId)
		} else {
			if (partInstance.partInstanceHasChanges) {
				partInstanceOps.push({
					replaceOne: {
						filter: { _id: partInstanceId },
						replacement: partInstance.partInstanceImpl,
						upsert: true,
					},
				})
			}

			for (const [pieceInstanceId, pieceInstance] of partInstance.pieceInstancesImpl.entries()) {
				if (!pieceInstance) {
					deletedPieceInstanceIds.push(pieceInstanceId)
				} else if (pieceInstance.HasChanges) {
					pieceInstanceOps.push({
						replaceOne: {
							filter: { _id: pieceInstanceId },
							replacement: pieceInstance.PieceInstanceImpl,
							upsert: true,
						},
					})
				}
			}

			partInstance.clearChangedFlags()
		}
	}

	// Delete any removed PartInstances
	if (deletedPartInstanceIds.length) {
		partInstanceOps.push({
			deleteMany: {
				filter: {
					_id: { $in: deletedPartInstanceIds },
				},
			},
		})
		pieceInstanceOps.push({
			deleteMany: {
				filter: {
					partInstanceId: { $in: deletedPartInstanceIds },
				},
			},
		})
	}

	// Delete any removed PieceInstances
	if (deletedPieceInstanceIds.length) {
		pieceInstanceOps.push({
			deleteMany: {
				filter: {
					_id: { $in: deletedPieceInstanceIds },
				},
			},
		})
	}

	return [
		partInstanceOps.length ? context.directCollections.PartInstances.bulkWrite(partInstanceOps) : Promise.resolve(),
		pieceInstanceOps.length
			? context.directCollections.PieceInstances.bulkWrite(pieceInstanceOps)
			: Promise.resolve(),
	]
}
