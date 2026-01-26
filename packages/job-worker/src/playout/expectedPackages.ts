import type { CleanupOrphanedExpectedPackageReferencesProps } from '@sofie-automation/corelib/dist/worker/studio'
import type { JobContext } from '../jobs/index.js'
import { runWithPlaylistLock } from './lock.js'
import {
	ExpectedPackageDB,
	isPackageReferencedByPlayout,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { AnyBulkWriteOperation } from 'mongodb'
import { ExpectedPackageId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export async function handleCleanupOrphanedExpectedPackageReferences(
	context: JobContext,
	data: CleanupOrphanedExpectedPackageReferencesProps
): Promise<void> {
	// Something has changed in the PieceInstances, we need to check that the ExpectedPackages have only valid PieceInstances as owners, and remove any which no longer have owners

	await runWithPlaylistLock(context, data.playlistId, async () => {
		const [existingPackages, validPieceInstances] = await Promise.all([
			context.directCollections.ExpectedPackages.findFetch(
				{
					studioId: context.studioId,
					rundownId: data.rundownId,
					bucketId: null,
				},
				{
					projection: {
						_id: 1,
						playoutSources: 1,
						// We only need to know if there are any entries, so project them to be as minimal as possible
						'ingestSources.fromPieceType': 1,
					},
				}
			) as Promise<
				Array<
					Pick<ExpectedPackageDB, '_id' | 'playoutSources' | 'ingestSources'> & {
						ingestSources: unknown[]
					}
				>
			>,
			context.directCollections.PieceInstances.findFetch(
				{
					rundownId: data.rundownId,
					reset: { $ne: true },
				},
				{
					projection: {
						_id: 1,
						neededExpectedPackageIds: 1,
					},
				}
			) as Promise<Array<Pick<PieceInstance, '_id' | 'neededExpectedPackageIds'>>>,
		])

		const pieceInstancePackageMap = new Map<PieceInstanceId, Set<ExpectedPackageId>>()
		for (const pieceInstance of validPieceInstances) {
			if (pieceInstance.neededExpectedPackageIds && pieceInstance.neededExpectedPackageIds.length > 0)
				pieceInstancePackageMap.set(pieceInstance._id, new Set(pieceInstance.neededExpectedPackageIds))
		}

		const writeOps: AnyBulkWriteOperation<ExpectedPackageDB>[] = []

		for (const expectedPackage of existingPackages) {
			// Find the pieceInstanceIds that are stale
			const pieceInstanceIdsToRemove: PieceInstanceId[] = []
			for (const pieceInstanceId of expectedPackage.playoutSources.pieceInstanceIds) {
				const pieceInstancePackageIds = pieceInstancePackageMap.get(pieceInstanceId)
				if (!pieceInstancePackageIds || !pieceInstancePackageIds.has(expectedPackage._id)) {
					// This pieceInstanceId is no longer valid, queue it to be removed
					pieceInstanceIdsToRemove.push(pieceInstanceId)
				}
			}

			// Queue the write
			if (pieceInstanceIdsToRemove.length === expectedPackage.playoutSources.pieceInstanceIds.length) {
				// It looks like all the pieceInstanceIds are being removed

				if (
					expectedPackage.ingestSources.length === 0 &&
					!isPackageReferencedByPlayout({
						// Test with a fake package
						...expectedPackage,
						playoutSources: {
							...expectedPackage.playoutSources,
							pieceInstanceIds: [],
						},
					})
				) {
					// This package is not referenced by anything, so we can delete it
					writeOps.push({
						deleteOne: {
							filter: {
								_id: expectedPackage._id,
							},
						},
					})
				} else {
					// This package is still referenced by something, so we need to keep it
					writeOps.push({
						updateOne: {
							filter: {
								_id: expectedPackage._id,
							},
							update: {
								$set: {
									'playoutSources.pieceInstanceIds': [],
								},
							},
						},
					})
				}
			} else if (pieceInstanceIdsToRemove.length > 0) {
				// Some of the pieceInstanceIds are being removed
				writeOps.push({
					updateOne: {
						filter: {
							_id: expectedPackage._id,
						},
						update: {
							$pull: {
								'playoutSources.pieceInstanceIds': { $in: pieceInstanceIdsToRemove },
							},
						},
					},
				})
			}
		}

		if (writeOps.length > 0) {
			await context.directCollections.ExpectedPackages.bulkWrite(writeOps)
		}
	})
}
