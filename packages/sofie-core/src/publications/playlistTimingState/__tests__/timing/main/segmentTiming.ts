/**
 * Main's gateway timing of a segment, frozen for the comparison with main: copied unchanged from
 * packages/live-status-gateway/src/topics/helpers/segmentTiming.ts at main d40ae733fefdd831ce614792b65e8434778b2757.
 * Only imports differ: the gateway API's types are the frozen copy next to this file, and unprotectString is
 * corelib's, which the server-core-integration package the gateway imported it from passes on.
 *
 * The timing publication rewrote these helpers to read the timing documents. Main's gateway sent
 * calculateCurrentSegmentTiming as the activePlaylist topic's currentSegment.timing, and calculateSegmentTiming as
 * each segment's timing in the segments topic. To see that it is unchanged:
 *
 *   git diff d40ae733f:packages/live-status-gateway/src/topics/helpers/segmentTiming.ts \
 *     HEAD:packages/sofie-core/src/publications/playlistTimingState/__tests__/timing/main/segmentTiming.ts
 */

import { SegmentTimingInfo } from '@sofie-automation/blueprints-integration'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { SegmentCountdownType, SegmentTiming } from './liveStatusGatewayApi'
import { CountdownType } from '@sofie-automation/blueprints-integration'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import * as _ from 'underscore'

export interface CurrentSegmentTiming extends SegmentTiming {
	projectedEndTime: number
}

export function calculateCurrentSegmentTiming(
	segmentTimingInfo: SegmentTimingInfo | undefined,
	currentPartInstance: DBPartInstance,
	firstInstanceInSegmentPlayout: DBPartInstance | undefined,
	segmentPartInstances: DBPartInstance[],
	segmentParts: DBPart[]
): CurrentSegmentTiming {
	const segmentTiming = calculateSegmentTiming(segmentTimingInfo, segmentPartInstances, segmentParts)
	const playedDurations = segmentPartInstances.reduce((sum, partInstance) => {
		return (partInstance.timings?.duration ?? 0) + sum
	}, 0)
	const currentPartInstanceStart =
		currentPartInstance.timings?.reportedStartedPlayback ??
		currentPartInstance.timings?.plannedStartedPlayback ??
		Date.now()
	const leftToPlay = segmentTiming.expectedDurationMs - playedDurations
	const projectedEndTime = leftToPlay + currentPartInstanceStart
	const projectedBudgetEndTime =
		(firstInstanceInSegmentPlayout?.timings?.reportedStartedPlayback ??
			firstInstanceInSegmentPlayout?.timings?.plannedStartedPlayback ??
			Date.now()) + (segmentTiming.budgetDurationMs ?? 0)
	return {
		...segmentTiming,
		projectedEndTime: segmentTiming.budgetDurationMs != null ? projectedBudgetEndTime : projectedEndTime,
	}
}

export function calculateSegmentTiming(
	segmentTimingInfo: SegmentTimingInfo | undefined,
	segmentPartInstances: DBPartInstance[],
	segmentParts: DBPart[]
): SegmentTiming {
	// This might be a premature optimization, at least when the number of partInstances is reasonable.
	// Should we consider a separate path dependent on the length of the array?
	const partInstancesByPartId: Record<string, DBPartInstance> = _.indexBy(segmentPartInstances, (partInstance) =>
		unprotectString(partInstance.part._id)
	)
	return {
		budgetDurationMs: segmentTimingInfo?.budgetDuration,
		expectedDurationMs: segmentParts.reduce<number>((sum, part): number => {
			part = partInstancesByPartId[unprotectString(part._id)]?.part ?? part
			return part.expectedDurationWithTransition != null && !part.untimed
				? sum + part.expectedDurationWithTransition
				: sum
		}, 0),
		countdownType: translateSegmentCountdownType(segmentTimingInfo?.countdownType),
	}
}

function translateSegmentCountdownType(type: CountdownType | undefined): SegmentCountdownType | undefined {
	switch (type) {
		case undefined:
			return undefined
		case CountdownType.PART_EXPECTED_DURATION:
			return SegmentCountdownType.PART_EXPECTED_DURATION
		case CountdownType.SEGMENT_BUDGET_DURATION:
			return SegmentCountdownType.SEGMENT_BUDGET_DURATION
		default:
			assertNever(type)
			// Cast and return the value anyway, so that the application works
			return type as any as SegmentCountdownType
	}
}
