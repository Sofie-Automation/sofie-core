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

export function findLookaheadForLayer(
	context: JobContext,
	currentPartInstanceId: PartInstanceId | null,
	partInstancesInfo: PartInstanceAndPieceInstances[],
	previousPartInstanceInfo: PartInstanceAndPieceInstances | undefined,
	orderedPartInfos: Array<PartAndPieces>,
	layer: string,
	lookaheadTargetFutureObjects: number,
	lookaheadMaxSearchDistance: number,
	playoutState: TimelinePlayoutState
): LookaheadResult {
	const span = context.startSpan(`findLookaheadForlayer.${layer}`)
	const res: LookaheadResult = {
		timed: [],
		future: [],
	}

	// Track the previous info for checking how the timeline will be built
	let previousPart: ReadonlyDeep<DBPart> | undefined
	if (previousPartInstanceInfo) {
		previousPart = previousPartInstanceInfo.part.part
	}

	// Generate timed/future objects for the partInstances
	for (const partInstanceInfo of partInstancesInfo) {
		if (!partInstanceInfo.onTimeline && lookaheadMaxSearchDistance <= 0) break

		const partInfo: PartAndPieces = {
			part: partInstanceInfo.part.part,
			usesInTransition: partInstanceInfo.calculatedTimings.inTransitionStart !== null,
			pieces: sortPieceInstancesByStart(partInstanceInfo.allPieces, partInstanceInfo.nowInPart),
		}

		const objs = findLookaheadObjectsForPart(
			context,
			currentPartInstanceId,
			layer,
			previousPart,
			partInfo,
			partInstanceInfo.part._id,
			playoutState
		)

		if (partInstanceInfo.onTimeline) {
			res.timed.push(...objs)
		} else {
			res.future.push(...objs)
		}

		previousPart = partInfo.part
	}

	if (lookaheadMaxSearchDistance > 1 && lookaheadTargetFutureObjects > 0) {
		for (const partInfo of orderedPartInfos.slice(0, lookaheadMaxSearchDistance - 1)) {
			// Stop if we have enough objects already
			if (res.future.length >= lookaheadTargetFutureObjects) {
				break
			}

			if (partInfo.pieces.length > 0 && isPartPlayable(partInfo.part)) {
				const objs = findLookaheadObjectsForPart(
					context,
					currentPartInstanceId,
					layer,
					previousPart,
					partInfo,
					null,
					{
						...playoutState,
						// This is beyond the next part, so will be back to not being in hold
						isInHold: false,
						includeWhenNotInHoldObjects: true,
					}
				)
				res.future.push(...objs)
				previousPart = partInfo.part
			}
		}
	}

	if (span) span.end()
	return res
}
