import { IBlueprintPieceType } from '@sofie-automation/blueprints-integration'
import { DBPartInstance } from '../dataModel/PartInstance.js'
import { DBPart } from '../dataModel/Part.js'
import { PieceInstance, PieceInstancePiece } from '../dataModel/PieceInstance.js'
import { Piece } from '../dataModel/Piece.js'
import { RundownHoldState } from '../dataModel/RundownPlaylist/RundownPlaylist.js'
import { ReadonlyDeep } from 'type-fest'

/**
 * Whether the pieceType is one of the out-transition types, which are anchored to the end of the Part
 */
export function isOutTransitionPieceType(pieceType: IBlueprintPieceType): boolean {
	return pieceType === IBlueprintPieceType.OutTransition || pieceType === IBlueprintPieceType.AutoNextOutTransition
}

/**
 * Calculate the total pre-roll duration of a PartInstance
 * Note: once the part has been taken this should not be recalculated. Doing so may result in the timings shifting
 */
function calculatePartPreroll(pieces: ReadonlyDeep<CalculateTimingsPiece[]>): number {
	const candidates: number[] = []
	for (const piece of pieces) {
		if (piece.pieceType !== IBlueprintPieceType.Normal) {
			// Ignore preroll for transition pieces
			continue
		}

		if (piece.enable.start === 'now') {
			// A piece starting at now was adlibbed, so does not affect the starting preroll
		} else if (piece.prerollDuration) {
			// How far before the part does the piece protrude
			candidates.push(Math.max(0, piece.prerollDuration - piece.enable.start))
		}
	}

	return Math.max(0, ...candidates)
}
/**
 * Calculate the total post-roll duration of a PartInstance
 */
function calculatePartPostroll(pieces: ReadonlyDeep<CalculateTimingsPiece[]>): number {
	const candidates: number[] = []
	for (const piece of pieces) {
		if (!piece.postrollDuration) {
			continue
		}
		if (piece.enable.duration) {
			// presume it ends before we do a take
			continue
		}

		candidates.push(piece.postrollDuration)
	}

	return Math.max(0, ...candidates)
}

/**
 * Which transition was used for the boundary into a Part
 * - `none`: no transition, a simple cut (possibly delayed by an additive outTransition)
 * - `inTransition`: the inTransition of the Part being taken into
 * - `outTransition`: the `'exclusive'` outTransition of the Part being taken out of
 * - `autoNextOutTransition`: the autoNextOutTransition of the Part being taken out of
 */
export type PartTransitionSource = 'none' | 'inTransition' | 'outTransition' | 'autoNextOutTransition'

/**
 * Numbers are relative to the start of toPartGroup. Nothing should ever be negative, the pieces of toPartGroup will be delayed to allow for other things to complete.
 * Note: once the part has been taken this should not be recalculated. Doing so may result in the timings shifting if the preroll required for the part is found to have changed
 */
export interface PartCalculatedTimings {
	inTransitionStart: number | null // The start time within the toPartGroup of the inTransition
	toPartDelay: number // How long after the start of toPartGroup should piece time 0 be
	toPartPostroll: number
	fromPartRemaining: number // How long after the start of toPartGroup should fromPartGroup continue?
	fromPartPostroll: number
	fromPartKeepalive: number

	/** Which transition was used for the boundary into this Part. Undefined for timings persisted before this was added */
	transitionSource?: PartTransitionSource
	/** How long after plannedStartedPlayback takes out of this Part are blocked. Undefined for timings persisted before this was added */
	blockTakeDuration?: number
}

export type CalculateTimingsPiece = Pick<Piece, 'enable' | 'prerollDuration' | 'postrollDuration' | 'pieceType'>
export type CalculateTimingsFromPart = Pick<DBPart, 'autoNext' | 'autoNextOutTransition' | 'outTransition'>

export type CalculateTimingsToPart = Pick<DBPart, 'inTransition'>

/**
 * The single transition used for the boundary between two Parts.
 * Exactly one transition wins, nothing is merged between them
 */
export interface ResolvedPartTransition {
	source: PartTransitionSource
	keepalive: number
	contentDelay: number
	blockTakeDuration: number
	/** Whether the InTransition piece of the Part being taken into plays */
	playInTransitionPiece: boolean
	/** Whether the additive outTransition.duration of the Part being taken out of contributes to the take offset */
	applyAdditiveOutDuration: boolean
}

/**
 * Determine which transition to use for the boundary between two Parts
 */
export function resolvePartTransition(
	isInHold: boolean,
	fromPart: CalculateTimingsFromPart | undefined,
	toPart: CalculateTimingsToPart
): ResolvedPartTransition {
	const noTransition = (applyAdditiveOutDuration: boolean): ResolvedPartTransition => ({
		source: 'none',
		keepalive: 0,
		contentDelay: 0,
		blockTakeDuration: 0,
		playInTransitionPiece: false,
		applyAdditiveOutDuration,
	})

	if (!fromPart) return noTransition(false)

	// If in a hold, we cant do the transition
	if (isInHold) return noTransition(true)

	if (fromPart.autoNext && fromPart.autoNextOutTransition) {
		return {
			source: 'autoNextOutTransition',
			keepalive: fromPart.autoNextOutTransition.partKeepaliveDuration,
			contentDelay: fromPart.autoNextOutTransition.nextPartContentDelayDuration,
			blockTakeDuration: fromPart.autoNextOutTransition.blockTakeDuration,
			playInTransitionPiece: false,
			applyAdditiveOutDuration: false,
		}
	}

	if (fromPart.outTransition?.type === 'exclusive') {
		return {
			source: 'outTransition',
			keepalive: fromPart.outTransition.partKeepaliveDuration,
			contentDelay: fromPart.outTransition.nextPartContentDelayDuration,
			blockTakeDuration: fromPart.outTransition.blockTakeDuration,
			playInTransitionPiece: false,
			applyAdditiveOutDuration: false,
		}
	}

	if (toPart.inTransition && !fromPart.outTransition?.disableNextInTransition) {
		return {
			source: 'inTransition',
			keepalive: toPart.inTransition.previousPartKeepaliveDuration,
			contentDelay: toPart.inTransition.partContentDelayDuration,
			blockTakeDuration: toPart.inTransition.blockTakeDuration,
			playInTransitionPiece: true,
			applyAdditiveOutDuration: true,
		}
	}

	return noTransition(true)
}

