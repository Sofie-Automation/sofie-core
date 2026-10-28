import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { PieceInstance, ResolvedPieceInstance } from '../dataModel/PieceInstance.js'
import { SourceLayers } from '../dataModel/ShowStyleBase.js'
import { groupByToMapFunc } from '../lib.js'
import { protectString } from '../protectedString.js'
import { isShadowPiece, PieceLifespan } from './pieceLifespan.js'
import _ from 'underscore'
import { isCandidateBetterToBeContinued, isCandidateMoreImportant } from './infinites.js'
import { ReadonlyDeep } from 'type-fest'
import { PieceLifespanScope } from '@sofie-automation/shared-lib/dist/core/model/Rundown'

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
	key: InfiniteLayerKey,
	newPiece: ReadonlyDeep<PieceInstance>
): boolean {
	if (key === 'other') return false

	// A persisting piece is hidden while a narrower persisting piece (such as a virtual) is covering it
	for (const narrowerKey of PERSISTING_LAYER_KEYS.slice(0, PERSISTING_LAYER_KEYS.indexOf(key))) {
		const narrowerPiece = activePieces[narrowerKey]
		if (narrowerPiece && isCandidateMoreImportant(newPiece, narrowerPiece)) return true
	}
	return false
}

export interface RelativeResolvedEndCap {
	offsetFromNow: number
}

