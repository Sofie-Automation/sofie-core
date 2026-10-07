import { IBlueprintPartOutTransition, IBlueprintPieceType, TSR } from '@sofie-automation/blueprints-integration'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
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
import { TimelinePlayoutState } from './lib.js'

export function transformPartIntoTimeline(
	context: JobContext,
	playlistId: RundownPlaylistId,
	pieceInstances: ReadonlyDeep<Array<PieceInstanceWithTimings>>,
	pieceGroupFirstObjClasses: string[],
	parentGroup: TimelineObjGroupPart & OnGenerateTimelineObjExt,
	partInfo: SelectedPartInstanceTimelineInfo,
	nextPartTimings: PartCalculatedTimings | null,
	playoutState: TimelinePlayoutState
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const span = context.startSpan('transformPartIntoTimeline')

	const nowInParentGroup = partInfo.partTimes.nowInPart
	const partTimings = partInfo.calculatedTimings
	const outTransition = partInfo.partInstance.part.outTransition ?? null

	let parentGroupNoKeepalive: (TimelineObjGroupPart & OnGenerateTimelineObjExt) | undefined

	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

	for (const pieceInstance of pieceInstances) {
		if (pieceInstance.disabled) continue

		const pieceEnable = getPieceEnableForPieceInstance(
			partTimings,
			nextPartTimings,
			outTransition,
			parentGroup,
			pieceInstance
		)

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
				partInfo.calculatedTimings,
				partGroupToAddTo,
				nowInParentGroup,
				pieceInstance,
				pieceEnable,
				pieceGroupFirstObjClasses,
				playoutState
			)
		)
	}
	if (span) span.end()
	return timelineObjs
}

export interface OutTransitionPiecePlacement {
	/** How long before the end of the Part the piece starts. Negative values are after the end */
	offsetFromPartEnd: number
	/** The duration of the piece, if it is limited */
	duration: number | undefined
}

/**
 * Placement for an out-transition piece of a transition which replaced the next Part's inTransition.
 * This starts at the transition start, which is the start of the next Part (the take, plus any take offset)
 */
function getExclusiveOutTransitionPiecePlacement(
	nextPartTimings: PartCalculatedTimings,
	piece: ReadonlyDeep<Pick<PieceInstancePiece, 'enable'>>
): OutTransitionPiecePlacement {
	// Respect the start time of the piece, to allow for delaying it
	const startOffset = typeof piece.enable.start === 'number' ? piece.enable.start : 0

	return {
		offsetFromPartEnd: nextPartTimings.fromPartKeepalive + nextPartTimings.fromPartPostroll - startOffset,
		duration: piece.enable.duration,
	}
}

/**
 * Determine where an out-transition piece is placed, relative to the end of its Part
 * @param partTimings Timings of the Part containing the piece
 * @param nextPartTimings Timings of the Part being taken into
 * @param outTransition The outTransition of the Part containing the piece
 * @param piece The piece to place
 * @returns The placement, or undefined if the piece is not played
 */
export function getOutTransitionPiecePlacement(
	partTimings: PartCalculatedTimings,
	nextPartTimings: PartCalculatedTimings | null | undefined,
	outTransition: ReadonlyDeep<IBlueprintPartOutTransition> | null | undefined,
	piece: ReadonlyDeep<Pick<PieceInstancePiece, 'pieceType' | 'enable'>>
): OutTransitionPiecePlacement | undefined {
	switch (piece.pieceType) {
		case IBlueprintPieceType.OutTransition:
			if (!outTransition) return undefined

			switch (outTransition.type) {
				case 'exclusive':
					// Only play when this transition was the one used
					if (nextPartTimings?.transitionSource !== 'outTransition') return undefined

					return getExclusiveOutTransitionPiecePlacement(nextPartTimings, piece)
				case 'additive':
					// The autoNextOutTransition replaces this transition
					if (nextPartTimings?.transitionSource === 'autoNextOutTransition') return undefined

					return {
						offsetFromPartEnd: outTransition.duration + partTimings.toPartPostroll,
						duration: undefined,
					}
				default:
					assertNever(outTransition)
					return undefined
			}
		case IBlueprintPieceType.AutoNextOutTransition:
			// Only play when this transition was the one used
			if (nextPartTimings?.transitionSource !== 'autoNextOutTransition') return undefined

			return getExclusiveOutTransitionPiecePlacement(nextPartTimings, piece)
		case IBlueprintPieceType.Normal:
		case IBlueprintPieceType.InTransition:
			return undefined
		default:
			assertNever(piece.pieceType)
			return undefined
	}
}

function getPieceEnableForPieceInstance(
	partTimings: PartCalculatedTimings,
	nextPartTimings: PartCalculatedTimings | null,
	outTransition: ReadonlyDeep<IBlueprintPartOutTransition> | null,
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
		case IBlueprintPieceType.OutTransition:
		case IBlueprintPieceType.AutoNextOutTransition: {
			const placement = getOutTransitionPiecePlacement(
				partTimings,
				nextPartTimings,
				outTransition,
				pieceInstance.piece
			)
			if (!placement) return undefined

			const pieceEnable: TSR.Timeline.TimelineEnable = {
				start:
					placement.offsetFromPartEnd >= 0
						? `#${parentGroup.id}.end - ${placement.offsetFromPartEnd}`
						: `#${parentGroup.id}.end + ${-placement.offsetFromPartEnd}`,
			}
			if (placement.duration !== undefined) pieceEnable.duration = placement.duration

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
