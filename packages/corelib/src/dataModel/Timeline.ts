import { TSR, OnGenerateTimelineObj, Time } from '@sofie-automation/blueprints-integration'
import {
	TimelineObjGeneric,
	TimelineObjType,
	TimelineEnableExt,
} from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import { SetRequired } from 'type-fest'
import { PartInstanceId, PieceInstanceInfiniteId, BlueprintId, StudioId } from './Ids.js'

export {
	deserializeTimelineBlob,
	serializeTimelineBlob,
	RoutedTimeline,
} from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import { TimelineHash, TimelineBlob } from '@sofie-automation/shared-lib/dist/core/model/Ids'
export { TimelineHash, TimelineBlob }
import {
	PartPlaybackCallbackData,
	PiecePlaybackCallbackData,
	PlayoutChangedType,
	TriggerRegenerationCallbackData,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
export { PartPlaybackCallbackData, PiecePlaybackCallbackData }

export { TimelineObjGeneric, TimelineObjType, TimelineEnableExt }

export enum TimelineContentTypeOther {
	NOTHING = 'nothing',
	GROUP = 'group',
}

export interface OnGenerateTimelineObjExt<TMetadata = unknown, TKeyframeMetadata = unknown>
	extends SetRequired<OnGenerateTimelineObj<TSR.TSRTimelineContent, TMetadata, TKeyframeMetadata>, 'metaData'> {
	/** The id of the partInstance this object belongs to */
	partInstanceId: PartInstanceId | null
	/** If this is from an infinite piece, the id of the infinite instance */
	infinitePieceInstanceId?: PieceInstanceInfiniteId
}

export interface TimelineObjRundown extends TimelineObjGeneric {
	objectType: TimelineObjType.RUNDOWN
}
export interface TimelineObjGroup extends Omit<TimelineObjGeneric, 'content'> {
	enable: TimelineEnableExt
	content: {
		type: TimelineContentTypeOther.GROUP
	}
	children: TimelineObjGeneric[]
	isGroup: true
}
export type TimelineObjGroupRundown = TimelineObjGroup & Omit<TimelineObjRundown, 'enable'>

export type TimelineObjGroupPart = TimelineObjGroupRundown

export interface TimelineObjPartAbstract extends TimelineObjRundown {
	// used for sending callbacks
	content: {
		deviceType: TSR.DeviceType.ABSTRACT
		type: 'callback'
		callBack: PlayoutChangedType.PART_PLAYBACK_STARTED
		callBackStopped: PlayoutChangedType.PART_PLAYBACK_STOPPED
		callBackData: PartPlaybackCallbackData
	}
}
export interface TimelineObjPieceAbstract extends Omit<TimelineObjRundown, 'enable'> {
	enable: TimelineEnableExt

	// used for sending callbacks
	content: {
		deviceType: TSR.DeviceType.ABSTRACT
		type: 'callback'
		callBack: PlayoutChangedType.PIECE_PLAYBACK_STARTED
		callBackStopped: PlayoutChangedType.PIECE_PLAYBACK_STOPPED
		callBackData: PiecePlaybackCallbackData
	}
}

export interface TimelineObjRegenerateTrigger extends TimelineObjRundown {
	// used for sending callbacks
	content: {
		deviceType: TSR.DeviceType.ABSTRACT
		type: 'callback'
		callBack: PlayoutChangedType.TRIGGER_REGENERATION
		callBackData: TriggerRegenerationCallbackData
	}
}

export function updateLookaheadLayer(obj: TimelineObjRundown): void {
	// Set lookaheadForLayer to reference the original layer:
	obj.lookaheadForLayer = obj.layer
	obj.layer += '_lookahead'
}

/** Version numbers of sofie at the time the timeline was generated */
export interface TimelineCompleteGenerationVersions {
	core: string
	blueprintId: BlueprintId | undefined
	blueprintVersion: string
	studio: string
}

export interface TimelineComplete {
	/** The id of the timeline. Since there is one (1) timeline in a studio, we can use that id here. */
	_id: StudioId
	/**
	 * The TimelineHash is a random string, which is modified whenever the timeline has changed.
	 * It is used in the playout-gateway to be able to report back resolve-times
	 */
	timelineHash: TimelineHash
	/** Timestamp when the timeline is generated */
	generated: Time
	/** serialized JSON Array containing all timeline-objects.  */
	timelineBlob: TimelineBlob
	/** Version numbers of sofie at the time the timeline was generated */
	generationVersions: TimelineCompleteGenerationVersions

	/**
	 * A special regenerate object can be on the timeline to trigger a regeneration at a certain point
	 * It uses this token to verify that the regeneration request is valid
	 */
	regenerateTimelineToken: string | undefined
}
