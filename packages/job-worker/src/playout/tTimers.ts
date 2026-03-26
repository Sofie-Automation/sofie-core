import type { RundownTTimerIndex, RundownTTimer } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import type { RundownTTimerMode, TimerState } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { getCurrentTime } from '../lib/index.js'
import type { ReadonlyDeep } from 'type-fest'
import * as chrono from 'chrono-node'
import { PartId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { JobContext } from '../jobs/index.js'
import { PlayoutModel } from './model/PlayoutModel.js'
import { getOrderedPartsAfterPlayhead } from './lookahead/util.js'

export function validateTTimerIndex(index: number): asserts index is RundownTTimerIndex {
	if (![1, 2, 3].includes(index)) throw new Error(`T-timer index out of range: ${index}`)
}

/**
 * Returns an updated T-timer in the paused state (if supported)
 * @param timer Timer to update
 * @returns If the timer supports pausing, the timer in paused state, otherwise null
 */
export function pauseTTimer(timer: ReadonlyDeep<RundownTTimer>): ReadonlyDeep<RundownTTimer> | null {
	if (!timer.mode || !timer.state) return null
	if (timer.mode.type === 'countdown' || timer.mode.type === 'freeRun') {
		if (timer.state.paused) {
			// Already paused
			return timer
		}
		return {
			...timer,
			state: { paused: true, duration: timer.state.zeroTime - getCurrentTime() },
		}
	} else {
		return null
	}
}

/**
 * Returns an updated T-timer in the resumed state (if supported)
 * @param timer Timer to update
 * @returns If the timer supports pausing, the timer in resumed state, otherwise null
 */
export function resumeTTimer(timer: ReadonlyDeep<RundownTTimer>): ReadonlyDeep<RundownTTimer> | null {
	if (!timer.mode || !timer.state) return null
	if (timer.mode.type === 'countdown' || timer.mode.type === 'freeRun') {
		if (!timer.state.paused) {
			// Already running
			return timer
		}

		return {
			...timer,
			state: { paused: false, zeroTime: timer.state.duration + getCurrentTime() },
		}
	} else {
		return null
	}
}

/**
 * Returns an updated T-timer, after restarting (if supported)
 * @param timer Timer to update
 * @returns If the timer supports restarting, the restarted timer, otherwise null
 */
export function restartTTimer(timer: ReadonlyDeep<RundownTTimer>): ReadonlyDeep<RundownTTimer> | null {
	if (!timer.mode || !timer.state) return null
	if (timer.mode.type === 'countdown') {
		return {
			...timer,
			state: timer.state.paused
				? { paused: true, duration: timer.mode.duration }
				: { paused: false, zeroTime: getCurrentTime() + timer.mode.duration },
		}
	} else if (timer.mode.type === 'timeOfDay') {
		const nextTime = calculateNextTimeOfDayTarget(timer.mode.targetRaw)
		// If we can't calculate the next time, or it's the same, we can't restart
		if (nextTime === null || (timer.state.paused ? false : nextTime === timer.state.zeroTime)) return null

		return {
			...timer,
			state: { paused: false, zeroTime: nextTime },
		}
	} else {
		return null
	}
}

/**
 * Create a new countdown T-timer mode and initial state
 * @param duration Duration in milliseconds
 * @param options Options for the countdown
 * @returns The created T-timer mode and state
 */
export function createCountdownTTimer(
	duration: number,
	options: {
		stopAtZero: boolean
		startPaused: boolean
	}
): { mode: ReadonlyDeep<RundownTTimerMode>; state: ReadonlyDeep<TimerState> } {
	if (duration <= 0) throw new Error('Duration must be greater than zero')

	return {
		mode: {
			type: 'countdown',
			duration,
			stopAtZero: !!options.stopAtZero,
		},
		state: options.startPaused
			? { paused: true, duration: duration }
			: { paused: false, zeroTime: getCurrentTime() + duration },
	}
}

export function createTimeOfDayTTimer(
	targetTime: string | number,
	options: {
		stopAtZero: boolean
	}
): { mode: ReadonlyDeep<RundownTTimerMode>; state: ReadonlyDeep<TimerState> } {
	const nextTime = calculateNextTimeOfDayTarget(targetTime)
	if (nextTime === null) throw new Error('Unable to parse target time for timeOfDay T-timer')

	return {
		mode: {
			type: 'timeOfDay',
			targetRaw: targetTime,
			stopAtZero: !!options.stopAtZero,
		},
		state: { paused: false, zeroTime: nextTime },
	}
}

/**
 * Create a new free-running T-timer mode and initial state
 * @param options Options for the free-run
 * @returns The created T-timer mode and state
 */
export function createFreeRunTTimer(options: { startPaused: boolean }): {
	mode: ReadonlyDeep<RundownTTimerMode>
	state: ReadonlyDeep<TimerState>
} {
	const now = getCurrentTime()
	return {
		mode: {
			type: 'freeRun',
		},
		state: options.startPaused ? { paused: true, duration: 0 } : { paused: false, zeroTime: now },
	}
}

/**
 * Calculate the next target time for a timeOfDay T-timer
 * @param targetTime The target time, as a string or timestamp number
 * @returns The next target timestamp in milliseconds, or null if it could not be calculated
 */
export function calculateNextTimeOfDayTarget(targetTime: string | number): number | null {
	if (typeof targetTime === 'number') {
		// This should be a unix timestamp
		return targetTime
	}

	// Verify we have a string worth parsing
	if (typeof targetTime !== 'string' || !targetTime) return null

	const parsed = chrono.parseDate(targetTime, undefined, {
		// Always look ahead for the next occurrence
		forwardDate: true,
	})
	return parsed ? parsed.getTime() : null
}

/**
 * Recalculate T-Timer projections based on timing anchors using segment budget timing.
 *
 * Uses a single-pass algorithm with two accumulators:
 * - totalAccumulator: Accumulated time across completed segments
 * - segmentAccumulator: Accumulated time within current segment
 *
 * At each segment boundary:
 * - If segment has a budget → use segment budget duration
 * - Otherwise → use accumulated part durations
 *
 * Handles starting mid-segment with budget by calculating remaining budget time.
 *
 * @param context Job context
 * @param playoutModel The playout model containing the playlist and parts
 */
export function recalculateTTimerProjections(context: JobContext, playoutModel: PlayoutModel): void {
	const span = context.startSpan('recalculateTTimerProjections')

	const playlist = playoutModel.playlist

	const tTimers = playlist.tTimers

	// Find which timers have anchors that need calculation
	const timerAnchors = new Map<PartId, RundownTTimerIndex[]>()
	for (const timer of tTimers) {
		if (timer.anchorPartId) {
			const existingTimers = timerAnchors.get(timer.anchorPartId) ?? []
			existingTimers.push(timer.index)
			timerAnchors.set(timer.anchorPartId, existingTimers)
		}
	}

	// If no timers have anchors, nothing to do
	if (timerAnchors.size === 0) {
		if (span) span.end()
		return
	}

	const currentPartInstance = playoutModel.currentPartInstance?.partInstance

	// Get ordered parts after playhead (excludes previous, current, and next)
	// Use ignoreQuickLoop=true to count parts linearly without loop-back behavior
	const playablePartsSlice = getOrderedPartsAfterPlayhead(context, playoutModel, Infinity, true)

	if (playablePartsSlice.length === 0 && !currentPartInstance) {
		// No parts to iterate through, clear projections
		for (const timer of tTimers) {
			if (timer.anchorPartId) {
				playoutModel.updateTTimer({ ...timer, projectedState: undefined })
			}
		}
		if (span) span.end()
		return
	}

	const now = getCurrentTime()

	// Initialize accumulators
	let totalAccumulator = 0
	let segmentAccumulator = 0
	let isPushing = false
	let currentSegmentId: SegmentId | undefined = undefined
	let currentPartRemainingTime = 0
	let startedInCurrentSegment = false

	// Handle current part/segment
	// TODO: We should consider how to handle the case where the current part is untimed - for now, we just skip it in the calculations
	if (currentPartInstance && !currentPartInstance.part.untimed) {
		currentSegmentId = currentPartInstance.segmentId
		const currentSegment = playoutModel.findSegment(currentPartInstance.segmentId)
		const currentSegmentBudget = currentSegment?.segment.segmentTiming?.budgetDuration

		if (currentSegmentBudget === undefined) {
			// Normal part duration timing
			const currentPartDuration =
				currentPartInstance.part.expectedDurationWithTransition ?? currentPartInstance.part.expectedDuration
			if (currentPartDuration) {
				const currentPartStartedPlayback = currentPartInstance.timings?.plannedStartedPlayback
				const startedPlayback =
					currentPartStartedPlayback && currentPartStartedPlayback <= now ? currentPartStartedPlayback : now
				const playOffset = currentPartInstance.timings?.playOffset || 0
				const elapsed = now - startedPlayback - playOffset
				const remaining = currentPartDuration - elapsed

				isPushing = remaining < 0
				totalAccumulator = Math.max(0, remaining)
				currentPartRemainingTime = totalAccumulator
			}
		} else {
			// Segment budget timing - we're already inside a budgeted segment
			// For parts within the current budgeted segment, calculate based on
			// remaining part durations. When we leave this segment, use the segment budget.
			startedInCurrentSegment = true
			const segmentStartedPlayback =
				playlist.segmentsStartedPlayback?.[currentPartInstance.segmentId as unknown as string]

			// Calculate remaining time in current part
			const currentPartDuration =
				currentPartInstance.part.expectedDurationWithTransition ?? currentPartInstance.part.expectedDuration
			if (currentPartDuration) {
				const currentPartStartedPlayback = currentPartInstance.timings?.plannedStartedPlayback
				const startedPlayback =
					currentPartStartedPlayback && currentPartStartedPlayback <= now ? currentPartStartedPlayback : now
				const playOffset = currentPartInstance.timings?.playOffset || 0
				const elapsed = now - startedPlayback - playOffset
				const partRemaining = currentPartDuration - elapsed
				currentPartRemainingTime = Math.max(0, partRemaining)
				// Set totalAccumulator to current part remaining for correct anchor calculations
				// within the same segment
				totalAccumulator = currentPartRemainingTime
			}

			// Check if we're pushing (segment budget overrun)
			if (segmentStartedPlayback) {
				const segmentElapsed = now - segmentStartedPlayback
				const segmentRemaining = currentSegmentBudget - segmentElapsed
				isPushing = segmentRemaining < 0
			}
		}
	}

	// Add the next part to the beginning of playablePartsSlice
	// getOrderedPartsAfterPlayhead excludes both current and next, so we need to prepend next
	// This allows the loop to handle it normally, including detecting if it's an anchor
	const nextPartInstance = playoutModel.nextPartInstance?.partInstance
	if (nextPartInstance) {
		playablePartsSlice.unshift(nextPartInstance.part)
	}

	// Single pass through parts
	for (const part of playablePartsSlice) {
		// Detect segment boundary
		if (part.segmentId !== currentSegmentId) {
			// Flush previous segment
			if (currentSegmentId !== undefined) {
				const lastSegment = playoutModel.findSegment(currentSegmentId)
				const segmentBudget = lastSegment?.segment.segmentTiming?.budgetDuration

				// Use budget if it exists, otherwise use accumulated part durations
				// BUT: if we started in this segment (budgeted), don't add the budget again
				// because we already accounted for parts via totalAccumulator + segmentAccumulator
				if (segmentBudget !== undefined && !startedInCurrentSegment) {
					totalAccumulator += segmentBudget
				} else {
					totalAccumulator += segmentAccumulator
				}
			}

			// Reset for new segment
			segmentAccumulator = 0
			currentSegmentId = part.segmentId
			startedInCurrentSegment = false
		}

		// Check if this part is an anchor
		const timersForThisPart = timerAnchors.get(part._id)
		if (timersForThisPart) {
			const anchorTime = totalAccumulator + segmentAccumulator

			for (const timerIndex of timersForThisPart) {
				const timer = tTimers[timerIndex - 1]

				const projectedState: TimerState = isPushing
					? literal<TimerState>({
							paused: true,
							duration: anchorTime,
							pauseTime: null, // Already paused/pushing
						})
					: literal<TimerState>({
							paused: false,
							zeroTime: now + anchorTime,
							pauseTime: now + currentPartRemainingTime, // When current part ends and pushing begins
						})

				playoutModel.updateTTimer({ ...timer, projectedState })
			}

			timerAnchors.delete(part._id)
		}

		// Accumulate this part's duration (skip untimed parts)
		if (!part.untimed) {
			const partDuration = part.expectedDurationWithTransition ?? part.expectedDuration ?? 0
			segmentAccumulator += partDuration
		}
	}

	// Clear projections for unresolved anchors
	for (const [, timerIndices] of timerAnchors.entries()) {
		for (const timerIndex of timerIndices) {
			const timer = tTimers[timerIndex - 1]
			playoutModel.updateTTimer({ ...timer, projectedState: undefined })
		}
	}

	if (span) span.end()
}
