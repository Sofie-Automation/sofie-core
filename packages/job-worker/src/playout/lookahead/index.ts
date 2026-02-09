import { getOrderedPartsAfterPlayhead, PartAndPieces, PartInstanceAndPieceInstances } from './util.js'
import { findLookaheadForLayer, LookaheadResult } from './findForLayer.js'
import { PlayoutModel } from '../model/PlayoutModel.js'
import { sortPieceInstancesByStart } from '../pieces.js'
import { MappingExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { TSR, LookaheadMode, OnGenerateTimelineObj } from '@sofie-automation/blueprints-integration'
import { SelectedPartInstancesTimelineInfo, SelectedPartInstanceTimelineInfo } from '../timeline/generate.js'
import {
	OnGenerateTimelineObjExt,
	TimelineObjRundown,
	updateLookaheadLayer,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { JobContext } from '../../jobs/index.js'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance, wrapPieceToInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { Filter as FilterQuery } from 'mongodb'
import _ from 'underscore'
import { LOOKAHEAD_DEFAULT_SEARCH_DISTANCE } from '@sofie-automation/shared-lib/dist/core/constants'
import { prefixSingleObjectId } from '../lib.js'
import { LookaheadTimelineObject } from './findObjects.js'
import { hasPieceInstanceDefinitelyEnded, TimelinePlayoutState } from '../timeline/lib.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { ReadonlyDeep } from 'type-fest'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

const LOOKAHEAD_OBJ_PRIORITY = 0.1

function parseSearchDistance(rawVal: number | undefined): number {
	if (typeof rawVal !== 'number' || rawVal <= -1) {
		return LOOKAHEAD_DEFAULT_SEARCH_DISTANCE
	} else {
		return rawVal
	}
}

function findLargestLookaheadDistance(mappings: Array<[string, MappingExt]>): number {
	const values = mappings.map(([_id, m]) => parseSearchDistance(m.lookaheadMaxSearchDistance))
	return _.max(values)
}

type ValidLookaheadMode = LookaheadMode.PRELOAD | LookaheadMode.WHEN_CLEAR

function getPrunedEndedPieceInstances(info: SelectedPartInstanceTimelineInfo) {
	if (!info.partInstance.timings?.plannedStartedPlayback) {
		return info.pieceInstances
	} else {
		return info.pieceInstances.filter((p) => !hasPieceInstanceDefinitelyEnded(p, info.partTimes.nowInPart))
	}
}
function removeInfiniteContinuations(
	info: PartInstanceAndPieceInstances,
	isCurrentPart: boolean
): PartInstanceAndPieceInstances {
	const partId = info.part.part._id
	return {
		...info,
		// Ignore PieceInstances that continue from the previous part, as they will not need lookahead
		allPieces: info.allPieces.filter((inst) => {
			// Always include non infinite pieces
			if (!inst.infinite) return true

			// Only include rundown owned pieces in the current part
			if (!inst.piece.startPartId) {
				return isCurrentPart
			}

			// Include infinite pieces in the part where they start
			return inst.piece.startPartId === partId
		}),
	}
}

export async function getLookeaheadObjects(
	context: JobContext,
	playoutModel: PlayoutModel,
	partInstancesInfo0: SelectedPartInstancesTimelineInfo
): Promise<Array<TimelineObjRundown & OnGenerateTimelineObjExt>> {
	const span = context.startSpan('getLookeaheadObjects')
	const allMappings = context.studio.mappings
	const mappingsToConsider = Object.entries<MappingExt>(allMappings).filter(
		([_id, map]) => map.lookahead !== LookaheadMode.NONE && map.lookahead !== undefined
	)
	if (mappingsToConsider.length === 0) {
		if (span) span.end()
		return []
	}

	const maxLookaheadDistance = findLargestLookaheadDistance(mappingsToConsider)
	const orderedPartsFollowingPlayhead = getOrderedPartsAfterPlayhead(context, playoutModel, maxLookaheadDistance)

	const piecesToSearchQuery: FilterQuery<Piece> = {
		startRundownId: { $in: playoutModel.getRundownIds() },
		startPartId: { $in: orderedPartsFollowingPlayhead.map((p) => p._id) },
		invalid: { $ne: true },
	}
	const pPiecesToSearch = context.directCollections.Pieces.findFetch(piecesToSearchQuery, {
		projection: {
			privateData: 0,

			// these are known to be chunky when they exist
			content: 0,
		},
	})

	const partInstancesInfo: PartInstanceAndPieceInstances[] = _.compact([
		partInstancesInfo0.current
			? removeInfiniteContinuations(
					{
						part: partInstancesInfo0.current.partInstance,
						onTimeline: true,
						nowInPart: partInstancesInfo0.current.partTimes.nowInPart,
						allPieces: getPrunedEndedPieceInstances(partInstancesInfo0.current),
						calculatedTimings: partInstancesInfo0.current.calculatedTimings,
					},
					true
				)
			: undefined,
		partInstancesInfo0.next
			? removeInfiniteContinuations(
					{
						part: partInstancesInfo0.next.partInstance,
						onTimeline: !!partInstancesInfo0.current?.partInstance?.part?.autoNext, //TODO -QL
						nowInPart: partInstancesInfo0.next.partTimes.nowInPart,
						allPieces: partInstancesInfo0.next.pieceInstances,
						calculatedTimings: partInstancesInfo0.next.calculatedTimings,
					},
					false
				)
			: undefined,
	])

	// Track the previous info for checking how the timeline will be built
	let previousPartInfo: PartInstanceAndPieceInstances | undefined
	if (partInstancesInfo0.previous) {
		previousPartInfo = removeInfiniteContinuations(
			{
				part: partInstancesInfo0.previous.partInstance,
				onTimeline: true,
				nowInPart: partInstancesInfo0.previous.partTimes.nowInPart,
				allPieces: getPrunedEndedPieceInstances(partInstancesInfo0.previous),
				calculatedTimings: partInstancesInfo0.previous.calculatedTimings,
			},
			false
		)
	}

	// TODO: Do we need to use processAndPrunePieceInstanceTimings on these pieces? In theory yes, but that gets messy and expensive.
	// In reality, there are not likely to be any/many conflicts if the blueprints are written well so it shouldnt be a problem
	const piecesToSearch = await pPiecesToSearch

	const piecesByPart = new Map<PartId, Array<PieceInstance>>()
	for (const piece of piecesToSearch) {
		// Don't lookahead any rundown owned pieces, that should only happen once they become PieceInstances
		if (!piece.startPartId) continue

		const pieceInstance = wrapPieceToInstance(piece, protectString(''), protectString(''), true)
		const existing = piecesByPart.get(piece.startPartId)
		if (existing) {
			existing.push(pieceInstance)
		} else {
			piecesByPart.set(piece.startPartId, [pieceInstance])
		}
	}

	const orderedPartInfos: Array<PartAndPieces> = orderedPartsFollowingPlayhead.map((part, i) => {
		const previousPart: ReadonlyDeep<DBPart> | undefined =
			i === 0
				? (partInstancesInfo0.next?.partInstance ?? partInstancesInfo0.current?.partInstance)?.part
				: orderedPartsFollowingPlayhead[i - 1]

		return {
			part,
			usesInTransition: !previousPart?.disableNextInTransition, // aproximate, but accurate enough
			pieces: sortPieceInstancesByStart(piecesByPart.get(part._id) || [], 0),
		}
	})

	const playoutState: TimelinePlayoutState = {
		isRehearsal: !!playoutModel.playlist.rehearsal,
		isInHold: playoutModel.playlist.holdState === RundownHoldState.ACTIVE,
	}

	const span2 = context.startSpan('getLookeaheadObjects.iterate')
	const timelineObjs: Array<TimelineObjRundown & OnGenerateTimelineObjExt> = []
	const futurePartCount = orderedPartInfos.length + (partInstancesInfo0.next ? 1 : 0)
	for (const [layerId, mapping] of mappingsToConsider) {
		if (mapping.lookahead !== LookaheadMode.NONE) {
			const lookaheadTargetObjects = mapping.lookaheadDepth || 1
			const lookaheadMaxSearchDistance = Math.min(
				parseSearchDistance(mapping.lookaheadMaxSearchDistance),
				futurePartCount
			)

			const lookaheadObjs = findLookaheadForLayer(
				context,
				playoutModel.playlist.currentPartInfo?.partInstanceId ?? null,
				partInstancesInfo,
				previousPartInfo,
				orderedPartInfos,
				layerId,
				lookaheadTargetObjects,
				lookaheadMaxSearchDistance,
				playoutState
			)

			timelineObjs.push(...processResult(lookaheadObjs, mapping.lookahead))
		}
	}
	span2?.end()

	span?.end()
	return timelineObjs
}

// elsewhere uses prefixAllObjectIds to do this, but we want to apply to a single object from itself
const getStartOfObjectRef = (obj: TimelineObjRundown & OnGenerateTimelineObj<any>): string =>
	`#${prefixSingleObjectId(obj, obj.pieceInstanceId ?? '')}.start`
const calculateStartAfterPreviousObj = (
	prevObj: TimelineObjRundown & OnGenerateTimelineObj<any>
): TSR.Timeline.TimelineEnable => {
	const prevHasDelayFlag = (prevObj.classes || []).indexOf('_lookahead_start_delay') !== -1

	// Start with previous piece
	const startOffset = prevHasDelayFlag ? 2000 : 0
	return {
		start: `${getStartOfObjectRef(prevObj)} + ${startOffset}`,
	}
}
function mutateLookaheadObject(
	rawObj: LookaheadTimelineObject,
	i: string,
	enable: TimelineObjRundown['enable'],
	mode: ValidLookaheadMode,
	priority: number,
	disabled: boolean
): LookaheadTimelineObject {
	const obj = clone(rawObj)

	obj.id = `lookahead_${i}_${prefixSingleObjectId(obj, obj.pieceInstanceId)}`
	obj.priority = priority
	obj.enable = enable
	obj.isLookahead = true
	if (obj.keyframes) {
		obj.keyframes = obj.keyframes
			.filter((kf) => kf.preserveForLookahead)
			.map((kf, i) => ({
				...kf,
				id: `${obj.id}_keyframe_${i}`,
			}))
	}
	delete obj.inGroup // force it to be cleared
	obj.disabled = disabled

	if (mode === LookaheadMode.PRELOAD) {
		// Set lookaheadForLayer to reference the original layer:
		updateLookaheadLayer(obj)
	}
	return obj
}

function processResult(lookaheadObjs: LookaheadResult, mode: ValidLookaheadMode): Array<LookaheadTimelineObject> {
	const res: Array<LookaheadTimelineObject> = []

	// Add the objects that have some timing info
	lookaheadObjs.timed.forEach((obj, i) => {
		let enable: TSR.Timeline.TimelineEnable = {
			start: 1, // Absolute 0 without a group doesnt work
		}
		if (i !== 0) {
			const prevObj = lookaheadObjs.timed[i - 1]
			enable = calculateStartAfterPreviousObj(prevObj)
		}
		if (!obj.id) throw new Error('lookahead: timeline obj id not set')

		enable.end = getStartOfObjectRef(obj)

		res.push(mutateLookaheadObject(obj, `timed${i}`, enable, mode, LOOKAHEAD_OBJ_PRIORITY, false))
	})

	// Add each of the future objects, that have no end point
	const futureObjCount = lookaheadObjs.future.length
	const futurePriorityScale = LOOKAHEAD_OBJ_PRIORITY / (futureObjCount + 1)
	lookaheadObjs.future.some((obj, i) => {
		if (!obj.id) throw new Error('lookahead: timeline obj id not set')

		// WHEN_CLEAR mode can't take multiple futures, as they are always flattened into the single layer.
		// so give it some real timings, and only leave one enabled. The rest are added for onTimelineGenerate to do some 'magic'
		const singleEnabledObj = mode === LookaheadMode.WHEN_CLEAR

		const lastTimedObj = _.last(lookaheadObjs.timed)
		const enable =
			singleEnabledObj && i === 0 && lastTimedObj ? calculateStartAfterPreviousObj(lastTimedObj) : { while: '1' }
		// We use while: 1 for the enabler, as any time before it should be active will be filled by either a playing object, or a timed lookahead.
		// And this allows multiple futures to be timed in a way that allows them to co-exist

		// Prioritise so that the earlier ones are higher, decreasing within the range 'reserved' for lookahead
		const priority = futurePriorityScale * (futureObjCount - i)
		res.push(mutateLookaheadObject(obj, `future${i}`, enable, mode, priority, singleEnabledObj && i !== 0))
	})

	return res
}
