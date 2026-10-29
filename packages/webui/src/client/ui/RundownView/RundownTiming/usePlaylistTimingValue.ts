import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { PartId, PartInstanceId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	getPartTimingStateDocId,
	getPlaylistTimingStateDocId,
	getSegmentTimingStateDocId,
	isPartTimingStateDoc,
	isPlaylistTimingStateDoc,
	isSegmentTimingStateDoc,
	type PartTimingStateDoc,
	type PlaylistTimingStateDoc,
	type SegmentTimingStateDoc,
	type TimingStateDoc,
	type TimingStateDocId,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import {
	offsetTimerState,
	type TimerState,
	timerStateToDuration,
	timerStateToZeroTime,
} from '@sofie-automation/corelib/dist/dataModel/TimerState'
import type { MongoFieldSpecifierOnes } from '@sofie-automation/corelib/dist/mongo'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { PlaylistTimingStates } from '../../Collections.js'
import { useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData.js'
import { getCurrentTime } from '../../../lib/systemTime.js'
import {
	RundownTiming,
	TimingTickResolution,
	rundownTimingEventFromTickResolution,
	type TimingEvent,
} from './RundownTiming.js'
import { getOnAirTimerStateRightAfterTake } from './onAirTimerRightAfterTake.js'

/** How to read a published TimerState as a number */
export enum TimerValueMode {
	/**
	 * Milliseconds until the timer reaches zero, going negative once past it.
	 * Use for a duration/countdown display ("Rem. Dur", "Start In").
	 */
	Duration = 'duration',
	/**
	 * The absolute unix timestamp (ms) at which the timer reaches/reached zero.
	 * Use for a wall-clock display ("Plan. End", "Est. End").
	 */
	Timestamp = 'timestamp',
	/**
	 * Milliseconds elapsed, as a positive growing number.
	 *
	 * A TimerState's duration read can hold or fall but never rise, so anything that counts up is
	 * published as a falling negative (`played`, `playedOut`, `liveDisplayDuration`). This flips it
	 * back, so callers of those never have to negate by hand.
	 */
	CountUp = 'countUp',
}

/** The fields of a published document that can be read as a single TimerState */
type TimerKeysOf<TDoc> = {
	[K in keyof TDoc]-?: NonNullable<TDoc[K]> extends TimerState ? K : never
}[keyof TDoc]

/**
 * The playlist's timers that mean something on their own. `partCountdownBase` does not: it is read through
 * {@link usePartCountdownValue}, together with a part's offset
 */
export type PlaylistTimerKey = Exclude<TimerKeysOf<PlaylistTimingStateDoc>, 'partCountdownBase'>
export type SegmentTimerKey = TimerKeysOf<SegmentTimingStateDoc>
export type PartTimerKey = TimerKeysOf<PartTimingStateDoc>

export interface UsePlaylistTimingValueOptions {
	/**
	 * How often the value should be recomputed (which re-renders the caller).
	 * Defaults to Synced: the caller is drawn again at the moment the value's whole second changes,
	 * see {@link useTimeOfOwnSecond}.
	 */
	tickResolution?: TimingTickResolution

	/**
	 * How often the value should be recomputed while the published timer holds its value, as a Part's
	 * `played` does whenever that Part is not on air. Defaults to `tickResolution`.
	 *
	 * A Duration or CountUp read of a timer that holds is the same at any time, so None here draws the
	 * same while sparing the caller every re-render by the clock until the timer moves again. A
	 * Timestamp read is always recomputed at `tickResolution`; see {@link timerValueChangesWithClock}.
	 */
	tickResolutionWhileHolding?: TimingTickResolution

	/**
	 * The number that the caller shows, made from the value: for example the end of a clip minus the played time. With
	 * the Synced tick resolution, the caller is drawn again at the moment the whole second of that number changes, not
	 * of the value itself. A number made with a constant that is not a whole number of seconds changes at another
	 * moment than the value. Default: the value itself.
	 */
	drawnAs?: (value: number) => number

	/**
	 * Only return a value that is about this PartInstance.
	 *
	 * The on-air timers describe whichever part the server last had on air, and a component rendering
	 * a specific part must not show another part's numbers during the moment after a take when the
	 * two disagree. Pass the part being rendered: while the published state is about another part,
	 * the hook returns null, except right after a take of this part, when it returns what the server
	 * publishes for a part just taken (see {@link getOnAirTimerStateRightAfterTake}).
	 */
	forPartInstanceId?: PartInstanceId | null
	/** Only return a value while the published state is about this Segment. See `forPartInstanceId`. */
	forSegmentId?: SegmentId | null
}

/**
 * Read a single timer from the playlist's published timing state
 * (the `playlistTimingState` publication), already evaluated against the current time.
 *
 * Reactivity is scoped to the requested timer: the caller only re-renders when that timer's state
 * changes on the server, or when the value is recomputed at the chosen tick resolution.
 *
 * Note: the tick is driven by the RundownTimingProvider timing events, so this must be used within
 * a view that mounts one (as all the rundown views do).
 *
 * @param playlistId The playlist to read, or undefined outside a timing scope
 * @param timer Which timer to read
 * @param mode Whether to read it as a duration or as a wall-clock timestamp
 * @returns The value in milliseconds, or null if that timer is not currently published
 */
export function usePlaylistTimingValue(
	playlistId: RundownPlaylistId | undefined,
	timer: PlaylistTimerKey,
	mode: TimerValueMode,
	options?: UsePlaylistTimingValueOptions
): number | null {
	return useTimingStateValue(
		playlistId && getPlaylistTimingStateDocId(playlistId),
		isPlaylistTimingStateDoc,
		timer,
		mode,
		options
	)
}

/**
 * Read a single timer from a segment's published timing state. See {@link usePlaylistTimingValue}.
 *
 * Each segment's document already describes that segment - whether it is the on-air one or not -
 * so unlike the playlist's on-air timers this needs no identity guard.
 */
export function useSegmentTimingValue(
	segmentId: SegmentId | undefined,
	timer: SegmentTimerKey,
	mode: TimerValueMode,
	options?: UsePlaylistTimingValueOptions
): number | null {
	return useTimingStateValue(
		segmentId && getSegmentTimingStateDocId(segmentId),
		isSegmentTimingStateDoc,
		timer,
		mode,
		options
	)
}

/**
 * Read a single timer from a part's published timing state. See {@link usePlaylistTimingValue}.
 *
 * Each part's document already describes that part, so unlike the playlist's on-air timers this
 * needs no identity guard. Note that `played` and `liveDisplayDuration` count up, so they want
 * {@link TimerValueMode.CountUp}.
 */
export function usePartTimingValue(
	partId: PartId | undefined,
	timer: PartTimerKey,
	mode: TimerValueMode,
	options?: UsePlaylistTimingValueOptions
): number | null {
	return useTimingStateValue(partId && getPartTimingStateDocId(partId), isPartTimingStateDoc, timer, mode, options)
}

/**
 * The countdown until a part goes on air, from the published timing state: the playlist's
 * `partCountdownBase` shifted by the part's `countdownOffset`. See {@link usePlaylistTimingValue}.
 *
 * The caller re-renders when the part's offset or the playlist's base changes, which is at playout
 * events, and on the timing ticks while the countdown moves.
 *
 * @param partId The part to read, or undefined outside a timing scope
 * @param mode Whether to read it as a duration or as a wall-clock timestamp
 * @returns The value in milliseconds, or null when the part has no countdown, because it will
 * probably not be played out if the rundown is played in order, or nothing is published for the
 * part or its playlist
 */
export function usePartCountdownValue(
	partId: PartId | undefined,
	mode: TimerValueMode,
	options?: Pick<UsePlaylistTimingValueOptions, 'tickResolution' | 'tickResolutionWhileHolding' | 'drawnAs'>
): number | null {
	const state = useTracker(
		() => {
			if (!partId) return undefined

			// `type` narrows the published union, so it has to be in each projection
			const partDoc = PlaylistTimingStates.findOne(getPartTimingStateDocId(partId), {
				fields: {
					type: 1,
					playlistId: 1,
					countdownOffset: 1,
				} satisfies MongoFieldSpecifierOnes<PartTimingStateDoc>,
			}) as (Pick<TimingStateDoc, 'type'> & Partial<PartTimingStateDoc>) | undefined
			if (!partDoc || !isPartTimingStateDoc(partDoc)) return undefined

			const countdownOffset = partDoc.countdownOffset
			const hasCountdown = countdownOffset !== undefined
			if (!hasCountdown) return undefined

			const playlistDoc = PlaylistTimingStates.findOne(getPlaylistTimingStateDocId(partDoc.playlistId), {
				fields: { type: 1, partCountdownBase: 1 } satisfies MongoFieldSpecifierOnes<PlaylistTimingStateDoc>,
			}) as (Pick<TimingStateDoc, 'type'> & Partial<PlaylistTimingStateDoc>) | undefined
			if (!playlistDoc || !isPlaylistTimingStateDoc(playlistDoc)) return undefined

			return offsetTimerState(playlistDoc.partCountdownBase, countdownOffset)
		},
		[partId],
		undefined
	)

	return useTimerStateValue(state, mode, options)
}

/**
 * Read one of the playlist's non-timer fields from its published timing state.
 *
 * These do not vary with the clock, so unlike {@link usePlaylistTimingValue} this does not tick: the
 * caller re-renders only when the published value actually changes.
 *
 * @returns The value, or undefined while nothing is published for the playlist
 */
export function usePlaylistTimingField<TField extends 'timingType' | 'currentPartWillAutoNext'>(
	playlistId: RundownPlaylistId | undefined,
	field: TField
): PlaylistTimingStateDoc[TField] | undefined {
	return useTracker(
		() => {
			if (!playlistId) return undefined

			// `type` narrows the published union, so it has to be in the projection
			const doc = PlaylistTimingStates.findOne(getPlaylistTimingStateDocId(playlistId), {
				fields: { type: 1, [field]: 1 } satisfies MongoFieldSpecifierOnes<PlaylistTimingStateDoc>,
			}) as (Pick<TimingStateDoc, 'type'> & Partial<PlaylistTimingStateDoc>) | undefined

			if (!doc || !isPlaylistTimingStateDoc(doc)) return undefined

			return doc[field]
		},
		[playlistId, field],
		undefined
	)
}

/**
 * Read one of a part's non-timer fields from its published timing state - `rank`, `isInQuickLoop`
 * or `countsTowardsTiming`.
 *
 * These do not vary with the clock, so unlike {@link usePartTimingValue} this does not tick: the
 * caller re-renders only when the published value actually changes.
 *
 * @returns The value, or undefined while nothing is published for the part
 */
export function usePartTimingField<TField extends 'rank' | 'isInQuickLoop' | 'countsTowardsTiming'>(
	partId: PartId | undefined,
	field: TField
): PartTimingStateDoc[TField] | undefined {
	return useTracker(
		() => {
			if (!partId) return undefined

			// `type` narrows the published union, so it has to be in the projection
			const doc = PlaylistTimingStates.findOne(getPartTimingStateDocId(partId), {
				fields: { type: 1, [field]: 1 } satisfies MongoFieldSpecifierOnes<PartTimingStateDoc>,
			}) as (Pick<TimingStateDoc, 'type'> & Partial<PartTimingStateDoc>) | undefined

			if (!doc || !isPartTimingStateDoc(doc)) return undefined

			return doc[field]
		},
		[partId, field],
		undefined
	)
}

/**
 * Every part of the playlist, in playout order.
 *
 * Documents have no inherent order, so this sorts on the `rank` the publication resolved them in -
 * which is the order the calculator walked, not the ingest order, and so accounts for the queued
 * segment and the parts that are actually going to be played.
 */
export function useOrderedPartIds(playlistId: RundownPlaylistId | undefined): PartId[] {
	return (
		useTracker(
			() => {
				if (!playlistId) return []

				return PlaylistTimingStates.find({ type: 'part', playlistId } as never, {
					fields: { partId: 1, rank: 1 } satisfies MongoFieldSpecifierOnes<PartTimingStateDoc>,
					sort: { rank: 1 },
				}).map((doc) => (doc as PartTimingStateDoc).partId)
			},
			[playlistId],
			[]
		) ?? []
	)
}

/** One Part's geometry numbers, taken from the publication and evaluated against the current time */
export interface SegmentPartTiming {
	partId: PartId
	/**
	 * Offset from the start of the Segment: the running sum of the display durations of the Parts
	 * before this one, within this Segment.
	 */
	displayStartsAt: number
	/** How much room the Part takes up, growing while it is on air and overrunning */
	displayDuration: number
	/** As-run once played, as-planned before that, likewise growing while overrunning */
	duration: number
	isInQuickLoop: boolean
}

/**
 * A Segment's Parts in playout order, with their published geometry values evaluated and the
 * within-Segment offsets accumulated.
 *
 * The offsets are relative to the Segment rather than the playlist because that is all any consumer
 * needs - every place the old client-side `partDisplayStartsAt` was read, it was read as a difference
 * between two Parts of the same Segment. Keeping it segment-relative also means one Segment's
 * geometry never depends on another's.
 *
 * This is deliberately nothing but published data plus a running total: it is exactly what an
 * external consumer of the publication would do, so if this is not enough to render the timeline,
 * the publication is missing something.
 *
 * Only the on-air Part's values grow with the clock, so only the Segment holding it is re-evaluated
 * on every high-resolution tick. Every other Segment's values hold until something new is published,
 * and the caller is not re-rendered by the clock at all.
 */
export function useSegmentPartTimings(segmentId: SegmentId | undefined): Map<PartId, SegmentPartTiming> {
	const docs = useTracker(
		() => {
			if (!segmentId) return []

			return PlaylistTimingStates.find({ type: 'part', segmentId } as never, {
				fields: {
					partId: 1,
					rank: 1,
					isInQuickLoop: 1,
					liveDisplayDuration: 1,
					duration: 1,
				} satisfies MongoFieldSpecifierOnes<PartTimingStateDoc>,
				sort: { rank: 1 },
			}).fetch() as unknown as PartTimingStateDoc[]
		},
		[segmentId],
		[]
	)

	const hasPartChangingWithClock = docs.some(
		(doc) => timerStateChangesWithClock(doc.liveDisplayDuration) || timerStateChangesWithClock(doc.duration)
	)
	const now = useTimingNow(hasPartChangingWithClock ? TimingTickResolution.High : TimingTickResolution.None)

	// The same Map for as long as nothing it is built from has changed, so that the components it is
	// handed to can tell by its identity that they have nothing new to draw
	return useMemo(() => evaluateSegmentPartTimings(docs, now), [docs, now])
}

function evaluateSegmentPartTimings(docs: PartTimingStateDoc[], now: number): Map<PartId, SegmentPartTiming> {
	const timings = new Map<PartId, SegmentPartTiming>()

	let displayStartsAt = 0
	for (const doc of docs) {
		// the count-ups are published negated, per the convention on PartTimingStateDoc.played
		const displayDuration = doc.liveDisplayDuration ? 0 - timerStateToDuration(doc.liveDisplayDuration, now) : 0
		const duration = doc.duration ? 0 - timerStateToDuration(doc.duration, now) : 0

		timings.set(doc.partId, {
			partId: doc.partId,
			displayStartsAt,
			displayDuration,
			duration,
			isInQuickLoop: doc.isInQuickLoop,
		})
		displayStartsAt += displayDuration
	}

	return timings
}

/**
 * Whether a published timer's value moves with the clock. A running timer does, and so does a paused
 * one that has a time to start running at. Any other paused timer holds its value until a new state
 * is published.
 */
function timerStateChangesWithClock(state: TimerState | undefined): boolean {
	if (!state) return false

	const isRunning = !state.paused
	const hasScheduledStart = state.paused && state.resumesAt != null
	return isRunning || hasScheduledStart
}

/**
 * Whether the value read from a published timer moves with the clock. A Duration or CountUp read
 * moves only while the timer itself does. A Timestamp read of a timer that holds is the moment it
 * would reach zero if it resumed now, which moves with the clock, so a Timestamp read always moves.
 */
function timerValueChangesWithClock(state: TimerState | undefined, mode: TimerValueMode): boolean {
	switch (mode) {
		case TimerValueMode.Duration:
		case TimerValueMode.CountUp:
			return timerStateChangesWithClock(state)
		case TimerValueMode.Timestamp:
			return true
		default:
			assertNever(mode)
			return true
	}
}

/**
 * The sum of every part's resolved expected duration.
 *
 * Used as a stand-in playlist length where the playlist has no planned duration of its own. Note
 * this counts the parts that currently exist, so unlike the calculator's equivalent it does not
 * keep counting parts that an ingest has since removed.
 */
export function usePartsTotalExpectedDuration(playlistId: RundownPlaylistId | undefined): number {
	return (
		useTracker(
			() => {
				if (!playlistId) return 0

				let total = 0
				PlaylistTimingStates.find({ type: 'part', playlistId } as never, {
					fields: { expectedDuration: 1 } satisfies MongoFieldSpecifierOnes<PartTimingStateDoc>,
				}).forEach((doc) => {
					const expectedDuration = (doc as PartTimingStateDoc).expectedDuration
					// a constant state, so any instant reads the same value
					total += expectedDuration ? timerStateToDuration(expectedDuration, 0) : 0
				})
				return total
			},
			[playlistId],
			0
		) ?? 0
	)
}

function useTimingStateValue<TDoc extends TimingStateDoc>(
	docId: TimingStateDocId | undefined,
	isWantedDoc: (doc: Pick<TimingStateDoc, 'type'>) => doc is TDoc,
	timer: TimerKeysOf<TDoc>,
	mode: TimerValueMode,
	options?: UsePlaylistTimingValueOptions
): number | null {
	const forPartInstanceId = options?.forPartInstanceId
	const forSegmentId = options?.forSegmentId

	const state = useTracker(
		() => {
			if (!docId) return undefined

			// `type` narrows the published union, and the identities back the guards below, so all
			// of them have to be in the projection
			const doc = PlaylistTimingStates.findOne(docId, {
				fields: {
					type: 1,
					playlistId: 1,
					currentPartInstanceId: 1,
					currentSegmentId: 1,
					[timer]: 1,
				} satisfies MongoFieldSpecifierOnes<PlaylistTimingStateDoc>,
			}) as (Pick<TimingStateDoc, 'type'> & Partial<PlaylistTimingStateDoc>) | undefined

			if (!doc || !isWantedDoc(doc)) return undefined

			// Never a state that is about a different part than the caller renders. Right after a take
			// the page has the new part on air a moment before the server's timing for it, and for
			// that moment the caller gets the state the server publishes for a part just taken
			const isAboutAnotherPart =
				forPartInstanceId !== undefined && doc.currentPartInstanceId !== forPartInstanceId
			if (isAboutAnotherPart) return getOnAirTimerStateRightAfterTake(doc, timer, forPartInstanceId)

			// Discard a state that is about a different segment than the caller renders
			if (forSegmentId !== undefined && doc.currentSegmentId !== forSegmentId) return undefined

			return (doc as TDoc)[timer] as TimerState | undefined
		},
		[docId, timer, forPartInstanceId, forSegmentId],
		undefined
	)

	return useTimerStateValue(state, mode, options)
}

/**
 * A published timer state read as a number at the current time, and read again on the timing ticks
 * for as long as the value moves with the clock, so that it stays current between published states.
 *
 * @returns The value in milliseconds, or null when there is no state
 */
function useTimerStateValue(
	state: TimerState | undefined,
	mode: TimerValueMode,
	options:
		| Pick<UsePlaylistTimingValueOptions, 'tickResolution' | 'tickResolutionWhileHolding' | 'drawnAs'>
		| undefined
): number | null {
	const tickResolution = options?.tickResolution ?? TimingTickResolution.Synced
	const tickResolutionWhileHolding = options?.tickResolutionWhileHolding ?? tickResolution

	const isValueHolding = !timerValueChangesWithClock(state, mode)
	const activeTickResolution = isValueHolding ? tickResolutionWhileHolding : tickResolution
	const isDrawnOnOwnSecond = activeTickResolution === TimingTickResolution.Synced

	const tickTime = useTimingNow(isDrawnOnOwnSecond ? TimingTickResolution.None : activeTickResolution)
	const drawnAs = options?.drawnAs
	const readMovingValue =
		isDrawnOnOwnSecond && !isValueHolding && state
			? (now: number) => {
					const value = readTimerState(state, mode, now)
					return drawnAs ? drawnAs(value) : value
				}
			: undefined
	const ownSecondTime = useTimeOfOwnSecond(readMovingValue)

	if (!state) return null

	return readTimerState(state, mode, isDrawnOnOwnSecond ? ownSecondTime : tickTime)
}

/** A published timer state read as a number at a time */
function readTimerState(state: TimerState, mode: TimerValueMode, now: number): number {
	switch (mode) {
		case TimerValueMode.Duration:
			return timerStateToDuration(state, now)
		case TimerValueMode.CountUp:
			// subtracting rather than negating, so that nothing elapsed gives 0 rather than -0
			return 0 - timerStateToDuration(state, now)
		case TimerValueMode.Timestamp:
			return timerStateToZeroTime(state, now)
		default:
			assertNever(mode)
			return timerStateToDuration(state, now)
	}
}

/**
 * A number that moves with the clock, which the caller calculates itself, for example the time until the end of a
 * clip. The caller is drawn again at the moment the number's own whole second changes, as with the published timing
 * values (see {@link useTimeOfOwnSecond}).
 *
 * @param read The number at a time, in milliseconds. Undefined while there is no such number.
 * @returns The number at the current time, or null while `read` is undefined
 */
export function useClockValue(read: ((now: number) => number) | undefined): number | null {
	const now = useTimeOfOwnSecond(read)
	return read ? read(now) : null
}

/**
 * The time to read a value at, for a caller that is drawn again at the moment the value's whole
 * second changes.
 *
 * The Synced tick comes at each full second of the clock, but most timing values count from another
 * moment: from the start of a part, which comes some milliseconds after the take, or at any moment
 * after a take by hand. Read at the tick, such a value would show the second before for most of each
 * second. So the value is checked on each high-resolution tick instead, and the caller is drawn again
 * only when the whole second of the value has changed, rounded down or rounded up. Values that count from the same moment change
 * in the same frame.
 *
 * Each time the caller is drawn, this is the current time. So a value that arrives between two
 * ticks, such as the timing that the server publishes when a part starts, is read at the time it
 * arrives, never at the time of an earlier tick.
 *
 * @param readMovingValue The value at a time, in milliseconds, while it moves with the clock.
 * Undefined while it holds: then the clock never draws the caller again.
 * @returns The current time
 */
function useTimeOfOwnSecond(readMovingValue: ((now: number) => number) | undefined): number {
	const now = getCurrentTime()
	const drawnSeconds = readMovingValue ? shownSecondsOf(readMovingValue(now)) : null

	const drawnSecondsRef = useRef(drawnSeconds)
	const readMovingValueRef = useRef(readMovingValue)
	useLayoutEffect(() => {
		drawnSecondsRef.current = drawnSeconds
		readMovingValueRef.current = readMovingValue
	})

	const [, drawAgain] = useReducer((drawCount: number) => drawCount + 1, 0)

	const isMovingWithClock = readMovingValue !== undefined
	useEffect(() => {
		if (!isMovingWithClock) return

		const onTick = () => {
			const read = readMovingValueRef.current
			if (!read) return

			const haveSecondsChanged = shownSecondsOf(read(getCurrentTime())) !== drawnSecondsRef.current
			if (haveSecondsChanged) drawAgain()
		}

		window.addEventListener(RundownTiming.Events.timeupdateHighResolution, onTick)
		return () => window.removeEventListener(RundownTiming.Events.timeupdateHighResolution, onTick)
	}, [isMovingWithClock])

	return now
}

/**
 * The whole seconds that a value in milliseconds shows as, rounded down and rounded up. A display rounds one way or
 * the other, so the caller is drawn again when either changes: when the value passes a whole second, and also when it
 * reaches one exactly and stops there, as a countdown does that holds at the end of the on-air part.
 */
function shownSecondsOf(milliseconds: number): string {
	return `${Math.floor(milliseconds / 1000)}/${Math.ceil(milliseconds / 1000)}`
}

/**
 * The current time, re-rendering the caller on each timing tick.
 *
 * This is the clock the rest of the timing UI runs on, without any of the calculator's data - for
 * a component that only needs to know what time it is, such as a wall clock or a countdown to a
 * timestamp it already has.
 *
 * Note: the tick comes from the RundownTimingProvider, so this must be used within a view that
 * mounts one (as all the rundown views do).
 *
 * @param tickResolution How often to re-render. Defaults to Synced (1Hz, aligned with the rest of
 * the timing UI). With None the caller is not re-rendered by the clock at all, and keeps the time it
 * last had.
 */
export function useTimingNow(tickResolution: TimingTickResolution = TimingTickResolution.Synced): number {
	const [now, setNow] = useState(() => getCurrentTime())
	const [nowTickResolution, setNowTickResolution] = useState(tickResolution)

	// A caller that moves to another rate - in particular one that starts ticking after not ticking
	// at all - takes the current time straight away, rather than rendering with the time it last had
	// until its first new tick arrives. Setting state while rendering makes React render again at
	// once, before anything is drawn.
	const hasTickResolutionChanged = nowTickResolution !== tickResolution
	if (hasTickResolutionChanged) {
		setNowTickResolution(tickResolution)
		setNow(getCurrentTime())
	}

	useEffect(() => {
		const eventName = rundownTimingEventFromTickResolution(tickResolution)
		if (!eventName) return

		const handler = (e: Event) => setNow((e as TimingEvent).detail?.currentTime ?? getCurrentTime())

		window.addEventListener(eventName, handler)
		return () => window.removeEventListener(eventName, handler)
	}, [tickResolution])

	return now
}
