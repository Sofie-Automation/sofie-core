import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import {
	ExpectedPackageDBType,
	ExpectedPackageDBFromPiece,
	ExpectedPackageDBFromBaselineAdLibPiece,
	ExpectedPackageDBFromAdLibAction,
	ExpectedPackageDBFromBaselineAdLibAction,
	ExpectedPackageDBFromBucketAdLib,
	ExpectedPackageDBFromBucketAdLibAction,
	ExpectedPackageDBBase,
	ExpectedPackageDBFromRundownBaselineObjects,
	ExpectedPackageDBFromStudioBaselineObjects,
	getContentVersionHash,
	getExpectedPackageId,
	ExpectedPackageFromRundown,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import {
	SegmentId,
	RundownId,
	AdLibActionId,
	PieceId,
	RundownBaselineAdLibActionId,
	BucketAdLibActionId,
	BucketAdLibId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
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
import { ExpectedPackageForIngestModelBaseline, IngestModel } from './model/IngestModel.js'
import { IngestPartModel } from './model/IngestPartModel.js'
import { clone } from '@sofie-automation/corelib/dist/lib'

export function updateExpectedPackagesForPartModel(context: JobContext, part: IngestPartModel): void {
	updateExpectedPlayoutItemsForPartModel(context, part)

	const expectedPackages: ExpectedPackageFromRundown[] = [
		...generateExpectedPackagesForPiece(
			context.studio,
			part.part.rundownId,
			part.part.segmentId,
			part.pieces,
			ExpectedPackageDBType.PIECE
		),
		...generateExpectedPackagesForPiece(
			context.studio,
			part.part.rundownId,
			part.part.segmentId,
			part.adLibPieces,
			ExpectedPackageDBType.ADLIB_PIECE
		),
		...generateExpectedPackagesForAdlibAction(
			context.studio,
			part.part.rundownId,
			part.part.segmentId,
			part.adLibActions
		),
	]

	part.setExpectedPackages(expectedPackages)
}

export async function updateExpectedPackagesForRundownBaseline(
	context: JobContext,
	ingestModel: IngestModel,
	baseline: BlueprintResultBaseline | undefined,
	forceBaseline = false
): Promise<void> {
	await updateExpectedPlayoutItemsForRundownBaseline(context, ingestModel, baseline)

	const expectedPackages: ExpectedPackageForIngestModelBaseline[] = []

	const preserveTypesDuringSave = new Set<ExpectedPackageDBType>()

	// Only regenerate the baseline types if they are already loaded into memory
	// If the data isn't already loaded, then we haven't made any changes to the baseline adlibs
	// This means we can skip regenerating them as it is guaranteed there will be no changes
	const baselineAdlibPieceCache = forceBaseline
		? await ingestModel.rundownBaselineAdLibPieces.get()
		: ingestModel.rundownBaselineAdLibPieces.getIfLoaded()
	if (baselineAdlibPieceCache) {
		expectedPackages.push(
			...generateExpectedPackagesForBaselineAdlibPiece(
				context.studio,
				ingestModel.rundownId,
				baselineAdlibPieceCache
			)
		)
	} else {
		// We haven't regenerated anything, so preserve the values in the save
		preserveTypesDuringSave.add(ExpectedPackageDBType.BASELINE_ADLIB_PIECE)
	}
	const baselineAdlibActionCache = forceBaseline
		? await ingestModel.rundownBaselineAdLibActions.get()
		: ingestModel.rundownBaselineAdLibActions.getIfLoaded()
	if (baselineAdlibActionCache) {
		expectedPackages.push(
			...generateExpectedPackagesForBaselineAdlibAction(
				context.studio,
				ingestModel.rundownId,
				baselineAdlibActionCache
			)
		)
	} else {
		// We haven't regenerated anything, so preserve the values in the save
		preserveTypesDuringSave.add(ExpectedPackageDBType.BASELINE_ADLIB_ACTION)
	}

	if (baseline) {
		// Fill in ids of unnamed expectedPackages
		setDefaultIdOnExpectedPackages(baseline.expectedPackages)

		const bases = generateExpectedPackageBases(
			context.studio,
			ingestModel.rundownId,
			baseline.expectedPackages ?? []
		)

		expectedPackages.push(
			...bases.map((item): ExpectedPackageDBFromRundownBaselineObjects => {
				return {
					...item,
					fromPieceType: ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS,
					rundownId: ingestModel.rundownId,
					pieceId: null,
				}
			})
		)
	} else {
		// We haven't regenerated anything, so preserve the values in the save
		preserveTypesDuringSave.add(ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS)
	}

	// Add expected packages for global pieces
	for (const piece of ingestModel.getGlobalPieces()) {
		if (piece.expectedPackages) {
			const bases = generateExpectedPackageBases(context.studio, piece._id, piece.expectedPackages)
			for (const base of bases) {
				expectedPackages.push({
					...base,
					rundownId: ingestModel.rundownId,
					pieceId: piece._id,
					fromPieceType: ExpectedPackageDBType.BASELINE_PIECE,
				})
			}
		}
	}

	// Preserve anything existing
	for (const expectedPackage of ingestModel.expectedPackagesForRundownBaseline) {
		if (preserveTypesDuringSave.has(expectedPackage.fromPieceType)) {
			expectedPackages.push(clone<ExpectedPackageForIngestModelBaseline>(expectedPackage))
		}
	}

	ingestModel.setExpectedPackagesForRundownBaseline(expectedPackages)
}

function generateExpectedPackagesForPiece(
	studio: ReadonlyDeep<JobStudio>,
	rundownId: RundownId,
	segmentId: SegmentId,
	pieces: ReadonlyDeep<Piece | AdLibPiece>[],
	type: ExpectedPackageDBType.PIECE | ExpectedPackageDBType.ADLIB_PIECE
) {
	const packages: ExpectedPackageDBFromPiece[] = []
	for (const piece of pieces) {
		const partId = 'startPartId' in piece ? piece.startPartId : piece.partId
		if (piece.expectedPackages && partId) {
			const bases = generateExpectedPackageBases(studio, piece._id, piece.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					rundownId,
					segmentId,
					partId,
					pieceId: piece._id,
					fromPieceType: type,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackagesForBaselineAdlibPiece(
	studio: ReadonlyDeep<JobStudio>,
	rundownId: RundownId,
	pieces: ReadonlyDeep<RundownBaselineAdLibItem[]>
) {
	const packages: ExpectedPackageDBFromBaselineAdLibPiece[] = []
	for (const piece of pieces) {
		if (piece.expectedPackages) {
			const bases = generateExpectedPackageBases(studio, piece._id, piece.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					rundownId,
					pieceId: piece._id,
					fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_PIECE,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackagesForAdlibAction(
	studio: ReadonlyDeep<JobStudio>,
	rundownId: RundownId,
	segmentId: SegmentId,
	actions: ReadonlyDeep<AdLibAction[]>
) {
	const packages: ExpectedPackageDBFromAdLibAction[] = []
	for (const action of actions) {
		if (action.expectedPackages) {
			const bases = generateExpectedPackageBases(studio, action._id, action.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					rundownId,
					segmentId,
					partId: action.partId,
					pieceId: action._id,
					fromPieceType: ExpectedPackageDBType.ADLIB_ACTION,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackagesForBaselineAdlibAction(
	studio: ReadonlyDeep<JobStudio>,
	rundownId: RundownId,
	actions: ReadonlyDeep<RundownBaselineAdLibAction[]>
) {
	const packages: ExpectedPackageDBFromBaselineAdLibAction[] = []
	for (const action of actions) {
		if (action.expectedPackages) {
			const bases = generateExpectedPackageBases(studio, action._id, action.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					rundownId,
					pieceId: action._id,
					fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_ACTION,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackagesForBucketAdlib(studio: ReadonlyDeep<JobStudio>, adlibs: BucketAdLib[]) {
	const packages: ExpectedPackageDBFromBucketAdLib[] = []
	for (const adlib of adlibs) {
		if (adlib.expectedPackages) {
			const bases = generateExpectedPackageBases(studio, adlib._id, adlib.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					bucketId: adlib.bucketId,
					pieceId: adlib._id,
					pieceExternalId: adlib.externalId,
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackagesForBucketAdlibAction(
	studio: ReadonlyDeep<JobStudio>,
	adlibActions: BucketAdLibAction[]
) {
	const packages: ExpectedPackageDBFromBucketAdLibAction[] = []
	for (const action of adlibActions) {
		if (action.expectedPackages) {
			const bases = generateExpectedPackageBases(studio, action._id, action.expectedPackages)
			for (const base of bases) {
				packages.push({
					...base,
					bucketId: action.bucketId,
					pieceId: action._id,
					pieceExternalId: action.externalId,
					fromPieceType: ExpectedPackageDBType.BUCKET_ADLIB_ACTION,
				})
			}
		}
	}
	return packages
}
function generateExpectedPackageBases(
	studio: ReadonlyDeep<JobStudio>,
	ownerId:
		| PieceId
		| AdLibActionId
		| RundownBaselineAdLibActionId
		| BucketAdLibId
		| BucketAdLibActionId
		| RundownId
		| StudioId,
	expectedPackages: ReadonlyDeep<ExpectedPackage.Any[]>
) {
	const bases: Omit<ExpectedPackageDBBase, 'pieceId' | 'fromPieceType'>[] = []

	for (let i = 0; i < expectedPackages.length; i++) {
		const expectedPackage = expectedPackages[i]
		const id = expectedPackage._id || '__unnamed' + i

		bases.push({
			...clone<ExpectedPackage.Any>(expectedPackage),
			_id: getExpectedPackageId(ownerId, id),
			blueprintPackageId: id,
			contentVersionHash: getContentVersionHash(expectedPackage),
			studioId: studio._id,
			created: Date.now(),
		})
	}
	return bases
}

export async function updateExpectedPackagesForBucketAdLibPiece(
	context: JobContext,
	adlib: BucketAdLib
): Promise<void> {
	const packages = generateExpectedPackagesForBucketAdlib(context.studio, [adlib])

	await saveIntoDb(context, context.directCollections.ExpectedPackages, { pieceId: adlib._id }, packages)
}

export async function updateExpectedPackagesForBucketAdLibAction(
	context: JobContext,
	action: BucketAdLibAction
): Promise<void> {
	const packages = generateExpectedPackagesForBucketAdlibAction(context.studio, [action])

	await saveIntoDb(context, context.directCollections.ExpectedPackages, { pieceId: action._id }, packages)
}
export async function cleanUpExpectedPackagesForBucketAdLibs(
	context: JobContext,
	adLibIds: BucketAdLibId[]
): Promise<void> {
	if (adLibIds.length > 0) {
		await context.directCollections.ExpectedPackages.remove({
			pieceId: {
				$in: adLibIds,
			},
		})
	}
}
export async function cleanUpExpectedPackagesForBucketAdLibsActions(
	context: JobContext,
	adLibIds: BucketAdLibActionId[]
): Promise<void> {
	if (adLibIds.length > 0) {
		await context.directCollections.ExpectedPackages.remove({
			pieceId: {
				$in: adLibIds,
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

	// Fill in ids of unnamed expectedPackages
	setDefaultIdOnExpectedPackages(baseline.expectedPackages)

	const bases = generateExpectedPackageBases(context.studio, context.studio._id, baseline.expectedPackages ?? [])
	playoutModel.setExpectedPackagesForStudioBaseline(
		bases.map((item): ExpectedPackageDBFromStudioBaselineObjects => {
			return {
				...item,
				fromPieceType: ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS,
				pieceId: null,
			}
		})
	)
}

export function setDefaultIdOnExpectedPackages(expectedPackages: ExpectedPackage.Any[] | undefined): void {
	// Fill in ids of unnamed expectedPackage
	if (expectedPackages) {
		for (let i = 0; i < expectedPackages.length; i++) {
			const expectedPackage = expectedPackages[i]
			if (!expectedPackage._id) {
				expectedPackage._id = `__index${i}`
			}
		}
	}
}
