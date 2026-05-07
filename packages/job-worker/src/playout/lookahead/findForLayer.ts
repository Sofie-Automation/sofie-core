import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { ReadonlyDeep } from 'type-fest'
import { JobContext } from '../../jobs/index.js'
import { sortPieceInstancesByStart } from '../pieces.js'
import { findLookaheadObjectsForPart, LookaheadTimelineObject } from './findObjects.js'
import { PartAndPieces, PartInstanceAndPieceInstances } from './util.js'
import { TimelinePlayoutState } from '../timeline/lib.js'

export interface LookaheadResult {
	timed: Array<LookaheadTimelineObject>
	future: Array<LookaheadTimelineObject>
}

export interface PartInstanceAndPieceInstancesInfos {
	/** Oldest-first. Each entry is "on timeline" and contributes timed lookahead data. */
	previous: PartInstanceAndPieceInstances[]
	current?: PartInstanceAndPieceInstances
	next?: PartInstanceAndPieceInstances
}

export function findLookaheadForLayer(
	context: JobContext,
	partInstancesInfo: PartInstanceAndPieceInstancesInfos,
	orderedPartInfos: Array<PartAndPieces>,
	layer: string,
	lookaheadTargetFutureObjects: number,
	lookaheadMaxSearchDistance: number,
	playoutState: TimelinePlayoutState,
	nextTimeOffset?: number | null
): LookaheadResult {
	const span = context.startSpan(`findLookaheadForlayer.${layer}`)
	const currentPartId = partInstancesInfo.current?.part._id ?? null
	const res: LookaheadResult = {
		timed: [],
		future: [],
	}

	let previousPart: ReadonlyDeep<DBPart> | undefined
	for (const prevInfo of partInstancesInfo.previous) {
		const { objs: prevObjs, partInfo: prevPartInfo } = generatePartInstanceLookaheads(
			context,
			prevInfo,
			currentPartId,
			layer,
			previousPart,
			playoutState
		)
		if (prevInfo.onTimeline) {
			res.timed.push(...prevObjs)
		} else {
			res.future.push(...prevObjs)
		}
		previousPart = prevPartInfo.part
	}

	// Generate timed/future objects for the partInstances
	if (partInstancesInfo.current) {
		const { objs: currentObjs, partInfo: currentPartInfo } = generatePartInstanceLookaheads(
			context,
			partInstancesInfo.current,
			partInstancesInfo.current.part._id,
			layer,
			previousPart,
			playoutState
		)

		if (partInstancesInfo.current.onTimeline) {
			res.timed.push(...currentObjs)
		} else {
			res.future.push(...currentObjs)
		}
		previousPart = currentPartInfo.part
	}

	let lookaheadMaxSearchDistanceOffset = 0

	// for Lookaheads in the next part we need to take the nextTimeOffset into account.
	if (partInstancesInfo.next) {
		const { objs: nextObjs, partInfo: nextPartInfo } = generatePartInstanceLookaheads(
			context,
			partInstancesInfo.next,
			currentPartId,
			layer,
			previousPart,
			playoutState,
			nextTimeOffset
		)

		if (partInstancesInfo.next?.onTimeline) {
			res.timed.push(...nextObjs)
		} else if (lookaheadMaxSearchDistance >= 1 && lookaheadTargetFutureObjects > 0) {
			res.future.push(...nextObjs)
		}
		previousPart = nextPartInfo.part

		lookaheadMaxSearchDistanceOffset = 1
	}

	if (lookaheadMaxSearchDistance > 1 && lookaheadTargetFutureObjects > 0) {
		for (const partInfo of orderedPartInfos.slice(
			0,
			lookaheadMaxSearchDistance - lookaheadMaxSearchDistanceOffset
		)) {
			// Stop if we have enough objects already
			if (res.future.length >= lookaheadTargetFutureObjects) {
				break
			}

			if (partInfo.pieces.length > 0 && isPartPlayable(partInfo.part)) {
				const objs =
					nextTimeOffset && !partInstancesInfo.next // apply the lookahead offset to the first future if an offset is set.
						? findLookaheadObjectsForPart(
								context,
								currentPartId,
								layer,
								previousPart,
								partInfo,
								null,
								{
									...playoutState,
									// This is beyond the next part, so will be back to not being in hold
									isInHold: false,
									includeWhenNotInHoldObjects: true,
								},
								nextTimeOffset
							)
						: findLookaheadObjectsForPart(context, currentPartId, layer, previousPart, partInfo, null, {
								...playoutState,
								// This is beyond the next part, so will be back to not being in hold
								isInHold: false,
								includeWhenNotInHoldObjects: true,
							})
				res.future.push(...objs)
				previousPart = partInfo.part
			}
		}
	}

	if (span) span.end()
	return res
}
function generatePartInstanceLookaheads(
	context: JobContext,
	partInstanceInfo: PartInstanceAndPieceInstances,
	currentPartInstanceId: PartInstanceId | null,
	layer: string,
	previousPart: ReadonlyDeep<DBPart> | undefined,
	playoutState: TimelinePlayoutState,
	nextTimeOffset?: number | null
): { objs: LookaheadTimelineObject[]; partInfo: PartAndPieces } {
	const partInfo: PartAndPieces = {
		part: partInstanceInfo.part.part,
		usesInTransition: partInstanceInfo.calculatedTimings?.inTransitionStart ? true : false,
		pieces: sortPieceInstancesByStart(partInstanceInfo.allPieces, partInstanceInfo.nowInPart),
	}
	if (nextTimeOffset) {
		return {
			objs: findLookaheadObjectsForPart(
				context,
				currentPartInstanceId,
				layer,
				previousPart,
				partInfo,
				partInstanceInfo.part._id,
				playoutState,
				nextTimeOffset
			),
			partInfo,
		}
	} else {
		return {
			objs: findLookaheadObjectsForPart(
				context,
				currentPartInstanceId,
				layer,
				previousPart,
				partInfo,
				partInstanceInfo.part._id,
				playoutState
			),
			partInfo,
		}
	}
}
