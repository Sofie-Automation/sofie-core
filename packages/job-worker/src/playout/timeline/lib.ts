import {
	IBlueprintPieceType,
	TimelineObjectCoreExt,
	TimelineObjHoldMode,
	TimelineObjOnAirMode,
} from '@sofie-automation/blueprints-integration'
import { PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { ReadonlyDeep } from 'type-fest'
import { DEFINITELY_ENDED_FUTURE_DURATION } from '../infinites.js'
import { assertNever } from '@sofie-automation/corelib/dist/lib'

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

export interface TimelinePlayoutState {
	/** Whether the playout is currently in rehearsal mode */
	isRehearsal: boolean
	/** If true, we're playing in a HOLD situation */
	isInHold: boolean
	/**
	 * If true, objects with holdMode EXCEPT will be included on the timeline, even when in hold.
	 * This is used for infinite, when their pieces belong to both sides of the HOLD
	 */
	includeWhenNotInHoldObjects?: boolean
}

/**
 * Whether a timeline object should be included on the timeline
 * This uses some specific properties on the object which define this behaviour
 */
export function shouldIncludeObjectOnTimeline(
	playoutState: TimelinePlayoutState,
	object: TimelineObjectCoreExt<any>
): boolean {
	// Some objects can be filtered out at times based on the holdMode of the object
	switch (object.holdMode) {
		case TimelineObjHoldMode.NORMAL:
		case undefined:
			break
		case TimelineObjHoldMode.EXCEPT:
			if (playoutState.isInHold && !playoutState.includeWhenNotInHoldObjects) {
				return false
			}
			break
		case TimelineObjHoldMode.ONLY:
			if (!playoutState.isInHold) {
				return false
			}
			break
		default:
			assertNever(object.holdMode)
	}

	// Some objects should be filtered depending on the onair mode
	switch (object.onAirMode) {
		case TimelineObjOnAirMode.ALWAYS:
		case undefined:
			break
		case TimelineObjOnAirMode.ONAIR:
			if (playoutState.isRehearsal) return false
			break
		case TimelineObjOnAirMode.REHEARSAL:
			if (!playoutState.isRehearsal) return false

			break
		default:
			assertNever(object.onAirMode)
	}

	return true
}
