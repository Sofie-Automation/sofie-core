import { PartInstanceId, RundownId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance, wrapPieceToInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	getPieceInstancesForPart as libgetPieceInstancesForPart,
	getPlayheadTrackingInfinitesForPart as libgetPlayheadTrackingInfinitesForPart,
	buildPiecesStartingInThisPartQuery,
	buildPastInfinitePiecesForThisPartQuery,
} from '@sofie-automation/corelib/dist/playout/infinites'
import {
	createPartCurrentTimes,
	processAndPrunePieceInstanceTimings,
} from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { JobContext } from '../jobs/index.js'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutModel } from './model/PlayoutModel.js'
import { PlayoutPartInstanceModel } from './model/PlayoutPartInstanceModel.js'
import { PlayoutSegmentModel } from './model/PlayoutSegmentModel.js'
import { getCurrentTime } from '../lib/index.js'
import { clone, flatten, getRandomId } from '@sofie-automation/corelib/dist/lib'
import _ from 'underscore'
import { IngestModelReadonly } from '../ingest/model/IngestModel.js'
import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { sortRundownIDsInPlaylist } from '@sofie-automation/corelib/dist/playout/playlist'
import { mongoWhere } from '@sofie-automation/corelib/dist/mongo'
import { PlayoutRundownModel } from './model/PlayoutRundownModel.js'
import { logger } from '../logging.js'

/** When we crop a piece, set the piece as "it has definitely ended" this far into the future. */
export const DEFINITELY_ENDED_FUTURE_DURATION = 1 * 1000

function getShowStyleIdsRundownMapping(rundowns: readonly PlayoutRundownModel[]): Map<RundownId, ShowStyleBaseId> {
	const ret = new Map()

	for (const rundown of rundowns) {
		ret.set(rundown.rundown._id, rundown.rundown.showStyleBaseId)
	}

	return ret
}

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

/**
 * Get the ids of parts, segments and rundowns before a given part in the playlist.
 * Note: this will return no segments and rundowns if the part is in the AdlibTesting segment.
 */
function getIdsBeforeThisPart(context: JobContext, playoutModel: PlayoutModel, nextPart: ReadonlyDeep<DBPart>) {
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

	const partsBeforeThisInSegmentSorted = _.sortBy(partsBeforeThisInSegment, (p) => p._rank).map((p) => p._id)

	const nextPartSegment = currentRundown?.getSegment(nextPart.segmentId)
	if (nextPartSegment?.segment?.orphaned === SegmentOrphanedReason.ADLIB_TESTING) {
		if (span) span.end()
		return {
			partsToReceiveOnSegmentEndFrom: partsBeforeThisInSegmentSorted,
			segmentsToReceiveOnRundownEndFrom: [],
			rundownsToReceiveOnShowStyleEndFrom: [],
		}
	} else {
		// Note: In theory we should ignore any AdlibTesting segments here, but they will never produce any planned `Pieces`, only `PieceInstances`

		const currentSegment = currentRundown?.getSegment(nextPart.segmentId)
		const segmentsToReceiveOnRundownEndFrom =
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
		const rundownsToReceiveOnShowStyleEndFrom =
			currentRundownIndex === -1 ? [] : sortedRundownIds.slice(0, currentRundownIndex)

		if (span) span.end()
		return {
			partsToReceiveOnSegmentEndFrom: partsBeforeThisInSegmentSorted,
			segmentsToReceiveOnRundownEndFrom,
			rundownsToReceiveOnShowStyleEndFrom,
		}
	}
}

