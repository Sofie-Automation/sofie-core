import { SegmentId, PartInstanceId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JobContext } from '../../jobs/index.js'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { BeforeIngestOperationPartMap } from '../commit.js'
import { IngestModelReadonly } from '../model/IngestModel.js'
import { MongoProjectedDoc, MongoProjectionStrict } from '@sofie-automation/corelib/dist/mongo'

async function fetchOrphanedPartInstancesInRundown(context: JobContext, rundownId: RundownId) {
	const orphanedPartInstances = await context.directCollections.PartInstances.findFetch(
		{
			rundownId: rundownId,
			orphaned: { $exists: true },
			reset: { $ne: true },
		},
		{
			projection: MinimalPartInstanceProjection,
			sort: {
				takeCount: 1,
			},
		}
	)

	return orphanedPartInstances
}

const MinimalPartInstanceProjection = {
	_id: 1,
	segmentId: 1,
	orphaned: 1,
	part: {
		_id: 1,
		_rank: 1,
	},
} as const satisfies MongoProjectionStrict<DBPartInstance>

type MinimalPartInstance = MongoProjectedDoc<DBPartInstance, typeof MinimalPartInstanceProjection>

/**
 * Ensure any adlibbed PartInstances are moved across segments when the Part before them is moved.
 * If there is no Part before them, they get left alone, even if this means they get stranded.
 * @param context
 * @param cache Cache for the ingest operation
 * @param beforePartMap Map of Parts and Segments before the ingest operation was run
 */
export async function updateSegmentIdsForAdlibbedPartInstances(
	context: JobContext,
	ingestModel: IngestModelReadonly,
	beforePartMap: BeforeIngestOperationPartMap
): Promise<void> {
	const orphanedPartInstances = await fetchOrphanedPartInstancesInRundown(context, ingestModel.rundownId)

	const segmentIdChanges = await findChangesToSegmentIdsOfPartInstances(
		ingestModel,
		beforePartMap,
		orphanedPartInstances.filter((p) => p.orphaned === 'adlib-part')
	)

	// Perform a mongo update to modify the PartInstances
	await writePartInstanceSegmentIdChangesToMongo(context, segmentIdChanges)
}

async function findChangesToSegmentIdsOfPartInstances(
	ingestModel: IngestModelReadonly,
	beforePartMap: BeforeIngestOperationPartMap,
	adlibbedPartInstances: Array<MinimalPartInstance>
) {
	const renameRules = new Map<PartInstanceId, SegmentId>()

	for (const partInstance of adlibbedPartInstances) {
		const segmentItems = beforePartMap.get(partInstance.segmentId)
		if (!segmentItems) continue

		// Find the part before the adlibbed part
		const partsBefore = segmentItems
			.filter((item) => item.rank < partInstance.part._rank)
			.sort((a, b) => b.rank - a.rank)

		for (const partEntry of partsBefore) {
			// Check if the Part still exists
			const part = ingestModel.findPart(partEntry.id)
			if (part) {
				// Check if the part segmentId should be changed
				if (part.part.segmentId !== partInstance.segmentId) {
					renameRules.set(partInstance._id, part.part.segmentId)
				}

				break
			}
		}
	}

	return renameRules
}

async function writePartInstanceSegmentIdChangesToMongo(
	context: JobContext,
	renameRules: Map<PartInstanceId, SegmentId>
) {
	if (renameRules.size == 0) return

	await context.directCollections.PartInstances.bulkWrite(
		Array.from(renameRules.entries()).map(([partInstanceId, segmentId]) => ({
			updateOne: {
				filter: {
					_id: partInstanceId,
				},
				update: {
					$set: {
						segmentId: segmentId,
						'part.segmentId': segmentId,
					},
				},
			},
		}))
	)
}
