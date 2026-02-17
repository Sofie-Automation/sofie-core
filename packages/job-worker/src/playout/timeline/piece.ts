import { TSR, TimelineObjectCoreExt } from '@sofie-automation/blueprints-integration'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { deserializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	TimelineObjRundown,
	OnGenerateTimelineObjExt,
	TimelineObjType,
	TimelineObjGroupPart,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { createPieceGroupAndCap } from './pieceGroup.js'
import { PartCalculatedTimings } from '@sofie-automation/corelib/dist/playout/timings'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { prefixAllObjectIds } from '../lib.js'
import { hasPieceInstanceDefinitelyEnded, shouldIncludeObjectOnTimeline, TimelinePlayoutState } from './lib.js'

export function transformPieceGroupAndObjects(
	playlistId: RundownPlaylistId,
	partGroup: TimelineObjGroupPart & OnGenerateTimelineObjExt,
	nowInPart: number,
	pieceInstance: ReadonlyDeep<PieceInstanceWithTimings>,
	pieceEnable: TSR.Timeline.TimelineEnable,
	/** If the start of the piece has been offset inside the partgroup  */
	pieceStartOffset: number,
	controlObjClasses: string[],
	playoutState: TimelinePlayoutState
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	// If a piece has definitely finished playback, then we can prune its contents. But we can only do that check if the part has an absolute time, otherwise we are only guessing
	const hasDefinitelyEnded =
		typeof partGroup.enable.start === 'number' && hasPieceInstanceDefinitelyEnded(pieceInstance, nowInPart)

	// create a piece group for the pieces and then place all of them there
	const { controlObj, childGroup, capObjs } = createPieceGroupAndCap(
		playlistId,
		pieceInstance,
		pieceEnable,
		controlObjClasses,
		partGroup,
		pieceStartOffset
	)
	// We need all these objects so that we can resolve all the piece timings in this timeline
	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = [controlObj, childGroup, ...capObjs]

	if (!pieceInstance.piece.virtual && !hasDefinitelyEnded) {
		const pieceObjects: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

		const objects = deserializePieceTimelineObjectsBlob(pieceInstance.piece.timelineObjectsString)
		for (const o of objects) {
			if (!shouldIncludeObjectOnTimeline(playoutState, o)) continue

			pieceObjects.push({
				metaData: undefined,
				...clone<TimelineObjectCoreExt<any>>(o),
				inGroup: childGroup.id,
				objectType: TimelineObjType.RUNDOWN,
				pieceInstanceId: unprotectString(pieceInstance._id),
				infinitePieceInstanceId: pieceInstance.infinite?.infiniteInstanceId,
				partInstanceId: partGroup.partInstanceId,
			})
		}

		// This `prefixAllObjectIds` call needs to match the one in, lookahead.ts. If changed then getStartOfObjectRef() will need updating
		timelineObjs.push(...prefixAllObjectIds(pieceObjects, unprotectString(pieceInstance._id)))
	}

	return timelineObjs
}

export function getPieceEnableInsidePart(
	pieceInstance: ReadonlyDeep<PieceInstanceWithTimings>,
	partTimings: PartCalculatedTimings,
	partGroupId: string,
	partHasEndTime: boolean
): TSR.Timeline.TimelineEnable {
	const pieceEnable: TSR.Timeline.TimelineEnable = { ...pieceInstance.piece.enable }
	if (typeof pieceEnable.start === 'number') {
		// pieces should be offset based on the preroll of the part
		pieceEnable.start += partTimings.toPartDelay
	}

	// If the part has an end time, we can consider post-roll
	if (partHasEndTime && partTimings.toPartPostroll) {
		if (pieceEnable.duration === undefined) {
			// make sure that the control object is shortened correctly
			pieceEnable.end = `#${partGroupId} - ${partTimings.toPartPostroll}`
		}
	}

	if (pieceInstance.userDuration) {
		delete pieceEnable.duration

		if ('endRelativeToPart' in pieceInstance.userDuration) {
			pieceEnable.end = pieceInstance.userDuration.endRelativeToPart
		} else {
			// This will be fixed later
			pieceEnable.end = 'now'
		}
	}

	return pieceEnable
}
