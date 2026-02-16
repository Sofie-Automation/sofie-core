import {
	IBlueprintPieceType,
	PieceLifespan,
	Time,
	TimelineObjClassesCore,
	TSR,
} from '@sofie-automation/blueprints-integration'
import { PartInstanceId, PieceInstanceId, PieceInstanceInfiniteId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PieceInstanceInfinite } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundownPlaylist, RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import {
	TimelineObjGroupPart,
	TimelineObjRundown,
	OnGenerateTimelineObjExt,
	TimelineObjType,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { getPartGroupId } from '@sofie-automation/corelib/dist/playout/ids'
import { PieceInstanceWithTimings } from '@sofie-automation/corelib/dist/playout/processAndPrune'
import { PartCalculatedTimings } from '@sofie-automation/corelib/dist/playout/timings'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { JobContext } from '../../jobs/index.js'
import { ReadonlyDeep } from 'type-fest'
import { SelectedPartInstancesTimelineInfo, SelectedPartInstanceTimelineInfo } from './generate.js'
import { createPartGroup, createPartGroupFirstObject, PartEnable, transformPartIntoTimeline } from './part.js'
import { literal, normalizeArrayToMapFunc } from '@sofie-automation/corelib/dist/lib'
import { getCurrentTime } from '../../lib/index.js'
import _ from 'underscore'
import { getPieceEnableInsidePart, transformPieceGroupAndObjects } from './piece.js'
import { logger } from '../../logging.js'

/**
 * Some additional data used by the timeline generation process
 * Fields are populated as it progresses through generation, and consumed during the finalisation
 */
export interface RundownTimelineTimingContext {
	currentPartGroup: TimelineObjGroupPart
	currentPartDuration: number | undefined

	previousPartOverlap?: number

	nextPartGroup?: TimelineObjGroupPart
	nextPartOverlap?: number

	multiGatewayMode: boolean
}
export interface RundownTimelineResult {
	timeline: (TimelineObjRundown & OnGenerateTimelineObjExt)[]
	timingContext: RundownTimelineTimingContext | undefined
}

export function buildTimelineObjsForRundown(
	context: JobContext,
	activePlaylist: ReadonlyDeep<DBRundownPlaylist>,
	partInstancesInfo: SelectedPartInstancesTimelineInfo,
	multiGatewayMode: boolean
): RundownTimelineResult {
	const span = context.startSpan('buildTimelineObjsForRundown')
	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

	const currentTime = getCurrentTime()

	timelineObjs.push(
		literal<TimelineObjRundown & OnGenerateTimelineObjExt>({
			id: activePlaylist._id + '_status',
			objectType: TimelineObjType.RUNDOWN,
			enable: { while: 1 },
			layer: 'rundown_status',
			content: {
				deviceType: TSR.DeviceType.ABSTRACT,
			},
			classes: [
				activePlaylist.rehearsal
					? TimelineObjClassesCore.RundownRehearsal
					: TimelineObjClassesCore.RundownActive,
				!activePlaylist.currentPartInfo ? TimelineObjClassesCore.BeforeFirstPart : undefined,
				!activePlaylist.nextPartInfo ? TimelineObjClassesCore.NoNextPart : undefined,
			].filter((v): v is TimelineObjClassesCore => v !== undefined),
			partInstanceId: null,
			metaData: undefined,
			priority: 0,
		})
	)

	// Fetch the nextPart first, because that affects how the currentPart will be treated
	if (activePlaylist.nextPartInfo) {
		// We may be at the end of a show, where there is no next part
		if (!partInstancesInfo.next)
			throw new Error(`PartInstance "${activePlaylist.nextPartInfo?.partInstanceId}" not found!`)
	}
	if (activePlaylist.currentPartInfo) {
		// We may be before the beginning of a show, and there can be no currentPart and we are waiting for the user to Take
		if (!partInstancesInfo.current)
			throw new Error(`PartInstance "${activePlaylist.currentPartInfo?.partInstanceId}" not found!`)
	}
	if (activePlaylist.previousPartInfo) {
		// We may be at the beginning of a show, where there is no previous part
		if (!partInstancesInfo.previous)
			logger.warn(`Previous PartInstance "${activePlaylist.previousPartInfo?.partInstanceId}" not found!`)
	}

	if (!partInstancesInfo.next && !partInstancesInfo.current) {
		// maybe at the end of the show
		logger.info(`No next part and no current part set on RundownPlaylist "${activePlaylist._id}".`)
	}

	// Currently playing:
	if (!partInstancesInfo.current) {
		if (span) span.end()
		return {
			timeline: timelineObjs,
			timingContext: undefined,
		}
	}

	const [currentInfinitePieces, currentNormalItems] = _.partition(
		partInstancesInfo.current.pieceInstances,
		(l) => !!(l.infinite && (l.piece.lifespan !== PieceLifespan.WithinPart || l.infinite.fromHold))
	)

	// Find all the infinites in each of the selected parts
	const currentInfinitePieceIds = new Set(_.compact(currentInfinitePieces.map((l) => l.infinite?.infiniteInstanceId)))
	const nextPartInfinites = new Map<PieceInstanceInfinite['infiniteInstanceId'], PieceInstanceWithTimings>()
	if (partInstancesInfo.current.partInstance.part.autoNext && partInstancesInfo.next) {
		partInstancesInfo.next.pieceInstances.forEach((piece) => {
			if (piece.infinite) {
				nextPartInfinites.set(piece.infinite.infiniteInstanceId, piece)
			}
		})
	}

	const previousPartInfinites: Map<PieceInstanceInfinite['infiniteInstanceId'], PieceInstanceWithTimings> =
		partInstancesInfo.previous
			? normalizeArrayToMapFunc(partInstancesInfo.previous.pieceInstances, (inst) =>
					inst.infinite ? inst.infinite.infiniteInstanceId : undefined
				)
			: new Map()

	// The startTime of this start is used as the reference point for the calculated timings, so we can use 'now' and everything will lie after this point
	const currentPartEnable = createCurrentPartGroupEnable(partInstancesInfo.current, !!partInstancesInfo.next)
	const currentPartGroup = createPartGroup(partInstancesInfo.current.partInstance, currentPartEnable)

	const timingContext: RundownTimelineTimingContext = {
		currentPartGroup,
		currentPartDuration: currentPartEnable.duration,
		multiGatewayMode,
	}

	// Start generating objects
	if (partInstancesInfo.previous) {
		timelineObjs.push(
			...generatePreviousPartInstanceObjects(
				context,
				activePlaylist,
				partInstancesInfo.previous,
				currentInfinitePieceIds,
				timingContext,
				partInstancesInfo.current.calculatedTimings
			)
		)
	}

	// any continued infinite lines need to skip the group, as they need a different start trigger
	for (const infinitePiece of currentInfinitePieces) {
		timelineObjs.push(
			...generateCurrentInfinitePieceObjects(
				activePlaylist,
				partInstancesInfo.current,
				previousPartInfinites,
				nextPartInfinites,
				timingContext,
				infinitePiece,
				currentTime,
				partInstancesInfo.current.calculatedTimings,
				partInstancesInfo.next?.calculatedTimings ?? null
			)
		)
	}

	const groupClasses: string[] = ['current_part']
	timelineObjs.push(
		currentPartGroup,
		createPartGroupFirstObject(
			activePlaylist._id,
			partInstancesInfo.current.partInstance,
			currentPartGroup,
			partInstancesInfo.previous?.partInstance
		),
		...transformPartIntoTimeline(
			context,
			activePlaylist._id,
			currentNormalItems,
			groupClasses,
			currentPartGroup,
			partInstancesInfo.current,
			partInstancesInfo.next?.calculatedTimings ?? null,
			{
				isRehearsal: !!activePlaylist.rehearsal,
				isInHold: activePlaylist.holdState === RundownHoldState.ACTIVE,
			}
		)
	)

	// only add the next objects into the timeline if the current partgroup has a duration, and can autoNext
	if (partInstancesInfo.next && currentPartEnable.duration) {
		timelineObjs.push(
			...generateNextPartInstanceObjects(
				context,
				activePlaylist,
				partInstancesInfo.current,
				partInstancesInfo.next,
				timingContext
			)
		)
	}

	if (span) span.end()
	return {
		timeline: timelineObjs,
		timingContext: timingContext,
	}
}

function createCurrentPartGroupEnable(
	currentPartInfo: SelectedPartInstanceTimelineInfo,
	hasNextPart: boolean
): PartEnable {
	// The startTime of this start is used as the reference point for the calculated timings, so we can use 'now' and everything will lie after this point
	const currentPartEnable: PartEnable = { start: 'now' }
	if (currentPartInfo.partInstance.timings?.plannedStartedPlayback) {
		// If we are recalculating the currentPart, then ensure it doesnt think it is starting now
		currentPartEnable.start = currentPartInfo.partInstance.timings.plannedStartedPlayback
	}

	if (
		hasNextPart &&
		currentPartInfo.partInstance.part.autoNext &&
		currentPartInfo.partInstance.part.expectedDuration !== undefined
	) {
		// If there is a valid autonext out of the current part, then calculate the duration
		currentPartEnable.duration =
			currentPartInfo.partInstance.part.expectedDuration +
			currentPartInfo.calculatedTimings.toPartDelay +
			currentPartInfo.calculatedTimings.toPartPostroll // autonext should have the postroll added to it to not confuse the timeline

		if (
			typeof currentPartEnable.start === 'number' &&
			currentPartEnable.start + currentPartEnable.duration < getCurrentTime()
		) {
			logger.warn('Prevented setting the end of an autonext in the past')
			// note - this will cause a small glitch on air where the next part is skipped into because this calculation does not account
			// for the time it takes between timeline generation and timeline execution. That small glitch is preferable to setting the time
			// very far in the past however. To do this properly we should support setting the "end" to "now" and have that calculated after
			// timeline generation as we do for start times.
			currentPartEnable.duration = getCurrentTime() - currentPartEnable.start
		}
	}

	return currentPartEnable
}

export function getInfinitePartGroupId(pieceInstanceId: PieceInstanceId): string {
	return getPartGroupId(protectString<PartInstanceId>(unprotectString(pieceInstanceId))) + '_infinite'
}

function generateCurrentInfinitePieceObjects(
	activePlaylist: ReadonlyDeep<DBRundownPlaylist>,
	currentPartInfo: SelectedPartInstanceTimelineInfo,
	previousPartInfinites: Map<PieceInstanceInfinite['infiniteInstanceId'], PieceInstanceWithTimings>,
	nextPartInfinites: Map<PieceInstanceInfinite['infiniteInstanceId'], PieceInstanceWithTimings>,
	timingContext: RundownTimelineTimingContext,
	pieceInstance: PieceInstanceWithTimings,
	currentTime: Time,
	currentPartInstanceTimings: PartCalculatedTimings,
	nextPartInstanceTimings: PartCalculatedTimings | null
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	if (!pieceInstance.infinite) {
		// Type guard, should never be hit
		return []
	}
	if (pieceInstance.disabled || pieceInstance.piece.pieceType !== IBlueprintPieceType.Normal) {
		// Can't be generated as infinites
		return []
	}

	const { infiniteGroupEnable, pieceEnable, nowInParent } = calculateInfinitePieceEnable(
		currentPartInfo,
		timingContext,
		pieceInstance,
		currentTime,
		currentPartInstanceTimings
	)

	const { pieceInstanceWithUpdatedEndCap, cappedInfiniteGroupEnable } = applyInfinitePieceGroupEndCap(
		currentPartInfo,
		timingContext,
		pieceInstance,
		infiniteGroupEnable,
		currentPartInstanceTimings,
		nextPartInstanceTimings,
		nextPartInfinites.get(pieceInstance.infinite.infiniteInstanceId)
	)

	const infiniteGroup = createPartGroup(currentPartInfo.partInstance, cappedInfiniteGroupEnable)
	infiniteGroup.id = getInfinitePartGroupId(pieceInstance._id) // This doesnt want to belong to a part, so force the ids
	infiniteGroup.priority = 1

	const groupClasses: string[] = ['current_part']
	// If the previousPart also contains another segment of this infinite piece, then we label our new one as such
	if (previousPartInfinites.get(pieceInstance.infinite.infiniteInstanceId)) {
		groupClasses.push('continues_infinite')
	}

	// Still show objects flagged as 'HoldMode.EXCEPT' if this is a infinite continuation as they belong to the previous too
	const isOriginOfInfinite = pieceInstance.piece.startPartId !== currentPartInfo.partInstance.part._id
	const isInHold = activePlaylist.holdState === RundownHoldState.ACTIVE

	return [
		infiniteGroup,
		...transformPieceGroupAndObjects(
			activePlaylist._id,
			infiniteGroup,
			nowInParent,
			pieceInstanceWithUpdatedEndCap,
			pieceEnable,
			0,
			groupClasses,
			{
				isRehearsal: !!activePlaylist.rehearsal,
				isInHold: isInHold,
				includeWhenNotInHoldObjects: isOriginOfInfinite,
			}
		),
	]
}

function calculateInfinitePieceEnable(
	currentPartInfo: SelectedPartInstanceTimelineInfo,
	timingContext: RundownTimelineTimingContext,
	pieceInstance: ReadonlyDeep<PieceInstanceWithTimings>,
	// infiniteGroup: TimelineObjGroupPart & OnGenerateTimelineObjExt,
	currentTime: number,
	currentPartInstanceTimings: PartCalculatedTimings
) {
	const pieceEnable = getPieceEnableInsidePart(
		pieceInstance,
		currentPartInstanceTimings,
		timingContext.currentPartGroup.id,
		timingContext.currentPartGroup.enable.end !== undefined ||
			timingContext.currentPartGroup.enable.duration !== undefined
	)

	let infiniteGroupEnable: PartEnable = {
		start: `#${timingContext.currentPartGroup.id}.start`, // This gets overriden with a concrete time if the original piece is known to have already started
	}

	let nowInParent = currentPartInfo.partTimes.nowInPart // Where is 'now' inside of the infiniteGroup?
	if (pieceInstance.piece.enable.isAbsolute) {
		// Piece is absolute, so we should use the absolute time. This is a special case for pieces belonging to the rundown directly.

		const infiniteGroupStart = pieceInstance.plannedStartedPlayback ?? pieceInstance.piece.enable.start

		if (typeof infiniteGroupStart === 'number') {
			nowInParent = currentTime - infiniteGroupStart
		} else {
			// We should never hit this, but in case start is "now"
			nowInParent = 0
		}

		infiniteGroupEnable = { start: infiniteGroupStart }
		pieceEnable.start = 0

		// Future: should this consider the prerollDuration?
	} else if (!timingContext.multiGatewayMode && pieceInstance.reportedStartedPlayback !== undefined) {
		// We have a absolute start time, so we should use that, but only if not in multiGatewayMode
		let infiniteGroupStart = pieceInstance.reportedStartedPlayback
		nowInParent = currentTime - pieceInstance.reportedStartedPlayback

		// infiniteGroupStart had an actual timestamp inside and pieceEnable.start being a number
		// means that it expects an offset from it's parent
		// The infiniteGroupStart is a timestamp of the actual start of the piece controlObj,
		// which includes the value of `pieceEnable.start` so we need to offset by that value and avoid trimming
		// the start of the piece group
		if (typeof pieceEnable.start === 'number' && pieceEnable.start !== null) {
			infiniteGroupStart -= pieceEnable.start
		} else {
			// We should never hit this, but in case pieceEnable.start is "now"
			pieceEnable.start = 0
		}

		infiniteGroupEnable = { start: infiniteGroupStart }

		// If an end time has been set by a hotkey, then update the duration to be correct
		if (pieceInstance.userDuration && pieceInstance.piece.enable.start !== 'now') {
			if ('endRelativeToPart' in pieceInstance.userDuration) {
				infiniteGroupEnable.duration =
					pieceInstance.userDuration.endRelativeToPart - pieceInstance.piece.enable.start
			} else {
				infiniteGroupEnable.end = 'now'
			}
		}
	}

	return {
		pieceEnable,
		infiniteGroupEnable,
		nowInParent,
	}
}

function applyInfinitePieceGroupEndCap(
	currentPartInfo: SelectedPartInstanceTimelineInfo,
	timingContext: RundownTimelineTimingContext,
	pieceInstance: ReadonlyDeep<PieceInstanceWithTimings>,
	infiniteGroupEnable: Readonly<PartEnable>,
	currentPartInstanceTimings: PartCalculatedTimings,
	nextPartInstanceTimings: PartCalculatedTimings | null,
	infiniteInNextPart: PieceInstanceWithTimings | undefined
) {
	const cappedInfiniteGroupEnable: PartEnable = { ...infiniteGroupEnable }

	// If this infinite piece continues to the next part, and has a duration then we should respect that in case it is really close to the take
	const hasDurationOrEnd = (enable: TSR.Timeline.TimelineEnable) =>
		enable.duration !== undefined || enable.end !== undefined
	if (
		infiniteInNextPart &&
		!hasDurationOrEnd(cappedInfiniteGroupEnable) &&
		hasDurationOrEnd(infiniteInNextPart.piece.enable)
	) {
		// infiniteGroup.enable.end = infiniteInNextPart.piece.enable.end
		cappedInfiniteGroupEnable.duration = infiniteInNextPart.piece.enable.duration
	}

	const pieceInstanceWithUpdatedEndCap: PieceInstanceWithTimings = { ...pieceInstance }
	// Give the infinite group and end cap when the end of the piece is known
	if (pieceInstance.resolvedEndCap) {
		// If the cap is a number, it is relative to the part, not the parent group so needs to be handled here
		if (typeof pieceInstance.resolvedEndCap === 'number') {
			cappedInfiniteGroupEnable.end = `#${timingContext.currentPartGroup.id}.start + ${pieceInstance.resolvedEndCap}`
			delete cappedInfiniteGroupEnable.duration
			delete pieceInstanceWithUpdatedEndCap.resolvedEndCap
		}
	} else if (
		// If this piece does not continue in the next part, then set it to end with the part it belongs to
		!infiniteInNextPart &&
		currentPartInfo.partInstance.part.autoNext &&
		cappedInfiniteGroupEnable.duration === undefined &&
		cappedInfiniteGroupEnable.end === undefined
	) {
		let endOffset = 0

		if (currentPartInstanceTimings.fromPartPostroll) endOffset -= currentPartInstanceTimings.fromPartPostroll

		if (pieceInstance.piece.postrollDuration) endOffset += pieceInstance.piece.postrollDuration

		if (pieceInstance.piece.excludeDuringPartKeepalive && nextPartInstanceTimings)
			endOffset -= nextPartInstanceTimings.fromPartKeepalive

		// cap relative to the currentPartGroup
		cappedInfiniteGroupEnable.end = `#${timingContext.currentPartGroup.id}.end + ${endOffset}`
	}

	return { pieceInstanceWithUpdatedEndCap, cappedInfiniteGroupEnable }
}

function generatePreviousPartInstanceObjects(
	context: JobContext,
	activePlaylist: ReadonlyDeep<DBRundownPlaylist>,
	previousPartInfo: SelectedPartInstanceTimelineInfo,
	currentInfinitePieceIds: Set<PieceInstanceInfiniteId>,
	timingContext: RundownTimelineTimingContext,
	currentPartInstanceTimings: PartCalculatedTimings
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const partStartedPlayback = previousPartInfo.partInstance.timings?.plannedStartedPlayback
	if (partStartedPlayback) {
		// The previous part should continue for a while into the following part
		const prevPartOverlapDuration = currentPartInstanceTimings.fromPartRemaining
		timingContext.previousPartOverlap = prevPartOverlapDuration

		const previousPartGroup = createPartGroup(previousPartInfo.partInstance, {
			start: partStartedPlayback,
			end: `#${timingContext.currentPartGroup.id}.start + ${prevPartOverlapDuration}`,
		})
		previousPartGroup.priority = -1

		// If a Piece is infinite, and continued in the new Part, then we want to add the Piece only there to avoid id collisions
		const previousContinuedPieces = previousPartInfo.pieceInstances.filter(
			(pi) => !pi.infinite || !currentInfinitePieceIds.has(pi.infinite.infiniteInstanceId)
		)

		const groupClasses: string[] = ['previous_part']

		return [
			previousPartGroup,
			...transformPartIntoTimeline(
				context,
				activePlaylist._id,
				previousContinuedPieces,
				groupClasses,
				previousPartGroup,
				previousPartInfo,
				currentPartInstanceTimings,
				{
					isRehearsal: !!activePlaylist.rehearsal,
					isInHold: activePlaylist.holdState === RundownHoldState.ACTIVE,
				}
			),
		]
	} else {
		return []
	}
}

function generateNextPartInstanceObjects(
	context: JobContext,
	activePlaylist: ReadonlyDeep<DBRundownPlaylist>,
	currentPartInfo: SelectedPartInstanceTimelineInfo,
	nextPartInfo: SelectedPartInstanceTimelineInfo,
	timingContext: RundownTimelineTimingContext
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const nextPartGroup = createPartGroup(nextPartInfo.partInstance, {
		start: `#${timingContext.currentPartGroup.id}.end - ${nextPartInfo.calculatedTimings.fromPartRemaining}`,
	})
	timingContext.nextPartGroup = nextPartGroup
	timingContext.nextPartOverlap = nextPartInfo.calculatedTimings.fromPartRemaining

	const nextPieceInstances = nextPartInfo?.pieceInstances.filter(
		(i) => !i.infinite || i.infinite.infiniteInstanceIndex === 0
	)

	const groupClasses: string[] = ['next_part']

	return [
		nextPartGroup,
		createPartGroupFirstObject(
			activePlaylist._id,
			nextPartInfo.partInstance,
			nextPartGroup,
			currentPartInfo.partInstance
		),
		...transformPartIntoTimeline(
			context,
			activePlaylist._id,
			nextPieceInstances,
			groupClasses,
			nextPartGroup,
			nextPartInfo,
			null,
			{
				isRehearsal: !!activePlaylist.rehearsal,
				isInHold: false,
			}
		),
	]
}
