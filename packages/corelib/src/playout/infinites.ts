import { Piece } from '../dataModel/Piece.js'
import { DBPart } from '../dataModel/Part.js'
import {
	PartId,
	PartInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	SegmentId,
	ShowStyleBaseId,
} from '../dataModel/Ids.js'
import { PieceInstance, PieceInstancePiece, rewrapPieceToInstance } from '../dataModel/PieceInstance.js'
import { DBPartInstance } from '../dataModel/PartInstance.js'
import { DBRundown } from '../dataModel/Rundown.js'
import { ReadonlyDeep } from 'type-fest'
import { clone, flatten, getRandomId, groupByToMapFunc, max, normalizeArrayToMapFunc } from '../lib.js'
import { protectString } from '../protectedString.js'
import _ from 'underscore'
import { MongoQuery } from '../mongo.js'
import { DBSegment, SegmentOrphanedReason } from '../dataModel/Segment.js'
import { PieceLifespan } from './pieceLifespan.js'

export function buildPiecesStartingInThisPartQuery(part: ReadonlyDeep<DBPart>): MongoQuery<Piece> {
	return { startPartId: part._id }
}

/**
 * The infinites to continue on a source layer. The playhead tracking one is stored under `onChange`, the static ones
 * under the key from `getStaticInfiniteKey`, so that only the latest of each kind of lifespan is kept.
 */
type InfinitePieceSet<T> = Map<string, ReadonlyDeep<T>>

const ON_CHANGE_KEY = 'onChange'

/** Static infinites with the same scope and shadow behaviour replace each other on a source layer */
function getStaticInfiniteKey(lifespan: PieceLifespan): string {
	return `${lifespan.scope}:${lifespan.inShadow}`
}

export function buildPastInfinitePiecesForThisPartQuery(
	part: ReadonlyDeep<DBPart>,
	partIdsToReceiveOnSegmentEndFrom: PartId[],
	segmentsToReceiveOnRundownEndFrom: SegmentId[],
	rundownIdsBeforeThisInPlaylist: RundownId[]
): MongoQuery<Piece> | null {
	const fragments = _.compact([
		partIdsToReceiveOnSegmentEndFrom.length > 0
			? {
					// same segment, and previous part
					'lifespan.scope': { $in: ['segment', 'rundown', 'showstyle', 'playlist'] },
					startRundownId: part.rundownId,
					startSegmentId: part.segmentId,
					startPartId: { $in: partIdsToReceiveOnSegmentEndFrom },
				}
			: undefined,
		segmentsToReceiveOnRundownEndFrom.length > 0
			? {
					// same rundown, and previous segment
					'lifespan.scope': { $in: ['rundown', 'showstyle', 'playlist'] },
					startRundownId: part.rundownId,
					startSegmentId: { $in: segmentsToReceiveOnRundownEndFrom },
				}
			: undefined,
		rundownIdsBeforeThisInPlaylist.length > 0
			? {
					// previous rundown
					'lifespan.scope': { $in: ['showstyle', 'playlist'] },
					startRundownId: { $in: rundownIdsBeforeThisInPlaylist },
				}
			: undefined,
	])

	if (fragments.length === 0) {
		return null
	} else if (fragments.length === 1) {
		return {
			invalid: { $ne: true },
			startPartId: { $ne: part._id },
			...fragments[0],
		}
	} else {
		return {
			invalid: { $ne: true },
			startPartId: { $ne: part._id },
			$or: fragments,
		}
	}
}

