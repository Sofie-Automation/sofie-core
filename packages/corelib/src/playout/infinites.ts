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
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { PieceInstance, PieceInstancePiece, rewrapPieceToInstance } from '../dataModel/PieceInstance.js'
import { DBPartInstance } from '../dataModel/PartInstance.js'
import { DBRundown } from '../dataModel/Rundown.js'
import { ReadonlyDeep } from 'type-fest'
import { assertNever, clone, getRandomId, groupByToMapFunc, normalizeArrayToMapFunc } from '../lib.js'
import { protectString } from '../protectedString.js'
import _ from 'underscore'
import { MongoQuery } from '../mongo.js'
import { DBSegment, SegmentOrphanedReason } from '../dataModel/Segment.js'
import { isValidForBranding } from './branding.js'

/**
 * Add a candidate to the infinite Pieces being kept for a source layer, dropping any which can never be shown
 * as a result.
 *
 * Ordinarily only the best candidate is kept. But a Piece limited to some Brandings may be the only one
 * shown on a layer while one of those is selected, so it neither discards another nor is discarded by one —
 * only Pieces used with every Branding are reduced to a single winner. The choice must not depend on which
 * Branding is selected now, as that can change after these PieceInstances have been created.
 */
function addInfiniteCandidate<T>(
	kept: T[],
	candidate: T,
	isLimitedToBranding: (piece: T) => boolean,
	isCandidateBetter: (best: T, candidate: T) => boolean
): T[] {
	if (isLimitedToBranding(candidate)) return [...kept, candidate]

	const result: T[] = []
	for (const other of kept) {
		if (isLimitedToBranding(other)) {
			result.push(other)
		} else if (!isCandidateBetter(other, candidate)) {
			// The candidate can never be shown, as the other is preferred over it
			return kept
		}
		// Otherwise the other can never be shown, so it is dropped
	}

	result.push(candidate)

	return result
}

/** Whether the candidate is the later starting of two PieceInstances on a source layer */
function isLaterStartingCandidateBetter(
	best: ReadonlyDeep<PieceInstance>,
	candidate: ReadonlyDeep<PieceInstance>
): boolean {
	const bestStart = best.piece.enable.start
	const candidateStart = candidate.piece.enable.start

	// A piece starting 'now' starts later than any planned start
	if (bestStart === 'now' || candidateStart === 'now') return bestStart !== 'now' && candidateStart === 'now'

	return bestStart < candidateStart
}

/** Whether the candidate is the one showing at the end of the Part, of two PieceInstances on a source layer */
function isLastPieceInstanceCandidateBetter(
	best: ReadonlyDeep<PieceInstance>,
	candidate: ReadonlyDeep<PieceInstance>
): boolean {
	if (best.piece.enable.start !== candidate.piece.enable.start) {
		return isLaterStartingCandidateBetter(best, candidate)
	}

	return isCandidateBetterToBeContinued(best, candidate)
}

/** The onEnd lifespans an infinite may be kept for, in the order they are emitted */
const ON_END_LIFESPANS = [
	PieceLifespan.OutOnShowStyleEnd,
	PieceLifespan.OutOnRundownEnd,
	PieceLifespan.OutOnSegmentEnd,
] as const