/**
 * Calculate the timings of the period where the parts can overlap.
 */
export function calculatePartTimings(
	holdState: RundownHoldState | undefined,
	fromPart: CalculateTimingsFromPart | undefined,
	fromPieces: CalculateTimingsPiece[] | undefined,
	toPart: CalculateTimingsToPart,
	toPieces: ReadonlyDeep<CalculateTimingsPiece[]>
	// toPartPreroll: number
): PartCalculatedTimings {
	// If in a hold, we cant do the transition
	const isInHold =
		holdState !== RundownHoldState.NONE && holdState !== RundownHoldState.COMPLETE && holdState !== undefined

	const toPartPreroll = calculatePartPreroll(toPieces)
	const fromPartPostroll = fromPart && fromPieces ? calculatePartPostroll(fromPieces) : 0
	const toPartPostroll = calculatePartPostroll(toPieces)

	const transition = resolvePartTransition(isInHold, fromPart, toPart)

	const additiveOutDuration =
		transition.applyAdditiveOutDuration && fromPart?.outTransition && fromPart.outTransition.type !== 'exclusive'
			? fromPart.outTransition.duration
			: undefined

	// Try and convert the transition
	if (transition.source === 'none') {
		// The amount to delay the part 'switch' to, to ensure the outTransition has time to complete as well as any prerolls for part B
		const takeOffset = Math.max(0, additiveOutDuration ?? 0, toPartPreroll)

		return {
			inTransitionStart: null, // No transition to use
			// delay the new part for a bit
			toPartDelay: takeOffset,
			toPartPostroll,
			// The old part needs to continue for a while
			fromPartRemaining: takeOffset + fromPartPostroll,
			fromPartPostroll: fromPartPostroll,
			fromPartKeepalive: 0,
			transitionSource: transition.source,
			blockTakeDuration: transition.blockTakeDuration,
		}
	} else {
		// The amount of time needed to complete the outTransition before the 'take' point
		const outTransitionTime = additiveOutDuration !== undefined ? additiveOutDuration - transition.keepalive : 0

		// The amount of time needed to preroll Part B before the 'take' point
		const prerollTime = toPartPreroll - transition.contentDelay

		// The amount to delay the part 'switch' to, to ensure the outTransition has time to complete as well as any prerolls for part B
		const takeOffset = Math.max(0, outTransitionTime, prerollTime)

		return {
			inTransitionStart: transition.playInTransitionPiece ? takeOffset : null,
			toPartDelay: takeOffset + transition.contentDelay,
			toPartPostroll: toPartPostroll,
			fromPartRemaining: takeOffset + transition.keepalive + fromPartPostroll,
			fromPartPostroll: fromPartPostroll,
			fromPartKeepalive: transition.keepalive,
			transitionSource: transition.source,
			blockTakeDuration: transition.blockTakeDuration,
		}
	}
}

export function getPartTimingsOrDefaults(
	partInstance: ReadonlyDeep<DBPartInstance>,
	pieceInstances: ReadonlyDeep<PieceInstance[]>
): PartCalculatedTimings {
	if (partInstance.partPlayoutTimings) {
		return partInstance.partPlayoutTimings
	} else {
		return calculatePartTimings(
			RundownHoldState.NONE,
			undefined,
			undefined,
			partInstance.part,
			pieceInstances.map((p) => p.piece)
		)
	}
}

function calculateExpectedDurationWithTransition(rawDuration: number, timings: PartCalculatedTimings): number {
	// toPartDelay and fromPartPostroll needs to be subtracted, because it is added to `fromPartRemaining` when the `fromPartRemaining` value is calculated.
	return Math.max(0, rawDuration - (timings.fromPartRemaining - timings.toPartDelay - timings.fromPartPostroll))
}

export type CalculateExpectedDurationPart = Pick<DBPart, 'inTransition' | 'expectedDuration'>

export function calculatePartExpectedDurationWithTransition(
	part: CalculateExpectedDurationPart,
	pieces: ReadonlyDeep<PieceInstancePiece[]>
): number | undefined {
	if (part.expectedDuration === undefined) return undefined

	const timings = calculatePartTimings(undefined, {}, [], part, pieces)

	return calculateExpectedDurationWithTransition(part.expectedDuration, timings)
}

export function calculatePartInstanceExpectedDurationWithTransition(
	partInstance: Pick<DBPartInstance, 'part' | 'partPlayoutTimings'>
	// pieces: CalculateTimingsPiece[]
): number | undefined {
	if (partInstance.part.expectedDuration === undefined) return undefined

	if (partInstance.partPlayoutTimings) {
		// The timings needed are known, we can ensure that live data is used
		return calculateExpectedDurationWithTransition(
			partInstance.part.expectedDuration,
			partInstance.partPlayoutTimings
		)
	} else {
		return partInstance.part.expectedDurationWithTransition
	}
}