export function getPlayheadTrackingInfinitesForPart(
	playlistActivationId: RundownPlaylistActivationId,
	partsToReceiveOnSegmentEndFromSet: Set<PartId>,
	segmentsToReceiveOnRundownEndFromSet: Set<SegmentId>,
	rundownsToReceiveOnShowStyleEndFrom: RundownId[],
	rundownsToShowstyles: ReadonlyMap<RundownId, ShowStyleBaseId>,
	currentPartInstance: ReadonlyDeep<DBPartInstance>,
	playingSegment: ReadonlyDeep<Pick<DBSegment, '_id' | 'orphaned'>>,
	currentPartPieceInstances: ReadonlyDeep<PieceInstance[]>,
	intoRundown: ReadonlyDeep<Pick<DBRundown, '_id' | 'showStyleBaseId'>>,
	intoPart: ReadonlyDeep<DBPart>,
	intoSegment: ReadonlyDeep<Pick<DBSegment, '_id' | 'orphaned'>>,
	newInstanceId: PartInstanceId,
	nextPartIsAfterCurrentPart: boolean,
	isTemporary: boolean,
	allowTestingAdlibsToPersist: boolean
): PieceInstance[] {
	if (
		!allowTestingAdlibsToPersist &&
		intoSegment._id !== playingSegment._id &&
		(intoSegment.orphaned === SegmentOrphanedReason.ADLIB_TESTING ||
			playingSegment.orphaned === SegmentOrphanedReason.ADLIB_TESTING)
	) {
		// If crossing the boundary between of the AdlibTesting segment, don't continue any infinites
		return []
	}

	const canContinueAdlibOnEnds = nextPartIsAfterCurrentPart

	const piecesOnSourceLayers = new Map<string, InfinitePieceSet<PieceInstance>>()

	const canContinueShowStyleEndInfinites = continueShowStyleEndInfinites(
		rundownsToReceiveOnShowStyleEndFrom,
		rundownsToShowstyles,
		currentPartInstance.rundownId,
		intoRundown
	)

	const groupedPlayingPieceInstances = groupByToMapFunc(currentPartPieceInstances, (p) => p.piece.sourceLayerId)
	for (const [sourceLayerId, pieceInstances] of groupedPlayingPieceInstances.entries()) {
		// Find the ones that starts last. Note: any piece will stop an onChange
		const lastPiecesByStart = groupByToMapFunc(pieceInstances, (p) => p.piece.enable.start)
		let lastPieceInstances = lastPiecesByStart.get('now') ?? []
		if (lastPieceInstances.length === 0) {
			const target = max(Array.from(lastPiecesByStart.keys()), (k) => Number(k))
			if (target !== undefined) {
				lastPieceInstances = lastPiecesByStart.get(target) ?? []
			}
		}

		// Some basic resolving, to figure out which is our candidate
		let lastPieceInstance: ReadonlyDeep<PieceInstance> | undefined
		for (const candidate of lastPieceInstances) {
			if (lastPieceInstance === undefined || isCandidateBetterToBeContinued(lastPieceInstance, candidate)) {
				lastPieceInstance = candidate
			}
		}

		if (lastPieceInstance && !lastPieceInstance.plannedStoppedPlayback && !lastPieceInstance.userDuration) {
			// If it is an onChange, then it may want to continue
			const lifespan = PieceLifespan.from(lastPieceInstance.piece.lifespan)

			const isUsed =
				lifespan.tracksPlayhead &&
				((lifespan.inScope('segment') && currentPartInstance.segmentId === intoPart.segmentId) || // same segment
					(lifespan.inScope('rundown') && lastPieceInstance.rundownId === intoPart.rundownId) || // same rundown
					(lifespan.inScope('showstyle') &&
						canContinueShowStyleEndInfinites &&
						rundownsToShowstyles.get(lastPieceInstance.rundownId) === intoRundown.showStyleBaseId) || // same showstyle
					lifespan.inScope('playlist')) // playlist scope (which is the same as the legacy showstyle scope, but they should be different, we should handle them differently in the future)
			if (isUsed) {
				const pieceSet = piecesOnSourceLayers.get(sourceLayerId) ?? new Map()
				pieceSet.set(ON_CHANGE_KEY, lastPieceInstance)
				piecesOnSourceLayers.set(sourceLayerId, pieceSet)
				// This may get pruned later, if somethng else has a start of 0
			}
		}

		// Check if we should persist any adlib static infinites
		if (canContinueAdlibOnEnds) {
			const piecesByLifespan = groupByToMapFunc(
				pieceInstances.filter((p) => {
					const lifespan = PieceLifespan.from(p.piece.lifespan)
					return (
						lifespan.isInfinite &&
						lifespan.isStatic &&
						p.infinite &&
						(p.dynamicallyInserted || p.dynamicallyConvertedToInfinite)
					)
				}),
				(p) => getStaticInfiniteKey(PieceLifespan.from(p.piece.lifespan))
			)
			for (const [lifespanKey, pieces] of piecesByLifespan.entries()) {
				// This is the piece we may copy across
				const candidatePiece =
					pieces.find((p) => p.piece.enable.start === 'now') ?? max(pieces, (p) => p.piece.enable.start)
				if (candidatePiece && !candidatePiece.plannedStoppedPlayback && !candidatePiece.userDuration) {
					// Check this infinite is allowed to continue to this part
					let isValid = false
					switch (PieceLifespan.from(candidatePiece.piece.lifespan).scope) {
						case 'segment':
							isValid =
								currentPartInstance.segmentId === intoPart.segmentId &&
								!!candidatePiece.piece.startPartId &&
								partsToReceiveOnSegmentEndFromSet.has(candidatePiece.piece.startPartId)
							break
						case 'rundown':
							isValid =
								candidatePiece.rundownId === intoPart.rundownId &&
								(segmentsToReceiveOnRundownEndFromSet.has(currentPartInstance.segmentId) ||
									currentPartInstance.segmentId === intoPart.segmentId ||
									// If infinites are allowed to persist, then the infinite is allowed to continue
									(allowTestingAdlibsToPersist &&
										intoSegment.orphaned === SegmentOrphanedReason.ADLIB_TESTING))
							break
						case 'showstyle':
							isValid = canContinueShowStyleEndInfinites
							break
						case 'playlist':
							isValid = true
							break
					}

					if (isValid) {
						const pieceSet = piecesOnSourceLayers.get(sourceLayerId) ?? new Map()
						pieceSet.set(lifespanKey, candidatePiece)
						piecesOnSourceLayers.set(sourceLayerId, pieceSet)
					}
				}
			}
		}
	}

	const rewrapInstance = (p: PieceInstance | undefined): PieceInstance | undefined => {
		if (p) {
			const instance = rewrapPieceToInstance(
				p.piece,
				playlistActivationId,
				intoPart.rundownId,
				newInstanceId,
				isTemporary
			)
			markPieceInstanceAsContinuation(p, instance)

			if (p.infinite) {
				if (!instance.piece.enable.isAbsolute) {
					// This was copied from before, so we know we can force the time to 0
					instance.piece = {
						...instance.piece,
						enable: {
							start: 0,
						},
					}
				}

				instance.infinite = {
					...p.infinite,
					infiniteInstanceIndex: p.infinite.infiniteInstanceIndex + 1,
					fromPreviousPart: true,
					fromPreviousPlayhead: true,
				}

				return instance
			}
		}
		return undefined
	}

	return flatten(
		Array.from(piecesOnSourceLayers.values()).map((ps) => {
			return _.compact((Array.from(ps.values()) as PieceInstance[]).map(rewrapInstance))
		})
	)
}