export function buildPiecesStartingInThisPartQuery(part: ReadonlyDeep<DBPart>): MongoQuery<Piece> {
	return { startPartId: part._id }
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
					lifespan: {
						$in: [
							PieceLifespan.OutOnSegmentEnd,
							PieceLifespan.OutOnSegmentChange,
							PieceLifespan.OutOnRundownEnd,
							PieceLifespan.OutOnRundownChange,
							PieceLifespan.OutOnShowStyleEnd,
						],
					},
					startRundownId: part.rundownId,
					startSegmentId: part.segmentId,
					startPartId: { $in: partIdsToReceiveOnSegmentEndFrom },
				}
			: undefined,
		segmentsToReceiveOnRundownEndFrom.length > 0
			? {
					// same rundown, and previous segment
					lifespan: {
						$in: [
							PieceLifespan.OutOnRundownEnd,
							PieceLifespan.OutOnRundownChange,
							PieceLifespan.OutOnShowStyleEnd,
						],
					},
					startRundownId: part.rundownId,
					startSegmentId: { $in: segmentsToReceiveOnRundownEndFrom },
				}
			: undefined,
		rundownIdsBeforeThisInPlaylist.length > 0
			? {
					// previous rundown
					lifespan: {
						$in: [PieceLifespan.OutOnShowStyleEnd],
					},
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
	interface InfinitePieceSet {
		[PieceLifespan.OutOnShowStyleEnd]?: ReadonlyDeep<PieceInstance>[]
		[PieceLifespan.OutOnRundownEnd]?: ReadonlyDeep<PieceInstance>[]
		[PieceLifespan.OutOnSegmentEnd]?: ReadonlyDeep<PieceInstance>[]
		onChange?: ReadonlyDeep<PieceInstance>[]
	}
	const piecesOnSourceLayers = new Map<string, InfinitePieceSet>()

	const canContinueShowStyleEndInfinites = continueShowStyleEndInfinites(
		rundownsToReceiveOnShowStyleEndFrom,
		rundownsToShowstyles,
		currentPartInstance.rundownId,
		intoRundown
	)

	// A Piece hidden by the Branding is not playing, so it cannot be continued
	const playingPieceInstances = currentPartPieceInstances.filter((p) =>
		isValidForBranding(p.piece, currentPartInstance.brandingId)
	)

	const groupedPlayingPieceInstances = groupByToMapFunc(playingPieceInstances, (p) => p.piece.sourceLayerId)
	for (const [sourceLayerId, pieceInstances] of groupedPlayingPieceInstances.entries()) {
		// Find the ones that start last. Note: any piece will stop an onChange
		let lastPieceInstances: ReadonlyDeep<PieceInstance>[] = []
		for (const candidate of pieceInstances) {
			lastPieceInstances = addInfiniteCandidate(
				lastPieceInstances,
				candidate,
				(p) => !!p.piece.onlyValidForBranding,
				isLastPieceInstanceCandidateBetter
			)
		}

		for (const lastPieceInstance of lastPieceInstances) {
			if (lastPieceInstance.plannedStoppedPlayback || lastPieceInstance.userDuration) continue

			// If it is an onChange, then it may want to continue
			let isUsed = false
			switch (lastPieceInstance.piece.lifespan) {
				case PieceLifespan.OutOnSegmentChange:
					if (currentPartInstance.segmentId === intoPart.segmentId) {
						// Still in the same segment
						isUsed = true
					}
					break
				case PieceLifespan.OutOnRundownChange:
					if (lastPieceInstance.rundownId === intoPart.rundownId) {
						// Still in the same rundown
						isUsed = true
					}
					break
			}

			if (isUsed) {
				const pieceSet = piecesOnSourceLayers.get(sourceLayerId) ?? {}
				pieceSet.onChange = [...(pieceSet.onChange ?? []), lastPieceInstance]
				piecesOnSourceLayers.set(sourceLayerId, pieceSet)
				// This may get pruned later, if somethng else has a start of 0
			}
		}

		// Check if we should persist any adlib onEnd infinites
		if (canContinueAdlibOnEnds) {
			const piecesByInfiniteMode = groupByToMapFunc(
				pieceInstances.filter((p) => p.dynamicallyInserted || p.dynamicallyConvertedToInfinite),
				(p) => p.piece.lifespan
			)
			for (const mode0 of [
				PieceLifespan.OutOnRundownEnd,
				PieceLifespan.OutOnSegmentEnd,
				PieceLifespan.OutOnShowStyleEnd,
			]) {
				const mode = mode0 as
					| PieceLifespan.OutOnRundownEnd
					| PieceLifespan.OutOnSegmentEnd
					| PieceLifespan.OutOnShowStyleEnd
				const pieces = (piecesByInfiniteMode.get(mode) || []).filter(
					(p) =>
						p.infinite &&
						(p.infinite.fromPreviousPlayhead || p.dynamicallyInserted || p.dynamicallyConvertedToInfinite)
				)
				// These are the pieces we may copy across
				let candidatePieces: ReadonlyDeep<PieceInstance>[] = []
				for (const candidate of pieces) {
					candidatePieces = addInfiniteCandidate(
						candidatePieces,
						candidate,
						(p) => !!p.piece.onlyValidForBranding,
						isLaterStartingCandidateBetter
					)
				}

				for (const candidatePiece of candidatePieces) {
					if (candidatePiece.plannedStoppedPlayback || candidatePiece.userDuration) continue

					// Check this infinite is allowed to continue to this part
					let isValid = false
					switch (mode) {
						case PieceLifespan.OutOnSegmentEnd:
							isValid =
								currentPartInstance.segmentId === intoPart.segmentId &&
								!!candidatePiece.piece.startPartId &&
								partsToReceiveOnSegmentEndFromSet.has(candidatePiece.piece.startPartId)
							break
						case PieceLifespan.OutOnRundownEnd:
							isValid =
								candidatePiece.rundownId === intoPart.rundownId &&
								(segmentsToReceiveOnRundownEndFromSet.has(currentPartInstance.segmentId) ||
									currentPartInstance.segmentId === intoPart.segmentId ||
									// If infinites are allowed to persist, then the infinite is allowed to continue
									(allowTestingAdlibsToPersist &&
										intoSegment.orphaned === SegmentOrphanedReason.ADLIB_TESTING))
							break
						case PieceLifespan.OutOnShowStyleEnd:
							isValid = canContinueShowStyleEndInfinites
					}

					if (isValid) {
						const pieceSet = piecesOnSourceLayers.get(sourceLayerId) ?? {}
						pieceSet[mode] = [...(pieceSet[mode] ?? []), candidatePiece]
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

	const result: PieceInstance[] = []
	for (const pieceSet of piecesOnSourceLayers.values()) {
		for (const pieces of Object.values<PieceInstance[] | undefined>(pieceSet as any)) {
			if (!pieces) continue

			for (const piece of pieces) {
				const instance = rewrapInstance(piece)
				if (instance) result.push(instance)
			}
		}
	}

	return result
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

	switch (pieceToCheck.lifespan) {
		case PieceLifespan.WithinPart:
			// This must be from another part
			return false
		case PieceLifespan.OutOnSegmentEnd:
			return (
				!!pieceToCheck.startPartId &&
				pieceToCheck.startSegmentId === part.segmentId &&
				partsToReceiveOnSegmentEndFrom.has(pieceToCheck.startPartId)
			)
		case PieceLifespan.OutOnRundownEnd:
			if (
				pieceToCheck.startRundownId === part.rundownId &&
				pieceToCheck.startPartId &&
				pieceToCheck.startSegmentId
			) {
				if (pieceToCheck.startSegmentId === part.segmentId) {
					return partsToReceiveOnSegmentEndFrom.has(pieceToCheck.startPartId)
				} else {
					return segmentsToReceiveOnRundownEndFrom.has(pieceToCheck.startSegmentId)
				}
			} else {
				return false
			}
		case PieceLifespan.OutOnSegmentChange:
			if (previousPartInstance !== undefined) {
				// This gets handled by getPlayheadTrackingInfinitesForPart
				// We will only copy the pieceInstance from the previous, never using the original piece
				return false
			} else {
				// Predicting what will happen at arbitrary point in the future
				return (
					!!pieceToCheck.startPartId &&
					pieceToCheck.startSegmentId === part.segmentId &&
					partsToReceiveOnSegmentEndFrom.has(pieceToCheck.startPartId)
				)
			}
		case PieceLifespan.OutOnRundownChange:
			if (previousPartInstance !== undefined) {
				// This gets handled by getPlayheadTrackingInfinitesForPart
				// We will only copy the pieceInstance from the previous, never using the original piece
				return false
			} else {
				// Predicting what will happen at arbitrary point in the future
				return (
					!!pieceToCheck.startSegmentId &&
					pieceToCheck.startRundownId === part.rundownId &&
					segmentsToReceiveOnRundownEndFrom.has(pieceToCheck.startSegmentId)
				)
			}
		case PieceLifespan.OutOnShowStyleEnd:
			return previousPartInstance && pieceToCheck.lifespan === PieceLifespan.OutOnShowStyleEnd
				? continueShowStyleEndInfinites(
						rundownsToReceiveOnShowStyleEndFrom,
						rundownsToShowstyles,
						previousPartInstance.rundownId,
						rundown
					)
				: false
		default:
			assertNever(pieceToCheck.lifespan)
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

	interface InfinitePieceSet {
		[PieceLifespan.OutOnShowStyleEnd]?: ReadonlyDeep<Piece>[]
		[PieceLifespan.OutOnRundownEnd]?: ReadonlyDeep<Piece>[]
		[PieceLifespan.OutOnSegmentEnd]?: ReadonlyDeep<Piece>[]
		// onChange?: PieceInstance
	}
	const piecesOnSourceLayers = new Map<string, InfinitePieceSet>()

	// Filter down to the last starting onEnd infinite per layer
	for (const candidatePiece of possiblePieces) {
		if (
			candidatePiece.startPartId !== part._id &&
			(candidatePiece.lifespan === PieceLifespan.OutOnShowStyleEnd ||
				candidatePiece.lifespan === PieceLifespan.OutOnRundownEnd ||
				candidatePiece.lifespan === PieceLifespan.OutOnSegmentEnd)
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
				const pieceSet = piecesOnSourceLayers.get(candidatePiece.sourceLayerId) ?? {}
				pieceSet[candidatePiece.lifespan] = addInfiniteCandidate(
					pieceSet[candidatePiece.lifespan] ?? [],
					candidatePiece,
					(piece) => !!piece.onlyValidForBranding,
					doesPieceAStartBeforePieceB
				)
				piecesOnSourceLayers.set(candidatePiece.sourceLayerId, pieceSet)
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

		if (instance.piece.lifespan !== PieceLifespan.WithinPart) {
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
	for (const pieceSet of piecesOnSourceLayers.values()) {
		for (const lifespan of ON_END_LIFESPANS) {
			const pieces = pieceSet[lifespan]
			if (!pieces) continue

			result.push(...pieces.map(wrapPiece))
		}
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
