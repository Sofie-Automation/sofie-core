import type { CountdownType, PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { ProtectedString, protectString } from '../protectedString.js'
import type { PartId, PartInstanceId, RundownPlaylistId, SegmentId } from './Ids.js'
import type { TimerState } from './TimerState.js'

export type TimingStateDocId = ProtectedString<'TimingStateDoc'>

/**
 * A document published by the `playlistTimingState` publication, which carries the timing state of
 * everything within a RundownPlaylist.
 *
 * Every timing value is expressed as a `TimerState` — a piecewise-linear function of wall-clock time —
 * so that consumers can evaluate the current value locally (via `timerStateToDuration` /
 * `timerStateToZeroTime`) and the server only needs to publish updates when playout or ingest state
 * changes, never on a clock tick.
 *
 * This is a discriminated union, keyed on `type`, with one document per "area": the playlist, each
 * segment and each part. Consumers must narrow on `type` (e.g. with `isPlaylistTimingStateDoc`)
 * rather than assuming a shape, and must include `type` in any projection they use.
 */
export type TimingStateDoc = PlaylistTimingStateDoc | SegmentTimingStateDoc | PartTimingStateDoc

/**
 * Playlist-level timing values: the timers shown in the rundown header.
 */
export interface PlaylistTimingStateDoc {
	_id: TimingStateDocId
	type: 'playlist'
	playlistId: RundownPlaylistId

	/** Which timing mode the playlist is in (None/ForwardTime/BackTime/Duration) */
	timingType: PlaylistTimingType

	/**
	 * Planned start of the playlist.
	 * zeroTime read = the planned start timestamp ("Plan. Start"),
	 * duration read = countdown until the planned start ("Start In").
	 * Omitted if the playlist has no (derivable) planned start.
	 */
	plannedStart?: TimerState

	/**
	 * Planned end of the playlist.
	 * zeroTime read = the planned end timestamp ("Plan. End").
	 * Omitted if the playlist has no (derivable) planned end.
	 */
	plannedEnd?: TimerState

	/**
	 * Planned duration of the playlist ("Plan. Dur").
	 * Always paused (a constant duration read).
	 * Omitted if the playlist has no planned duration.
	 */
	plannedDuration?: TimerState

	/**
	 * Actual start of playback (only present while the playlist is active, matching the header behavior).
	 * zeroTime read = the startedPlayback timestamp ("Started").
	 */
	startedPlayback?: TimerState

	/**
	 * Remaining content duration of the playlist.
	 * duration read = time remaining ("Rem. Dur").
	 * pauseTime = the expected end of the on-air part: once the on-air part overruns,
	 * the remaining duration freezes (the equivalent of the old client-side `max(0, …)` clamp).
	 */
	remainingDuration?: TimerState

	/**
	 * Estimated end of the playlist.
	 * zeroTime read = the projected end timestamp ("Est. End").
	 * While the on-air part is overrunning (past pauseTime) the estimate pushes 1:1 with time.
	 * Kept separate from remainingDuration: before playback with a future planned start,
	 * the estimated end is fixed while the remaining duration is also fixed — a single state
	 * cannot express both a constant timestamp and a constant duration at once.
	 */
	estimatedEnd?: TimerState

	/**
	 * The on-air PartInstance, if any. Consumers that render a specific part should compare this
	 * before using the on-air timers below, so that they never show another part's numbers.
	 */
	currentPartInstanceId?: PartInstanceId
	/** The on-air Segment, if any. Same purpose, for segment-scoped consumers. */
	currentSegmentId?: SegmentId

	/**
	 * Time left of the on-air part ("On Air").
	 * duration read = time remaining, going negative once the part overruns - it is deliberately
	 * not clamped, because overrunning is what the display highlights.
	 * Holds at the part's full duration until the part actually starts (`resumesAt`), which is the
	 * window after a take in a multi-gateway studio.
	 */
	remainingOnCurrentPart?: TimerState
	/**
	 * Time left of the on-air segment's budget ("Seg. Budg.").
	 * Omitted unless the on-air segment uses `CountdownType.SEGMENT_BUDGET_DURATION` - consumers
	 * hide the display when it is absent.
	 */
	remainingBudgetOnCurrentSegment?: TimerState

	/** Whether the on-air Part will auto-next out of itself */
	currentPartWillAutoNext: boolean

	/**
	 * The timer that every Part's countdown is a shift of. It has no meaning of its own, and no display
	 * shows it. A Part's countdown is
	 *   offsetTimerState(playlist.partCountdownBase, part.countdownOffset)
	 * using `offsetTimerState` from TimerState.ts, and a Part without a `countdownOffset` has no countdown.
	 */
	partCountdownBase: TimerState

	/**
	 * Schedule balance ("Over"/"Under").
	 * duration read = the time in hand: positive = under (ahead of schedule), negative = over.
	 * The UI's over-positive diff is therefore `-timerStateToDuration(overUnder, now)`.
	 *
	 * The balance holds steady while the playlist is on schedule and burns down 1:1 once it starts
	 * pushing, so `resumesAt` is the moment it starts being consumed.
	 *
	 * Omitted when not meaningful (an untimed playlist with no expected duration that has never
	 * been played) — consumers should hide the Over/Under display in that case.
	 */
	overUnder?: TimerState
}

/**
 * Timing values for a single Segment: what the segment duration displays show.
 */
export interface SegmentTimingStateDoc {
	_id: TimingStateDocId
	type: 'segment'
	playlistId: RundownPlaylistId
	segmentId: SegmentId

	/** Which countdown this segment uses. Consumers need it for the hard-floor display rule. */
	countdownType: CountdownType

	/**
	 * The segment's planned length: its budget duration, or the sum of its parts' expected
	 * durations when it has no budget. Constant - duration read.
	 */
	plannedDuration?: TimerState
	/**
	 * How much of the segment has played out. duration read = the elapsed time, counting up as a
	 * negative value while the segment is on air (the usual count-up convention).
	 */
	playedOut?: TimerState
	/**
	 * What is left of the segment. duration read = time remaining, going negative once over.
	 * For a budgeted segment this is the budget countdown; otherwise planned minus played out.
	 */
	remaining?: TimerState
}

/**
 * Timing values for a single Part.
 *
 * The static fields here are the *resolved* durations - the whole cascade of fallbacks (recorded
 * duration, expected duration with transition, the Part's share of its display-duration group, the
 * Studio default) has already been applied. A consumer takes the number it wants and needs to know
 * none of that.
 */
export interface PartTimingStateDoc {
	_id: TimingStateDocId
	type: 'part'
	playlistId: RundownPlaylistId
	segmentId: SegmentId
	partId: PartId
	/**
	 * The PartInstance this describes, when there is one. Absent for Parts that have not been played.
	 * Note that most timing values are keyed by PartInstance where one exists and by Part otherwise,
	 * which is why both ids are carried here.
	 */
	partInstanceId?: PartInstanceId

	/**
	 * Position in the playout order, counting from 0.
	 * Documents have no inherent order, and several displays need "the parts in order" or "the first
	 * part", so this carries the order that the publication resolved them in.
	 */
	rank: number

	/** Whether the Part is inside the QuickLoop */
	isInQuickLoop: boolean

	/**
	 * Whether this Part contributes to the playlist and rundown totals. False for Parts that will be
	 * skipped if the rundown is played in order, unless the playlist allows out-of-order timing.
	 */
	countsTowardsTiming: boolean

	/**
	 * Whether the Part is untimed, as set on the Part. An untimed Part still has its own
	 * `expectedDuration` here, but it is left out of the playlist and segment totals, and so has to be
	 * left out of any total a consumer adds up from the Parts.
	 */
	untimed: boolean

	/**
	 * Whether the PartInstance is orphaned: there is no Part for it in the rundown, because it was
	 * created by an adlib, or because its Part has been removed from the rundown since. An orphaned Part
	 * still has its own `expectedDuration` here, but it is not part of the Segment as planned, so it is
	 * left out of the segment totals, and has to be left out of any segment total a consumer adds up
	 * from the Parts.
	 */
	orphaned: boolean

	/**
	 * The Part's expected duration, resolved. Constant - duration read, positive.
	 */
	expectedDuration?: TimerState

	/**
	 * How long the Part occupies in the rundown display, resolved, as if it were not playing.
	 * Constant - duration read, positive. See `liveDisplayDuration` for the on-air value.
	 */
	displayDuration?: TimerState

	/**
	 * Where this Part's countdown is against the playlist document's `partCountdownBase`, in ms. The
	 * number alone has no meaning; the countdown until this Part goes on air is
	 *   offsetTimerState(playlist.partCountdownBase, part.countdownOffset)
	 * using `offsetTimerState` from TimerState.ts. Its duration read is the time until the Part starts,
	 * holding at the Part's own wait once the on-air Part has overrun (the countdown cannot go below
	 * the waits that still have to happen).
	 *
	 * Absent when the Part will probably not be played out if the rundown is played in order - which
	 * is what the displays use to decide not to show a countdown at all.
	 */
	countdownOffset?: number

	/**
	 * How much of this Part has played.
	 * duration read = the elapsed time as a *negative* value, per the count-up convention also used
	 * by the Segment document's `playedOut` - a TimerState's duration read can hold or fall, never
	 * rise, so a quantity that grows is published as one that falls. Free-running while the Part is
	 * on air, frozen at the recorded duration once it is done.
	 */
	played?: TimerState

	/**
	 * The Part's duration: as-run once it has played, as-planned before that, and growing past the
	 * planned value while the Part is on air and overrunning.
	 * duration read = *negative*, per the count-up convention described on `played`.
	 */
	duration?: TimerState

	/**
	 * `displayDuration` while the Part is on air: it grows once the Part passes its planned end, so
	 * that an overrunning Part keeps taking up more room rather than being drawn as finished.
	 * Only differs from `displayDuration` for the on-air Part.
	 * duration read = *negative*, per the count-up convention described on `played`.
	 */
	liveDisplayDuration?: TimerState
}

export function getPlaylistTimingStateDocId(playlistId: RundownPlaylistId): TimingStateDocId {
	return protectString(`playlist_${playlistId}`)
}

export function getSegmentTimingStateDocId(segmentId: SegmentId): TimingStateDocId {
	return protectString(`segment_${segmentId}`)
}

/**
 * Keyed on the PartId rather than the PartInstanceId, so that a Part keeps one document across
 * takes and resets, and consumers that only know the Part (which is most of them) can find it.
 */
export function getPartTimingStateDocId(partId: PartId): TimingStateDocId {
	return protectString(`part_${partId}`)
}

/**
 * Narrow a published timing state document to the playlist-level one.
 * Note that `type` must be present on the document, so include it in any projection.
 */
export function isPlaylistTimingStateDoc(doc: Pick<TimingStateDoc, 'type'>): doc is PlaylistTimingStateDoc {
	return doc.type === 'playlist'
}

/**
 * Narrow a published timing state document to a segment-level one.
 * Note that `type` must be present on the document, so include it in any projection.
 */
export function isSegmentTimingStateDoc(doc: Pick<TimingStateDoc, 'type'>): doc is SegmentTimingStateDoc {
	return doc.type === 'segment'
}

/**
 * Narrow a published timing state document to a part-level one.
 * Note that `type` must be present on the document, so include it in any projection.
 */
export function isPartTimingStateDoc(doc: Pick<TimingStateDoc, 'type'>): doc is PartTimingStateDoc {
	return doc.type === 'part'
}