/**
 * Find all infinite Pieces that _may_ be active in the given Part, which will be continued from a previous part
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

	const piecePromises: Array<Promise<Array<Piece> | Array<ReadonlyDeep<Piece>>>> = []

	// Find all the pieces starting in the part
	const thisPiecesQuery = buildPiecesStartingInThisPartQuery(part)
	piecePromises.push(
		unsavedIngestModel?.rundownId === part.rundownId
			? Promise.resolve(unsavedIngestModel.getAllPieces().filter((p) => mongoWhere(p, thisPiecesQuery)))
			: context.directCollections.Pieces.findFetch(thisPiecesQuery)
	)

	// Figure out the ids of everything else we will have to search through
	const { partsToReceiveOnSegmentEndFrom, segmentsToReceiveOnRundownEndFrom, rundownsToReceiveOnShowStyleEndFrom } =
		getIdsBeforeThisPart(context, playoutModel, part)

	if (unsavedIngestModel?.rundownId === part.rundownId) {
		// Find pieces for the current rundown
		const thisRundownPieceQuery = buildPastInfinitePiecesForThisPartQuery(
			part,
			partsToReceiveOnSegmentEndFrom,
			segmentsToReceiveOnRundownEndFrom,
			[] // other rundowns don't exist in the ingestModel
		)
		if (thisRundownPieceQuery) {
			piecePromises.push(
				Promise.resolve(unsavedIngestModel.getAllPieces().filter((p) => mongoWhere(p, thisRundownPieceQuery)))
			)
		}

		// Find pieces for the previous rundowns
		const previousRundownPieceQuery = buildPastInfinitePiecesForThisPartQuery(
			part,
			[], // Only applies to the current rundown
			[], // Only applies to the current rundown
			rundownsToReceiveOnShowStyleEndFrom
		)
		if (previousRundownPieceQuery) {
			piecePromises.push(context.directCollections.Pieces.findFetch(previousRundownPieceQuery))
		}
	} else {
		// Skip model, so we can do a single query to the db for it all
		const infinitePiecesQuery = buildPastInfinitePiecesForThisPartQuery(
			part,
			partsToReceiveOnSegmentEndFrom,
			segmentsToReceiveOnRundownEndFrom,
			rundownsToReceiveOnShowStyleEndFrom
		)
		if (infinitePiecesQuery) {
			piecePromises.push(context.directCollections.Pieces.findFetch(infinitePiecesQuery))
		}
	}

	const pieces = flatten(await Promise.all(piecePromises))
	if (span) span.end()
	return pieces
}

/**
 * Update the onChange infinites for the nextPartInstance to be up to date with the ones on the currentPartInstance
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
		const playlist = playoutModel.playlist
		if (!playlist.activationId) throw new Error(`RundownPlaylist "${playlist._id}" is not active`)

		const {
			partsToReceiveOnSegmentEndFrom,
			segmentsToReceiveOnRundownEndFrom,
			rundownsToReceiveOnShowStyleEndFrom,
		} = getIdsBeforeThisPart(context, playoutModel, toPartInstance.partInstance.part)

		const currentRundown = playoutModel.getRundown(fromPartInstance.partInstance.rundownId)
		if (!currentRundown) throw new Error(`Rundown "${fromPartInstance.partInstance.rundownId}" not found!`)

		const currentSegment = currentRundown.getSegment(fromPartInstance.partInstance.segmentId)
		if (!currentSegment) throw new Error(`Segment "${fromPartInstance.partInstance.segmentId}" not found!`)

		const nextRundown = playoutModel.getRundown(toPartInstance.partInstance.rundownId)
		if (!nextRundown) throw new Error(`Rundown "${toPartInstance.partInstance.rundownId}" not found!`)

		const nextSegment = nextRundown.getSegment(toPartInstance.partInstance.segmentId)
		if (!nextSegment) throw new Error(`Segment "${toPartInstance.partInstance.segmentId}" not found!`)

		const showStyleBase = await context.getShowStyleBase(nextRundown.rundown.showStyleBaseId)

		const nextPartIsAfterCurrentPart = candidatePartIsAfterPreviewPartInstance(
			context,
			playoutModel.getAllOrderedSegments(),
			fromPartInstance.partInstance,
			toPartInstance.partInstance.part
		)

		const partTimes = createPartCurrentTimes(
			getCurrentTime(),
			fromPartInstance.partInstance.timings?.plannedStartedPlayback
		)
		const prunedPieceInstances = processAndPrunePieceInstanceTimings(
			showStyleBase.sourceLayers,
			fromPartInstance.pieceInstances.map((p) => p.pieceInstance),
			partTimes,
			undefined,
			true
		)

		const rundownIdsToShowstyleIds = getShowStyleIdsRundownMapping(playoutModel.rundowns)

		const infinites = libgetPlayheadTrackingInfinitesForPart(
			playlist.activationId,
			new Set(partsToReceiveOnSegmentEndFrom),
			new Set(segmentsToReceiveOnRundownEndFrom),
			rundownsToReceiveOnShowStyleEndFrom,
			rundownIdsToShowstyleIds,
			fromPartInstance.partInstance,
			currentSegment?.segment,
			prunedPieceInstances,
			nextRundown.rundown,
			toPartInstance.partInstance.part,
			nextSegment?.segment,
			toPartInstance.partInstance._id,
			nextPartIsAfterCurrentPart,
			false,
			context.studio.settings.allowTestingAdlibsToPersist ?? false
		)

		toPartInstance.replaceInfinitesFromPreviousPlayhead(infinites)
	} else if (toPartInstance && !fromPartInstance) {
		// This is the first take of the rundown, ensure the baseline infinites are loaded
		const baselineInfinites = await getBaselineInfinitesForPart(
			context,
			playoutModel,
			unsavedIngestModel,
			toPartInstance.partInstance.part,
			toPartInstance.partInstance._id
		)

		toPartInstance.replaceInfinitesFromPreviousPlayhead(baselineInfinites)
	}
	if (span) span.end()
}

/**
 * Calculate all of the onEnd PieceInstances for a PartInstance
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
	const { partsToReceiveOnSegmentEndFrom, segmentsToReceiveOnRundownEndFrom, rundownsToReceiveOnShowStyleEndFrom } =
		getIdsBeforeThisPart(context, playoutModel, part)

	const playlist = playoutModel.playlist
	if (!playlist.activationId) throw new Error(`RundownPlaylist "${playlist._id}" is not active`)

	const playingPieceInstances = playingPartInstance?.pieceInstances ?? []

	const nextPartIsAfterCurrentPart = candidatePartIsAfterPreviewPartInstance(
		context,
		playoutModel.getAllOrderedSegments(),
		playingPartInstance?.partInstance,
		part
	)

	const rundownIdsToShowstyleIds = getShowStyleIdsRundownMapping(playoutModel.rundowns)

	let playingRundown: PlayoutRundownModel | undefined
	let playingSegment: PlayoutSegmentModel | undefined
	if (playingPartInstance) {
		playingRundown = playoutModel.getRundown(playingPartInstance.partInstance.rundownId)
		if (!playingRundown) throw new Error(`Rundown "${playingPartInstance.partInstance.rundownId}" not found!`)

		playingSegment = playingRundown.getSegment(playingPartInstance.partInstance.segmentId)
		if (!playingSegment) {
			// Double check that there are no parts using the old segment ids:
			// TODO: This whole section can probably be removed later, it's really unneccessary in the grand scheme of
			// things, it's here only to debug some problems
			const rundownId = playingRundown.rundown._id
			context.directCollections.Segments.findFetch({
				rundownId: rundownId,
			})
				.then((segment) => {
					logger.error(
						`TROUBLESHOOT: Segment not found, rundown "${rundownId}", segments in db: ${JSON.stringify(
							segment.map((s) => s._id)
						)}`
					)
				})
				.catch((e) => logger.error(e))
			// End of temporary section

			throw new Error(
				`Segment "${playingPartInstance.partInstance.segmentId}" in Rundown "${
					playingRundown.rundown._id
				}" not found! (partInstanceId: "${
					playingPartInstance.partInstance._id
				}", other segments: ${JSON.stringify(playingRundown.segments.map((s) => s.segment._id))})`
			)
		}
	}

	const segment = rundown.getSegment(part.segmentId)
	if (!segment) throw new Error(`Segment "${part.segmentId}" not found!`)

	const res = libgetPieceInstancesForPart(
		playlist.activationId,
		playingPartInstance?.partInstance,
		playingSegment?.segment,
		playingPieceInstances.map((p) => p.pieceInstance),
		rundown.rundown,
		segment.segment,
		part,
		new Set(partsToReceiveOnSegmentEndFrom),
		new Set(segmentsToReceiveOnRundownEndFrom),
		rundownsToReceiveOnShowStyleEndFrom,
		rundownIdsToShowstyleIds,
		possiblePieces,
		playoutModel.getAllOrderedParts().map((p) => p._id),
		newInstanceId,
		nextPartIsAfterCurrentPart,
		false,
		context.studio.settings.allowTestingAdlibsToPersist ?? false
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
