import { IBlueprintPartOutTransition, IBlueprintPieceType, TSR } from '@sofie-automation/blueprints-integration'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	TimelineObjGroupPart,
	OnGenerateTimelineObjExt,
	TimelineObjType,
	TimelineContentTypeOther,
	TimelineObjRundown,
	TimelineObjPartAbstract,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { assertNever, literal } from '@sofie-automation/corelib/dist/lib'
import { getPartGroupId, getPartFirstObjectId } from '@sofie-automation/corelib/dist/playout/ids'
import { PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { PieceTimelineMetadata } from './pieceGroup.js'
import { JobContext } from '../../jobs/index.js'
import { ReadonlyDeep } from 'type-fest'
import { getPieceEnableInsidePart, transformPieceGroupAndObjects } from './piece.js'
import { PlayoutChangedType } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { SelectedPartInstanceTimelineInfo } from './generate.js'
import { PartCalculatedTimings } from '@sofie-automation/corelib/dist/playout/timings'

export function transformPartIntoTimeline(
	context: JobContext,
	playlistId: RundownPlaylistId,
	pieceInstances: ReadonlyDeep<Array<PieceInstanceWithTimings>>,
	pieceGroupFirstObjClasses: string[],
	parentGroup: TimelineObjGroupPart & OnGenerateTimelineObjExt,
	partInfo: SelectedPartInstanceTimelineInfo,
	nextPartTimings: PartCalculatedTimings | null,
	isInHold: boolean
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const span = context.startSpan('transformPartIntoTimeline')

	const nowInParentGroup = partInfo.partTimes.nowInPart
	const partTimings = partInfo.calculatedTimings
	const outTransition = partInfo.partInstance.part.outTransition ?? null

	let parentGroupNoKeepalive: (TimelineObjGroupPart & OnGenerateTimelineObjExt) | undefined

	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

	for (const pieceInstance of pieceInstances) {
		if (pieceInstance.disabled) continue

		const pieceEnable = getPieceEnableForPieceInstance(partTimings, outTransition, parentGroup, pieceInstance)

		// Not able to enable this piece
		if (!pieceEnable) continue

		// Determine which group to add to
		let partGroupToAddTo = parentGroup
		if (pieceInstance.piece.excludeDuringPartKeepalive) {
			if (!parentGroupNoKeepalive) {
				// Only generate the no-keepalive group if is is needed
				parentGroupNoKeepalive = createPartNoKeepaliveGroup(parentGroup, nextPartTimings)
				timelineObjs.push(parentGroupNoKeepalive)
			}
			partGroupToAddTo = parentGroupNoKeepalive
		}

		timelineObjs.push(
			...transformPieceGroupAndObjects(
				playlistId,
				partGroupToAddTo,
				nowInParentGroup,
				pieceInstance,
				pieceEnable,
				pieceInstance.dynamicallyInserted ? 0 : partTimings.toPartDelay,
				pieceGroupFirstObjClasses,
				isInHold,
				false
			)
		)
	}
	if (span) span.end()
	return timelineObjs
}

function getPieceEnableForPieceInstance(
	partTimings: PartCalculatedTimings,
	outTransition: IBlueprintPartOutTransition | null,
	parentGroup: TimelineObjGroupPart & OnGenerateTimelineObjExt,
	pieceInstance: ReadonlyDeep<PieceInstanceWithTimings>
): TSR.Timeline.TimelineEnable | undefined {
	switch (pieceInstance.piece.pieceType) {
		case IBlueprintPieceType.InTransition: {
			if (typeof partTimings.inTransitionStart !== 'number') return undefined
			// Respect the start time of the piece, in case there is a reason for it being non-zero
			const startOffset =
				typeof pieceInstance.piece.enable.start === 'number' ? pieceInstance.piece.enable.start : 0

			return {
				start: partTimings.inTransitionStart + startOffset,
				duration: pieceInstance.piece.enable.duration,
			}
		}
		case IBlueprintPieceType.OutTransition: {
			if (!outTransition) return undefined

			const pieceEnable: TSR.Timeline.TimelineEnable = {
				start: `#${parentGroup.id}.end - ${outTransition.duration + partTimings.toPartPostroll}`,
			}

			return pieceEnable
		}
		case IBlueprintPieceType.Normal:
			return getPieceEnableInsidePart(
				pieceInstance,
				partTimings,
				parentGroup.id,
				parentGroup.enable.duration !== undefined || parentGroup.enable.end !== undefined
			)
		default:
			assertNever(pieceInstance.piece.pieceType)
			return undefined
	}
}

export interface PartEnable {
	start: number | 'now' | string
	duration?: number
	end?: string
}

export function createPartGroup(
	partInstance: ReadonlyDeep<DBPartInstance>,
	enable: PartEnable
): TimelineObjGroupPart & OnGenerateTimelineObjExt {
	const partGrp = literal<TimelineObjGroupPart & OnGenerateTimelineObjExt>({
		id: getPartGroupId(partInstance),
		objectType: TimelineObjType.RUNDOWN,
		enable: enable,
		priority: 5,
		layer: '', // These should coexist
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: TimelineContentTypeOther.GROUP,
		},
		children: [],
		isGroup: true,
		partInstanceId: partInstance._id,
		metaData: literal<PieceTimelineMetadata>({
			isPieceTimeline: true,
		}),
	})

	return partGrp
}

export function createPartGroupFirstObject(
	playlistId: RundownPlaylistId,
	partInstance: ReadonlyDeep<DBPartInstance>,
	partGroup: TimelineObjRundown & OnGenerateTimelineObjExt,
	previousPart?: ReadonlyDeep<DBPartInstance>
): TimelineObjPartAbstract & OnGenerateTimelineObjExt {
	return literal<TimelineObjPartAbstract & OnGenerateTimelineObjExt>({
		id: getPartFirstObjectId(partInstance),
		objectType: TimelineObjType.RUNDOWN,
		enable: { start: 0 },
		layer: 'group_first_object',
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: 'callback',
			// Will cause the playout-gateway to run a callback, when the object starts playing:
			callBack: PlayoutChangedType.PART_PLAYBACK_STARTED,
			callBackData: {
				rundownPlaylistId: playlistId,
				partInstanceId: partInstance._id,
			},
			callBackStopped: PlayoutChangedType.PART_PLAYBACK_STOPPED, // Will cause a callback to be called, when the object stops playing:
		},
		inGroup: partGroup.id,
		partInstanceId: partGroup.partInstanceId,
		classes: (partInstance.part.classes || []).concat(previousPart ? previousPart.part.classesForNext || [] : []),
		metaData: undefined,
		priority: 0,
	})
}

export function createPartNoKeepaliveGroup(
	partGroup: TimelineObjGroupPart & OnGenerateTimelineObjExt,
	nextPartTimings: PartCalculatedTimings | null
): TimelineObjGroupPart & OnGenerateTimelineObjExt {
	const keepaliveDuration = nextPartTimings?.fromPartKeepalive ?? 0

	return {
		id: `${partGroup.id}_no_keepalive`,
		objectType: TimelineObjType.RUNDOWN,
		enable: {
			start: 0,
			end: `#${partGroup.id}.end - ${keepaliveDuration}`,
		},
		priority: 5,
		layer: '', // These should coexist
		content: {
			deviceType: TSR.DeviceType.ABSTRACT,
			type: TimelineContentTypeOther.GROUP,
		},
		children: [],
		isGroup: true,
		partInstanceId: partGroup.partInstanceId,
		metaData: literal<PieceTimelineMetadata>({
			isPieceTimeline: true,
		}),
		inGroup: partGroup.id,
	}
}
