import {
	OnGenerateTimelineObjExt,
	TimelineContentTypeOther,
	TimelineObjGroupRundown,
	TimelineObjPieceAbstract,
	TimelineObjRundown,
	TimelineObjType,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { ReadonlyDeep } from 'type-fest'
import { TSR } from '@sofie-automation/blueprints-integration'
import { PieceInstanceId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { clone, literal } from '@sofie-automation/corelib/dist/lib'
import { getPieceControlObjectId, getPieceGroupId } from '@sofie-automation/corelib/dist/playout/ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { PlayoutChangedType } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'

export interface PieceTimelineMetadata {
	/** Indicate that this is a PieceTimeline object */
	isPieceTimeline: true
	/** If this object should be used as timing for a PieceInstance */
	pieceInstanceGroupId?: PieceInstanceId
	/** If this object should be used to in onTriggerTime to de-now a PieceInstance */
	triggerPieceInstanceId?: PieceInstanceId
}

export function createPieceGroupAndCap(
	playlistId: RundownPlaylistId,
	pieceInstance: Pick<
		ReadonlyDeep<PieceInstanceWithTimings>,
		| '_id'
		| 'rundownId'
		| 'piece'
		| 'infinite'
		| 'resolvedEndCap'
		| 'priority'
		| 'partInstanceId'
		| 'dynamicallyInserted'
	>,
	controlObjEnable: TSR.Timeline.TimelineEnable,
	controlObjClasses?: string[],
	partGroup?: TimelineObjRundown,
	pieceStartOffset?: number
): {
	/** The 'control' object which defines the bounds of the group. This triggers the timing, and does not include and pre/postroll */
	controlObj: TimelineObjPieceAbstract & OnGenerateTimelineObjExt<PieceTimelineMetadata>
	/** The 'group' object that should contain all the content. This uses the control object for its timing, and adds the pre/postroll. */
	childGroup: TimelineObjGroupRundown & OnGenerateTimelineObjExt<PieceTimelineMetadata>
	/** Any additional objects which are used to determine points in time that the piece should start/end relative to. */
	capObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt<PieceTimelineMetadata>>
} {
	const controlObj = literal<TimelineObjPieceAbstract & OnGenerateTimelineObjExt<PieceTimelineMetadata>>({
		id: getPieceControlObjectId(pieceInstance),
		pieceInstanceId: unprotectString(pieceInstance._id),
		infinitePieceInstanceId: pieceInstance.infinite?.infiniteInstanceId,
		partInstanceId: pieceInstance.partInstanceId,
		objectType: TimelineObjType.RUNDOWN,
		enable: clone(controlObjEnable),
		layer: pieceInstance.piece.sourceLayerId,
		priority: pieceInstance.priority,
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: 'callback',
			callBack: PlayoutChangedType.PIECE_PLAYBACK_STARTED,
			callBackData: {
				rundownPlaylistId: playlistId,
				partInstanceId: pieceInstance.partInstanceId,
				pieceInstanceId: pieceInstance._id,
				dynamicallyInserted: pieceInstance.dynamicallyInserted !== undefined,
			},
			callBackStopped: PlayoutChangedType.PIECE_PLAYBACK_STOPPED, // Will cause a callback to be called, when the object stops playing:
		},
		classes: controlObjClasses ? [...controlObjClasses] : [],
		inGroup: partGroup && partGroup.id,
		metaData: {
			isPieceTimeline: true,
		},
	})

	const piecePreroll = pieceInstance.piece.prerollDuration ?? 0
	const childGroup = literal<TimelineObjGroupRundown & OnGenerateTimelineObjExt<PieceTimelineMetadata>>({
		id: getPieceGroupId(pieceInstance),
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: TimelineContentTypeOther.GROUP,
		},
		children: [],
		inGroup: partGroup && partGroup.id,
		isGroup: true,
		pieceInstanceId: unprotectString(pieceInstance._id),
		infinitePieceInstanceId: pieceInstance.infinite?.infiniteInstanceId,
		partInstanceId: pieceInstance.partInstanceId,
		objectType: TimelineObjType.RUNDOWN,
		enable: {
			start: `#${controlObj.id}.start - ${piecePreroll}`,
			end: `#${controlObj.id}.end + ${pieceInstance.piece.postrollDuration ?? 0}`,
		},
		layer: '',
		metaData: {
			isPieceTimeline: true,
			pieceInstanceGroupId: pieceInstance._id,
		},
		priority: 0,
	})

	const capObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt<PieceTimelineMetadata>> = []

	if (controlObj.enable.start === 'now' && piecePreroll > 0) {
		// Use a dedicated now object, as we need to delay the start of the control object to allow the piece_group to preroll
		const startNowObj = literal<TimelineObjRundown & OnGenerateTimelineObjExt<PieceTimelineMetadata>>({
			objectType: TimelineObjType.RUNDOWN,
			id: `${controlObj.id}_start_now`,
			enable: {
				start: 'now',
			},
			inGroup: partGroup?.id,
			layer: '',
			content: {
				deviceType: TSR.DeviceType.ABSTRACT,
			},
			partInstanceId: controlObj.partInstanceId,
			metaData: {
				isPieceTimeline: true,
				triggerPieceInstanceId: pieceInstance._id,
			},
			priority: 0,
		})
		capObjs.push(startNowObj)

		controlObj.enable.start = `#${startNowObj.id} + ${piecePreroll}`
	} else {
		// No preroll necessary, so let the control object trigger the de-nowify
		controlObj.metaData.triggerPieceInstanceId = pieceInstance._id
	}

	let resolvedEndCap: number | string | undefined
	// If the start has been adjusted, the end needs to be updated to compensate
	if (typeof pieceInstance.resolvedEndCap === 'number') {
		resolvedEndCap = pieceInstance.resolvedEndCap + (pieceStartOffset ?? 0)
	} else if (pieceInstance.resolvedEndCap || controlObj.enable.end === 'now') {
		// TODO - there could already be a piece with a cap of 'now' that we could use as our end time
		// As the cap is for 'now', rather than try to get tsr to understand `end: 'now'`, we can create a 'now' object to tranlate it
		const nowObj = literal<TimelineObjRundown & OnGenerateTimelineObjExt<PieceTimelineMetadata>>({
			objectType: TimelineObjType.RUNDOWN,
			id: `${controlObj.id}_cap_now`,
			enable: {
				start: 'now',
			},
			layer: '',
			content: {
				deviceType: TSR.DeviceType.ABSTRACT,
			},
			partInstanceId: controlObj.partInstanceId,
			metaData: literal<PieceTimelineMetadata>({
				isPieceTimeline: true,
			}),
			priority: 0,
		})
		capObjs.push(nowObj)

		resolvedEndCap = `#${nowObj.id}.start + ${pieceInstance.resolvedEndCap?.offsetFromNow ?? 0}`

		// If the object has an end of now, we can remove it as it will be replaced by the `resolvedEndCap`
		if (controlObj.enable.end === 'now') {
			delete controlObj.enable.end
		}
	}

	if (controlObj.enable.duration !== undefined || controlObj.enable.end !== undefined) {
		let updatedControlObj = false
		if (typeof resolvedEndCap === 'number') {
			// If everything is numeric, we can keep it simple and flatten it out here
			if (typeof controlObj.enable.end === 'number') {
				updatedControlObj = true
				controlObj.enable.end = Math.min(controlObj.enable.end, resolvedEndCap)
			} else if (typeof controlObj.enable.start === 'number' && typeof controlObj.enable.duration === 'number') {
				updatedControlObj = true
				controlObj.enable.end = Math.min(controlObj.enable.start + controlObj.enable.duration, resolvedEndCap)
				delete controlObj.enable.duration
			}
		}

		if (!updatedControlObj && resolvedEndCap !== undefined) {
			// Create a wrapper group to apply the end cap
			const pieceEndCapGroup = literal<TimelineObjGroupRundown & OnGenerateTimelineObjExt<PieceTimelineMetadata>>(
				{
					objectType: TimelineObjType.RUNDOWN,
					id: `${controlObj.id}_cap`,
					enable: {
						start: 0,
						end: resolvedEndCap,
					},
					layer: '',
					children: [],
					content: {
						deviceType: TSR.DeviceType.ABSTRACT,
						type: TimelineContentTypeOther.GROUP,
					},
					isGroup: true,
					inGroup: partGroup?.id,
					partInstanceId: controlObj.partInstanceId,
					metaData: literal<PieceTimelineMetadata>({
						isPieceTimeline: true,
					}),
					priority: 0,
				}
			)
			capObjs.push(pieceEndCapGroup)
			controlObj.inGroup = pieceEndCapGroup.id
		}
	} else {
		controlObj.enable.end = resolvedEndCap
	}

	return { controlObj, childGroup, capObjs }
}
