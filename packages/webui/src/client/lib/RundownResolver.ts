import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartInstance, wrapPartToTemporaryInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	getPieceInstancesForPart,
	buildPiecesStartingInThisPartQuery,
	buildPastInfinitePiecesForThisPartQuery,
} from '@sofie-automation/corelib/dist/playout/infinites'
import { invalidateAfter } from './invalidatingTime.js'
import { groupByToMap } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { getCurrentTime } from './systemTime.js'
import { DBRundownPlaylist, QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { mongoWhereFilter, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { FindOptions } from '@sofie-automation/meteor-lib/dist/collections/lib'
import {
	PartId,
	RundownId,
	RundownPlaylistActivationId,
	SegmentId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylistClientUtil } from './rundownPlaylistUtil.js'
import { PieceInstances, Pieces } from '../collections/index.js'

import { PieceExtended } from '@sofie-automation/meteor-lib/dist/uiTypes/Piece'
import { ISourceLayerExtended } from '@sofie-automation/meteor-lib/dist/uiTypes/SourceLayer'
import { IOutputLayerExtended } from '@sofie-automation/meteor-lib/dist/uiTypes/OutputLayer'

export type { PieceExtended } from '@sofie-automation/meteor-lib/dist/uiTypes/Piece'
export type { ISourceLayerExtended } from '@sofie-automation/meteor-lib/dist/uiTypes/SourceLayer'
export type { IOutputLayerExtended } from '@sofie-automation/meteor-lib/dist/uiTypes/OutputLayer'

export interface SegmentExtended extends DBSegment {
	/** Output layers available in the installation used by this segment */
	outputLayers: {
		[key: string]: IOutputLayerExtended
	}
	/** Source layers used by this segment */
	sourceLayers: {
		[key: string]: ISourceLayerExtended
	}
}

export type PartInstanceLimited = Omit<PartInstance, 'isTaken' | 'previousPartEndState'>

export interface PartExtended {
	partId: PartId
	instance: PartInstanceLimited
	/** Pieces belonging to this part */
	pieces: Array<PieceExtended>
	renderedDuration: number
	startsAt: number
	willProbablyAutoNext: boolean
}

function fetchPiecesThatMayBeActiveForPart(
	part: DBPart,
	partsToReceiveOnSegmentEndFromSet: Set<PartId>,
	segmentsToReceiveOnRundownEndFromSet: Set<SegmentId>,
	rundownsToReceiveOnShowStyleEndFrom: RundownId[],
	/** Map of Pieces on Parts, passed through for performance */
	allPiecesCache?: Map<PartId | null, Piece[]>
): Piece[] {
	let piecesStartingInPart: Piece[]
	const allPieces = allPiecesCache?.get(part._id)
	const selector = buildPiecesStartingInThisPartQuery(part)
	if (allPieces) {
		// Fast-path: if we already have the pieces, we can use them directly:
		piecesStartingInPart = mongoWhereFilter(allPieces, selector)
	} else {
		piecesStartingInPart = Pieces.find(selector).fetch()
	}

	const partsToReceiveOnSegmentEndFrom = Array.from(partsToReceiveOnSegmentEndFromSet.values())
	const segmentsToReceiveOnRundownEndFrom = Array.from(segmentsToReceiveOnRundownEndFromSet.values())

	const infinitePieceQuery = buildPastInfinitePiecesForThisPartQuery(
		part,
		partsToReceiveOnSegmentEndFrom,
		segmentsToReceiveOnRundownEndFrom,
		rundownsToReceiveOnShowStyleEndFrom
	)
	let infinitePieces: Piece[]
	if (allPieces) {
		// Fast-path: if we already have the pieces, we can use them directly:
		infinitePieces = infinitePieceQuery ? mongoWhereFilter(allPieces, infinitePieceQuery) : []
	} else {
		infinitePieces = infinitePieceQuery ? Pieces.find(infinitePieceQuery).fetch() : []
	}

	return piecesStartingInPart.concat(infinitePieces) // replace spread with concat, as 3x is faster (https://stackoverflow.com/questions/48865710/spread-operator-vs-array-concat)
}

const SIMULATION_INVALIDATION = 3000

/**
 * Get the PieceInstances for a given PartInstance. Will create temporary PieceInstances, based on the Pieces collection
 * if the partInstance is temporary.
 *
 * @export
 * @param {PartInstanceLimited} partInstance
 * @param {Set<PartId>} partsToReceiveOnSegmentEndFromSet
 * @param {Set<SegmentId>} segmentsToReceiveOnRundownEndFromSet
 * @param {PartId[]} orderedAllParts
 * @param {boolean} nextPartIsAfterCurrentPart
 * @param {(PartInstance | undefined)} currentPartInstance
 * @param {(PieceInstance[] | undefined)} currentPartInstancePieceInstances
 * @param {boolean} allowTestingAdlibsToPersist Studio config parameter to allow infinite adlibs from adlib testing to persist in the rundown
 * @param {FindOptions<PieceInstance>} [options]
 * @param {boolean} [pieceInstanceSimulation] If there are no PieceInstances in the PartInstance, create temporary
 * 		PieceInstances based on the Pieces collection and register a reactive dependency to recalculate the current
 * 		computation after some time to return the actual PieceInstances for the PartInstance.
 * @return {*}
 */
export function getPieceInstancesForPartInstance(
	playlistActivationId: RundownPlaylistActivationId | undefined,
	rundown: Pick<Rundown, '_id' | 'showStyleBaseId'>,
	segment: Pick<DBSegment, '_id' | 'orphaned'>,
	partInstance: PartInstanceLimited,
	partsToReceiveOnSegmentEndFromSet: Set<PartId>,
	segmentsToReceiveOnRundownEndFromSet: Set<SegmentId>,
	rundownsToReceiveOnShowStyleEndFrom: RundownId[],
	rundownsToShowstyles: ReadonlyMap<RundownId, ShowStyleBaseId>,
	orderedAllParts: PartId[],
	nextPartIsAfterCurrentPart: boolean,
	currentPartInstance: PartInstance | undefined,
	currentSegment: Pick<DBSegment, '_id' | 'orphaned'> | undefined,
	currentPartInstancePieceInstances: PieceInstance[] | undefined,
	allowTestingAdlibsToPersist: boolean,
	/** Map of Pieces on Parts, passed through for performance */
	allPiecesCache?: Map<PartId | null, Piece[]>,
	options?: FindOptions<PieceInstance>,
	pieceInstanceSimulation?: boolean
): PieceInstance[] {
	if (segment.orphaned === SegmentOrphanedReason.ADLIB_TESTING) {
		// When in the AdlibTesting segment, don't allow searching other segments/rundowns for infinites to continue
		segmentsToReceiveOnRundownEndFromSet = new Set()
		rundownsToReceiveOnShowStyleEndFrom = []
	}

	if (partInstance.isTemporary) {
		return getPieceInstancesForPart(
			playlistActivationId || protectString(''),
			currentPartInstance,
			currentSegment,
			currentPartInstancePieceInstances,
			rundown,
			segment,
			partInstance.part,
			partsToReceiveOnSegmentEndFromSet,
			segmentsToReceiveOnRundownEndFromSet,
			rundownsToReceiveOnShowStyleEndFrom,
			rundownsToShowstyles,
			fetchPiecesThatMayBeActiveForPart(
				partInstance.part,
				partsToReceiveOnSegmentEndFromSet,
				segmentsToReceiveOnRundownEndFromSet,
				rundownsToReceiveOnShowStyleEndFrom,
				allPiecesCache
			),
			orderedAllParts,
			partInstance._id,
			nextPartIsAfterCurrentPart,
			partInstance.isTemporary,
			allowTestingAdlibsToPersist
		)
	} else {
		const results =
			// Check if the PartInstance we're currently looking for PieceInstances for is already the current one.
			// If that's the case, we can sace ourselves a scan across the PieceInstances collection
			partInstance._id === currentPartInstance?._id && currentPartInstancePieceInstances
				? currentPartInstancePieceInstances
				: PieceInstances.find({ partInstanceId: partInstance._id }, options).fetch()
		// check if we can return the results immediately
		if (results.length > 0 || !pieceInstanceSimulation) return results

		// if a simulation has been requested and less than SIMULATION_INVALIDATION time has passed
		// since the PartInstance has been nexted or taken, simulate the PieceInstances using the Piece collection.
		const now = getCurrentTime()
		if (
			pieceInstanceSimulation &&
			results.length === 0 &&
			(!partInstance.timings ||
				(partInstance.timings.setAsNext || 0) > now - SIMULATION_INVALIDATION ||
				(partInstance.timings.take || 0) > now - SIMULATION_INVALIDATION)
		) {
			// make sure to invalidate the current computation after SIMULATION_INVALIDATION has passed
			invalidateAfter(SIMULATION_INVALIDATION)

			return getPieceInstancesForPart(
				playlistActivationId || protectString(''),
				currentPartInstance,
				currentSegment,
				currentPartInstancePieceInstances,
				rundown,
				segment,
				partInstance.part,
				partsToReceiveOnSegmentEndFromSet,
				segmentsToReceiveOnRundownEndFromSet,
				rundownsToReceiveOnShowStyleEndFrom,
				rundownsToShowstyles,
				fetchPiecesThatMayBeActiveForPart(
					partInstance.part,
					partsToReceiveOnSegmentEndFromSet,
					segmentsToReceiveOnRundownEndFromSet,
					rundownsToReceiveOnShowStyleEndFrom,
					allPiecesCache
				),
				orderedAllParts,
				partInstance._id,
				nextPartIsAfterCurrentPart,
				true,
				allowTestingAdlibsToPersist
			)
		} else {
			// otherwise, return results as they are
			return results
		}
	}
}

/**
 * Get all PartInstances (or temporary PartInstances) all segments in all rundowns in a playlist, using given queries
 * to limit the data, in correct order.
 *
 * @export
 * @param {DBRundownPlaylist} playlist
 * @param {(MongoQuery<DBSegment>)} [segmentsQuery]
 * @param {(MongoQuery<DBPart>)} [partsQuery]
 * @param {MongoQuery<PartInstance>} [partInstancesQuery]
 * @param {FindOptions<DBSegment>} [segmentsOptions]
 * @param {FindOptions<DBPart>} [partsOptions]
 * @param {FindOptions<PartInstance>} [partInstancesOptions]
 * @return {*}  {Array<{ segment: Segment; partInstances: PartInstance[] }>}
 */
export function getSegmentsWithPartInstances(
	playlist: DBRundownPlaylist,
	segmentsQuery?: MongoQuery<DBSegment>,
	partsQuery?: MongoQuery<DBPart>,
	partInstancesQuery?: MongoQuery<PartInstance>,
	segmentsOptions?: FindOptions<DBSegment>,
	partsOptions?: FindOptions<DBPart>,
	partInstancesOptions?: FindOptions<PartInstance>
): Array<{ segment: DBSegment; partInstances: PartInstance[] }> {
	const { segments, parts: rawParts } = RundownPlaylistClientUtil.getSegmentsAndPartsSync(
		playlist,
		segmentsQuery,
		partsQuery,
		segmentsOptions,
		partsOptions
	)
	const rawPartInstances = RundownPlaylistClientUtil.getActivePartInstances(
		playlist,
		partInstancesQuery,
		partInstancesOptions
	)
	const playlistActivationId = playlist.activationId ?? protectString('')

	const partsBySegment = groupByToMap(rawParts, 'segmentId')
	const partInstancesBySegment = groupByToMap(rawPartInstances, 'segmentId')

	return segments.map((segment) => {
		const segmentParts = partsBySegment.get(segment._id) ?? []
		const segmentPartInstances = partInstancesBySegment.get(segment._id) ?? []

		if (segmentPartInstances.length === 0) {
			return {
				segment,
				partInstances: segmentParts.map((p) => wrapPartToTemporaryInstance(playlistActivationId, p)),
			}
		} else if (segmentParts.length === 0) {
			return {
				segment,
				partInstances: segmentPartInstances.sort(
					(a, b) => a.part._rank - b.part._rank || a.takeCount - b.takeCount
				),
			}
		} else {
			const partIds: Set<PartId> = new Set()
			for (const partInstance of segmentPartInstances) {
				partIds.add(partInstance.part._id)
			}
			for (const part of segmentParts) {
				if (partIds.has(part._id)) continue
				segmentPartInstances.push(wrapPartToTemporaryInstance(playlistActivationId, part))
			}
			const allPartInstances = segmentPartInstances.sort(
				(a, b) => a.part._rank - b.part._rank || a.takeCount - b.takeCount
			)

			return {
				segment,
				partInstances: allPartInstances,
			}
		}
	})
}

export function isLoopDefined(playlist: DBRundownPlaylist | undefined): boolean {
	return playlist?.quickLoop?.start != null && playlist?.quickLoop?.end != null
}

export function isAnyLoopMarkerDefined(playlist: DBRundownPlaylist | undefined): boolean {
	return playlist?.quickLoop?.start != null || playlist?.quickLoop?.end != null
}

export function isLoopRunning(playlist: DBRundownPlaylist | undefined): boolean {
	return !!playlist?.quickLoop?.running
}

export function isLoopLocked(playlist: DBRundownPlaylist | undefined): boolean {
	return !!playlist?.quickLoop?.locked
}

export function isEntirePlaylistLooping(playlist: DBRundownPlaylist | undefined): boolean {
	return (
		playlist?.quickLoop?.start?.type === QuickLoopMarkerType.PLAYLIST &&
		playlist?.quickLoop?.end?.type === QuickLoopMarkerType.PLAYLIST
	)
}

export function isQuickLoopStart(partId: PartId, playlist: DBRundownPlaylist | undefined): boolean {
	return playlist?.quickLoop?.start?.type === QuickLoopMarkerType.PART && playlist.quickLoop.start.id === partId
}

export function isQuickLoopEnd(partId: PartId, playlist: DBRundownPlaylist | undefined): boolean {
	return playlist?.quickLoop?.end?.type === QuickLoopMarkerType.PART && playlist.quickLoop.end.id === partId
}

export function isEndOfLoopingShow(
	playlist: DBRundownPlaylist | undefined,
	isLastSegment: boolean,
	isPartLastInSegment: boolean,
	part: DBPart
): boolean {
	return (
		isPartLastInSegment &&
		isLoopDefined(playlist) &&
		((isLastSegment && playlist?.quickLoop?.end?.type === QuickLoopMarkerType.PLAYLIST) ||
			(playlist?.quickLoop?.end?.type === QuickLoopMarkerType.SEGMENT &&
				playlist?.quickLoop.end.id === part.segmentId) ||
			(playlist?.quickLoop?.end?.type === QuickLoopMarkerType.PART && playlist?.quickLoop.end.id === part._id))
	)
}