function markPieceInstanceAsContinuation(previousInstance: ReadonlyDeep<PieceInstance>, instance: PieceInstance) {
	instance._id = protectString(`${instance._id}_continue`)
	instance.dynamicallyInserted = previousInstance.dynamicallyInserted
	instance.dynamicallyConvertedToInfinite = previousInstance.dynamicallyConvertedToInfinite
	instance.adLibSourceId = previousInstance.adLibSourceId
	instance.reportedStartedPlayback = previousInstance.reportedStartedPlayback
	instance.plannedStartedPlayback = previousInstance.plannedStartedPlayback
}

export function isPiecePotentiallyActiveInPart(
	previousPartInstance: ReadonlyDeep<DBPartInstance> | undefined,
	partsToReceiveOnSegmentEndFrom: Set<PartId>,
	segmentsToReceiveOnRundownEndFrom: Set<SegmentId>,
	rundownsToReceiveOnShowStyleEndFrom: RundownId[],
	rundownsToShowstyles: ReadonlyMap<RundownId, ShowStyleBaseId>,
	rundown: ReadonlyDeep<Pick<DBRundown, '_id' | 'showStyleBaseId'>>,
	part: ReadonlyDeep<DBPart>,
	pieceToCheck: ReadonlyDeep<Piece>
): boolean {
	// If its from the current part
	if (pieceToCheck.startPartId === part._id) {
		return true
	}

	const lifespan = PieceLifespan.from(pieceToCheck.lifespan)

	// This must be from another part
	if (!lifespan.isInfinite) return false

	if (lifespan.tracksPlayhead && previousPartInstance !== undefined) {
		// This gets handled by getPlayheadTrackingInfinitesForPart
		// We will only copy the pieceInstance from the previous, never using the original piece
		return false
	}

	const isFromEarlierInRundown = (): boolean => {
		if (pieceToCheck.startRundownId !== part.rundownId || !pieceToCheck.startPartId || !pieceToCheck.startSegmentId)
			return false

		if (pieceToCheck.startSegmentId === part.segmentId) {
			return partsToReceiveOnSegmentEndFrom.has(pieceToCheck.startPartId)
		} else {
			return segmentsToReceiveOnRundownEndFrom.has(pieceToCheck.startSegmentId)
		}
	}

	switch (lifespan.scope) {
		case 'segment':
			return (
				!!pieceToCheck.startPartId &&
				pieceToCheck.startSegmentId === part.segmentId &&
				partsToReceiveOnSegmentEndFrom.has(pieceToCheck.startPartId)
			)
		case 'rundown':
			return isFromEarlierInRundown()
		case 'showstyle':
			return !!(
				previousPartInstance &&
				continueShowStyleEndInfinites(
					rundownsToReceiveOnShowStyleEndFrom,
					rundownsToShowstyles,
					previousPartInstance.rundownId,
					rundown
				)
			)
		case 'playlist':
			return isFromEarlierInRundown() || rundownsToReceiveOnShowStyleEndFrom.includes(pieceToCheck.startRundownId)
		default:
			return false
	}
}

