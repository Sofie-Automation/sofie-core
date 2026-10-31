import { PartId, PartInstanceId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance, wrapPieceToInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	buildPiecesStartingInThisPartQuery,
	buildPastInfinitePiecesForThisPartQuery,
	buildPastPiecesOnLayersForThisPartQuery,
	getContinuedInfinitesForPart,
	getPieceInstancesForPart as libGetPieceInstancesForPart,
	PartPosition,
	PieceInstancesForPartParams,
	PlayingPartInstance,
} from '@sofie-automation/corelib/dist/playout/infinites'
import { JobContext } from '../jobs/index.js'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutModel } from './model/PlayoutModel.js'
import { PlayoutPartInstanceModel } from './model/PlayoutPartInstanceModel.js'
import { PlayoutSegmentModel } from './model/PlayoutSegmentModel.js'
import { clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import _ from 'underscore'
import { IngestModelReadonly } from '../ingest/model/IngestModel.js'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { sortRundownIDsInPlaylist } from '@sofie-automation/corelib/dist/playout/playlist'
import { MongoQuery, mongoWhere } from '@sofie-automation/corelib/dist/mongo'
import { PlayoutRundownModel } from './model/PlayoutRundownModel.js'

/** When we crop a piece, set the piece as "it has definitely ended" this far into the future. */
export const DEFINITELY_ENDED_FUTURE_DURATION = 1 * 1000

/**
 * We can only continue adlib onEnd infinites if we go forwards in the rundown. Any distance backwards will clear them.
 * */
export function candidatePartIsAfterPreviewPartInstance(
	_context: JobContext,
	orderedSegments: readonly PlayoutSegmentModel[],
	previousPartInstance: ReadonlyDeep<DBPartInstance> | undefined,
	candidateInstance: ReadonlyDeep<DBPart>
): boolean {
	if (previousPartInstance) {
		// When in the same segment, we can rely on the ranks to be in order. This is to handle orphaned parts, but is also valid for normal parts
		if (candidateInstance.segmentId === previousPartInstance.segmentId) {
			return candidateInstance._rank > previousPartInstance.part._rank
		} else {
			// Check if the segment is after the other
			const previousSegmentIndex = orderedSegments.findIndex(
				(s) => s.segment._id === previousPartInstance.segmentId
			)
			const candidateSegmentIndex = orderedSegments.findIndex(
				(s) => s.segment._id === candidateInstance.segmentId
			)

			if (previousSegmentIndex === -1 || candidateSegmentIndex === -1) {
				// Should never happen, as orphaned segments are kept around
				return false
			}

			return candidateSegmentIndex >= previousSegmentIndex
		}
	} else {
		// There won't be anything to continue anyway..
		return false
	}
}

interface IdsBeforePart {
	partIdsBefore: PartId[]
	segmentIdsBefore: SegmentId[]
	rundownIdsBefore: RundownId[]
}

/**
 * Get the ids of parts, segments and rundowns before a given part in the playlist.
 * Note: this will return no segments and rundowns if the part is in the AdlibTesting segment.
 */
function getIdsBeforeThisPart(
	context: JobContext,
	playoutModel: PlayoutModel,
	nextPart: ReadonlyDeep<DBPart>
): IdsBeforePart {
	const span = context.startSpan('getIdsBeforeThisPart')

	const currentRundown = playoutModel.getRundown(nextPart.rundownId)
	const currentSegment = currentRundown?.getSegment(nextPart.segmentId)

	// Get the normal parts
	const partsBeforeThisInSegment = currentSegment?.parts?.filter((p) => p._rank < nextPart._rank) ?? []

	// Find any orphaned parts
	const partInstancesBeforeThisInSegment = playoutModel.loadedPartInstances.filter(
		(p) =>
			p.partInstance.segmentId === nextPart.segmentId &&
			!!p.partInstance.orphaned &&
			p.partInstance.part._rank < nextPart._rank
	)
	partsBeforeThisInSegment.push(...partInstancesBeforeThisInSegment.map((p) => p.partInstance.part))

	const partIdsBefore = _.sortBy(partsBeforeThisInSegment, (p) => p._rank).map((p) => p._id)

	if (currentSegment?.segment?.orphaned === SegmentOrphanedReason.ADLIB_TESTING) {
		if (span) span.end()
		return {
			partIdsBefore,
			segmentIdsBefore: [],
			rundownIdsBefore: [],
		}
	}

	// Note: In theory we should ignore any AdlibTesting segments here, but they will never produce any planned `Pieces`, only `PieceInstances`
	const segmentIdsBefore =
		currentRundown && currentSegment
			? currentRundown.segments
					.filter(
						(s) =>
							s.segment.rundownId === nextPart.rundownId &&
							s.segment._rank < currentSegment.segment._rank &&
							s.segment.orphaned !== SegmentOrphanedReason.ADLIB_TESTING
					)
					.map((p) => p.segment._id)
			: []

	const sortedRundownIds = sortRundownIDsInPlaylist(
		playoutModel.playlist.rundownIdsInOrder,
		playoutModel.rundowns.map((rd) => rd.rundown._id)
	)
	const currentRundownIndex = sortedRundownIds.indexOf(nextPart.rundownId)
	const rundownIdsBefore = currentRundownIndex === -1 ? [] : sortedRundownIds.slice(0, currentRundownIndex)

	if (span) span.end()
	return {
		partIdsBefore,
		segmentIdsBefore,
		rundownIdsBefore,
	}
}

function getPartPosition(context: JobContext, playoutModel: PlayoutModel, part: ReadonlyDeep<DBPart>): PartPosition {
	const { partIdsBefore, segmentIdsBefore, rundownIdsBefore } = getIdsBeforeThisPart(context, playoutModel, part)

	return {
		partIdsBefore: new Set(partIdsBefore),
		segmentIdsBefore: new Set(segmentIdsBefore),
		rundownIdsBefore,
		rundownShowStyles: new Map(playoutModel.rundowns.map((r) => [r.rundown._id, r.rundown.showStyleBaseId])),
		orderedPartIds: playoutModel.getAllOrderedParts().map((p) => p._id),
	}
}

function getPlayingPartInstance(
	context: JobContext,
	playoutModel: PlayoutModel,
	playingPartInstance: PlayoutPartInstanceModel | null,
	part: ReadonlyDeep<DBPart>
): PlayingPartInstance | undefined {
	if (!playingPartInstance) return undefined

	const { rundownId, segmentId } = playingPartInstance.partInstance
	const playingSegment = playoutModel.getRundown(rundownId)?.getSegment(segmentId)
	if (!playingSegment) throw new Error(`Segment "${segmentId}" in Rundown "${rundownId}" not found!`)

	return {
		partInstance: playingPartInstance.partInstance,
		segment: playingSegment.segment,
		pieceInstances: playingPartInstance.pieceInstances.map((p) => p.pieceInstance),
		isBeforeTarget: candidatePartIsAfterPreviewPartInstance(
			context,
			playoutModel.getAllOrderedSegments(),
			playingPartInstance.partInstance,
			part
		),
	}
}

function getPieceInstancesForPartParams(
	context: JobContext,
	playoutModel: PlayoutModel,
	playingPartInstance: PlayoutPartInstanceModel | null,
	rundown: PlayoutRundownModel,
	part: ReadonlyDeep<DBPart>,
	possiblePieces: ReadonlyDeep<Piece>[],
	newInstanceId: PartInstanceId
): PieceInstancesForPartParams {
	const playlistActivationId = playoutModel.playlist.activationId
	if (!playlistActivationId) throw new Error(`RundownPlaylist "${playoutModel.playlistId}" is not active`)

	const segment = rundown.getSegment(part.segmentId)
	if (!segment) throw new Error(`Segment "${part.segmentId}" not found!`)

	return {
		playlistActivationId,
		rundown: rundown.rundown,
		segment: segment.segment,
		part,
		position: getPartPosition(context, playoutModel, part),
		pieces: possiblePieces,
		playing: getPlayingPartInstance(context, playoutModel, playingPartInstance, part),
		newInstanceId,
		isTemporary: false,
		allowTestingAdlibsToPersist: context.studio.settings.allowTestingAdlibsToPersist ?? false,
	}
}

/**
 * Find all Pieces that _may_ be active in the given Part: the ones starting in it, the infinites which may be
 * continued from a previous part, and the other Pieces on their layers which may stop them.
 * Either search a provided ingest model, or the database for these Pieces
 * @param context Context of the current job
 * @param playoutModel Playout model for the current playlist
 * @param unsavedIngestModel If an ingest model is loaded, we can search that instead of mongo
 * @param part The Part to get the Pieces for
 * @returns Array of Piece
 */
export async function fetchPiecesThatMayBeActiveForPart(
	context: JobContext,
	playoutModel: PlayoutModel,
	unsavedIngestModel: Pick<IngestModelReadonly, 'rundownId' | 'getAllPieces'> | undefined,
	part: ReadonlyDeep<DBPart>
): Promise<ReadonlyDeep<Piece>[]> {
	const span = context.startSpan('fetchPiecesThatMayBeActiveForPart')

	const useIngestModel = unsavedIngestModel?.rundownId === part.rundownId
	const findPieces = async (query: MongoQuery<Piece> | null, inIngestModel: boolean) => {
		if (!query) return []
		if (inIngestModel && unsavedIngestModel) {
			return unsavedIngestModel.getAllPieces().filter((p) => mongoWhere(p, query))
		}
		return context.directCollections.Pieces.findFetch(query)
	}

	// The ingest model only contains the current rundown, so the previous rundowns need to come from the database
	const ids = getIdsBeforeThisPart(context, playoutModel, part)
	const findPiecesBeforePart = async (
		buildQuery: (partIds: PartId[], segmentIds: SegmentId[], rundownIds: RundownId[]) => MongoQuery<Piece> | null
	) => {
		if (useIngestModel) {
			const [thisRundown, previousRundowns] = await Promise.all([
				findPieces(buildQuery(ids.partIdsBefore, ids.segmentIdsBefore, []), true),
				findPieces(buildQuery([], [], ids.rundownIdsBefore), false),
			])
			return [...thisRundown, ...previousRundowns]
		} else {
			return findPieces(buildQuery(ids.partIdsBefore, ids.segmentIdsBefore, ids.rundownIdsBefore), false)
		}
	}

	const [piecesStartingInPart, infinitePieces] = await Promise.all([
		findPieces(buildPiecesStartingInThisPartQuery(part), useIngestModel),
		findPiecesBeforePart((partIds, segmentIds, rundownIds) =>
			buildPastInfinitePiecesForThisPartQuery(part, partIds, segmentIds, rundownIds)
		),
	])

	// Any piece on the same layer as one of those infinites may stop it
	const sourceLayerIds = _.uniq(infinitePieces.map((p) => p.sourceLayerId))
	const layerPieces = await findPiecesBeforePart((partIds, segmentIds, rundownIds) =>
		buildPastPiecesOnLayersForThisPartQuery(part, partIds, segmentIds, rundownIds, sourceLayerIds)
	)

	if (span) span.end()
	return [...piecesStartingInPart, ...layerPieces]
}

/**
 * Update the infinites continued into the nextPartInstance, to match what is happening in the currentPartInstance
 * @param context Context for the current job
 * @param playoutModel Playout model for the current playlist
 */
export async function syncPlayheadInfinitesForNextPartInstance(
	context: JobContext,
	playoutModel: PlayoutModel,
	unsavedIngestModel: Pick<IngestModelReadonly, 'rundownId' | 'getAllPieces'> | undefined,
	fromPartInstance: PlayoutPartInstanceModel | null,
	toPartInstance: PlayoutPartInstanceModel | null
): Promise<void> {
	const span = context.startSpan('syncPlayheadInfinitesForNextPartInstance')

	if (toPartInstance && fromPartInstance) {
		const part = toPartInstance.partInstance.part

		const rundown = playoutModel.getRundown(part.rundownId)
		if (!rundown) throw new Error(`Rundown "${part.rundownId}" not found!`)

		const possiblePieces = await fetchPiecesThatMayBeActiveForPart(context, playoutModel, unsavedIngestModel, part)

		const infinites = getContinuedInfinitesForPart(
			getPieceInstancesForPartParams(
				context,
				playoutModel,
				fromPartInstance,
				rundown,
				part,
				possiblePieces,
				toPartInstance.partInstance._id
			)
		)

		toPartInstance.replaceContinuedInfinites(infinites)
	} else if (toPartInstance && !fromPartInstance) {
		// This is the first take of the rundown, ensure the baseline infinites are loaded
		const baselineInfinites = await getBaselineInfinitesForPart(
			context,
			playoutModel,
			unsavedIngestModel,
			toPartInstance.partInstance.part,
			toPartInstance.partInstance._id
		)

		toPartInstance.replaceContinuedInfinites(baselineInfinites)
	}
	if (span) span.end()
}

/**
 * Calculate all of the PieceInstances for a PartInstance
 * @param context Context for the running job
 * @param playoutModel Playout model for the current playlist
 * @param playingPartInstance The current PartInstance, if there is one
 * @param rundown The Rundown the Part belongs to
 * @param part The Part the PartInstance is based on
 * @param possiblePieces Array of Pieces that should be considered for being a PieceInstance in the new PartInstance
 * @param newInstanceId Id of the PartInstance
 * @returns Array of PieceInstances for the specified PartInstance
 */
export function getPieceInstancesForPart(
	context: JobContext,
	playoutModel: PlayoutModel,
	playingPartInstance: PlayoutPartInstanceModel | null,
	rundown: PlayoutRundownModel,
	part: ReadonlyDeep<DBPart>,
	possiblePieces: ReadonlyDeep<Piece>[],
	newInstanceId: PartInstanceId
): PieceInstance[] {
	const span = context.startSpan('getPieceInstancesForPart')

	const res = libGetPieceInstancesForPart(
		getPieceInstancesForPartParams(
			context,
			playoutModel,
			playingPartInstance,
			rundown,
			part,
			possiblePieces,
			newInstanceId
		)
	)

	if (span) span.end()
	return res
}

export async function getBaselineInfinitesForPart(
	context: JobContext,
	playoutModel: PlayoutModel,
	unsavedIngestModel: Pick<IngestModelReadonly, 'rundownId' | 'getAllPieces'> | undefined,
	part: ReadonlyDeep<DBPart>,
	partInstanceId: PartInstanceId
): Promise<PieceInstance[]> {
	// Find the pieces. If an ingest model is provided, use that instead of the database
	const pieces =
		unsavedIngestModel && unsavedIngestModel.rundownId === part.rundownId
			? unsavedIngestModel.getAllPieces().filter((p) => p.startPartId === null)
			: await context.directCollections.Pieces.findFetch({
					startRundownId: part.rundownId,
					startPartId: null,
				})

	const playlistActivationId = playoutModel.playlist.activationId
	if (!playlistActivationId) throw new Error(`RundownPlaylist "${playoutModel.playlistId}" is not active`)

	return pieces.map((piece) => {
		const instance = wrapPieceToInstance(clone<Piece>(piece), playlistActivationId, partInstanceId, false)

		// All these pieces are expected to be outOnRundownChange infinites, as that is how they are ingested

		instance.infinite = {
			infiniteInstanceId: getRandomId(),
			infiniteInstanceIndex: 0,
			infinitePieceId: instance.piece._id,
			fromPreviousPart: true,
		}

		return instance
	})
}
