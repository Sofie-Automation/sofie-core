import { IBlueprintPieceType } from '@sofie-automation/blueprints-integration'
import { PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { ReadonlyDeep } from 'type-fest'
import { DEFINITELY_ENDED_FUTURE_DURATION } from '../infinites.js'

/**
 * Check if a PieceInstance has 'definitely ended'.
 * In other words, check if a PieceInstance has finished playback long enough ago that it can be excluded from the timeline
 * @param pieceInstance PieceInstnace to check if it has definitely ended
 * @param nowInPart Time to use as 'now', relative to the start of the part
 * @returns Whether the PieceInstance has definitely ended
 */
export function hasPieceInstanceDefinitelyEnded(
	pieceInstance: ReadonlyDeep<PieceInstanceWithTimings>,
	nowInPart: number
): boolean {
	if (nowInPart <= 0) return false
	if (pieceInstance.piece.hasSideEffects || pieceInstance.piece.pieceType === IBlueprintPieceType.OutTransition)
		return false

	let relativeEnd: number | undefined
	if (typeof pieceInstance.resolvedEndCap === 'number') {
		relativeEnd = pieceInstance.resolvedEndCap
	} else if (pieceInstance.resolvedEndCap) {
		relativeEnd = nowInPart + pieceInstance.resolvedEndCap.offsetFromNow
	}

	if (pieceInstance.userDuration) {
		const userDurationEnd = pieceInstance.userDuration.endRelativeToPart

		relativeEnd = relativeEnd === undefined ? userDurationEnd : Math.min(relativeEnd, userDurationEnd)
	}
	if (typeof pieceInstance.piece.enable.start === 'number' && pieceInstance.piece.enable.duration !== undefined) {
		const candidateEnd = pieceInstance.piece.enable.start + pieceInstance.piece.enable.duration
		relativeEnd = relativeEnd === undefined ? candidateEnd : Math.min(relativeEnd, candidateEnd)
	}

	return relativeEnd !== undefined && relativeEnd + DEFINITELY_ENDED_FUTURE_DURATION < nowInPart
}
