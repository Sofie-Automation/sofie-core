import {
	BlueprintSyncIngestNewData,
	BlueprintSyncIngestPartInstance,
	IBlueprintAdLibPieceDB,
} from '@sofie-automation/blueprints-integration'
import { JobContext, ProcessedShowStyleCompound } from '../jobs/index.js'
import { PlayoutModel } from '../playout/model/PlayoutModel.js'
import { PlayoutPartInstanceModel } from '../playout/model/PlayoutPartInstanceModel.js'
import { IngestModelReadonly } from './model/IngestModel.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { logger } from '../logging.js'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from '../playout/infinites.js'
import _ from 'underscore'
import { SyncIngestUpdateToPartInstanceContext } from '../blueprints/context/index.js'
import {
	convertAdLibActionToBlueprints,
	convertAdLibPieceToBlueprints,
	convertPartInstanceToBlueprints,
	convertPartToBlueprints,
	convertPieceInstanceToBlueprints,
	convertRundownPieceToBlueprints,
} from '../blueprints/context/lib.js'
import { validateAdlibTestingPartInstanceProperties } from '../playout/adlibTesting.js'
import { ReadonlyDeep } from 'type-fest'
import { convertIngestModelToPlayoutRundownWithSegments } from './commit.js'
import { convertNoteToNotification } from '../notifications/util.js'
import { PlayoutRundownModel } from '../playout/model/PlayoutRundownModel.js'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { setNextPart } from '../playout/setNext.js'
import { PartId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { WrappedShowStyleBlueprint } from '../blueprints/cache.js'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'

type PlayStatus = 'previous' | 'current' | 'next'
export interface PartInstanceToSync {
	playoutRundownModel: PlayoutRundownModel
	existingPartInstance: PlayoutPartInstanceModel
	previousPartInstance: PlayoutPartInstanceModel | null
	playStatus: PlayStatus
	newPart: ReadonlyDeep<DBPart> | undefined
	proposedPieceInstances: Promise<PieceInstance[]>
}

/**
 * Attempt to sync the current and next Part into their PartInstances
 * This defers out to the Blueprints to do the syncing
 * @param context Context of the job being run
 * @param playoutModel Playout model containing containing the Rundown being ingested
 * @param ingestModel Ingest model for the Rundown. This is being written to mongodb while this method runs
 */
export async function syncChangesToPartInstances(
	context: JobContext,
	playoutModel: PlayoutModel,
	ingestModel: IngestModelReadonly
): Promise<void> {
	if (!playoutModel.playlist.activationId) return

	// Get the final copy of the rundown
	const playoutRundownModel = convertIngestModelToPlayoutRundownWithSegments(ingestModel)

	const showStyle = await context.getShowStyleCompound(
		playoutRundownModel.rundown.showStyleVariantId,
		playoutRundownModel.rundown.showStyleBaseId
	)
	const blueprint = await context.getShowStyleBlueprint(showStyle._id)

	if (!blueprint.blueprint.syncIngestUpdateToPartInstance) {
		// blueprint.syncIngestUpdateToPartInstance is not set, default behaviour is to not sync the partInstance at all.
		return
	}

	const instancesToSync = findInstancesToSync(context, playoutModel, ingestModel, playoutRundownModel)

	const worker = new SyncChangesToPartInstancesWorker(context, playoutModel, ingestModel, showStyle, blueprint)

	for (const instanceToSync of instancesToSync) {
		await worker.syncChangesToPartInstance(instanceToSync)
	}
}

/**
 * Internal worker for syncing changes to PartInstances
 * Exposed for testing purposes
 * Note: many methods are public so that they can be spied on in tests
 */
export class SyncChangesToPartInstancesWorker {
	readonly #context: JobContext
	readonly #playoutModel: PlayoutModel
	readonly #ingestModel: IngestModelReadonly
	readonly #showStyle: ReadonlyDeep<ProcessedShowStyleCompound>
	readonly #blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>

	constructor(
		context: JobContext,
		playoutModel: PlayoutModel,
		ingestModel: IngestModelReadonly,
		showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
		blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>
	) {
		this.#context = context
		this.#playoutModel = playoutModel
		this.#ingestModel = ingestModel
		this.#showStyle = showStyle
		this.#blueprint = blueprint
	}

	async syncChangesToPartInstance(instanceToSync: PartInstanceToSync): Promise<void> {
		const { existingPartInstance } = instanceToSync

		const existingResultPartInstance: BlueprintSyncIngestPartInstance = {
			partInstance: convertPartInstanceToBlueprints(existingPartInstance.partInstance),
			pieceInstances: existingPartInstance.pieceInstances.map((p) =>
				convertPieceInstanceToBlueprints(p.pieceInstance)
			),
		}

		const part = instanceToSync.newPart ?? existingPartInstance.partInstance.part

		logger.info(`Syncing ingest changes for part: ${part._id} (orphaned: ${!!instanceToSync.newPart})`)

		const proposedPieceInstances = await instanceToSync.proposedPieceInstances
		const newResultData = this.collectNewIngestDataToSync(part._id, instanceToSync, proposedPieceInstances)
		const partInstanceSnapshot = existingPartInstance.snapshotMakeCopy()

		const syncContext = new SyncIngestUpdateToPartInstanceContext(
			this.#context,
			this.#playoutModel,
			{
				name: `Update to ${existingPartInstance.partInstance.part.externalId}`,
				identifier: `rundownId=${existingPartInstance.partInstance.part.rundownId},segmentId=${existingPartInstance.partInstance.part.segmentId}`,
			},
			this.#context.studio,
			this.#showStyle,
			this.#playoutModel.playlist,
			instanceToSync.playoutRundownModel.rundown,
			existingPartInstance,
			proposedPieceInstances,
			instanceToSync.playStatus
		)
		// TODO - how can we limit the frequency we run this? (ie, how do we know nothing affecting this has changed)
		try {
			if (!this.#blueprint.blueprint.syncIngestUpdateToPartInstance)
				throw new Error('Blueprint does not have syncIngestUpdateToPartInstance')

			// The blueprint handles what in the updated part is going to be synced into the partInstance:
			this.#blueprint.blueprint.syncIngestUpdateToPartInstance(
				syncContext,
				existingResultPartInstance,
				newResultData,
				instanceToSync.playStatus
			)

			// Persist t-timer changes
			for (const timer of syncContext.changedTTimers) {
				this.#playoutModel.updateTTimer(timer)
			}
		} catch (err) {
			logger.error(`Error in showStyleBlueprint.syncIngestUpdateToPartInstance: ${stringifyError(err)}`)

			// Operation failed, rollback the changes
			existingPartInstance.snapshotRestore(partInstanceSnapshot)
		}

		if (instanceToSync.playStatus === 'next' && syncContext.hasRemovedPartInstance) {
			// PartInstance was removed, so we need to remove it and re-select the next part
			await this.recreateNextPartInstance(instanceToSync.newPart)

			// We don't need to continue syncing this partInstance, as it's been replaced
			return
		}

		if (instanceToSync.playStatus === 'next') {
			existingPartInstance.recalculateExpectedDurationWithTransition()
		}

		// Save notes:
		this.saveNotes(syncContext, existingPartInstance)

		// Make sure an adlib-testing part is still labeled correctly. This could happen if the partInstance used any recently updated adlibs
		validateAdlibTestingPartInstanceProperties(this.#context, this.#playoutModel, existingPartInstance)

		if (existingPartInstance.partInstance._id === this.#playoutModel.playlist.currentPartInfo?.partInstanceId) {
			// This should be run after 'current', before 'next':
			await syncPlayheadInfinitesForNextPartInstance(
				this.#context,
				this.#playoutModel,
				this.#ingestModel,
				this.#playoutModel.currentPartInstance,
				this.#playoutModel.nextPartInstance
			)
		}
	}

	private collectNewIngestDataToSync(
		partId: PartId,
		instanceToSync: PartInstanceToSync,
		proposedPieceInstances: PieceInstance[]
	): BlueprintSyncIngestNewData {
		const ingestPart = this.#ingestModel.findPart(partId)

		const referencedAdlibs: IBlueprintAdLibPieceDB[] = []
		for (const adLibPieceId of _.compact(
			instanceToSync.existingPartInstance.pieceInstances.map((p) => p.pieceInstance.adLibSourceId)
		)) {
			const adLibPiece = this.#ingestModel.findAdlibPiece(adLibPieceId)
			if (adLibPiece) referencedAdlibs.push(convertAdLibPieceToBlueprints(adLibPiece))
		}

		const allModelParts = this.#ingestModel.getAllOrderedParts()

		return {
			allParts: allModelParts.map((part) => convertPartToBlueprints(part.part)),
			currentPartIndex: computeCurrentPartIndex(
				this.#ingestModel.getOrderedSegments().map((s) => s.segment),
				allModelParts.map((p) => p.part),
				partId,
				instanceToSync.existingPartInstance.partInstance.segmentId,
				instanceToSync.existingPartInstance.partInstance.part._rank
			),

			part: instanceToSync.newPart ? convertPartToBlueprints(instanceToSync.newPart) : undefined,
			pieceInstances: proposedPieceInstances.map(convertPieceInstanceToBlueprints),
			adLibPieces:
				instanceToSync.newPart && ingestPart ? ingestPart.adLibPieces.map(convertAdLibPieceToBlueprints) : [],
			actions:
				instanceToSync.newPart && ingestPart ? ingestPart.adLibActions.map(convertAdLibActionToBlueprints) : [],
			referencedAdlibs: referencedAdlibs,
			rundownPieces: this.#ingestModel.getGlobalPieces().map(convertRundownPieceToBlueprints),
		}
	}

	async recreateNextPartInstance(newPart: ReadonlyDeep<DBPart> | undefined): Promise<void> {
		const originalNextPartInfo = this.#playoutModel.playlist.nextPartInfo

		// Clear the next part
		await setNextPart(this.#context, this.#playoutModel, null, false, 0)

		if (originalNextPartInfo?.manuallySelected && newPart) {
			// If the next part was manually selected, we need to force it to be re-created
			await setNextPart(
				this.#context,
				this.#playoutModel,
				{
					part: newPart,
					consumesQueuedSegmentId: originalNextPartInfo.consumesQueuedSegmentId,
				},
				true,
				this.#playoutModel.playlist.nextTimeOffset || 0
			)
		} else {
			// A new next part will be selected automatically during the commit
		}
	}

	saveNotes(
		syncContext: SyncIngestUpdateToPartInstanceContext,
		existingPartInstance: PlayoutPartInstanceModel
	): void {
		const notificationCategory = `syncIngestUpdateToPartInstance:${existingPartInstance.partInstance._id}`
		this.#playoutModel.clearAllNotifications(notificationCategory)
		for (const note of syncContext.notes) {
			this.#playoutModel.setNotification(notificationCategory, {
				...convertNoteToNotification(note, [this.#blueprint.blueprintId]),
				relatedTo: {
					type: 'partInstance',
					rundownId: existingPartInstance.partInstance.part.rundownId,
					partInstanceId: existingPartInstance.partInstance._id,
				},
			})
		}
	}
}

export function findInstancesToSync(
	context: JobContext,
	playoutModel: PlayoutModel,
	ingestModel: IngestModelReadonly,
	playoutRundownModel: PlayoutRundownModel
): PartInstanceToSync[] {
	const currentPartInstance = playoutModel.currentPartInstance
	const nextPartInstance = playoutModel.nextPartInstance
	const previousPartInstance = playoutModel.previousPartInstance

	const instancesToSync: PartInstanceToSync[] = []
	if (currentPartInstance) {
		try {
			// If the currentPartInstance is adlibbed we probably also need to find the earliest
			// non-adlibbed Part within this segment and check it for updates too. It may have something
			// changed (like timing) that will affect what's going on.
			// The previous "planned" Part Instance needs to be inserted into the `instances` first, so that
			// it's ran first through the blueprints.
			if (currentPartInstance.partInstance.orphaned === 'adlib-part') {
				const partAndPartInstance = findLastUnorphanedPartInstanceInSegment(
					playoutModel,
					currentPartInstance.partInstance
				)
				if (partAndPartInstance) {
					try {
						const lastPartRundownModel = findPlayoutRundownModel(
							playoutRundownModel,
							playoutModel,
							partAndPartInstance.partInstance.partInstance.part.rundownId
						)

						insertToSyncedInstanceCandidates(
							context,
							instancesToSync,
							playoutModel,
							lastPartRundownModel,
							ingestModel,
							partAndPartInstance.partInstance,
							null,
							partAndPartInstance.part,
							'previous'
						)
					} catch (err) {
						logger.error(
							`Failed to prepare previousPartInstance for syncChangesToPartInstances: ${stringifyError(
								err
							)}`
						)
					}
				}
			}

			// We can now run the current Part Instance.
			const currentPartRundownModel = findPlayoutRundownModel(
				playoutRundownModel,
				playoutModel,
				currentPartInstance.partInstance.part.rundownId
			)
			findPartAndInsertToSyncedInstanceCandidates(
				context,
				instancesToSync,
				playoutModel,
				currentPartRundownModel,
				ingestModel,
				currentPartInstance,
				previousPartInstance,
				'current'
			)
		} catch (err) {
			logger.error(`Failed to prepare currentPartInstance for syncChangesToPartInstances: ${stringifyError(err)}`)
		}
	}
	if (nextPartInstance) {
		try {
			const nextPartRundownModel = findPlayoutRundownModel(
				playoutRundownModel,
				playoutModel,
				nextPartInstance.partInstance.part.rundownId
			)
			findPartAndInsertToSyncedInstanceCandidates(
				context,
				instancesToSync,
				playoutModel,
				nextPartRundownModel,
				ingestModel,
				nextPartInstance,
				currentPartInstance,
				currentPartInstance?.isTooCloseToAutonext(false) ? 'current' : 'next'
			)
		} catch (err) {
			logger.error(`Failed to prepare nextPartInstance for syncChangesToPartInstances: ${stringifyError(err)}`)
		}
	}

	return instancesToSync
}

/**
 * Inserts given PartInstances and underlying Part to the list of PartInstances to be synced
 */
function insertToSyncedInstanceCandidates(
	context: JobContext,
	instances: PartInstanceToSync[],
	playoutModel: PlayoutModel,
	playoutRundownModel: PlayoutRundownModel,
	ingestModel: IngestModelReadonly,
	thisPartInstance: PlayoutPartInstanceModel,
	previousPartInstance: PlayoutPartInstanceModel | null,
	part: ReadonlyDeep<DBPart> | undefined,
	playStatus: PlayStatus
): void {
	const partOrInstancePart = part ?? thisPartInstance.partInstance.part

	const piecesThatMayBeActive = fetchPiecesThatMayBeActiveForPart(
		context,
		playoutModel,
		ingestModel,
		partOrInstancePart
	)

	const proposedPieceInstances = piecesThatMayBeActive.then((piecesThatMayBeActive) =>
		getPieceInstancesForPart(
			context,
			playoutModel,
			previousPartInstance,
			playoutRundownModel,
			partOrInstancePart,
			piecesThatMayBeActive,
			thisPartInstance.partInstance._id
		)
	)
	// Ensure that the promise doesn't go uncaught, it will be awaited later
	proposedPieceInstances.catch(() => null)

	instances.push({
		playoutRundownModel,
		existingPartInstance: thisPartInstance,
		previousPartInstance: previousPartInstance,
		playStatus,
		newPart: part,
		proposedPieceInstances,
	})
}

function findPlayoutRundownModel(
	ingestPlayoutRundownModel: PlayoutRundownModel,
	playoutModel: PlayoutModel,
	rundownId: RundownId
): PlayoutRundownModel {
	if (ingestPlayoutRundownModel.rundown._id === rundownId) return ingestPlayoutRundownModel

	// Handle a case where the part is in a different rundown than the playoutRundownModel:
	const playoutRundownModelForPart = playoutModel.getRundown(rundownId)
	if (!playoutRundownModelForPart)
		throw new Error(`Internal Error: playoutRundownModelForPart is undefined (it should never be)`)

	return playoutRundownModelForPart
}

/**
 * Finds the underlying Part for a given `thisPartInstance` and inserts it to the list of PartInstances to be synced.
 * Doesn't do anything if it can't find the underlying Part in `model`.
 */
function findPartAndInsertToSyncedInstanceCandidates(
	context: JobContext,
	instances: PartInstanceToSync[],
	playoutModel: PlayoutModel,
	playoutRundownModel: PlayoutRundownModel,
	ingestModel: IngestModelReadonly,
	thisPartInstance: PlayoutPartInstanceModel,
	previousPartInstance: PlayoutPartInstanceModel | null,
	playStatus: PlayStatus
): void {
	const newPart = playoutModel.findPart(thisPartInstance.partInstance.part._id)

	insertToSyncedInstanceCandidates(
		context,
		instances,
		playoutModel,
		playoutRundownModel,
		ingestModel,
		thisPartInstance,
		previousPartInstance,
		newPart,
		playStatus
	)
}

/**
 * Finds the most recent Part before a given `currentPartInstance` within the current Segment. Then finds the
 * PartInstance that matches that Part. Returns them if found or returns `null` if it can't find anything.
 */
function findLastUnorphanedPartInstanceInSegment(
	playoutModel: PlayoutModel,
	currentPartInstance: ReadonlyDeep<DBPartInstance>
): {
	partInstance: PlayoutPartInstanceModel
	part: ReadonlyDeep<DBPart>
} | null {
	// Find the "latest" (last played), non-orphaned PartInstance in this Segment, in this play-through
	const previousPartInstance = playoutModel.sortedLoadedPartInstances
		.reverse()
		.find(
			(p) =>
				p.partInstance.playlistActivationId === currentPartInstance.playlistActivationId &&
				p.partInstance.segmentId === currentPartInstance.segmentId &&
				p.partInstance.segmentPlayoutId === currentPartInstance.segmentPlayoutId &&
				p.partInstance.takeCount < currentPartInstance.takeCount &&
				!!p.partInstance.orphaned &&
				!p.partInstance.reset
		)

	if (!previousPartInstance) return null

	const previousPart = playoutModel.findPart(previousPartInstance.partInstance.part._id)
	if (!previousPart) return null

	return {
		partInstance: previousPartInstance,
		part: previousPart,
	}
}

/**
 * Compute an approximate (possibly non-integer) index of the part within all parts
 * This is used to give the blueprints an idea of where the part is within the rundown
 * Note: this assumes each part has a unique integer rank, which is what ingest will produce
 * @returns The approximate index, or `null` if the part could not be placed
 */
export function computeCurrentPartIndex(
	allOrderedSegments: ReadonlyDeep<DBSegment>[],
	allOrderedParts: ReadonlyDeep<DBPart>[],
	partId: PartId,
	segmentId: SegmentId,
	targetRank: number
): number | null {
	// Exact match by part id
	const exactIdx = allOrderedParts.findIndex((p) => p._id === partId)
	if (exactIdx !== -1) return exactIdx

	// Find the segment object
	const segment = allOrderedSegments.find((s) => s._id === segmentId)
	if (!segment) return null

	// Prepare parts with their global indices
	const partsWithGlobal = allOrderedParts.map((p, globalIndex) => ({ part: p, globalIndex }))

	// Parts in the same segment
	const partsInSegment = partsWithGlobal.filter((pg) => pg.part.segmentId === segmentId)

	if (partsInSegment.length === 0) {
		// Segment has no parts: place between the previous/next parts by segment order
		const segmentRank = segment._rank

		const prev = partsWithGlobal.findLast((pg) => {
			const seg = allOrderedSegments.find((s) => s._id === pg.part.segmentId)
			return !!seg && seg._rank < segmentRank
		})

		const next = partsWithGlobal.find((pg) => {
			const seg = allOrderedSegments.find((s) => s._id === pg.part.segmentId)
			return !!seg && seg._rank > segmentRank
		})

		if (prev && next) return (prev.globalIndex + next.globalIndex) / 2
		if (prev) return prev.globalIndex + 0.5
		if (next) return next.globalIndex - 0.5

		// No parts at all
		return null
	}

	// There are parts in the segment: decide placement by rank within the segment.

	const nextIdx = partsInSegment.findIndex((pg) => pg.part._rank > targetRank)
	if (nextIdx === -1) {
		// After last
		return partsInSegment[partsInSegment.length - 1].globalIndex + 0.5
	}

	if (nextIdx === 0) {
		// Before first
		return partsInSegment[0].globalIndex - 0.5
	}

	// Between two adjacent parts: interpolate by their ranks (proportionally)
	const prev = partsInSegment[nextIdx - 1]
	const next = partsInSegment[nextIdx]
	return prev.globalIndex + (next.globalIndex - prev.globalIndex) / 2
}
