import { type TimerState, timerStateToZeroTime } from '@sofie-automation/corelib/dist/dataModel/TimerState'

/**
 * When a timer is projected to reach zero, as seen at `now`: what the gateway sends as a `projectedEndTime`.
 *
 * This reads a timer as corelib's `timerStateToZeroTime` does, apart from a paused timer whose scheduled start
 * (`resumesAt`) is still to come, such as the on-air Part's countdown between a take and the Part's start in
 * multi-gateway mode. `timerStateToZeroTime` reads that one as if it resumed now, which is early by the time left
 * until the start. It holds at its duration until it resumes, and counts down from then, so it reaches zero that
 * duration after its scheduled start: the zero time it will have once it runs.
 */
export function projectedZeroTime(state: TimerState, now: number): number {
	const scheduledStart = state.paused ? state.resumesAt : null
	const isWaitingForScheduledStart = scheduledStart != null && scheduledStart > now

	// from its scheduled start on, its zero time is fixed, so it is read then
	const readAt = isWaitingForScheduledStart ? scheduledStart : now
	return timerStateToZeroTime(state, readAt)
}
