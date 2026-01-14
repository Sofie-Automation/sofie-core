import { BlueprintId, ExpectedPackageId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { SegmentNote, PartNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { RawPartNote, SegmentUserContext } from '../blueprints/context/index.js'
import { WatchedPackagesHelper } from '../blueprints/context/watchedPackages.js'
import { postProcessAdLibActions, postProcessAdLibPieces, postProcessPieces } from '../blueprints/postProcess.js'
import { logger } from '../logging.js'
import { IngestModel, IngestModelReadonly, IngestReplaceSegmentType } from './model/IngestModel.js'
import { getSegmentId, canSegmentBeUpdated } from './lib.js'
import { JobContext, ProcessedShowStyleCompound } from '../jobs/index.js'
import { CommitIngestData } from './lock.js'
import {
	BlueprintResultPart,
	BlueprintResultSegment,
	NoteSeverity,
	SofieIngestRundown,
	SofieIngestSegment,
} from '@sofie-automation/blueprints-integration'
import { wrapTranslatableMessageFromBlueprints } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { updateExpectedMediaAndPlayoutItemsForPartModel } from './expectedPackages.js'
import { IngestReplacePartType, IngestSegmentModel } from './model/IngestSegmentModel.js'
import { ReadonlyDeep } from 'type-fest'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { WrappedShowStyleBlueprint } from '../blueprints/cache.js'
import { translateUserEditPropertiesFromBlueprint, translateUserEditsFromBlueprint } from '../blueprints/context/lib.js'

async function getWatchedPackagesHelper(
	context: JobContext,
	allRundownWatchedPackages0: WatchedPackagesHelper | null,
	ingestModel: IngestModelReadonly,
	ingestSegments: SofieIngestSegment[]
): Promise<WatchedPackagesHelper> {
	if (allRundownWatchedPackages0) {
		return allRundownWatchedPackages0
	} else {
		const segmentExternalIds = ingestSegments.map((s) => s.externalId)
		return WatchedPackagesHelper.createForIngestSegments(context, ingestModel, segmentExternalIds)
	}
}

/**
 * Generate and return the content for an array segments
 * @param context Context for the running job
 * @param ingestModel The ingest model of the rundown
 * @param ingestSegments The segments to regenerate
 * @param allRundownWatchedPackages0 Optional WatchedPackagesHelper for all Packages in the Rundown. If not provided, packages will be loaded from the database
 * @returns Newly generated documents
 */
export async function calculateSegmentsFromIngestData(
	context: JobContext,
	ingestModel: IngestModel,
	ingestSegments: SofieIngestSegment[],
	allRundownWatchedPackages0: WatchedPackagesHelper | null
): Promise<SegmentId[]> {
	const span = context.startSpan('ingest.rundownInput.calculateSegmentsFromIngestData')

	const rundown = ingestModel.getRundown()

	let changedSegmentIds: SegmentId[] = []

	if (ingestSegments.length > 0) {
		const pShowStyle = context.getShowStyleCompound(rundown.showStyleVariantId, rundown.showStyleBaseId)
		const pAllRundownWatchedPackages = getWatchedPackagesHelper(
			context,
			allRundownWatchedPackages0,
			ingestModel,
			ingestSegments
		)

		const showStyle = await pShowStyle
		const blueprint = await context.getShowStyleBlueprint(showStyle._id)

		const allRundownWatchedPackages = await pAllRundownWatchedPackages

		changedSegmentIds = await Promise.all(
			ingestSegments.map(async (ingestSegment) =>
				regenerateSegmentAndUpdateModelFull(
					context,
					showStyle,
					blueprint,
					allRundownWatchedPackages,
					ingestModel,
					ingestSegment
				)
			)
		)
	}

	span?.end()
	return changedSegmentIds
}

async function regenerateSegmentAndUpdateModelFull(
	context: JobContext,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	allRundownWatchedPackages: WatchedPackagesHelper,
	ingestModel: IngestModel,
	ingestSegment: SofieIngestSegment
): Promise<SegmentId> {
	// Ensure the parts are sorted by rank
	ingestSegment.parts.sort((a, b) => a.rank - b.rank)

	// Filter down to the packages for this segment
	const segmentId = ingestModel.getSegmentIdFromExternalId(ingestSegment.externalId)
	const segmentWatchedPackages = allRundownWatchedPackages.filter(
		context,
		(p) => 'segmentId' in p.source && p.source.segmentId === segmentId
	)

	let updatedSegmentModel = await regenerateSegmentAndUpdateModel(
		context,
		showStyle,
		blueprint,
		ingestModel,
		ingestSegment,
		segmentWatchedPackages
	)

	// Future: this would be better to go before `updateModelWithGeneratedSegment`, but we need the final ids of the ExpectedPackages
	const shouldRegenerateSegment = await checkIfSegmentReferencesUnloadedPackageInfos(
		context,
		updatedSegmentModel,
		segmentWatchedPackages
	)
	if (shouldRegenerateSegment) {
		logger.info(`Regenerating segment ${ingestSegment.name} due to existing PackageInfos being found`)
		const reloadedWatchedPackages = await WatchedPackagesHelper.createForIngestSegments(context, ingestModel, [
			ingestSegment.externalId,
		])

		// Regenerate the segment once, with the updated packages
		updatedSegmentModel = await regenerateSegmentAndUpdateModel(
			context,
			showStyle,
			blueprint,
			ingestModel,
			ingestSegment,
			reloadedWatchedPackages
		)
	}

	preserveOrphanedSegmentPositionInRundown(context, ingestModel, updatedSegmentModel.segment)

	return updatedSegmentModel.segment._id
}

async function regenerateSegmentAndUpdateModel(
	context: JobContext,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	ingestModel: IngestModel,
	ingestSegment: SofieIngestSegment,
	watchedPackages: WatchedPackagesHelper
): Promise<IngestSegmentModel> {
	const rundown = ingestModel.getRundown()

	const blueprintResult = await generateSegmentWithBlueprints(
		context,
		showStyle,
		blueprint,
		rundown,
		ingestSegment,
		watchedPackages
	)

	if (!blueprintResult) {
		// Something went wrong when generating the segment

		return ingestModel.replaceSegment(createInternalErrorSegment(blueprint.blueprintId, ingestSegment))
	}

	return updateModelWithGeneratedSegment(
		context,
		blueprint.blueprintId,
		ingestModel,
		ingestSegment,
		blueprintResult.blueprintSegment,
		blueprintResult.blueprintNotes
	)
}

async function checkIfSegmentReferencesUnloadedPackageInfos(
	context: JobContext,
	segmentModel: IngestSegmentModel,
	segmentWatchedPackages: WatchedPackagesHelper
) {
	const expectedPackageIdsToCheck = new Set<ExpectedPackageId>()
	// check if there are any updates right away?
	for (const part of segmentModel.parts) {
		for (const expectedPackage of part.expectedPackages) {
			if (expectedPackage.package.listenToPackageInfoUpdates) {
				if (!segmentWatchedPackages.hasPackage(expectedPackage._id)) {
					// The package didn't exist prior to the blueprint running
					expectedPackageIdsToCheck.add(expectedPackage._id)
				}
			}
		}
	}

	if (expectedPackageIdsToCheck.size > 0) {
		const areThereAnyData = await context.directCollections.PackageInfos.count({
			packageId: { $in: Array.from(expectedPackageIdsToCheck) },
		})
		return areThereAnyData > 0
	}
	return false
}

async function generateSegmentWithBlueprints(
	context: JobContext,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	rundown: ReadonlyDeep<Rundown>,
	ingestSegment: SofieIngestSegment,
	watchedPackages: WatchedPackagesHelper
): Promise<{
	blueprintSegment: BlueprintResultSegment
	blueprintNotes: RawPartNote[]
} | null> {
	const blueprintContext = new SegmentUserContext(
		{
			name: `getSegment=${ingestSegment.name};${getSegmentId(rundown._id, ingestSegment.externalId)}`,
			// Note: this intentionally does not include the segmentId, as parts may be moved between segemnts later on
			// This isn't much entropy, blueprints may want to add more for each Part they generate
			identifier: `rundownId=${rundown._id}`,
		},
		context,
		showStyle,
		rundown,
		watchedPackages
	)

	try {
		const blueprintSegment = await blueprint.blueprint.getSegment(blueprintContext, ingestSegment)
		return {
			blueprintSegment,
			blueprintNotes: blueprintContext.notes,
		}
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.getSegment: ${stringifyError(err)}`)
		return null
	}
}

function createInternalErrorSegment(
	blueprintId: BlueprintId,
	ingestSegment: SofieIngestSegment
): IngestReplaceSegmentType {
	return {
		externalId: ingestSegment.externalId,
		_rank: ingestSegment.rank,
		notes: [
			{
				type: NoteSeverity.ERROR,
				message: wrapTranslatableMessageFromBlueprints(
					{
						key: 'Internal Error generating segment',
					},
					[blueprintId]
				),
				origin: {
					name: '', // TODO
				},
			},
		],
		name: ingestSegment.name,
	}
}

function updateModelWithGeneratedSegment(
	context: JobContext,
	blueprintId: BlueprintId,
	ingestModel: IngestModel,
	ingestSegment: SofieIngestSegment,
	blueprintSegment: BlueprintResultSegment,
	blueprintNotes: RawPartNote[]
): IngestSegmentModel {
	// Ensure all parts have a valid externalId set on them
	const knownPartExternalIds = new Set(blueprintSegment.parts.map((p) => p.part.externalId))

	const segmentNotes = extractAndWrapSegmentNotes(blueprintId, blueprintNotes, knownPartExternalIds)

	const segmentModel = ingestModel.replaceSegment(
		literal<IngestReplaceSegmentType>({
			...blueprintSegment.segment,
			externalId: ingestSegment.externalId,
			_rank: ingestSegment.rank,
			notes: segmentNotes,
			userEditOperations: translateUserEditsFromBlueprint(blueprintSegment.segment.userEditOperations, [
				blueprintId,
			]),
			userEditProperties: translateUserEditPropertiesFromBlueprint(blueprintSegment.segment.userEditProperties, [
				blueprintId,
			]),
		})
	)

	blueprintSegment.parts.forEach((blueprintPart, i) => {
		updateModelWithGeneratedPart(context, blueprintId, segmentModel, blueprintNotes, blueprintPart, i)
	})

	return segmentModel
}

function extractAndWrapSegmentNotes(
	blueprintId: BlueprintId,
	blueprintNotes: RawPartNote[],
	knownPartExternalIds: Set<string>
): SegmentNote[] {
	const segmentNotes: SegmentNote[] = []

	for (const note of blueprintNotes) {
		if (!note.partExternalId || !knownPartExternalIds.has(note.partExternalId)) {
			segmentNotes.push(
				literal<SegmentNote>({
					type: note.type,
					message: wrapTranslatableMessageFromBlueprints(note.message, [blueprintId]),
					origin: {
						name: '', // TODO
					},
				})
			)
		}
	}

	return segmentNotes
}

function extractAndWrapPartNotes(
	blueprintId: BlueprintId,
	blueprintNotes: RawPartNote[],
	partExternalId: string
): PartNote[] {
	const partNotes: PartNote[] = []

	for (const note of blueprintNotes) {
		if (note.partExternalId === partExternalId) {
			partNotes.push(
				literal<PartNote>({
					type: note.type,
					message: wrapTranslatableMessageFromBlueprints(note.message, [blueprintId]),
					origin: {
						name: '', // TODO
					},
				})
			)
		}
	}

	return partNotes
}

function updateModelWithGeneratedPart(
	context: JobContext,
	blueprintId: BlueprintId,
	segmentModel: IngestSegmentModel,
	blueprintNotes: RawPartNote[],
	blueprintPart: BlueprintResultPart,
	i: number
): void {
	const partId = segmentModel.getPartIdFromExternalId(blueprintPart.part.externalId)

	const partNotes = extractAndWrapPartNotes(blueprintId, blueprintNotes, blueprintPart.part.externalId)

	const part = literal<IngestReplacePartType>({
		...blueprintPart.part,
		_rank: i, // This gets updated to a rank unique within its segment in a later step
		notes: partNotes,
		invalidReason: blueprintPart.part.invalidReason
			? {
					...blueprintPart.part.invalidReason,
					message: wrapTranslatableMessageFromBlueprints(blueprintPart.part.invalidReason.message, [
						blueprintId,
					]),
				}
			: undefined,
		userEditOperations: translateUserEditsFromBlueprint(blueprintPart.part.userEditOperations, [blueprintId]),
		userEditProperties: translateUserEditPropertiesFromBlueprint(blueprintPart.part.userEditProperties, [
			blueprintId,
		]),
	})

	// Update pieces
	const processedPieces = postProcessPieces(
		context,
		blueprintPart.pieces,
		blueprintId,
		segmentModel.segment.rundownId,
		segmentModel.segment._id,
		partId,
		false,
		part.invalid
	)
	const adlibPieces = postProcessAdLibPieces(
		context,
		blueprintId,
		segmentModel.segment.rundownId,
		partId,
		blueprintPart.adLibPieces
	)

	const adlibActions = postProcessAdLibActions(
		blueprintId,
		segmentModel.segment.rundownId,
		partId,
		blueprintPart.actions || []
	)

	const partModel = segmentModel.replacePart(part, processedPieces, adlibPieces, adlibActions)
	updateExpectedMediaAndPlayoutItemsForPartModel(context, partModel)
}

/**
 * Preserve the position of `orphaned: deleted` segments in the Rundown, when regenerating
 * Danger: This has been written and tested only for the iNews gateway.
 * It may work for mos-gateway, but this has not yet been tested and so is behind a feature/config field until it has been verified or adapted
 * @param context Context for the running job
 * @param ingestModel The ingest model of the rundown
 * @param newSegment The changed Segment that could affect ordering
 */
function preserveOrphanedSegmentPositionInRundown(
	context: JobContext,
	ingestModel: IngestModel,
	newSegment: ReadonlyDeep<DBSegment>
) {
	if (context.studio.settings.preserveOrphanedSegmentPositionInRundown) {
		// When we have orphaned segments, try to keep the order correct when adding and removing other segments
		const allSegmentsByRank = ingestModel.getOrderedSegments()
		const orphanedDeletedSegments = allSegmentsByRank.filter(
			(s) => s.segment.orphaned === SegmentOrphanedReason.DELETED
		)
		if (orphanedDeletedSegments.length) {
			// Rank padding
			const rankPad = 0.0001
			for (const orphanedSegment of orphanedDeletedSegments) {
				const removedInd = allSegmentsByRank.findIndex((s) => s.segment._id === orphanedSegment.segment._id)
				let newRank = Number.MIN_SAFE_INTEGER
				const previousSegment = allSegmentsByRank[removedInd + 1]
				const nextSegment = allSegmentsByRank[removedInd - 1]
				const previousPreviousSegment = allSegmentsByRank[removedInd + 2]

				if (previousSegment) {
					newRank = previousSegment.segment._rank + rankPad
					if (previousSegment.segment._id === newSegment._id) {
						if (previousSegment.segment._rank > newSegment._rank) {
							// Moved previous segment up: follow it
							newRank = newSegment._rank + rankPad
						} else if (previousSegment.segment._rank < newSegment._rank && previousPreviousSegment) {
							// Moved previous segment down: stay behind more previous
							newRank = previousPreviousSegment.segment._rank + rankPad
						}
					} else if (
						nextSegment &&
						nextSegment.segment._id === newSegment._id &&
						nextSegment.segment._rank > newSegment._rank
					) {
						// Next segment was moved uo
						if (previousPreviousSegment) {
							if (previousPreviousSegment.segment._rank < newSegment._rank) {
								// Swapped segments directly before and after
								// Will always result in both going below the unsynced
								// Will also affect multiple segents moved directly above the previous
								newRank = previousPreviousSegment.segment._rank + rankPad
							}
						} else {
							newRank = Number.MIN_SAFE_INTEGER
						}
					}
				}
				orphanedSegment.setRank(newRank)
			}
		}
	}
}

/**
 * Regenerate and save the content for a Segment
 * @param context Context for the running job
 * @param ingestModel The ingest model of the rundown
 * @param ingestSegment The segment to regenerate
 * @param isNewSegment True if the segment is being created.
 * @returns Details on the changes
 */
export async function updateSegmentFromIngestData(
	context: JobContext,
	ingestModel: IngestModel,
	ingestSegment: SofieIngestSegment,
	isNewSegment: boolean
): Promise<CommitIngestData | null> {
	const span = context.startSpan('ingest.rundownInput.handleUpdatedPartInner')

	const rundown = ingestModel.getRundown()

	// Updated OR created part
	const segmentId = getSegmentId(rundown._id, ingestSegment.externalId)
	const segment = ingestModel.getSegment(segmentId)
	if (!isNewSegment && !segment) throw new Error(`Segment "${segmentId}" not found`)
	if (!canSegmentBeUpdated(rundown, segment, isNewSegment)) return null

	const changedSegmentIds = await calculateSegmentsFromIngestData(context, ingestModel, [ingestSegment], null)

	span?.end()
	return {
		changedSegmentIds: changedSegmentIds,
		removedSegmentIds: [],
		renamedSegments: null,

		removeRundown: false,
	}
}

/**
 * Regenerate and save the content for all list of Segment Ids in a Rundown
 * @param context Context for the running job
 * @param ingestModel The ingest model of the rundown
 * @param ingestRundown The rundown to regenerate
 * @param segmentIds Ids of the segments to regenerate
 * @returns Details on the changes, and any SegmentIds that were not found in the ingestRundown
 */
export async function regenerateSegmentsFromIngestData(
	context: JobContext,
	ingestModel: IngestModel,
	ingestRundown: SofieIngestRundown,
	segmentIds: SegmentId[]
): Promise<{ result: CommitIngestData | null; skippedSegments: SegmentId[] }> {
	const span = context.startSpan('ingest.rundownInput.handleUpdatedPartInner')

	if (segmentIds.length === 0) {
		return { result: null, skippedSegments: [] }
	}

	const rundown = ingestModel.getRundown()

	const skippedSegments: SegmentId[] = []
	const ingestSegments: SofieIngestSegment[] = []

	for (const segmentId of segmentIds) {
		const segment = ingestModel.getSegment(segmentId)
		if (!segment) {
			skippedSegments.push(segmentId)
		} else if (!canSegmentBeUpdated(rundown, segment, false)) {
			skippedSegments.push(segmentId)
		} else {
			const ingestSegment = ingestRundown.segments.find((s) => s.externalId === segment.segment.externalId)
			if (!ingestSegment) {
				skippedSegments.push(segmentId)
			} else {
				ingestSegments.push(ingestSegment)
			}
		}
	}

	const changedSegmentIds = await calculateSegmentsFromIngestData(context, ingestModel, ingestSegments, null)

	const result: CommitIngestData = {
		changedSegmentIds: changedSegmentIds,
		removedSegmentIds: [],
		renamedSegments: null,

		removeRundown: false,
	}

	span?.end()
	return {
		result,
		skippedSegments,
	}
}

/**
 * Generate and return the content for all Segments in a Rundown, along with Segments which should be removed
 * @param context Context for the running job
 * @param ingestModel The ingest model of the rundown
 * @param ingestRundown The Rundown to regenerate
 * @param allRundownWatchedPackages0 WatchedPackagesHelper for all Packages used in the Rundown
 * @returns Newly generated documents, and list of those to remove
 */
export async function calculateSegmentsAndRemovalsFromIngestData(
	context: JobContext,
	ingestModel: IngestModel,
	ingestRundown: SofieIngestRundown,
	allRundownWatchedPackages: WatchedPackagesHelper
): Promise<{ changedSegmentIds: SegmentId[]; removedSegmentIds: SegmentId[] }> {
	const changedSegmentIds = await calculateSegmentsFromIngestData(
		context,
		ingestModel,
		ingestRundown.segments,
		allRundownWatchedPackages
	)

	/** Don't remove segments for now, orphan them instead. The 'commit' phase will clean them up if possible */
	const changedSegmentIdsSet = new Set(changedSegmentIds)
	const segmentsToBeRemoved = ingestModel.getAllSegments().filter((s) => !changedSegmentIdsSet.has(s.segment._id))
	const removedSegmentIds: SegmentId[] = []
	for (const oldSegment of segmentsToBeRemoved) {
		removedSegmentIds.push(oldSegment.segment._id)
		changedSegmentIds.push(oldSegment.segment._id)
		oldSegment.setOrphaned(SegmentOrphanedReason.DELETED)

		oldSegment.removeAllParts()
	}

	return { changedSegmentIds, removedSegmentIds }
}