/**
 * Calculate all of the onEnd PieceInstances for a PartInstance
 * @param playlistActivationId The current playlist ActivationId
 * @param playingPartInstance The current PartInstance, if there is one
 * @param playingPieceInstances The PieceInstances from the current PartInstance
 * @param rundown The Rundown the Part belongs to
 * @param part The Part the PartInstance is based on
 * @param partsToReceiveOnSegmentEndFromSet Set of PartIds that exist in the Segment before the part being processed
 * @param segmentsToReceiveOnRundownEndFromSet Set of SegmentIds that exist in the Rundown before the part being processed
 * @param rundownsToReceiveOnShowStyleEndFrom Set of RundownIds that exist in the Playlist before the part being processed
 * @param rundownsToShowstyles Lookup of RundownIds in the Playlist, to their ShowStyleBase id
 * @param possiblePieces Array of Pieces that should be considered for being a PieceInstance in the new PartInstance
 * @param orderedPartIds Ordered array of all PartId in the Rundown
 * @param newInstanceId Id of the PartInstance
 * @param nextPartIsAfterCurrentPart Whether the new Part existing after the playlingPartInstane in the Rundown
 * @param isTemporary Whether to mark these PieceInstances as temporary
 * @returns Array of PieceInstances for the specified PartInstance
 */
