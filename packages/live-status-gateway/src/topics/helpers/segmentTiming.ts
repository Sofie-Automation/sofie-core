import { SegmentTimingInfo } from '@sofie-automation/blueprints-integration'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { SegmentCountdownType, SegmentTiming } from '@sofie-automation/live-status-gateway-api'
import { CountdownType } from '@sofie-automation/blueprints-integration'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/server-core-integration'
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
