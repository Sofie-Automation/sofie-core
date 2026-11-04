import type { PartTimingStateDoc, PlaylistTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
import type { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { offsetTimerState, type TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { CurrentPartTiming, PartTiming } from '@sofie-automation/live-status-gateway-api'
import { projectedZeroTime } from './timerState.js'

/**
 * A Part's timing, as Sofie resolved and published it.
 *
 * The timers are forwarded rather than evaluated: the client reads them against its own clock, so
 * the gateway sends on playout events instead of on a tick. The durations do not move with the clock,
 * so they are published, and sent on, as plain numbers.
 */
export function toPartTiming(
	timing: PartTimingStateDoc,
	playlistTiming: PlaylistTimingStateDoc | undefined
): PartTiming {
	return {
		id: unprotectString(timing.partId),
		instanceId: timing.partInstanceId ? unprotectString(timing.partInstanceId) : null,
		segmentId: unprotectString(timing.segmentId),
		rank: timing.rank,
		expectedDurationMs: timing.expectedDuration ?? 0,
		displayDurationMs: timing.displayDuration ?? 0,
		isInQuickLoop: timing.isInQuickLoop,
		countsTowardsTiming: timing.countsTowardsTiming,
		countdown: toPartCountdown(timing, playlistTiming),
		played: timing.played,
		duration: timing.duration,
		liveDisplayDuration: timing.liveDisplayDuration,
	}
}

/**
 * The countdown until the Part goes on air: the playlist's base for the Part countdowns, shifted by the Part's offset.
 * Undefined when the Part has no offset, as it will probably not be played out if the rundown is played in order, and
 * when the playlist's timing is not that of the Part's playlist: after a switch of playlist, the previous playlist's
 * document can still be held until the new subscription delivers.
 */
function toPartCountdown(
	timing: PartTimingStateDoc,
	playlistTiming: PlaylistTimingStateDoc | undefined
): TimerState | undefined {
	const countdownOffset = timing.countdownOffset
	if (countdownOffset === undefined || !playlistTiming) return undefined

	const isOfThePartsPlaylist = playlistTiming.playlistId === timing.playlistId
	if (!isOfThePartsPlaylist) return undefined

	return offsetTimerState(playlistTiming.partCountdownBase, countdownOffset)
}

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
