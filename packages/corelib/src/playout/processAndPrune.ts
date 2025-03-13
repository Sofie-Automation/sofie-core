import { ISourceLayer, PieceLifespan } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { PieceInstance, ResolvedPieceInstance } from '../dataModel/PieceInstance.js'
import { SourceLayers } from '../dataModel/ShowStyleBase.js'
import { assertNever, groupByToMapFunc } from '../lib.js'
import _ from 'underscore'
import { isCandidateBetterToBeContinued, isCandidateMoreImportant } from './infinites.js'
import { ReadonlyDeep } from 'type-fest'

/**
 * Get the `enable: { start: ?? }` for the new piece in terms that can be used as an `end` for another object
 */
function getPieceStartTimeAsReference(
	newPieceStart: number | 'now',
	partTimes: PartCurrentTimes,
	pieceToAffect: ReadonlyDeep<PieceInstance>
): number | RelativeResolvedEndCap {
	if (typeof newPieceStart !== 'number') return { offsetFromNow: 0 }

	if (pieceToAffect.piece.enable.isAbsolute) {
		// If the piece is absolute timed, then the end needs to be adjusted to be absolute
		if (pieceToAffect.piece.enable.start === 'now') {
			return { offsetFromNow: newPieceStart }
		} else {
			// Translate to an absolute timestamp
			return partTimes.currentTime - partTimes.nowInPart + newPieceStart
		}
	}

	return newPieceStart
}

function getPieceStartTimeWithinPart(p: ReadonlyDeep<PieceInstance>, partTimes: PartCurrentTimes): 'now' | number {
	const pieceEnable = p.piece.enable
	if (pieceEnable.isAbsolute) {
		// Note: these can't be adlibbed, so we don't need to consider adding the preroll

		if (pieceEnable.start === 'now') {
			// Should never happen, but just in case
			return pieceEnable.start
		} else {
			// Translate this to the part
			return pieceEnable.start - partTimes.currentTime + partTimes.nowInPart
		}
	}

	return pieceEnable.start
}

function isClear(piece?: ReadonlyDeep<PieceInstance>): boolean {
	return !!piece?.piece.virtual
}

function isCappedByAVirtual(
	activePieces: PieceInstanceOnInfiniteLayers,
	key: keyof PieceInstanceOnInfiniteLayers,
	newPiece: ReadonlyDeep<PieceInstance>
): boolean {
	if (
		(key === 'onRundownEnd' || key === 'onShowStyleEnd') &&
		activePieces.onSegmentEnd &&
		isCandidateMoreImportant(newPiece, activePieces.onSegmentEnd)
	)
		return true
	if (
		key === 'onShowStyleEnd' &&
		activePieces.onRundownEnd &&
		isCandidateMoreImportant(newPiece, activePieces.onRundownEnd)
	)
		return true
	return false
}

export interface RelativeResolvedEndCap {
	offsetFromNow: number
}

export interface PieceInstanceWithTimings extends ReadonlyDeep<PieceInstance> {
	/**
	 * This is a maximum end point of the pieceInstance.
	 * If the pieceInstance also has a enable.duration or userDuration set then the shortest one will need to be used
	 * This can be:
	 *  - '100', if relative to the start of the part
	 *  - { offsetFromNow: 100 }, if stopped by an absolute time
	 */
	resolvedEndCap?: number | RelativeResolvedEndCap
	priority: number
}

export interface PartCurrentTimes {
	/** The current time when this was sampled */
	readonly currentTime: number
	/** The time the part started playback, if it has begun */
	readonly partStartTime: number | null
	/** An approximate current time within the part */
	readonly nowInPart: number
}

export function createPartCurrentTimes(
	currentTime: number,
	partStartTime: number | undefined | null
): PartCurrentTimes {
	return {
		currentTime,
		partStartTime: partStartTime ?? null,
		nowInPart: typeof partStartTime === 'number' ? currentTime - partStartTime : 0,
	}
}

/**
 * Process the infinite pieces to determine the start time and a maximum end time for each.
 * Any pieces which have no chance of being shown (duplicate start times) are pruned
 * The stacking order of infinites is considered, to define the stop times
 * Note: `nowInPart` is only needed to order the PieceInstances. The result of this can be cached until that order changes.
 */
