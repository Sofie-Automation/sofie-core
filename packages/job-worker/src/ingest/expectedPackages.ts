import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import {
	ExpectedPackageDBType,
	ExpectedPackageDB,
	getExpectedPackageIdFromIngestSource,
	ExpectedPackageIngestSource,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { BucketId, BucketAdLibId, BucketAdLibActionId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { saveIntoDb } from '../db/changes.js'
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
import { clone, hashObj } from '@sofie-automation/corelib/dist/lib'

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
			...generateBucketExpectedPackages(
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
			...generateBucketExpectedPackages(
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
function generateBucketExpectedPackages(
	studio: ReadonlyDeep<JobStudio>,
	bucketId: BucketId,
	source: ExpectedPackageIngestSource,
	expectedPackages: ReadonlyDeep<ExpectedPackage.Any[]>
): ExpectedPackageDB[] {
	const bases: ExpectedPackageDB[] = []

	for (let i = 0; i < expectedPackages.length; i++) {
		const expectedPackage = expectedPackages[i]
		const id = expectedPackage._id || '__unnamed' + i

		bases.push({
			_id: getExpectedPackageIdFromIngestSource(bucketId, source, id),
			package: {
				...clone<ExpectedPackage.Any>(expectedPackage),
				_id: id,
			},
			studioId: studio._id,
			rundownId: null,
			bucketId: bucketId,
			created: Date.now(), // This will be preserved during the `saveIntoDb`
			ingestSources: [source],
		})
	}

	return bases
}

export async function updateExpectedPackagesForBucketAdLibPiece(
	context: JobContext,
	adlib: BucketAdLib
): Promise<void> {
	const packages = generateExpectedPackagesForBucketAdlib(context.studio, adlib)

	await saveIntoDb(
		context,
		context.directCollections.ExpectedPackages,
		{
			studioId: context.studioId,
			bucketId: adlib.bucketId,
			// Note: This assumes that there is only one ingest source for each piece
			ingestSources: {
				$elemMatch: {
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB,
					pieceId: adlib._id,
				},
			},
		},
		packages,
		{
			beforeDiff: (obj, oldObj) => {
				return {
					...obj,
					// Preserve old created timestamp
					created: oldObj.created,
				}
			},
		}
	)
}

export async function updateExpectedPackagesForBucketAdLibAction(
	context: JobContext,
	action: BucketAdLibAction
): Promise<void> {
	const packages = generateExpectedPackagesForBucketAdlibAction(context.studio, action)

	await saveIntoDb(
		context,
		context.directCollections.ExpectedPackages,
		{
			studioId: context.studioId,
			bucketId: action.bucketId,
			// Note: This assumes that there is only one ingest source for each piece
			ingestSources: {
				$elemMatch: {
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION,
					pieceId: action._id,
				},
			},
		},
		packages,
		{
			beforeDiff: (obj, oldObj) => {
				return {
					...obj,
					// Preserve old created timestamp
					created: oldObj.created,
				}
			},
		}
	)
}

export async function cleanUpExpectedPackagesForBucketAdLibs(
	context: JobContext,
	bucketId: BucketId,
	adLibIds: BucketAdLibId[]
): Promise<void> {
	if (adLibIds.length > 0) {
		await context.directCollections.ExpectedPackages.remove({
			studioId: context.studioId,
			bucketId: bucketId,
			// Note: This assumes that there is only one ingest source for each piece
			ingestSources: {
				$elemMatch: {
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB,
					pieceId: { $in: adLibIds },
				},
			},
		})
	}
}
export async function cleanUpExpectedPackagesForBucketAdLibsActions(
	context: JobContext,
	bucketId: BucketId,
	adLibIds: BucketAdLibActionId[]
): Promise<void> {
	if (adLibIds.length > 0) {
		await context.directCollections.ExpectedPackages.remove({
			studioId: context.studioId,
			bucketId: bucketId,
			// Note: This assumes that there is only one ingest source for each piece
			ingestSources: {
				$elemMatch: {
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION,
					pieceId: { $in: adLibIds },
				},
			},
		})
	}
}

export function updateBaselineExpectedPackagesOnStudio(
	context: JobContext,
	playoutModel: StudioPlayoutModel | PlayoutModel,
	baseline: BlueprintResultBaseline
): void {
	updateBaselineExpectedPlayoutItemsOnStudio(context, playoutModel, baseline.expectedPlayoutItems ?? [])

	playoutModel.setExpectedPackagesForStudioBaseline(baseline.expectedPackages ?? [])
}

export function setDefaultIdOnExpectedPackages(expectedPackages: ExpectedPackage.Any[] | undefined): void {
	// Fill in ids of unnamed expectedPackage
	if (expectedPackages) {
		for (let i = 0; i < expectedPackages.length; i++) {
			const expectedPackage = expectedPackages[i]
			if (!expectedPackage._id) {
				expectedPackage._id = `__index${i}`
			}

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
