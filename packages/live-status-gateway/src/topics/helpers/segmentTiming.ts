import { SegmentTimingInfo } from '@sofie-automation/blueprints-integration'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'

export interface SegmentTiming {
	budgetDurationMs?: number
	expectedDurationMs: number
	countdownType?: 'part_expected_duration' | 'segment_budget_duration'
}

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
	const segmentTiming = calculateSegmentTiming(segmentTimingInfo, segmentParts)
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
	segmentParts: DBPart[]
): SegmentTiming {
	return {
		budgetDurationMs: segmentTimingInfo?.budgetDuration,
		expectedDurationMs: segmentParts.reduce<number>((sum, part): number => {
			return part.expectedDurationWithTransition != null && !part.untimed
				? sum + part.expectedDurationWithTransition
				: sum
		}, 0),
		countdownType: segmentTimingInfo?.countdownType,
	}
}