export function processAndPrunePieceInstanceTimings(
	sourceLayers: SourceLayers,
	pieces: ReadonlyDeep<PieceInstance[]>,
	partTimes: PartCurrentTimes,
	keepDisabledPieces?: boolean,
	includeVirtual?: boolean
): PieceInstanceWithTimings[] {
	const results: PieceInstanceWithTimings[] = []

	// We want to group by exclusive groups, to let them be resolved
	const exclusiveGroupMap = new Map<string, string>()
	for (const layer of Object.values<ISourceLayer | undefined>(sourceLayers)) {
		if (layer?.exclusiveGroup) {
			exclusiveGroupMap.set(layer._id, layer.exclusiveGroup)
		}
	}

	const piecesGroupedByExclusiveGroupOrLayer = groupByToMapFunc(
		keepDisabledPieces ? pieces : pieces.filter((p) => !p.disabled),
		// At this stage, if a Piece is disabled, the `keepDisabledPieces` must be turned on. If that's the case
		// we split out the disabled Pieces onto the sourceLayerId they actually exist on, instead of putting them
		// onto the shared "exclusivityGroup" layer. This may cause it to not display "exactly" accurately
		// while in the disabled state, but it should keep it from affecting any not-disabled Pieces.
		(p) =>
			p.disabled ? p.piece.sourceLayerId : exclusiveGroupMap.get(p.piece.sourceLayerId) || p.piece.sourceLayerId
	)
	for (const piecesInExclusiveGroupOrLayer of piecesGroupedByExclusiveGroupOrLayer.values()) {
		// Group and sort the pieces so that we can step through each point in time in order
		const piecesByStartMap = groupByToMapFunc(piecesInExclusiveGroupOrLayer, (p) =>
			getPieceStartTimeWithinPart(p, partTimes)
		)
		const piecesByStart: Array<[number | 'now', ReadonlyDeep<PieceInstance[]>]> = _.sortBy(
			Array.from(piecesByStartMap.entries()).map(([k, v]) =>
				literal<[number | 'now', ReadonlyDeep<PieceInstance[]>]>([k === 'now' ? 'now' : Number(k), v])
			),
			([k]) => (k === 'now' ? partTimes.nowInPart : k)
		)

		// Step through time
		const activePieces: PieceInstanceOnInfiniteLayers = {}
		for (const [newPiecesStart, pieces] of piecesByStart) {
			const newPieces = findPieceInstancesOnInfiniteLayers(pieces)

			// Apply the updates
			// Note: order is important, the higher layers must be done first
			updateWithNewPieces(results, partTimes, activePieces, newPieces, newPiecesStart, includeVirtual, 'other')
			updateWithNewPieces(
				results,
				partTimes,
				activePieces,
				newPieces,
				newPiecesStart,
				includeVirtual,
				'onSegmentEnd'
			)
			updateWithNewPieces(
				results,
				partTimes,
				activePieces,
				newPieces,
				newPiecesStart,
				includeVirtual,
				'onRundownEnd'
			)
			updateWithNewPieces(
				results,
				partTimes,
				activePieces,
				newPieces,
				newPiecesStart,
				includeVirtual,
				'onShowStyleEnd'
			)
		}
	}

	// Strip out any pieces that start and end at the same point
	return results.filter((p) => p.resolvedEndCap === undefined || p.resolvedEndCap !== p.piece.enable.start)
}
function updateWithNewPieces(
	results: PieceInstanceWithTimings[],
	partTimes: PartCurrentTimes,
	activePieces: PieceInstanceOnInfiniteLayers,
	newPieces: PieceInstanceOnInfiniteLayers,
	newPiecesStart: number | 'now',
	includeVirtual: boolean | undefined,
	key: keyof PieceInstanceOnInfiniteLayers
): void {
	const newPiece = newPieces[key]
	if (newPiece) {
		const activePiece = activePieces[key]
		if (activePiece) {
			activePiece.resolvedEndCap = getPieceStartTimeAsReference(newPiecesStart, partTimes, activePiece)
		}
		// track the new piece
		activePieces[key] = newPiece

		// We don't want to include virtual pieces in the output (most of the time)
		// TODO - do we want to always output virtual pieces from the 'other' group?
		if (
			includeVirtual ||
			((!isClear(newPiece) || key === 'other') && !isCappedByAVirtual(activePieces, key, newPiece))
		) {
			// add the piece to results
			results.push(newPiece)

			if (
				key === 'onSegmentEnd' ||
				(key === 'onRundownEnd' && !activePieces.onSegmentEnd) ||
				(key === 'onShowStyleEnd' && !activePieces.onSegmentEnd && !activePieces.onRundownEnd)
			) {
				// when start === 0, we are likely to have multiple infinite continuations. Only stop the 'other' if it should not be considered for being on air
				if (
					activePieces.other &&
					(newPiecesStart !== 0 || isCandidateBetterToBeContinued(activePieces.other, newPiece))
				) {
					// These modes should stop the 'other' when they start if not hidden behind a higher priority onEnd
					activePieces.other.resolvedEndCap = getPieceStartTimeAsReference(
						newPiecesStart,
						partTimes,
						activePieces.other
					)
					activePieces.other = undefined
				}
			}
		}
	}
}

