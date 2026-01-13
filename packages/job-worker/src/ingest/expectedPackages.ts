import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import {
	ExpectedPackageDBType,
	ExpectedPackageDB,
	ExpectedPackageIngestSource,
	getExpectedPackageIdNew,
	ExpectedPackageIngestSourceBucketAdlibAction,
	ExpectedPackageIngestSourceBucketAdlibPiece,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { BucketId, BucketAdLibId, BucketAdLibActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PlayoutModel } from '../playout/model/PlayoutModel.js'
import { StudioPlayoutModel } from '../studio/model/StudioPlayoutModel.js'
import { ReadonlyDeep } from 'type-fest'
import { ExpectedPackage, BlueprintResultBaseline } from '@sofie-automation/blueprints-integration'
import {
	updateBaselineExpectedPlayoutItemsOnStudio,
	updateExpectedPlayoutItemsForPartModel,
	updateExpectedPlayoutItemsForRundownBaseline,
} from './expectedPlayoutItems.js'
import { JobContext, JobStudio } from '../jobs/index.js'
import { IngestModel } from './model/IngestModel.js'
import { IngestPartModel } from './model/IngestPartModel.js'
import { hashObj } from '@sofie-automation/corelib/dist/lib'
import { AnyBulkWriteOperation } from 'mongodb'

export function updateExpectedMediaAndPlayoutItemsForPartModel(context: JobContext, part: IngestPartModel): void {
	updateExpectedPlayoutItemsForPartModel(context, part)
}

export async function updateExpectedMediaAndPlayoutItemsForRundownBaseline(
	context: JobContext,
	ingestModel: IngestModel,
	baseline: BlueprintResultBaseline | undefined
): Promise<void> {
	await updateExpectedPlayoutItemsForRundownBaseline(context, ingestModel, baseline)
}

function generateExpectedPackagesForBucketAdlib(studio: ReadonlyDeep<JobStudio>, adlib: BucketAdLib) {
	const packages: ExpectedPackageDB[] = []

	if (adlib.expectedPackages) {
		packages.push(
			...generateBucketExpectedPackages<ExpectedPackageIngestSourceBucketAdlibPiece>(
				studio,
				adlib.bucketId,
				{
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB,
					pieceId: adlib._id,
					pieceExternalId: adlib.externalId,
				},
				adlib.expectedPackages
			)
		)
	}

	return packages
}
function generateExpectedPackagesForBucketAdlibAction(studio: ReadonlyDeep<JobStudio>, action: BucketAdLibAction) {
	const packages: ExpectedPackageDB[] = []

	if (action.expectedPackages) {
		packages.push(
			...generateBucketExpectedPackages<ExpectedPackageIngestSourceBucketAdlibAction>(
				studio,
				action.bucketId,
				{
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION,
					pieceId: action._id,
					pieceExternalId: action.externalId,
				},
				action.expectedPackages
			)
		)
	}

	return packages
}
function generateBucketExpectedPackages<TSource = never>(
	studio: ReadonlyDeep<JobStudio>,
	bucketId: BucketId,
	source: Omit<TSource, 'blueprintPackageId' | 'listenToPackageInfoUpdates'>,
	expectedPackages: ReadonlyDeep<ExpectedPackage.Any[]>
): ExpectedPackageDB[] {
	const bases: ExpectedPackageDB[] = []

	for (let i = 0; i < expectedPackages.length; i++) {
		const expectedPackage = expectedPackages[i]

		const fullPackage: ReadonlyDeep<ExpectedPackage.Any> = {
			...expectedPackage,
			_id: expectedPackage._id || '__unnamed' + i,
		}

		bases.push({
			_id: getExpectedPackageIdNew(bucketId, fullPackage),
			package: fullPackage,
			studioId: studio._id,
			rundownId: null,
			bucketId: bucketId,
			created: Date.now(), // This will be preserved during the save if needed
			ingestSources: [
				{
					...(source as any), // Because this is a generic, this spread doesnt work
					blueprintPackageId: expectedPackage._id,
					listenToPackageInfoUpdates: expectedPackage.listenToPackageInfoUpdates,
				},
			],
		})
	}

	return bases
}

async function writeUpdatedExpectedPackages(
	context: JobContext,
	bucketId: BucketId,
	documentsToSave: ExpectedPackageDB[],
	matchSource: Partial<ExpectedPackageIngestSource>
): Promise<void> {
	const writeOps: AnyBulkWriteOperation<ExpectedPackageDB>[] = []

	const documentIdsToSave = documentsToSave.map((doc) => doc._id)

	// Find which documents already exist in the database
	// It would be nice to avoid this, but that would make the update operation incredibly complex
	// There is no risk of race conditions, as bucket packages are only modified in the ingest job worker
	const existingDocIds = new Set(
		(
			await context.directCollections.ExpectedPackages.findFetch(
				{
					_id: { $in: documentIdsToSave },
					studioId: context.studioId,
					bucketId: bucketId,
				},
				{
					projection: {
						_id: 1,
					},
				}
			)
		).map((doc) => doc._id)
	)

	for (const doc of documentsToSave) {
		if (existingDocIds.has(doc._id)) {
			// Document already exists, perform an update to merge the source into the existing document
			writeOps.push({
				updateOne: {
					filter: {
						_id: doc._id,
						ingestSources: {
							// This is pretty messy, but we need to make sure that we don't add the same source twice
							$not: {
								$elemMatch: matchSource,
							},
						},
					},
					update: {
						$push: {
							ingestSources: doc.ingestSources[0],
						},
					},
				},
			})
		} else {
			// Perform a simple insert
			writeOps.push({
				insertOne: {
					document: doc,
				},
			})
		}
	}

	// Remove any old references from this source
	writeOps.push({
		updateMany: {
			filter: {
				studioId: context.studioId,
				bucketId: bucketId,
				_id: { $nin: documentIdsToSave },
			},
			update: {
				$pull: {
					ingestSources: matchSource,
				},
			},
		},
	})

	await context.directCollections.ExpectedPackages.bulkWrite(writeOps)

	// Check for any packages that no longer have any sources
	await cleanUpUnusedPackagesInBucket(context, bucketId)
}

export async function updateExpectedPackagesForBucketAdLibPiece(
	context: JobContext,
	adlib: BucketAdLib
): Promise<void> {
	const documentsToSave = generateExpectedPackagesForBucketAdlib(context.studio, adlib)

	await writeUpdatedExpectedPackages(context, adlib.bucketId, documentsToSave, {
		fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB,
		pieceId: adlib._id,
	})
}

export async function updateExpectedPackagesForBucketAdLibAction(
	context: JobContext,
	action: BucketAdLibAction
): Promise<void> {
	const documentsToSave = generateExpectedPackagesForBucketAdlibAction(context.studio, action)

	await writeUpdatedExpectedPackages(context, action.bucketId, documentsToSave, {
		fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION,
		pieceId: action._id,
	})
}

export async function cleanUpExpectedPackagesForBucketAdLibs(
	context: JobContext,
	bucketId: BucketId,
	adLibIds: Array<BucketAdLibId | BucketAdLibActionId>
): Promise<void> {
	if (adLibIds.length > 0) {
		// Remove the claim for the adlibs from any expected packages in the db
		await context.directCollections.ExpectedPackages.update(
			{
				studioId: context.studioId,
				bucketId: bucketId,
				// Note: this could have the ingestSources match, but that feels excessive as the $pull performs the same check
			},
			{
				$pull: {
					ingestSources: {
						fromPieceType: {
							$in: [ExpectedPackageDBType.BUCKET_ADLIB, ExpectedPackageDBType.BUCKET_ADLIB_ACTION],
						},
						pieceId: { $in: adLibIds },
					} as any, // This cast isn't nice, but is needed for some reason
				},
			}
		)

		// Remove any expected packages that have now have no owners
		await cleanUpUnusedPackagesInBucket(context, bucketId)
	}
}

async function cleanUpUnusedPackagesInBucket(context: JobContext, bucketId: BucketId) {
	await context.directCollections.ExpectedPackages.remove({
		studioId: context.studioId,
		bucketId: bucketId,
		ingestSources: { $size: 0 },
		// Future: these currently can't be referenced by playoutSources, but they could be in the future
	})
}

export function updateBaselineExpectedPackagesOnStudio(
	context: JobContext,
	playoutModel: StudioPlayoutModel | PlayoutModel,
	baseline: BlueprintResultBaseline
): void {
	updateBaselineExpectedPlayoutItemsOnStudio(context, playoutModel, baseline.expectedPlayoutItems ?? [])

	playoutModel.setExpectedPackagesForStudioBaseline(baseline.expectedPackages ?? [])
}

export function sanitiseExpectedPackages(expectedPackages: ExpectedPackage.Any[] | undefined): void {
	// Fill in ids of unnamed expectedPackage
	if (expectedPackages) {
		for (const expectedPackage of expectedPackages) {
			expectedPackage.contentVersionHash = getContentVersionHash(expectedPackage)
		}
	}
}

function getContentVersionHash(expectedPackage: ReadonlyDeep<Omit<ExpectedPackage.Any, '_id'>>): string {
	return hashObj({
		content: expectedPackage.content,
		version: expectedPackage.version,
		// todo: should expectedPackage.sources.containerId be here as well?
	})
}
