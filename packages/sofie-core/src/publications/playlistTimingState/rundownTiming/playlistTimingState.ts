/**
 * Assembles the playlist-level timing values as TimerStates (a PlaylistTimingStateDoc), for
 * publishing over DDP (the `playlistTimingState` publication).
 *
 * There is deliberately no timing math of its own in this module:
 * - the time-dependence of the playlist aggregates lives inside RundownTimingCalculator
 *   (`remainingPlaylistDurationState` / `livePushTime` on the RundownTimingContext)
 * - the remaining/estimated-end shapes live in `PlaylistTiming.getRemainingDurationState` /
 *   `getEstimatedEndState` (of which the old numeric helpers are evaluations)
 * - the over/under balance is composed here as a target/projected TimerState pair, and
 *   `getPlaylistTimingDiff` is its evaluation at `now` — there is no separate diff formula.
 *
 * Consumers evaluate the published states locally with `timerStateToDuration` /
 * `timerStateToZeroTime`; the server only needs to republish when playout or ingest state changes.
 */

import {
	type TimerState,
	timerStateToDuration,
	timerStateToZeroTime,
} from '@sofie-automation/corelib/dist/dataModel/TimerState'
import type { PlaylistTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { RundownTimingCalculator, type RundownTimingContext, type TimingId } from './index'

type CalculateTimingsPartInstance = Pick<
	PartInstance,
	'_id' | 'isTemporary' | 'segmentId' | 'segmentPlayoutId' | 'orphaned' | 'timings' | 'part'
>

/** The timing value fields of a PlaylistTimingStateDoc (without the document envelope) */
export type PlaylistTimingStateValues = Omit<PlaylistTimingStateDoc, '_id' | 'type' | 'playlistId'>

/**
 * Calculate the playlist timing values as TimerStates for a given point in time.
 *
 * @param now Current timestamp. The returned states are anchored to this time, and remain valid
 *   until the next playout/ingest state change (at which point this should be re-run).
 * @param playlist The playlist
 * @param partInstances Sorted PartInstances (with unplayed Parts wrapped as temporary instances),
 *   as fed to RundownTimingCalculator
 * @param segmentsMap Segments of the playlist, in playlist order
 * @param defaultDuration Fallback duration for Parts without a duration of their own
 *   (the Studio's `defaultDisplayDuration`)
 * @param partsInQuickLoop As produced by findPartInstancesInQuickLoop
 */
export function calculatePlaylistTimingStates(
	now: number,
	playlist: DBRundownPlaylist,
	partInstances: CalculateTimingsPartInstance[],
	segmentsMap: Map<SegmentId, DBSegment>,
	defaultDuration: number,
	partsInQuickLoop: Record<TimingId, boolean>
): PlaylistTimingStateValues {
	const timingContext = new RundownTimingCalculator().updateDurations(
		now,
		false,
		playlist,
		partInstances,
		segmentsMap,
		defaultDuration,
		partsInQuickLoop
	)

	return calculatePlaylistTimingStatesFromContext(now, playlist, timingContext)
}

/**
 * Assemble the playlist timing values from a RundownTimingContext calculated at `now`.
 */
export function calculatePlaylistTimingStatesFromContext(
	now: number,
	playlist: DBRundownPlaylist,
	timingContext: RundownTimingContext
): PlaylistTimingStateValues {
	const timing = playlist.timing

	const expectedStart = PlaylistTiming.getExpectedStart(timing)
	const expectedEnd = PlaylistTiming.getExpectedEnd(timing)
	const expectedDuration = PlaylistTiming.getExpectedDuration(timing)

	// Matching the header components: `Started` (and the started-based projections) are only
	// shown while the playlist is active
	const startedPlayback = playlist.activationId ? playlist.startedPlayback : undefined

	// Matching the header's hide rule: an untimed playlist with no expected duration that has
	// never been played has no meaningful over/under
	const overUnderIsMeaningful = !(
		PlaylistTiming.isPlaylistTimingNone(timing) &&
		expectedDuration === undefined &&
		!playlist.startedPlayback
	)

	// Identities, so consumers can tell whether the on-air timers are about the part or segment
	// they are rendering
	const currentPartInstanceId = timingContext.currentPartInstanceId ?? undefined
	const currentSegmentId = timingContext.currentSegmentId ?? undefined
	const remainingOnCurrentPart = timingContext.remainingTimeOnCurrentPartState
	const remainingBudgetOnCurrentSegment = timingContext.remainingBudgetOnCurrentSegmentState

	const remainingDuration = PlaylistTiming.getRemainingDurationState(
		timing,
		timingContext.remainingPlaylistDurationState,
		startedPlayback
	)
	const estimatedEnd = PlaylistTiming.getEstimatedEndState(
		timing,
		now,
		remainingCountedFromTheTake(now, timingContext),
		startedPlayback
	)

	const values: PlaylistTimingStateValues = {
		timingType: timing.type,
		currentPartWillAutoNext: timingContext.currentPartWillAutoNext ?? false,
		partCountdownBase: timingContext.partCountdownBase,
	}

	// A value the playlist does not have is left out, rather than set to undefined (see
	// `computeTimingState` in publication.ts for why)
	if (currentPartInstanceId !== undefined) values.currentPartInstanceId = currentPartInstanceId
	if (currentSegmentId !== undefined) values.currentSegmentId = currentSegmentId
	if (remainingOnCurrentPart !== undefined) values.remainingOnCurrentPart = remainingOnCurrentPart
	if (remainingBudgetOnCurrentSegment !== undefined) {
		values.remainingBudgetOnCurrentSegment = remainingBudgetOnCurrentSegment
	}

	if (expectedStart !== undefined) values.plannedStart = { paused: false, zeroTime: expectedStart }
	if (expectedEnd !== undefined) values.plannedEnd = { paused: false, zeroTime: expectedEnd }
	if (expectedDuration !== undefined) values.plannedDuration = { paused: true, duration: expectedDuration }
	if (startedPlayback !== undefined) values.startedPlayback = { paused: false, zeroTime: startedPlayback }

	if (remainingDuration !== undefined) values.remainingDuration = remainingDuration
	if (estimatedEnd !== undefined) values.estimatedEnd = estimatedEnd
	if (overUnderIsMeaningful) values.overUnder = calculateOverUnderState(now, playlist, timingContext)

	return values
}

/**
 * The remaining duration from which the estimated end and the over/under count.
 *
 * Between a take and the playout gateway's report that the taken part started, the remaining duration holds at the
 * part's full length. Now + remaining would then grow with the clock, and fall back when the start is reported: a
 * screen showed one second more for a moment, then the second before. Here the remaining duration counts from the
 * later of the take and the planned end of the part that was on air before it. That is the moment from which the
 * estimated end counted just before the take: the part that was on air played to its planned end, or it ran over and
 * the estimated end moved with the clock up to the take. So the estimated end keeps its value from before the take,
 * and changes only once, when the start is reported. The published remaining duration itself still holds, so it does
 * not fall back either.
 */
function remainingCountedFromTheTake(now: number, timingContext: RundownTimingContext): TimerState | undefined {
	const remainingState = timingContext.remainingPlaylistDurationState
	const takenAt = timingContext.onAirPartTakenAt
	const isWaitingForTheStart =
		takenAt !== undefined &&
		takenAt <= now &&
		remainingState !== undefined &&
		remainingState.paused &&
		remainingState.resumesAt == null
	if (!isWaitingForTheStart) return remainingState

	const countsFrom = Math.max(takenAt, timingContext.previousPartPlannedEnd ?? takenAt)
	return { paused: false, zeroTime: countsFrom + timerStateToDuration(remainingState, now) }
}

/**
 * Calculate the over/under diff of a playlist against its planned timing, by evaluating the
 * published over/under state at `now`. This is the same number the published state yields.
 * @param fallbackCurrentTime Used as "now" if the timingContext does not carry a currentTime of its own
 */
export function getPlaylistTimingDiff(
	playlist: Pick<DBRundownPlaylist, 'timing' | 'startedPlayback' | 'activationId'>,
	timingContext: RundownTimingContext,
	fallbackCurrentTime: number
): number | undefined {
	const now = timingContext.currentTime || fallbackCurrentTime

	// the published state reads as time in hand, the diff is over-positive
	// (subtracting rather than negating, so that a balanced playlist gives 0 rather than -0)
	return 0 - timerStateToDuration(calculateOverUnderState(now, playlist, timingContext), now)
}

/**
 * The schedule balance of the playlist, as a single TimerState whose duration read is the time in
 * hand (positive = under/ahead of schedule, negative = over).
 *
 * The balance holds steady while the playlist is on schedule and burns down 1:1 once it starts
 * pushing, which is exactly a paused timer with a scheduled start. It is derived here from the
 * playlist's target and projected end times, whose difference is piecewise-linear with slope 0
 * (on schedule) or -1 (consuming slack), changing at most once.
 */
function calculateOverUnderState(
	now: number,
	playlist: Pick<DBRundownPlaylist, 'timing' | 'startedPlayback' | 'activationId'>,
	timingContext: RundownTimingContext
): TimerState {
	const { target, projected } = calculateOverUnderAnchors(now, playlist, timingContext)

	const timeInHandAt = (time: number) => timerStateToZeroTime(target, time) - timerStateToZeroTime(projected, time)
	const timeInHand = timeInHandAt(now)

	if (timeInHandAt(now + 1) < timeInHand) {
		// Already pushing: the balance is being consumed right now
		return { paused: false, zeroTime: now + timeInHand }
	}

	// Otherwise the balance holds until one of the anchors starts moving without the other
	const candidateBreakpoints = [target.pauseTime, projected.pauseTime]
		.filter((breakpoint): breakpoint is number => breakpoint != null && breakpoint > now)
		.sort((a, b) => a - b)
	for (const breakpoint of candidateBreakpoints) {
		if (timeInHandAt(breakpoint + 1) < timeInHandAt(breakpoint)) {
			return { paused: true, duration: timeInHand, resumesAt: breakpoint }
		}
	}

	// On schedule with nothing due to change it
	return { paused: true, duration: timeInHand }
}

/**
 * The two end times the schedule balance is the difference between (both read via
 * `timerStateToZeroTime`): time in hand = target - projected.
 *
 * For end-anchored modes (ForwardTime/BackTime while relevant), target is the (derived) planned
 * end and projected is the estimated end.
 * For duration-compared modes (None/Duration, and any played-out & deactivated playlist), both
 * are virtual end timestamps built on a common base: target = base + plannedDuration,
 * projected = base + asPlayedDuration.
 */
function calculateOverUnderAnchors(
	now: number,
	playlist: Pick<DBRundownPlaylist, 'timing' | 'startedPlayback' | 'activationId'>,
	timingContext: RundownTimingContext
): { target: TimerState; projected: TimerState } {
	const { timing, startedPlayback, activationId } = playlist
	const active = !!activationId

	const asPlayed = timingContext.asPlayedPlaylistDuration || 0
	const plannedDuration = timing.expectedDuration ?? timingContext.totalPlaylistDuration ?? 0

	const playedOutAndDeactivated = !active && !!startedPlayback

	// All duration-compared cases: diff = asPlayed - plannedDuration
	if (
		PlaylistTiming.isPlaylistTimingNone(timing) ||
		PlaylistTiming.isPlaylistDurationTimed(timing) ||
		(playedOutAndDeactivated && !(PlaylistTiming.isPlaylistTimingForwardTime(timing) && timing.expectedEnd))
	) {
		const base = startedPlayback ?? now
		return {
			target: { paused: false, zeroTime: base + plannedDuration },
			projected: projectedAsPlayedEnd(now, base, asPlayed, playedOutAndDeactivated ? undefined : timingContext),
		}
	}

	// Played out & deactivated ForwardTime with a firm expectedEnd:
	// diff = startedPlayback + asPlayed - expectedEnd
	if (playedOutAndDeactivated && PlaylistTiming.isPlaylistTimingForwardTime(timing) && timing.expectedEnd) {
		// startedPlayback is set here (playedOutAndDeactivated)
		const base = startedPlayback ?? now
		return {
			target: { paused: false, zeroTime: timing.expectedEnd },
			projected: projectedAsPlayedEnd(now, base, asPlayed, undefined),
		}
	}

	// End-anchored modes: diff = frontAnchor + remaining - backAnchor
	const remaining = timingContext.remainingPlaylistDuration || 0
	const remainingState: TimerState = remainingCountedFromTheTake(now, timingContext) ?? {
		paused: true,
		duration: remaining,
	}

	// Before the playlist has started, the remaining duration can already be counting down, so that
	// now + remaining holds (see the calculator): from the first take until the start of its Part is
	// reported, when the take plans that start (a take in a multi-gateway studio schedules it a little
	// ahead, and a take with a time offset plans it in the past), and while an untimed opening Part plays
	// in a segment with a budget
	const remainingCountsDownBeforeTheStart = startedPlayback === undefined && !remainingState.paused

	let target: TimerState
	if (PlaylistTiming.isPlaylistTimingBackTime(timing)) {
		target = { paused: false, zeroTime: timing.expectedEnd }
	} else if (PlaylistTiming.isPlaylistTimingForwardTime(timing)) {
		if (timing.expectedEnd !== undefined) {
			target = { paused: false, zeroTime: timing.expectedEnd }
		} else if (startedPlayback !== undefined) {
			// backAnchor = startedPlayback + plannedDuration: constant
			target = { paused: false, zeroTime: startedPlayback + plannedDuration }
		} else if (
			remainingCountsDownBeforeTheStart &&
			(timingContext.onAirPartPlannedStart ?? timingContext.onAirPartTakenAt) !== undefined
		) {
			// The on-air Part's own countdown drives the remaining duration, and the playlist starts when
			// that Part does: backAnchor = its planned start (or its take, while it waits for its start)
			// + plannedDuration: constant
			const playlistStart = timingContext.onAirPartPlannedStart ?? timingContext.onAirPartTakenAt ?? now
			target = { paused: false, zeroTime: playlistStart + plannedDuration }
		} else if (timing.expectedStart > now) {
			// backAnchor = expectedStart + plannedDuration until the planned start passes, then pushes
			target = {
				paused: false,
				zeroTime: timing.expectedStart + plannedDuration,
				pauseTime: timing.expectedStart,
			}
		} else {
			// backAnchor = now + plannedDuration: pushes 1:1
			target = { paused: true, duration: plannedDuration }
		}
	} else {
		// (unreachable: None/Duration handled above)
		target = { paused: true, duration: plannedDuration }
	}

	// projected = frontAnchor + remaining
	let projected: TimerState
	if (startedPlayback !== undefined && startedPlayback <= now) {
		// frontAnchor = now: projected = now + remaining, which is exactly the remaining-duration
		// state read through timerStateToZeroTime
		projected = remainingState
	} else if (remainingCountsDownBeforeTheStart) {
		// frontAnchor = now as well: projected = now + remaining holds while the remaining duration
		// counts down
		projected = remainingState
	} else {
		// Not started: frontAnchor = max(now, expectedStart) for ForwardTime, now otherwise
		// (remaining is constant while nothing counts it down)
		const frontStart = PlaylistTiming.isPlaylistTimingForwardTime(timing)
			? Math.max(timing.expectedStart, now)
			: now
		if (frontStart > now) {
			projected = { paused: false, zeroTime: frontStart + remaining, pauseTime: frontStart }
		} else {
			projected = { paused: true, duration: remaining }
		}
	}

	return { target, projected }
}

/**
 * A TimerState whose zeroTime read equals `base + asPlayed(t)`:
 * constant until the on-air part/segment overruns (as-played grows by planned durations only),
 * then pushing 1:1 (the on-air term is `max(expected, elapsed)`).
 *
 * @param timingContext Context carrying the live breakpoint; pass undefined when as-played can no
 *   longer move (e.g. the playlist has been deactivated)
 */
function projectedAsPlayedEnd(
	now: number,
	base: number,
	asPlayedNow: number,
	timingContext: RundownTimingContext | undefined
): TimerState {
	const pushTime = timingContext?.livePushTime
	if (pushTime !== undefined && now >= pushTime) {
		// Already pushing: the zeroTime read of a paused state is `t + duration`, moving 1:1 with
		// time. Anchor the duration so that at t = now the read equals base + asPlayedNow.
		return { paused: true, duration: base + asPlayedNow - now }
	}
	if (pushTime !== undefined) {
		// Constant until pushTime, then pushes
		return { paused: false, zeroTime: base + asPlayedNow, pauseTime: pushTime }
	}
	// Constant
	return { paused: false, zeroTime: base + asPlayedNow }
}
