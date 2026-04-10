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
import { literal } from '@sofie-automation/corelib/dist/lib'
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
	if (activePlaylist.previousPartsInfo?.length) {
		// Warn only if loaded info says 'previous' but the model didn't populate it
		if (!partInstancesInfo.previous.length)
			logger.warn(`Previous PartInstances "${JSON.stringify(activePlaylist.previousPartsInfo)}" not found!`)
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
		partInstancesInfo.previous.length > 0
			? new Map(
					partInstancesInfo.previous.flatMap((prev) =>
						prev.pieceInstances.flatMap((inst) =>
							inst.infinite ? [[inst.infinite.infiniteInstanceId, inst] as const] : []
						)
					)
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
	if (partInstancesInfo.previous.length > 0) {
		timelineObjs.push(
			...generatePreviousPartInstancesObjects(
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
			partInstancesInfo.previous[0]?.partInstance
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

	/*
	   Notes on the "Infinite Part Group":
	   Infinite pieces are put into a parent "infinite Part Group" object instead of the usual Part Group,
	   because their lifetime can be outside of their Part.
	   
	   The Infinite Part Group's start time is set to be the start time of the Piece, but this is then complicated by
	   the Piece.enable.start assuming that it is relative to the PartGroup it is in. This is being factored in if an
	   absolute start time is known for the piece.
	*/

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
		/*
			This gets overridden with a concrete time if the original piece is known to have already started
			but if not, allows the pieceEnable to be relative to the currentPartInstance's part group as normal
			and `nowInParent` to be correct for the piece objects inside
		*/
		start: `#${timingContext.currentPartGroup.id}.start`,
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

/**
 * Generate timeline objects for all previous PartInstances whose keepalive/postroll still overlaps with the
 * current (or a newer previous) PartInstance.
 *
 * `previousPartsInfo` is ordered most-recent-first (index 0 = the part taken from immediately before current).
 * Groups are chained: previous[0] ends relative to currentPartGroup; previous[1] ends relative to previous[0]'s
 * group start; and so on.
 */
function generatePreviousPartInstancesObjects(
	context: JobContext,
	activePlaylist: ReadonlyDeep<DBRundownPlaylist>,
	previousPartsInfo: SelectedPartInstanceTimelineInfo[],
	currentInfinitePieceIds: Set<PieceInstanceInfiniteId>,
	timingContext: RundownTimelineTimingContext,
	currentPartInstanceTimings: PartCalculatedTimings
): Array<TimelineObjRundown & OnGenerateTimelineObjExt> {
	const result: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []

	for (let i = 0; i < previousPartsInfo.length; i++) {
		const previousPartInfo = previousPartsInfo[i]
		const partStartedPlayback = previousPartInfo.partInstance.timings?.plannedStartedPlayback
		if (!partStartedPlayback) continue // Part was never actually on air – skip

		/**
		 * The overlap duration for this part:
		 *   - For previous[0]: how long it continues past the START of the current part group
		 *     (comes from currentPartInstanceTimings.fromPartRemaining, same as the original single-previous logic)
		 *   - For previous[i>0]: how long it continues past the START of previous[i-1]'s group
		 *     (comes from previous[i-1].calculatedTimings.fromPartRemaining, which is the "fromPartRemaining"
		 *     stored on the part that was taken TO previous[i-1] FROM previous[i])
		 */
		const prevPartOverlapDuration =
			i === 0
				? currentPartInstanceTimings.fromPartRemaining
				: previousPartsInfo[i - 1].calculatedTimings.fromPartRemaining

		// The "next" group in the chain: previous[0] ends relative to currentPartGroup; older ones end
		// relative to the immediately-newer previous group.
		const nextGroupId =
			i === 0 ? timingContext.currentPartGroup.id : getPartGroupId(previousPartsInfo[i - 1].partInstance)

		const previousPartGroup = createPartGroup(previousPartInfo.partInstance, {
			start: partStartedPlayback,
			end: `#${nextGroupId}.start + ${prevPartOverlapDuration}`,
		})
		previousPartGroup.priority = -1

		// Only set the most-recent overlap in the timing context (used downstream by AB-playback etc.)
		if (i === 0) {
			timingContext.previousPartOverlap = prevPartOverlapDuration
		}

		// If a Piece is infinite and continued in the new Part, add it only there to avoid id collisions
		const previousContinuedPieces = previousPartInfo.pieceInstances.filter(
			(pi) => !pi.infinite || !currentInfinitePieceIds.has(pi.infinite.infiniteInstanceId)
		)

		const groupClasses: string[] = ['previous_part']

		result.push(
			previousPartGroup,
			...transformPartIntoTimeline(
				context,
				activePlaylist._id,
				previousContinuedPieces,
				groupClasses,
				previousPartGroup,
				previousPartInfo,
				// Pass the relevant "next" timings for context-sensitive piece rendering.
				// For the immediately-previous part this is the current part's timings;
				// for older parts it is the immediately-newer previous part's timings.
				i === 0 ? currentPartInstanceTimings : previousPartsInfo[i - 1].calculatedTimings,
				{
					isRehearsal: !!activePlaylist.rehearsal,
					isInHold: activePlaylist.holdState === RundownHoldState.ACTIVE,
				}
			)
		)
	}

	return result
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
