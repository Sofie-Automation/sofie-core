import {
	ExpectedPackageId,
	PartInstanceId,
	PieceInstanceId,
	RundownId,
	RundownPlaylistId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { AnyBulkWriteOperation } from 'mongodb'
import { JobContext } from '../../../jobs/index.js'
import { PlayoutPartInstanceModelImpl } from './PlayoutPartInstanceModelImpl.js'
import { PlayoutRundownModelImpl } from './PlayoutRundownModelImpl.js'
import { ReadonlyDeep } from 'type-fest'
import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import { normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'

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

interface ExpectedPackageEntry {
	_id: ExpectedPackageId
	package: ReadonlyDeep<ExpectedPackage.Base>

	pieceInstanceIds: PieceInstanceId[]
}

export async function writeExpectedPackagesForPlayoutSources(
	context: JobContext,
	playlistId: RundownPlaylistId,
	rundownId: RundownId,
	partInstancesForRundown: PlayoutPartInstanceModelImpl[]
): Promise<void> {
	// We know we are inside the playout lock, so we can safely load from the packages and it won't be modified by another thread

	const existingPackages = (await context.directCollections.ExpectedPackages.findFetch(
		{
			studioId: context.studioId,
			rundownId: rundownId,
			bucketId: null,
		},
		{
			projection: {
				_id: 1,
				playoutSources: 1,
			},
		}
	)) as Pick<ExpectedPackageDB, '_id' | 'playoutSources'>[]
	const existingPackagesMap = normalizeArrayToMap(existingPackages, '_id')

	const pieceInstancesToAddToPackages = new Map<ExpectedPackageId, PieceInstanceId[]>()
	const packagesToInsert = new Map<ExpectedPackageId, ExpectedPackageEntry>()

	let hasPieceInstanceExpectedPackageChanges = false

	for (const partInstance of partInstancesForRundown) {
		if (!partInstance) continue

		for (const pieceInstance of partInstance.pieceInstancesImpl.values()) {
			if (!pieceInstance) {
				// PieceInstance was deleted, cleanup may be needed
				hasPieceInstanceExpectedPackageChanges = true
				continue
			}

			// The expectedPackages of the PieceInstance has not been modified, so there is nothing to do
			if (!pieceInstance.updatedExpectedPackages) continue

			hasPieceInstanceExpectedPackageChanges = true

			// Any removed references will be removed by the debounced job

			for (const [packageId, expectedPackage] of pieceInstance.updatedExpectedPackages) {
				const existingPackage = existingPackagesMap.get(packageId)
				if (existingPackage?.playoutSources.pieceInstanceIds.includes(pieceInstance.pieceInstance._id)) {
					// Reference already exists, nothing to do
					continue
				}

				if (existingPackage) {
					// Add the pieceInstanceId to the existing package
					const pieceInstanceIds = pieceInstancesToAddToPackages.get(packageId) ?? []
					pieceInstanceIds.push(pieceInstance.pieceInstance._id)
					pieceInstancesToAddToPackages.set(packageId, pieceInstanceIds)
				} else {
					// Record as needing a new document, or add to existing entry if already queued for insert
					const existingEntry = packagesToInsert.get(packageId)
					if (existingEntry) {
						existingEntry.pieceInstanceIds.push(pieceInstance.pieceInstance._id)
					} else {
						packagesToInsert.set(packageId, {
							_id: packageId,
							package: expectedPackage,
							pieceInstanceIds: [pieceInstance.pieceInstance._id],
						})
					}

					// Future: If this came from a bucket, can we copy the packageInfos across to minimise latency until the status is ready?
				}
			}
		}
	}

	// We now know what needs to be written (only the additive changes)

	const writeOps: AnyBulkWriteOperation<ExpectedPackageDB>[] = []
	for (const [packageId, pieceInstanceIds] of pieceInstancesToAddToPackages.entries()) {
		writeOps.push({
			updateOne: {
				filter: { _id: packageId },
				update: {
					$addToSet: {
						'playoutSources.pieceInstanceIds': { $each: pieceInstanceIds },
					},
				},
			},
		})
	}

	for (const packageEntry of packagesToInsert.values()) {
		writeOps.push({
			insertOne: {
				document: {
					_id: packageEntry._id,
					studioId: context.studioId,
					rundownId: rundownId,
					bucketId: null,
					created: Date.now(),

					package: packageEntry.package,
					ingestSources: [],
					playoutSources: {
						pieceInstanceIds: packageEntry.pieceInstanceIds,
					},
				},
			},
		})
	}

	if (writeOps.length > 0) {
		await context.directCollections.ExpectedPackages.bulkWrite(writeOps)
	}

	// We can't easily track any references which have been deleted, so we should schedule a cleanup job to deal with that for us
	// Only queue if there were changes to expected packages, to avoid unnecessary job scheduling
	if (hasPieceInstanceExpectedPackageChanges) {
		await context.queueStudioJob(
			StudioJobs.CleanupOrphanedExpectedPackageReferences,
			{
				playlistId: playlistId,
				rundownId: rundownId,
			},
			{
				lowPriority: true,
				debounce: 1000,
			}
		)
	}
}