export interface PieceInstanceWithTimings extends ReadonlyDeep<PieceInstance> {
	/**
	 * This is a maximum end point of the pieceInstance, in the same timespace as the pieceInstance.piece.enable.start,
	 * meaning that it is relative to the start of the PartInstance, and not the start of the PartInstance's preroll and
	 * may need to be correctly translated to the timeline timespace.
	 *
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
		// Pieces starting 'now' are grouped by when they were actually started, so that they are ordered correctly
		const piecesByStartMap = groupByToMapFunc(piecesInExclusiveGroupOrLayer, (p) => {
			const start = getPieceStartTimeWithinPart(p, partTimes)
			return start === 'now' ? `now:${getPieceOrderTime(p, partTimes)}` : `${start}`
		})
		const piecesByStart: Array<[number | 'now', number, ReadonlyDeep<PieceInstance[]>]> = _.sortBy(
			Array.from(piecesByStartMap.entries()).map(([k, v]) =>
				k.startsWith('now:')
					? literal<[number | 'now', number, ReadonlyDeep<PieceInstance[]>]>(['now', Number(k.slice(4)), v])
					: literal<[number | 'now', number, ReadonlyDeep<PieceInstance[]>]>([Number(k), Number(k), v])
			),
			([, orderTime]) => orderTime
		)

		// Step through time
		const layerState: InfiniteLayerState = { activePieces: {}, shadowedPieces: new Map() }
		for (const [newPiecesStart, orderTime, pieces] of piecesByStart) {
			const [shadows, otherPieces] = _.partition(pieces, (p) => isShadowPiece(p.piece))
			const newPieces = findPieceInstancesOnInfiniteLayers(otherPieces)

			// Apply the updates
			// Note: order is important, the higher layers must be done first
			updateWithNewPieces(results, partTimes, layerState, newPieces, newPiecesStart, includeVirtual, 'other')
			for (const key of PERSISTING_LAYER_KEYS) {
				updateWithNewPieces(results, partTimes, layerState, newPieces, newPiecesStart, includeVirtual, key)
			}
			if (newPieces.best.other) hideLegacyPersistingPieces(partTimes, layerState, newPiecesStart, orderTime)

			// A clear virtual has no content to cover the pieces it doesn't end, so it obstructs them as a shadow does
			for (const key of ['other', ...PERSISTING_LAYER_KEYS] as const) {
				const newPiece = newPieces.best[key]
				if (newPiece && isClear(newPiece) && layerState.activePieces[key] === newPiece) {
					const keysUnder =
						key === 'other'
							? PERSISTING_LAYER_KEYS
							: PERSISTING_LAYER_KEYS.slice(PERSISTING_LAYER_KEYS.indexOf(key))
					applyShadow(results, partTimes, layerState, newPiece, newPiecesStart, orderTime, keysUnder, true)
				}
			}

			for (const shadow of shadows) {
				applyShadow(results, partTimes, layerState, shadow, newPiecesStart, orderTime)
				if (includeVirtual)
					results.push({ ...shadow, priority: PieceLifespan.from(shadow.piece.lifespan).stackingPriority })
			}
		}
	}

	// Strip out any pieces that end before they start
	return results.filter(
		(p) =>
			p.resolvedEndCap === undefined ||
			(typeof p.resolvedEndCap === 'number' && typeof p.piece.enable.start === 'number'
				? p.resolvedEndCap > p.piece.enable.start
				: p.resolvedEndCap !== p.piece.enable.start)
	)
}
function updateWithNewPieces(
	results: PieceInstanceWithTimings[],
	partTimes: PartCurrentTimes,
	{ activePieces, shadowedPieces }: InfiniteLayerState,
	newPieces: PieceInstancesStartingTogether,
	newPiecesStart: number | 'now',
	includeVirtual: boolean | undefined,
	key: InfiniteLayerKey
): void {
	const newPiece = newPieces.best[key]
	if (newPiece) {
		const coveredPieces = _.compact([...(shadowedPieces.get(key) ?? []), activePieces[key]])
		const stillShadowed: PieceInstanceWithTimings[] = []
		for (const piece of coveredPieces) {
			if (key !== 'other' && isResumedAfter(piece, newPiece)) {
				// A piece persisting in shadow resumes when the one covering it ends
				stillShadowed.push(piece)
			} else {
				piece.resolvedEndCap = getPieceStartTimeAsReference(newPiecesStart, partTimes, piece)
			}
		}

		// Pieces starting together with the new one are covered by it, only the ones resuming after it are kept
		for (const piece of newPieces.others.get(key) ?? []) {
			if (key !== 'other' && !isClear(piece) && isResumedAfter(piece, newPiece)) {
				// Below the new piece, which has the same priority and start
				piece.priority -= 0.5
				stillShadowed.push(piece)
				results.push(piece)
			}
		}
		shadowedPieces.set(key, stillShadowed)

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
				key !== 'other' &&
				PERSISTING_LAYER_KEYS.slice(0, PERSISTING_LAYER_KEYS.indexOf(key)).every(
					(narrowerKey) => !activePieces[narrowerKey]
				)
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

/**
 * Pieces that persist in shadow are tracked per scope, so that each scope can be stacked on top of the broader ones.
 * Every other piece is tracked as 'other', where a newer piece always replaces the previous one.
 */
type InfiniteLayerKey = PieceLifespanScope | 'other'

/** The scopes of persisting pieces, ordered from the narrowest to the broadest */
const PERSISTING_LAYER_KEYS: readonly PieceLifespanScope[] = ['part', 'segment', 'rundown', 'showstyle', 'playlist']

type PieceInstanceOnInfiniteLayers = Partial<Record<InfiniteLayerKey, PieceInstanceWithTimings>>

interface InfiniteLayerState {
	/** The newest piece in each group */
	activePieces: PieceInstanceOnInfiniteLayers
	/** Older pieces persisting in shadow of a newer one in their group, which will resume when it ends */
	shadowedPieces: Map<InfiniteLayerKey, PieceInstanceWithTimings[]>
}

/**
 * A piece which doesn't persist in shadow hides the legacy-persist pieces it covers for the rest of the Part, as the
 * legacy onEnd presets used to. They come back in the next Part.
 * Continuations from a previous Part are covered by a piece starting at the same time too.
 */
function hideLegacyPersistingPieces(
	partTimes: PartCurrentTimes,
	{ activePieces, shadowedPieces }: InfiniteLayerState,
	newPiecesStart: number | 'now',
	startTime: number
): void {
	const isHidden = (piece: PieceInstanceWithTimings) =>
		PieceLifespan.from(piece.piece.lifespan).isEndedByNewerOfSameScope &&
		(!!piece.infinite?.fromPreviousPart || getPieceOrderTime(piece, partTimes) < startTime)

	for (const key of PERSISTING_LAYER_KEYS) {
		const activePiece = activePieces[key]
		const shadowed = shadowedPieces.get(key) ?? []
		for (const piece of _.compact([activePiece, ...shadowed])) {
			if (isHidden(piece)) piece.resolvedEndCap = getPieceStartTimeAsReference(newPiecesStart, partTimes, piece)
		}
		if (activePiece && isHidden(activePiece)) activePieces[key] = undefined
		shadowedPieces.set(
			key,
			shadowed.filter((piece) => !isHidden(piece))
		)
	}
}

/**
 * A shadow obstructs the pieces already on its layer while it is active. Pieces starting after it are on top of it.
 * It ends nothing: the pieces under it are cut at the start of the shadow, and a slice of them resumes once it ends,
 * unless they are legacy-persist, which stay hidden for the rest of the Part.
 * Continuations from a previous Part are obstructed by a shadow starting at the same time too.
 * @param keys The groups of pieces under the shadow
 * @param keepLegacy Leave the legacy-persist pieces to the timeline, which covers them by priority as it used to
 */
function applyShadow(
	results: PieceInstanceWithTimings[],
	partTimes: PartCurrentTimes,
	{ activePieces, shadowedPieces }: InfiniteLayerState,
	shadow: ReadonlyDeep<PieceInstance>,
	shadowStart: number | 'now',
	startTime: number,
	keys: readonly InfiniteLayerKey[] = ['other', ...PERSISTING_LAYER_KEYS],
	keepLegacy = false
): void {
	const shadowEnd = getPieceEndTimeWithinPart(shadow, partTimes)
	const isUnder = (piece: PieceInstanceWithTimings) => {
		if (piece === shadow) return false
		if (keepLegacy && PieceLifespan.from(piece.piece.lifespan).isEndedByNewerOfSameScope) return false
		if (!piece.infinite?.fromPreviousPart) return getPieceOrderTime(piece, partTimes) < startTime

		// When both were continued, the one whose chain started first is underneath
		const pieceChainStart = getChainStartTime(piece)
		const shadowChainStart = shadow.infinite?.fromPreviousPart ? getChainStartTime(shadow) : undefined
		if (pieceChainStart !== undefined && shadowChainStart !== undefined) return pieceChainStart < shadowChainStart

		return true
	}

	const sliceAfterShadow = (piece: PieceInstanceWithTimings): PieceInstanceWithTimings | undefined => {
		piece.resolvedEndCap = getPieceStartTimeAsReference(shadowStart, partTimes, piece)
		if (shadowEnd === undefined || PieceLifespan.from(piece.piece.lifespan).isEndedByNewerOfSameScope)
			return undefined

		const pieceEnd = getPieceEndTimeWithinPart(piece, partTimes)
		if (pieceEnd !== undefined && pieceEnd <= shadowEnd) return undefined

		const slice: PieceInstanceWithTimings = {
			...piece,
			_id: protectString(`${piece._id}_after_${shadow._id}`),
			infinite: undefined,
			resolvedEndCap: undefined,
			piece: {
				...piece.piece,
				enable: {
					...piece.piece.enable,
					start: piece.piece.enable.isAbsolute
						? partTimes.currentTime - partTimes.nowInPart + shadowEnd
						: shadowEnd,
					duration: pieceEnd !== undefined && !piece.userDuration ? pieceEnd - shadowEnd : undefined,
				},
			},
		}
		results.push(slice)
		return slice
	}

	for (const key of keys) {
		const activePiece = activePieces[key]
		if (activePiece && isUnder(activePiece)) activePieces[key] = sliceAfterShadow(activePiece)

		const shadowed = shadowedPieces.get(key) ?? []
		shadowedPieces.set(key, _.compact(shadowed.map((piece) => (isUnder(piece) ? sliceAfterShadow(piece) : piece))))
	}
}

/** When a piece ends within the Part, if it has an end */
function getPieceEndTimeWithinPart(
	piece: ReadonlyDeep<PieceInstance>,
	partTimes: PartCurrentTimes
): number | undefined {
	const start = getPieceOrderTime(piece, partTimes)
	const ends = [
		typeof piece.piece.enable.duration === 'number' ? start + piece.piece.enable.duration : undefined,
		piece.userDuration?.endRelativeToPart,
	].filter((end): end is number => end !== undefined)
	return ends.length > 0 ? Math.min(...ends) : undefined
}

/**
 * When a piece starts within the Part, to order it against the others.
 * A piece starting 'now' is placed at when it was actually started, if that is known, otherwise at the playhead
 */
function getPieceOrderTime(piece: ReadonlyDeep<PieceInstance>, partTimes: PartCurrentTimes): number {
	const start = getPieceStartTimeWithinPart(piece, partTimes)
	if (start !== 'now') return start

	const startedAt = piece.plannedStartedPlayback ?? piece.reportedStartedPlayback ?? piece.dynamicallyInserted
	if (startedAt === undefined || partTimes.partStartTime === null) return partTimes.nowInPart

	return Math.max(0, Math.min(startedAt - partTimes.partStartTime, partTimes.nowInPart))
}

/** When the chain of an infinite was started (milliseconds since epoch), as continuations keep that of their origin */
function getChainStartTime(piece: ReadonlyDeep<PieceInstance>): number | undefined {
	return piece.plannedStartedPlayback ?? piece.reportedStartedPlayback
}

/** Whether a piece will stay on air until something stops it */
function isOpenEnded(piece: ReadonlyDeep<PieceInstance>): boolean {
	return !piece.userDuration && typeof piece.piece.enable.duration !== 'number'
}

/** Whether a piece persisting in shadow resumes after a newer piece of its scope, or is ended by it */
function isResumedAfter(piece: ReadonlyDeep<PieceInstance>, newPiece: ReadonlyDeep<PieceInstance>): boolean {
	return !isOpenEnded(newPiece) && !PieceLifespan.from(piece.piece.lifespan).isEndedByNewerOfSameScope
}

interface PieceInstancesStartingTogether {
	/** The most important new piece in each group */
	best: PieceInstanceOnInfiniteLayers
	/** The other new pieces in each group */
	others: Map<InfiniteLayerKey, PieceInstanceWithTimings[]>
}

function findPieceInstancesOnInfiniteLayers(pieces: ReadonlyDeep<PieceInstance[]>): PieceInstancesStartingTogether {
	const best: PieceInstanceOnInfiniteLayers = {}
	const others = new Map<InfiniteLayerKey, PieceInstanceWithTimings[]>()

	for (const piece of pieces) {
		const lifespan = PieceLifespan.from(piece.piece.lifespan)
		const key: InfiniteLayerKey = lifespan.persistsInShadow ? lifespan.scope : 'other'
		const candidate: PieceInstanceWithTimings = { ...piece, priority: lifespan.stackingPriority }

		const existing = best[key]
		const othersInGroup = others.get(key) ?? []
		if (!existing || isCandidateBetterToBeContinued(existing, piece)) {
			best[key] = candidate
			if (existing) othersInGroup.push(existing)
		} else {
			othersInGroup.push(candidate)
		}
		others.set(key, othersInGroup)
	}

	return { best, others }
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