interface PieceInstanceOnInfiniteLayers {
	onShowStyleEnd?: PieceInstanceWithTimings
	onRundownEnd?: PieceInstanceWithTimings
	onSegmentEnd?: PieceInstanceWithTimings
	other?: PieceInstanceWithTimings
}
function findPieceInstancesOnInfiniteLayers(pieces: ReadonlyDeep<PieceInstance[]>): PieceInstanceOnInfiniteLayers {
	if (pieces.length === 0) {
		return {}
	}

	const res: PieceInstanceOnInfiniteLayers = {}

	for (const piece of pieces) {
		switch (piece.piece.lifespan) {
			case PieceLifespan.OutOnShowStyleEnd:
				if (!res.onShowStyleEnd || isCandidateBetterToBeContinued(res.onShowStyleEnd, piece)) {
					res.onShowStyleEnd = {
						...piece,
						priority: 0,
					}
				}
				break
			case PieceLifespan.OutOnRundownEnd:
				if (!res.onRundownEnd || isCandidateBetterToBeContinued(res.onRundownEnd, piece)) {
					res.onRundownEnd = {
						...piece,
						priority: 1,
					}
				}
				break
			case PieceLifespan.OutOnSegmentEnd:
				if (!res.onSegmentEnd || isCandidateBetterToBeContinued(res.onSegmentEnd, piece)) {
					res.onSegmentEnd = {
						...piece,
						priority: 2,
					}
				}
				break
			case PieceLifespan.OutOnRundownChange:
			case PieceLifespan.OutOnSegmentChange:
			case PieceLifespan.WithinPart:
				if (!res.other || isCandidateBetterToBeContinued(res.other, piece)) {
					res.other = {
						...piece,
						priority: 5,
					}
				}
				break
			default:
				assertNever(piece.piece.lifespan)
		}
	}

	return res
}

/**
 * Resolve a PieceInstanceWithTimings to approximated numbers within the PartInstance
 * @param partTimes Approximate time of the playhead within the PartInstance
 * @param pieceInstance The PieceInstance to resolve
 */
export function resolvePrunedPieceInstance(
	partTimes: PartCurrentTimes,
	pieceInstance: PieceInstanceWithTimings
): ResolvedPieceInstance {
	let resolvedStart =
		pieceInstance.piece.enable.start === 'now' ? partTimes.nowInPart : pieceInstance.piece.enable.start
	if (pieceInstance.piece.enable.isAbsolute) {
		resolvedStart -= partTimes.currentTime - partTimes.nowInPart
	}

	// Interpret the `resolvedEndCap` property into a number
	let resolvedEnd: number | undefined
	if (typeof pieceInstance.resolvedEndCap === 'number') {
		resolvedEnd = pieceInstance.resolvedEndCap
	} else if (pieceInstance.resolvedEndCap) {
		resolvedEnd = partTimes.nowInPart + pieceInstance.resolvedEndCap.offsetFromNow
	}

	// Find any possible durations this piece may have
	const caps: number[] = []
	if (resolvedEnd !== undefined) caps.push(resolvedEnd - resolvedStart)

	// Consider the blueprint defined duration
	if (pieceInstance.piece.enable.duration !== undefined) caps.push(pieceInstance.piece.enable.duration)

	// Consider the playout userDuration
	if (pieceInstance.userDuration) {
		caps.push(pieceInstance.userDuration.endRelativeToPart - resolvedStart)
	}

	return {
		instance: pieceInstance,

		resolvedStart,
		resolvedDuration: caps.length ? Math.min(...caps) : undefined,

		timelinePriority: pieceInstance.priority,
	}
}
