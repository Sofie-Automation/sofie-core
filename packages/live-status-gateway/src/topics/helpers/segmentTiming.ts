import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'

export interface SegmentTiming {
	budgetDurationMs?: number
	expectedDurationMs: number
	countdownType?: 'part_expected_duration' | 'segment_budget_duration'
}

export interface CurrentSegmentTiming extends SegmentTiming {
	projectedEndTime: number
}

export function calculateCurrentSegmentTiming(
	segment: DBSegment,
	currentPartInstance: DBPartInstance,
	firstInstanceInSegmentPlayout: DBPartInstance | undefined,
	segmentPartInstances: DBPartInstance[],
	segmentParts: DBPart[]
): CurrentSegmentTiming {
	const segmentTiming = calculateSegmentTiming(segment, segmentParts)
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

export function calculateSegmentTiming(segment: DBSegment, segmentParts: DBPart[]): SegmentTiming {
	return {
		budgetDurationMs: segment.segmentTiming?.budgetDuration,
		expectedDurationMs: segmentParts.reduce<number>((sum, part): number => {
			return part.expectedDurationWithTransition != null && !part.untimed
				? sum + part.expectedDurationWithTransition
				: sum
		}, 0),
		countdownType: segment.segmentTiming?.countdownType,
	}
}
