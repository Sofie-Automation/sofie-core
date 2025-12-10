import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { ReadonlyDeep } from 'type-fest'
import { JobContext } from '../../jobs/index.js'
import { sortPieceInstancesByStart } from '../pieces.js'
import { findLookaheadObjectsForPart, LookaheadTimelineObject } from './findObjects.js'
import { PartAndPieces, PartInstanceAndPieceInstances } from './util.js'

export interface LookaheadResult {
	timed: Array<LookaheadTimelineObject>
	future: Array<LookaheadTimelineObject>
}

export interface PartInstanceAndPieceInstancesInfos {
	previous?: PartInstanceAndPieceInstances
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
	nextTimeOffset?: number | null
): LookaheadResult {
	const span = context.startSpan(`findLookaheadForlayer.${layer}`)
	const currentPartId = partInstancesInfo.current?.part._id ?? null
	const res: LookaheadResult = {
		timed: [],
		future: [],
	}

	// Track the previous info for checking how the timeline will be built
	let previousPart: ReadonlyDeep<DBPart> | undefined
	if (partInstancesInfo.previous?.part.part) {
		previousPart = partInstancesInfo.previous.part.part
	}

	// Generate timed/future objects for the partInstances
	if (partInstancesInfo.current) {
		const { objs: currentObjs, partInfo: currentPartInfo } = generatePartInstanceLookaheads(
			context,
			partInstancesInfo.current,
			partInstancesInfo.current.part._id,
			layer,
			previousPart
		)

		if (partInstancesInfo.current.onTimeline) {
			res.timed.push(...currentObjs)
		} else {
			res.future.push(...currentObjs)
		}
		previousPart = currentPartInfo.part
	}

	// for Lookaheads in the next part we need to take the nextTimeOffset into account.
	// TODO: Check if having two pieces after eachother on the same layer is handled correctly
	if (partInstancesInfo.next) {
		const { objs: nextObjs, partInfo: nextPartInfo } = generatePartInstanceLookaheads(
			context,
			partInstancesInfo.next,
			currentPartId,
			layer,
			previousPart,
			nextTimeOffset
		)

		if (partInstancesInfo.next?.onTimeline) {
			res.timed.push(...nextObjs)
		} else if (lookaheadMaxSearchDistance >= 1 && lookaheadTargetFutureObjects > 0) {
			res.future.push(...nextObjs)
		}
		previousPart = nextPartInfo.part
	}

	if (lookaheadMaxSearchDistance > 1 && lookaheadTargetFutureObjects > 0) {
		for (const partInfo of orderedPartInfos.slice(0, lookaheadMaxSearchDistance - 1)) {
			// Stop if we have enough objects already
			if (res.future.length >= lookaheadTargetFutureObjects) {
				break
			}

			if (partInfo.pieces.length > 0 && isPartPlayable(partInfo.part)) {
				const objs = findLookaheadObjectsForPart(context, currentPartId, layer, previousPart, partInfo, null)
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
				partInstanceInfo.part._id
			),
			partInfo,
		}
	}
}