export function getPieceInstancesForPart(
	playlistActivationId: RundownPlaylistActivationId,
	playingPartInstance: ReadonlyDeep<DBPartInstance> | undefined,
	playingSegment: ReadonlyDeep<Pick<DBSegment, '_id' | 'orphaned'>> | undefined,
	playingPieceInstances: ReadonlyDeep<PieceInstance[]> | undefined,
	rundown: ReadonlyDeep<Pick<DBRundown, '_id' | 'showStyleBaseId'>>,
	segment: ReadonlyDeep<Pick<DBSegment, '_id' | 'orphaned'>>,
	part: ReadonlyDeep<DBPart>,
	partsToReceiveOnSegmentEndFromSet: Set<PartId>,
	segmentsToReceiveOnRundownEndFromSet: Set<SegmentId>,
	rundownsToReceiveOnShowStyleEndFrom: RundownId[],
	rundownsToShowstyles: ReadonlyMap<RundownId, ShowStyleBaseId>,
	possiblePieces: ReadonlyDeep<Piece>[],
	orderedPartIds: PartId[],
	newInstanceId: PartInstanceId,
	nextPartIsAfterCurrentPart: boolean,
	isTemporary: boolean,
	allowTestingAdlibsToPersist: boolean
): PieceInstance[] {
	const doesPieceAStartBeforePieceB = (
		pieceA: ReadonlyDeep<PieceInstancePiece>,
		pieceB: ReadonlyDeep<PieceInstancePiece>
	): boolean => {
		if (pieceA.startPartId === pieceB.startPartId) {
			return pieceA.enable.start < pieceB.enable.start
		}
		const pieceAIndex = pieceA.startPartId === null ? -2 : orderedPartIds.indexOf(pieceA.startPartId)
		const pieceBIndex = pieceB.startPartId === null ? -2 : orderedPartIds.indexOf(pieceB.startPartId)

		if (pieceAIndex === -1) {
			return false
		} else if (pieceBIndex === -1) {
			return true
		} else if (pieceAIndex < pieceBIndex) {
			return true
		} else {
			return false
		}
	}

	const piecesOnSourceLayers = new Map<string, InfinitePieceSet<Piece>>()

	// Filter down to the last starting onEnd infinite per layer
	for (const candidatePiece of possiblePieces) {
		if (
			candidatePiece.startPartId !== part._id &&
			PieceLifespan.from(candidatePiece.lifespan).presence === 'forward-scope'
		) {
			const useIt = isPiecePotentiallyActiveInPart(
				playingPartInstance,
				partsToReceiveOnSegmentEndFromSet,
				segmentsToReceiveOnRundownEndFromSet,
				rundownsToReceiveOnShowStyleEndFrom,
				rundownsToShowstyles,
				rundown,
				part,
				candidatePiece
			)

			if (useIt) {
				const lifespanKey = getStaticInfiniteKey(PieceLifespan.from(candidatePiece.lifespan))
				const pieceSet = piecesOnSourceLayers.get(candidatePiece.sourceLayerId) ?? new Map()
				const existingPiece = pieceSet.get(lifespanKey)
				if (!existingPiece || doesPieceAStartBeforePieceB(existingPiece, candidatePiece)) {
					pieceSet.set(lifespanKey, candidatePiece)
					piecesOnSourceLayers.set(candidatePiece.sourceLayerId, pieceSet)
				}
			}
		}
	}

	// OnChange infinites take priority over onEnd, as they travel with the playhead
	const infinitesFromPrevious =
		playingPartInstance && playingSegment
			? getPlayheadTrackingInfinitesForPart(
					playlistActivationId,
					partsToReceiveOnSegmentEndFromSet,
					segmentsToReceiveOnRundownEndFromSet,
					rundownsToReceiveOnShowStyleEndFrom,
					rundownsToShowstyles,
					playingPartInstance,
					playingSegment,
					playingPieceInstances || [],
					rundown,
					part,
					segment,
					newInstanceId,
					nextPartIsAfterCurrentPart,
					isTemporary,
					allowTestingAdlibsToPersist
				)
			: []

	// Compile the resulting list

	const playingPieceInstancesMap = normalizeArrayToMapFunc(
		playingPieceInstances ?? [],
		(p) => p.infinite?.infinitePieceId
	)

	const wrapPiece = (p: ReadonlyDeep<PieceInstancePiece>) => {
		const instance = rewrapPieceToInstance(
			clone<PieceInstancePiece>(p),
			playlistActivationId,
			part.rundownId,
			newInstanceId,
			isTemporary
		)

		// TODO: we are excluding all part scopes here, but we might want to handle these separately.
		if (PieceLifespan.from(instance.piece.lifespan).scope !== 'part') {
			const existingPiece = nextPartIsAfterCurrentPart
				? playingPieceInstancesMap.get(instance.piece._id)
				: undefined
			instance.infinite = {
				infiniteInstanceId: existingPiece?.infinite?.infiniteInstanceId ?? getRandomId(),
				infiniteInstanceIndex: (existingPiece?.infinite?.infiniteInstanceIndex ?? -1) + 1,
				infinitePieceId: instance.piece._id,
				fromPreviousPart: false, // Set below
			}

			instance.infinite.fromPreviousPart = instance.piece.startPartId !== part._id
			if (existingPiece && (instance.piece.startPartId !== part._id || instance.dynamicallyInserted)) {
				// If it doesnt start in this part, then mark it as a continuation
				markPieceInstanceAsContinuation(existingPiece, instance)
			}

			if (instance.infinite.fromPreviousPart) {
				// If this is not the start point, it should start at 0
				// Note: this should not be setitng fromPreviousPlayhead, as it is not from the playhead
				instance.piece = {
					...instance.piece,
					enable: {
						start: 0,
					},
				}
			}
		}

		return instance
	}

	const normalPieces = possiblePieces.filter((p) => p.startPartId === part._id)
	const result = normalPieces.map(wrapPiece).concat(infinitesFromPrevious)
	for (const pieceSet of Array.from(piecesOnSourceLayers.values())) {
		// Broadest scope first
		const staticPieces = _.sortBy(
			Array.from(pieceSet.values()),
			(p) => PieceLifespan.from(p.lifespan).stackingPriority
		)
		result.push(...staticPieces.map(wrapPiece))
	}

	return result
}

