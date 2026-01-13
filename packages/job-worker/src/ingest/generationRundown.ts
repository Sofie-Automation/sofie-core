import {
	ExpectedPackageDBType,
	ExpectedPackageIngestSourceBaselineAdlibAction,
	ExpectedPackageIngestSourceBaselineAdlibPiece,
	ExpectedPackageIngestSourceBaselineObjects,
	ExpectedPackageIngestSourceBaselinePiece,
	ExpectedPackageIngestSourceRundownBaseline,
} from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { BlueprintId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { Piece, serializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBRundown, RundownSource } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { WrappedShowStyleBlueprint } from '../blueprints/cache.js'
import { StudioUserContext, GetRundownContext } from '../blueprints/context/index.js'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages.js'
import {
	postProcessAdLibPieces,
	postProcessGlobalAdLibActions,
	postProcessGlobalPieces,
	postProcessRundownBaselineItems,
} from '../blueprints/postProcess.js'
import { logger } from '../logging.js'
import _ from 'underscore'
import { IngestModel } from './model/IngestModel.js'
import { extendIngestRundownCore, canRundownBeUpdated } from './lib.js'
import { JobContext } from '../jobs/index.js'
import { CommitIngestData } from './lock.js'
import { SelectedShowStyleVariant, selectShowStyleVariant } from './selectShowStyleVariant.js'
import { updateExpectedMediaAndPlayoutItemsForRundownBaseline } from './expectedPackages.js'
import { ReadonlyDeep } from 'type-fest'
import {
	BlueprintResultRundown,
	ExpectedPackage,
	ExtendedIngestRundown,
} from '@sofie-automation/blueprints-integration'
import { wrapTranslatableMessageFromBlueprints } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { convertRundownToBlueprintSegmentRundown, translateUserEditsFromBlueprint } from '../blueprints/context/lib.js'
import { calculateSegmentsAndRemovalsFromIngestData } from './generationSegment.js'
import { SofieIngestRundownWithSource } from '@sofie-automation/corelib/dist/dataModel/SofieIngestDataCache'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { ExpectedPackageCollector, IngestExpectedPackage } from './model/IngestExpectedPackage.js'

export enum GenerateRundownMode {
	Create = 'create',
	Update = 'update',
	MetadataChange = 'metadata-change',
}

export interface CommitIngestDataExt extends CommitIngestData {
	didRegenerateRundown: boolean
}

/**
 * Regenerate and save a whole Rundown
 * @param context Context for the running job
 * @param ingestModel The ingest model of the rundown
 * @param ingestRundown The rundown to regenerate
 * @param isCreateAction Whether this operation is to create the Rundown or update it
 * @param rundownSource Source of this Rundown
 * @returns CommitIngestData describing the change
 */
export async function updateRundownFromIngestData(
	context: JobContext,
	ingestModel: IngestModel,
	ingestRundown: SofieIngestRundownWithSource,
	generateMode: GenerateRundownMode
): Promise<CommitIngestDataExt | null> {
	const span = context.startSpan('ingest.rundownInput.updateRundownFromIngestData')

	const regenerateAllContents = await updateRundownFromIngestDataInner(
		context,
		ingestModel,
		ingestRundown,
		generateMode
	)

	if (!regenerateAllContents) return null

	const regenerateSegmentsChanges = regenerateAllContents.regenerateAllContents
		? await calculateSegmentsAndRemovalsFromIngestData(
				context,
				ingestModel,
				ingestRundown,
				regenerateAllContents.allRundownWatchedPackages
			)
		: undefined

	logger.info(`Rundown ${ingestModel.rundownId} update complete`)

	span?.end()
	return literal<CommitIngestDataExt>({
		changedSegmentIds: regenerateSegmentsChanges?.changedSegmentIds ?? [],
		removedSegmentIds: regenerateSegmentsChanges?.removedSegmentIds ?? [],
		renamedSegments: new Map(),

		didRegenerateRundown: regenerateAllContents.regenerateAllContents,

		removeRundown: false,
	})
}

export interface UpdateRundownInnerResult {
	allRundownWatchedPackages: WatchedPackagesHelper
	regenerateAllContents: boolean
}

export async function updateRundownFromIngestDataInner(
	context: JobContext,
	ingestModel: IngestModel,
	ingestRundown: SofieIngestRundownWithSource,
	generateMode: GenerateRundownMode
): Promise<UpdateRundownInnerResult | null> {
	if (!canRundownBeUpdated(ingestModel.rundown, generateMode === GenerateRundownMode.Create)) return null

	const existingRundown = ingestModel.rundown
	if (!existingRundown && generateMode === GenerateRundownMode.MetadataChange) {
		throw new Error(`Rundown "${ingestRundown.externalId}" does not exist`)
	}

	logger.info(`${ingestModel.rundown ? 'Updating' : 'Adding'} rundown ${ingestModel.rundownId}`)

	// canBeUpdated is to be run by the callers

	const extendedIngestRundown = extendIngestRundownCore(ingestRundown, ingestModel.rundown)

	const selectShowStyleContext = new StudioUserContext(
		{
			name: 'selectShowStyleVariant',
			identifier: `studioId=${context.studio._id},rundownId=${ingestModel.rundownId},ingestRundownId=${ingestModel.rundownExternalId}`,
		},
		context.studio,
		context.getStudioBlueprintConfig()
	)

	const showStyle = await selectShowStyleVariant(
		context,
		selectShowStyleContext,
		extendedIngestRundown,
		ingestRundown.rundownSource
	)
	if (!showStyle) {
		logger.debug('Blueprint rejected the rundown')
		throw new Error('Blueprint rejected the rundown')
	}

	const pAllRundownWatchedPackages = WatchedPackagesHelper.createForIngestRundown(context, ingestModel)

	const showStyleBlueprint = await context.getShowStyleBlueprint(showStyle.base._id)
	const allRundownWatchedPackages = await pAllRundownWatchedPackages

	const extraRundownNotes: RundownNote[] = selectShowStyleContext.notes.map((note) => ({
		type: note.type,
		message: wrapTranslatableMessageFromBlueprints(note.message, [showStyleBlueprint.blueprintId]),
		origin: {
			name: 'selectShowStyleVariant',
		},
	}))

	// Call blueprints, get rundown
	const dbRundown = await regenerateRundownAndBaselineFromIngestData(
		context,
		ingestModel,
		extendedIngestRundown,
		ingestRundown.rundownSource,
		showStyle,
		showStyleBlueprint,
		allRundownWatchedPackages,
		extraRundownNotes
	)
	if (!dbRundown) {
		// We got no rundown, abort:
		return null
	}

	// TODO - store notes from rundownNotesContext

	let regenerateAllContents = true
	if (generateMode == GenerateRundownMode.MetadataChange) {
		regenerateAllContents =
			!existingRundown ||
			!_.isEqual(
				convertRundownToBlueprintSegmentRundown(existingRundown, true),
				convertRundownToBlueprintSegmentRundown(dbRundown, true)
			)
		if (regenerateAllContents) {
			logger.info(`MetaData of rundown ${dbRundown.externalId} has been modified, regenerating segments`)
		}
	}

	return {
		allRundownWatchedPackages,
		regenerateAllContents,
	}
}

/**
 * Generate a DBRundown from the ingest data
 * @param context Context for the running job
 * @param ingestModel The ingest model of the rundown
 * @param ingestRundown The rundown to regenerate
 * @param pPeripheralDevice The PeripheralDevice the Rundown originated from (if any)
 * @param showStyle ShowStyle to regenerate for
 * @param showStyleBlueprint ShowStyle Blueprint to regenerate with
 * @param allRundownWatchedPackages WatchedPackagesHelper for all packages belonging to the rundown
 * @param extraRundownNotes Additional notes to add to the Rundown, produced earlier in the ingest process
 * @returns Generated documents or null if Blueprints reject the Rundown
 */
export async function regenerateRundownAndBaselineFromIngestData(
	context: JobContext,
	ingestModel: IngestModel,
	extendedIngestRundown: ExtendedIngestRundown,
	rundownSource: RundownSource,
	showStyle: SelectedShowStyleVariant,
	showStyleBlueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	allRundownWatchedPackages: WatchedPackagesHelper,
	extraRundownNotes: RundownNote[]
): Promise<ReadonlyDeep<DBRundown> | null> {
	const rundownBaselinePackages = allRundownWatchedPackages.filter(
		context,
		(pkg) =>
			pkg.source.fromPieceType === ExpectedPackageDBType.BASELINE_ADLIB_ACTION ||
			pkg.source.fromPieceType === ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS
	)

	const blueprintContext = new GetRundownContext(
		{
			name: `${showStyle.base.name}-${showStyle.variant.name}`,
			identifier: `showStyleBaseId=${showStyle.base._id},showStyleVariantId=${showStyle.variant._id}`,
		},
		context,
		showStyle.compound,
		rundownBaselinePackages,
		async () => {
			// Note: This can cause a mild race-condition, in the case of two Rundowns being created at the same time.
			// But we're just ignoreing that for now.
			return context.directCollections.RundownPlaylists.findFetch({
				studioId: context.studioId,
			})
		},
		async () => {
			return context.directCollections.Rundowns.findFetch(
				{
					studioId: context.studioId,
				},
				{
					projection: {
						_id: 1,
						playlistId: 1,
					},
				}
			) as Promise<Pick<DBRundown, '_id' | 'playlistId'>[]>
		},
		async () => {
			return ingestModel.rundown
		}
	)
	let rundownRes: BlueprintResultRundown | null = null
	try {
		rundownRes = await showStyleBlueprint.blueprint.getRundown(blueprintContext, extendedIngestRundown)
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.getRundown: ${stringifyError(err)}`)
		rundownRes = null
	}

	if (rundownRes === null) {
		// There was an error in the blueprint, abort:
		return null
	}

	const translationNamespaces: BlueprintId[] = []
	if (showStyleBlueprint.blueprintId) {
		translationNamespaces.push(showStyleBlueprint.blueprintId)
	}
	if (context.studio.blueprintId) {
		translationNamespaces.push(context.studio.blueprintId)
	}

	// Ensure the ids in the notes are clean
	const rundownNotes = [
		...extraRundownNotes,
		...blueprintContext.notes.map((note) =>
			literal<RundownNote>({
				type: note.type,
				message: wrapTranslatableMessageFromBlueprints(note.message, translationNamespaces),
				origin: {
					name: `${showStyle.base.name}-${showStyle.variant.name}`,
				},
			})
		),
	]

	ingestModel.setRundownData(
		rundownRes.rundown,
		showStyle.base,
		showStyle.variant,
		showStyleBlueprint,
		rundownSource,
		rundownNotes,
		translateUserEditsFromBlueprint(rundownRes.rundown.userEditOperations, translationNamespaces)
	)

	// get the rundown separetely to ensure it exists now
	const dbRundown = ingestModel.getRundown()

	// Save the baseline
	logger.info(`Building baseline objects for ${dbRundown._id}...`)
	logger.info(`... got ${rundownRes.baseline.timelineObjects.length} objects from baseline.`)
	logger.info(`... got ${rundownRes.globalAdLibPieces.length} adLib objects from baseline.`)
	logger.info(`... got ${(rundownRes.globalActions || []).length} adLib actions from baseline.`)
	logger.info(`... got ${(rundownRes.globalPieces || []).length} global pieces from baseline.`)

	const timelineObjectsBlob = serializePieceTimelineObjectsBlob(
		postProcessRundownBaselineItems(showStyle.base.blueprintId, rundownRes.baseline.timelineObjects)
	)

	const adlibPieces = postProcessAdLibPieces(
		context,
		showStyle.base.blueprintId,
		dbRundown._id,
		undefined,
		rundownRes.globalAdLibPieces
	)
	const adlibActions = postProcessGlobalAdLibActions(
		showStyle.base.blueprintId,
		dbRundown._id,
		rundownRes.globalActions || []
	)
	const globalPieces = postProcessGlobalPieces(
		context,
		rundownRes.globalPieces || [],
		showStyle.base.blueprintId,
		dbRundown._id
	)

	const expectedPackages = generateExpectedPackagesForBaseline(
		dbRundown._id,
		adlibPieces,
		adlibActions,
		globalPieces,
		rundownRes.baseline.expectedPackages ?? []
	)

	await ingestModel.setRundownBaseline(timelineObjectsBlob, adlibPieces, adlibActions, globalPieces, expectedPackages)

	await updateExpectedMediaAndPlayoutItemsForRundownBaseline(context, ingestModel, rundownRes.baseline)

	return dbRundown
}

function generateExpectedPackagesForBaseline(
	rundownId: RundownId,
	adLibPieces: AdLibPiece[],
	adLibActions: RundownBaselineAdLibAction[],
	globalPieces: Piece[],
	expectedPackages: ExpectedPackage.Any[]
): IngestExpectedPackage<ExpectedPackageIngestSourceRundownBaseline>[] {
	const collector = new ExpectedPackageCollector<ExpectedPackageIngestSourceRundownBaseline>(rundownId)

	// This expects to generate multiple documents with the same packageId, these get deduplicated during saving.
	// This should only concern itself with avoiding duplicates with the same source

	collector.addPackagesWithSource<ExpectedPackageIngestSourceBaselineObjects>(expectedPackages, {
		fromPieceType: ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS,
	})

	// Populate the ingestSources
	for (const piece of adLibPieces) {
		if (piece.expectedPackages)
			collector.addPackagesWithSource<ExpectedPackageIngestSourceBaselineAdlibPiece>(piece.expectedPackages, {
				fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_PIECE,
				pieceId: piece._id,
			})
	}
	for (const piece of adLibActions) {
		if (piece.expectedPackages)
			collector.addPackagesWithSource<ExpectedPackageIngestSourceBaselineAdlibAction>(piece.expectedPackages, {
				fromPieceType: ExpectedPackageDBType.BASELINE_ADLIB_ACTION,
				pieceId: piece._id,
			})
	}
	for (const piece of globalPieces) {
		if (piece.expectedPackages)
			collector.addPackagesWithSource<ExpectedPackageIngestSourceBaselinePiece>(piece.expectedPackages, {
				fromPieceType: ExpectedPackageDBType.BASELINE_PIECE,
				pieceId: piece._id,
			})
	}

	return collector.finish()
}
