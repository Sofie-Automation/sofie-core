import type { PartTimingStateDoc, PlaylistTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
import type { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import type { CurrentPartTiming } from '@sofie-automation/live-status-gateway-api'
import { projectedZeroTime } from './timerState.js'

/**
 * The on-air Part's timing, taken from the `playlistTimingState` publication.
 *
 * `expectedDurationMs` is the *resolved* duration: the Part's expected duration with its transition;
 * where it has none of its own, its recorded duration once it has played, or else its share of a
 * display-duration group; and 0 where it has none of those (never the Studio default). It is not the
 * raw `expectedDuration` off the Part.
 *
 * `startTime` follows Sofie's own timing in using `plannedStartedPlayback`, so that the projected
 * end lines up with the countdowns rather than being a few frames out.
 *
 * `projectedEndTime` is when the On Air countdown reaches zero, read as {@link projectedZeroTime} does.
 * Before the Part has started, that is its planned start plus the length the countdown runs for.
 *
 * The On Air countdown is used only while the playlist's timing describes this PartInstance. Sofie
 * calculates the timing a moment after a take, and until then the countdown is still that of the part
 * before. In that moment the end is the start plus the expected duration, which is also what Sofie
 * publishes for a part that has just been taken.
 */
export function calculateCurrentPartTiming(
	currentPartInstance: DBPartInstance,
	partTiming: PartTimingStateDoc | undefined,
	playlistTiming: PlaylistTimingStateDoc | undefined,
	now: number
): CurrentPartTiming {
	const startTime = currentPartInstance.timings?.plannedStartedPlayback ?? now

	const expectedDurationMs = partTiming?.expectedDuration ?? 0

	const isTimingOfThisPartInstance = playlistTiming?.currentPartInstanceId === currentPartInstance._id
	const onAirCountdown = isTimingOfThisPartInstance ? playlistTiming?.remainingOnCurrentPart : undefined

	return {
		startTime,
		expectedDurationMs,
		projectedEndTime: onAirCountdown ? projectedZeroTime(onAirCountdown, now) : startTime + expectedDurationMs,
	}
}