export function isCandidateMoreImportant(
	best: ReadonlyDeep<PieceInstance>,
	candidate: ReadonlyDeep<PieceInstance>
): boolean | undefined {
	// If one is absolute timed, prefer that
	if (best.piece.enable.isAbsolute && !candidate.piece.enable.isAbsolute) {
		// Prefer the absolute best
		return false
	}
	if (!best.piece.enable.isAbsolute && candidate.piece.enable.isAbsolute) {
		// Prefer the absolute candidate
		return true
	}

	// Prioritise the one from this part over previous part
	if (best.infinite?.fromPreviousPart && !candidate.infinite?.fromPreviousPart) {
		// Prefer the candidate as it is not from previous
		return true
	}
	if (!best.infinite?.fromPreviousPart && candidate.infinite?.fromPreviousPart) {
		// Prefer the best as it is not from previous
		return false
	}

	// If we have adlibs, prefer the newest
	if (best.dynamicallyInserted && candidate.dynamicallyInserted) {
		// prefer the one which starts later
		return best.dynamicallyInserted < candidate.dynamicallyInserted
	} else if (best.dynamicallyInserted) {
		// Prefer the adlib
		return false
	} else if (candidate.dynamicallyInserted) {
		// Prefer the adlib
		return true
	} else {
		// Neither are adlibs, try other things
	}

	// If one is virtual, prefer that
	if (best.piece.virtual && !candidate.piece.virtual) {
		// Prefer the virtual best
		return false
	}
	if (!best.piece.virtual && candidate.piece.virtual) {
		// Prefer the virtual candidate
		return true
	}

	return undefined
}

export function isCandidateBetterToBeContinued(
	best: ReadonlyDeep<PieceInstance>,
	candidate: ReadonlyDeep<PieceInstance>
): boolean {
	// Fallback to id, as we dont have any other criteria and this will be stable.
	// Note: we shouldnt even get here, as it shouldnt be possible for multiple to start at the same time, but it is possible
	return isCandidateMoreImportant(best, candidate) ?? best.piece._id < candidate.piece._id
}

function continueShowStyleEndInfinites(
	rundownsToReceiveOnShowStyleEndFrom: RundownId[],
	rundownsToShowstyles: ReadonlyMap<RundownId, ShowStyleBaseId>,
	previousRundownId: RundownId,
	targetRundown: ReadonlyDeep<Pick<DBRundown, '_id' | 'showStyleBaseId'>>
): boolean {
	let canContinueShowStyleEndInfinites = true
	if (targetRundown.showStyleBaseId !== rundownsToShowstyles.get(previousRundownId)) {
		canContinueShowStyleEndInfinites = false
	} else {
		const targetShowStyle = targetRundown.showStyleBaseId
		canContinueShowStyleEndInfinites = rundownsToReceiveOnShowStyleEndFrom
			.slice(rundownsToReceiveOnShowStyleEndFrom.indexOf(previousRundownId))
			.every((r) => rundownsToShowstyles.get(r) === targetShowStyle)
	}

	return canContinueShowStyleEndInfinites
}
