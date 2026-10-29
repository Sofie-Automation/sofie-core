import * as fs from 'fs'
import * as path from 'path'
import { PartHoldMode, type RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import {
	offsetTimerState,
	type TimerState,
	timerStateToDuration,
	timerStateToZeroTime,
} from '@sofie-automation/corelib/dist/dataModel/TimerState'
import {
	isPartTimingStateDoc,
	isPlaylistTimingStateDoc,
	isSegmentTimingStateDoc,
	type PartTimingStateDoc,
	type PlaylistTimingStateDoc,
	type SegmentTimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { DEFAULT_DISPLAY_DURATION } from '@sofie-automation/shared-lib/dist/core/constants'
import * as _ from 'underscore'
import { RundownTimingCalculator } from '../../rundownTiming'
import { prepareTimingPartInstances } from '../../rundownTiming/prepareTimingInputs'
import {
	calculateTimingDocuments,
	type PlayoutScript,
	playoutScript,
	type PublicationInputs,
} from './lib/playoutScript'
import {
	budget,
	clock,
	formatClock,
	formatLength,
	type ReferenceRundown,
	referenceRundown,
	TIMING_MODES,
	type TimingModeName,
} from './lib/referenceRundown'
import {
	deactivatedAt,
	EARLY_SHOW,
	FIRST_TAKES_IN_MULTI_GATEWAY_MODE,
	LATE_SHOW,
	ON_TIME_SHOW,
	PLANNED_TIMING,
	playShow,
	RUN_THROUGH_BEFORE_THE_SHOW,
	type ShowInstant,
	type StandardShow,
} from './lib/standardShows'
import { calculateCurrentPartTiming } from './main/partTiming'
import { PlaylistTiming } from './main/playlistTiming'
import { getPlaylistTimingDiff } from './main/rundownTiming'
import { SegmentDuration } from './main/SegmentDuration'
import { calculateCurrentSegmentTiming, calculateSegmentTiming } from './main/segmentTiming'

/**
 * The timing publication against main. At each moment worth reading of each show, in each of the twelve timing modes,
 * this works out every value a screen or the gateway shows, as main showed it and as it is shown from the publication,
 * and prints the two side by side in one table, with `same` or `differs: <reason>`.
 *
 * Main's values: on main the browser ran the timing calculator itself, on every clock tick, and each screen worked out
 * what it showed from the result. The calculator moved into the server with its tests, whose expected values did not
 * change, and so did the preparation of its inputs. One change inside it does show in these shows, in the moment
 * between a take and the part's start in multi-gateway mode, and mainRemainingPlaylistDuration undoes it. So main's
 * value is the calculator's result at the moment, with that change undone, fed to main's own formulas for what a
 * screen showed. The formulas the publication replaced are kept, frozen and unchanged, in ./main: the over/under, the
 * remaining duration and the estimated end, a segment's duration, and the gateway's part and segment timing. The
 * calculator itself is not frozen, so any other change inside it would not show in this table.
 *
 * The publication's values: the publication calculates its documents when what it reads changes, so a client holds
 * documents calculated at the last change, and evaluates them at the moment, as the web UI's timing hooks do. Before
 * the first change, a client holds documents calculated when it subscribed, five minutes before the show. A moment can
 * say that the publication calculated again after the last change, as it does when anything else it reads changes,
 * such as a part edited in the rundown. The gateway evaluates the same documents when it sends a message, as its
 * helpers in packages/live-status-gateway/src/topics/helpers do today. The gateway's rows are a message sent at the
 * moment.
 *
 * The verdict is worked out, not written: a row is `same` when the two texts are equal. Each difference must be
 * explained by exactly one entry of KNOWN_DIFFERENCES, and each entry must explain at least one row, so that the list
 * is exactly what differs from main. The planned values and the gateway's playlist timers do not change during a show:
 * every moment compares them, but the table lists a row of theirs only the first time it reads as it does.
 *
 * The table is kept in comparisonWithMain.txt, next to this test. To rewrite it from what the code gives today, run
 * this test with UPDATE_TIMING_COMPARISON=1 set, and review the diff:
 *
 *   UPDATE_TIMING_COMPARISON=1 yarn unit --testPathPatterns playlistTimingState/__tests__/timing/comparisonWithMain
 */

// The shows

/** When a client subscribed to the publication, and so when it calculated the first documents the client holds */
const SUBSCRIBED_AT = clock('11:55:00')

interface ComparedShow {
	name: string
	script: PlayoutScript
	moments: readonly ComparedMoment[]
}

/** A moment worth reading a show at */
interface ComparedMoment extends ShowInstant {
	/**
	 * When the publication calculated again, after the last step that changed what it reads and not after the moment,
	 * as it does when anything else it reads changes, such as a part edited in the rundown. Unless set, it last
	 * calculated at that step
	 */
	calculatedAgainAt?: string
}

function standard(show: StandardShow): ComparedShow {
	return { name: show.name, script: playShow(show), moments: show.instants }
}

const DEACTIVATED_WHILE_B1_RUNS_OVER = deactivatedAt(LATE_SHOW, '12:01:23', [
	{ at: '12:01:25', what: '2 s after the deactivation' },
	{ at: '12:01:45', what: '22 s after the deactivation' },
])

/** The late show up to B1, the four takes in time */
function lateShowUpToB1(options: { rehearsal: boolean; rundown?: ReferenceRundown }): PlayoutScript {
	return playoutScript({ rundown: options.rundown ?? referenceRundown(), timing: PLANNED_TIMING })
		.activate('11:59:00', { rehearsal: options.rehearsal })
		.take('12:00:20')
		.take('12:00:30')
		.take('12:00:40')
		.take('12:00:50')
}

/** A hold from B1 to B2, started while B1 runs over: the take of B2 at 12:01:43 goes into the hold, the next completes it */
const HELD_FROM_B1_TO_B2 = lateShowUpToB1({
	rehearsal: false,
	rundown: referenceRundown({ parts: { B1: { holdMode: PartHoldMode.FROM }, B2: { holdMode: PartHoldMode.TO } } }),
})
	.startHold('12:01:20')
	.take('12:01:43')
	.take('12:01:53')

/** The late show in rehearsal, on air from the moment B1 is 10 s in, and then B2 */
const REHEARSAL_THEN_ON_AIR = lateShowUpToB1({ rehearsal: true }).activate('12:01:00').take('12:01:43')

/** The late show with C2 in a display-duration group after C1, and no length of its own: it takes what C1 leaves */
const DISPLAY_DURATION_GROUP: ComparedShow = {
	name: 'the late show, with C1 and C2 in a display-duration group, C2 without a length',
	script: playShow(LATE_SHOW, {
		variant: {
			parts: { C1: { displayDurationGroup: 'C' }, C2: { displayDurationGroup: 'C', expectedDuration: 0 } },
		},
	}),
	moments: [
		{ at: '12:02:05', what: 'C1 2 s in' },
		{ at: '12:02:15', what: 'C2 5 s in, after C1 ran 7 s' },
	],
}

/**
 * B1 auto-nexts into B2 in multi-gateway mode, with the takes of the multi-gateway show in the playback confirmation
 * test: A1, A2, A3 and B1 taken at 12:00:00, 12:00:13, 12:00:22 and 12:00:35, each part starting 2 s after its take.
 * Building the timeline at the take of B1 schedules B2 to start when B1 ends, at 12:00:57, and the gateway reports that
 * start a second later. Nothing the publication reads changes in that second, so it last calculated at the report of
 * B1's start; one moment reads it as if it had calculated again within the second
 */
const AUTO_NEXT_IN_MULTI_GATEWAY_MODE: ComparedShow = {
	name: 'B1 auto-nexting into B2 in multi-gateway mode',
	script: playoutScript({
		rundown: referenceRundown({ parts: { B1: { autoNext: true } } }),
		timing: PLANNED_TIMING,
		gateway: FIRST_TAKES_IN_MULTI_GATEWAY_MODE.gateway,
	})
		.activate('11:59:00')
		.take('12:00:00')
		.take('12:00:13')
		.take('12:00:22')
		.take('12:00:35')
		.autoNext('12:00:58'),
	moments: [
		{ at: '12:00:56', what: 'B1 19 s in, to auto-next into B2 at 12:00:57' },
		{ at: '12:00:57.500', what: 'B2 0.5 s past its scheduled start, which the gateway has not reported yet' },
		{
			at: '12:00:57.800',
			what: 'B2 0.8 s past its scheduled start, not yet reported; the publication calculated again at 12:00:57.500',
			calculatedAgainAt: '12:00:57.500',
		},
		{ at: '12:00:59', what: 'B2 2 s in, its start reported at 12:00:58' },
	],
}

/** A1 set as next again while it is on air, and taken again */
const A1_TAKEN_AGAIN: ComparedShow = {
	name: 'A1 taken again',
	script: playoutScript({ rundown: referenceRundown(), timing: PLANNED_TIMING })
		.activate('11:59:00')
		.take('12:00:20')
		.setNext('12:00:25', 'A1')
		.take('12:00:27')
		.take('12:00:37'),
	moments: [{ at: '12:00:30', what: 'A1 taken again 3 s ago, after it ran 7 s' }],
}

const SHOWS: readonly ComparedShow[] = [
	standard(LATE_SHOW),
	standard(ON_TIME_SHOW),
	standard(EARLY_SHOW),
	standard(DEACTIVATED_WHILE_B1_RUNS_OVER),
	{
		name: 'the late show, reset after it',
		script: playShow(LATE_SHOW).reset('12:03:50'),
		moments: [{ at: '12:03:50', what: 'reset, 10 s after the deactivation' }],
	},
	{
		name: 'the late show, reset after it and activated again',
		script: playShow(LATE_SHOW).reset('12:03:50').activate('12:04:00'),
		moments: [{ at: '12:04:05', what: 'activated again 5 s ago, nothing taken' }],
	},
	{
		name: 'the late show in rehearsal, on air from 12:01:00',
		script: REHEARSAL_THEN_ON_AIR,
		moments: [
			{ at: '12:00:55', what: 'in rehearsal, B1 5 s in' },
			{ at: '12:01:00', what: 'on air from now, B1 10 s in' },
			{ at: '12:01:50', what: 'on air, B2 7 s in' },
		],
	},
	{
		name: 'the late show, with a hold from B1 to B2 started at 12:01:20',
		script: HELD_FROM_B1_TO_B2,
		moments: [
			{ at: '12:01:45', what: 'B2 taken into the hold 2 s ago' },
			{ at: '12:01:55', what: 'the hold completed 2 s ago' },
		],
	},
	{
		name: 'the late show, with a budget of 1:00 on C',
		script: playShow(LATE_SHOW, { variant: { segments: { C: budget('1:00') } } }),
		moments: [
			{ at: '12:02:35', what: 'C3 5 s in, past the planned end' },
			{ at: '12:03:05', what: 'D1 5 s in, after C' },
		],
	},
	standard(RUN_THROUGH_BEFORE_THE_SHOW),
	{
		name: `${RUN_THROUGH_BEFORE_THE_SHOW.name}, then the show activated at 11:59:50`,
		script: playShow(RUN_THROUGH_BEFORE_THE_SHOW).activate('11:59:50'),
		moments: [{ at: '11:59:55', what: 'activated 5 s ago, nothing taken' }],
	},
	standard(FIRST_TAKES_IN_MULTI_GATEWAY_MODE),
	AUTO_NEXT_IN_MULTI_GATEWAY_MODE,
	DISPLAY_DURATION_GROUP,
	A1_TAKEN_AGAIN,
]

// The values

/** Each value a screen or the gateway shows, in the order of the table */
const VALUES = [
	'Plan. Start',
	'Plan. Dur',
	'Plan. End',
	'Started',
	'Start In',
	'Rem. Dur',
	'Est. End',
	'Over/Under',
	'On Air',
	'Seg. Budg.',
	'segment durations',
	'fixed segment durations',
	'segments counting up',
	'On Air In',
	'part countdowns',
	'gateway part timing',
	'gateway segment timing',
	'gateway segments',
	'gateway playlist timers',
] as const
type ValueName = (typeof VALUES)[number]
type ShownValues = Map<ValueName, string>

/** Values that do not change during a show, of which the table lists a row only the first time it reads as it does */
const LISTED_ONCE: ReadonlySet<ValueName> = new Set([
	'Plan. Start',
	'Plan. Dur',
	'Plan. End',
	'gateway playlist timers',
])

/** A screen that shows no value, and a gateway that sends none */
const HIDDEN = 'hidden'
const NOT_SENT = 'not sent'
/** What the gateway sends as the playlist timers: the timer states the header reads, for a consumer to evaluate */
const HEADER_TIMERS = "the header's timers"

function lengthText(value: number | null | undefined): string {
	return value === undefined || value === null ? HIDDEN : formatLength(value)
}
function clockText(value: number | null | undefined): string {
	return value === undefined || value === null ? HIDDEN : formatClock(value)
}
/** As the header shows it: O for over, and U for under, which zero reads as */
function overUnderText(diff: number | undefined): string {
	if (diff === undefined) return HIDDEN
	return diff > 0 ? `O ${formatLength(diff)}` : `U ${formatLength(-diff)}`
}
/** A value per segment or per part, as 'B 0:25 C 1:05'; one without a value is left out */
function listText(entries: ReadonlyArray<readonly [string, number | undefined]>): string {
	const shown = entries.flatMap(([key, value]) => (value === undefined ? [] : [`${key} ${formatLength(value)}`]))
	return shown.length === 0 ? HIDDEN : shown.join(' ')
}

/** A moment of a show: what the publication holds then, when it last calculated, and the moment itself */
interface Moment {
	inputs: PublicationInputs
	playlist: DBRundownPlaylist
	segments: DBSegment[]
	parts: DBPart[]
	partInstances: DBPartInstance[]
	calculatedAt: number
	now: number
}

function readMoment(script: PlayoutScript, at: ComparedMoment): Moment {
	const inputs = script.inputsAt(at.at)
	const now = clock(at.at)
	const lastChangeAt = script.lastCalculationAt(at.at) ?? SUBSCRIBED_AT
	const calculatedAgainAt = at.calculatedAgainAt === undefined ? undefined : clock(at.calculatedAgainAt)
	if (calculatedAgainAt !== undefined && (calculatedAgainAt < lastChangeAt || calculatedAgainAt > now)) {
		throw new Error(`At ${at.at} the publication cannot have calculated again at ${at.calculatedAgainAt}`)
	}
	// the publication's projections hold every field the timing reads
	return {
		inputs,
		playlist: inputs.playlist as DBRundownPlaylist,
		segments: inputs.segments as DBSegment[],
		parts: inputs.parts as DBPart[],
		partInstances: inputs.partInstances as DBPartInstance[],
		calculatedAt: calculatedAgainAt ?? lastChangeAt,
		now,
	}
}

function onAirPartInstance(moment: Moment): DBPartInstance | undefined {
	if (!moment.playlist.activationId) return undefined
	const current = moment.playlist.currentPartInfo?.partInstanceId
	return moment.partInstances.find((partInstance) => partInstance._id === current)
}

function nextPartInstance(moment: Moment): DBPartInstance | undefined {
	if (!moment.playlist.activationId) return undefined
	const next = moment.playlist.nextPartInfo?.partInstanceId
	return moment.partInstances.find((partInstance) => partInstance._id === next)
}

/** The countdowns to the parts that start a segment, as segment headers show them, and to the other parts */
function countdownTexts(moment: Moment, countdownOf: (part: DBPart) => number | undefined) {
	const firstPartIds = new Set(
		moment.segments.map((segment) => moment.parts.find((part) => part.segmentId === segment._id)?._id)
	)
	const isFirst = (part: DBPart) => firstPartIds.has(part._id)
	return {
		onAirIn: listText(
			moment.parts.filter(isFirst).map((part) => [unprotectString(part.segmentId), countdownOf(part)] as const)
		),
		partCountdowns: listText(
			moment.parts.filter((part) => !isFirst(part)).map((part) => [part.title, countdownOf(part)] as const)
		),
	}
}

// Main's values

/**
 * Main's remaining playlist duration: the calculator's, with the one change inside it that shows here undone. In
 * multi-gateway mode a part starts a moment after its take. In that moment main's calculator counted the on-air part at
 * its length; the calculator now counts it to its end from its planned start, so that the projected end holds, which
 * adds the time left until the start. It does so for a timed part without a recorded duration, outside a segment with a
 * budget, and so does this.
 */
function mainRemainingPlaylistDuration(moment: Moment, calculatorRemaining: number | undefined): number | undefined {
	const onAir = onAirPartInstance(moment)
	const plannedStart = onAir?.timings?.plannedStartedPlayback
	if (calculatorRemaining === undefined || !onAir || plannedStart === undefined) return calculatorRemaining

	const timeLeftUntilTheStart = plannedStart - moment.now
	const segment = moment.segments.find((candidate) => candidate._id === onAir.segmentId)
	const isCountedFromItsStart =
		!onAir.part.untimed && segment?.segmentTiming?.budgetDuration === undefined && !onAir.timings?.duration
	return timeLeftUntilTheStart > 0 && isCountedFromItsStart
		? calculatorRemaining - timeLeftUntilTheStart
		: calculatorRemaining
}

/** What main's screens showed at the moment: main's formulas, on the calculator's result at the moment */
function mainScreens(moment: Moment, timing: RundownPlaylistTiming): ShownValues {
	const now = moment.now
	const playlist: DBRundownPlaylist = { ...moment.playlist, timing }
	const activePartInstances = _.sortBy(moment.partInstances, (partInstance) => partInstance.takeCount).map(
		(partInstance) => ({ ...partInstance, isTemporary: false })
	)
	const prepared = prepareTimingPartInstances(playlist, moment.segments, moment.parts, activePartInstances)
	const calculated = new RundownTimingCalculator().updateDurations(
		now,
		false,
		playlist,
		prepared.partInstances,
		new Map(moment.segments.map((segment) => [segment._id, segment])),
		moment.inputs.studioSettings.settings.defaultDisplayDuration ?? DEFAULT_DISPLAY_DURATION,
		prepared.partsInQuickLoop
	)
	const context = {
		...calculated,
		remainingPlaylistDuration: mainRemainingPlaylistDuration(moment, calculated.remainingPlaylistDuration),
	}

	const expectedStart = PlaylistTiming.getExpectedStart(timing)
	const startedPlayback = playlist.activationId ? playlist.startedPlayback : undefined
	const remaining = context.remainingPlaylistDuration
	// the header hides the over/under of an untimed playlist that has not started
	const isOverUnderHidden =
		PlaylistTiming.isPlaylistTimingNone(timing) &&
		timing.expectedDuration === undefined &&
		!playlist.startedPlayback
	const currentPartInstanceId = playlist.currentPartInfo?.partInstanceId
	const isAboutOnAirPart = !!currentPartInstanceId && context.currentPartInstanceId === currentPartInstanceId
	const segmentDurations = (shown: { fixed?: boolean; countUp?: boolean }) =>
		listText(
			moment.segments.map((segment) => {
				const parts = prepared.partInstances
					.filter((partInstance) => partInstance.segmentId === segment._id)
					.map((instance) => ({ instance }))
				return [unprotectString(segment._id), SegmentDuration({ segment, parts, ...shown }, context)?.value]
			})
		)
	const countdowns = countdownTexts(moment, (part) => context.partCountdown?.[unprotectString(part._id)] ?? undefined)

	return new Map([
		['Plan. Start', clockText(expectedStart)],
		['Plan. Dur', lengthText(PlaylistTiming.getExpectedDuration(timing))],
		['Plan. End', clockText(PlaylistTiming.getExpectedEnd(timing))],
		['Started', clockText(startedPlayback)],
		[
			'Start In',
			lengthText(startedPlayback === undefined && expectedStart !== undefined ? expectedStart - now : undefined),
		],
		['Rem. Dur', lengthText(PlaylistTiming.getRemainingDuration(timing, now, remaining, startedPlayback))],
		['Est. End', clockText(PlaylistTiming.getEstimatedEnd(timing, now, remaining, startedPlayback))],
		['Over/Under', overUnderText(isOverUnderHidden ? undefined : getPlaylistTimingDiff(playlist, context))],
		['On Air', lengthText(isAboutOnAirPart ? context.remainingTimeOnCurrentPart : undefined)],
		['Seg. Budg.', lengthText(isAboutOnAirPart ? context.remainingBudgetOnCurrentSegment : undefined)],
		['segment durations', segmentDurations({})],
		['fixed segment durations', segmentDurations({ fixed: true })],
		['segments counting up', segmentDurations({ countUp: true })],
		['On Air In', countdowns.onAirIn],
		['part countdowns', countdowns.partCountdowns],
	])
}

/** What main's gateway sent in a message at the moment */
function mainGateway(moment: Moment): ShownValues {
	if (!moment.playlist.activationId) return new Map()
	const partsOf = (segment: DBSegment) => moment.parts.filter((part) => part.segmentId === segment._id)
	const values: ShownValues = new Map([
		[
			'gateway segments',
			listText(
				moment.segments.map((segment) => {
					const timing = calculateSegmentTiming(segment.segmentTiming, [], partsOf(segment))
					return [unprotectString(segment._id), timing.expectedDurationMs] as const
				})
			),
		],
	])

	const onAir = onAirPartInstance(moment)
	const segment = moment.segments.find((candidate) => candidate._id === onAir?.segmentId)
	if (!onAir || !segment) return values

	const inSegmentPlayout = moment.partInstances.filter(
		(partInstance) => partInstance.segmentPlayoutId === onAir.segmentPlayoutId
	)
	const firstInSegmentPlayout = _.min(inSegmentPlayout, (partInstance) => partInstance.takeCount) as DBPartInstance
	// main's helpers read the clock for a part with no start yet
	const clockAtTheMoment = jest.spyOn(Date, 'now').mockReturnValue(moment.now)
	try {
		const part = calculateCurrentPartTiming(onAir, inSegmentPlayout)
		const segmentTiming = calculateCurrentSegmentTiming(
			segment.segmentTiming,
			onAir,
			firstInSegmentPlayout,
			inSegmentPlayout,
			partsOf(segment)
		)
		values.set(
			'gateway part timing',
			partTimingText(part.startTime, part.expectedDurationMs, part.projectedEndTime)
		)
		values.set(
			'gateway segment timing',
			segmentTimingText(segmentTiming.expectedDurationMs, segmentTiming.projectedEndTime)
		)
	} finally {
		clockAtTheMoment.mockRestore()
	}
	return values
}

function partTimingText(startTime: number, expectedDurationMs: number, projectedEndTime: number): string {
	return `${formatClock(startTime)} ${formatLength(expectedDurationMs)} ${formatClock(projectedEndTime)}`
}
function segmentTimingText(expectedDurationMs: number, projectedEndTime: number): string {
	return `${formatLength(expectedDurationMs)} ${formatClock(projectedEndTime)}`
}

// The publication's values

interface PublishedDocuments {
	playlist: PlaylistTimingStateDoc | undefined
	segments: Map<string, SegmentTimingStateDoc>
	parts: PartTimingStateDoc[]
}

/** The documents a client holds at the moment: those the publication calculated at the last change */
function publishedDocuments(moment: Moment, timing: RundownPlaylistTiming): PublishedDocuments {
	const docs = calculateTimingDocuments(moment.inputs, timing, moment.calculatedAt)
	return {
		playlist: docs.find(isPlaylistTimingStateDoc),
		segments: new Map(docs.filter(isSegmentTimingStateDoc).map((doc) => [unprotectString(doc.segmentId), doc])),
		parts: docs.filter(isPartTimingStateDoc),
	}
}

/** A part's countdown, as a screen composes it: the playlist's base for the part countdowns, shifted by the part's offset */
function partCountdown(
	partDoc: PartTimingStateDoc | undefined,
	playlistDoc: PlaylistTimingStateDoc | undefined
): TimerState | undefined {
	if (partDoc?.countdownOffset === undefined || !playlistDoc) return undefined
	return offsetTimerState(playlistDoc.partCountdownBase, partDoc.countdownOffset)
}

function durationAt(state: TimerState | undefined, now: number): number | undefined {
	return state && timerStateToDuration(state, now)
}
function zeroTimeAt(state: TimerState | undefined, now: number): number | undefined {
	return state && timerStateToZeroTime(state, now)
}
/**
 * When a timer is projected to reach zero, as the gateway reads it for a projectedEndTime: as its zero time reads,
 * apart from a paused timer whose scheduled start is still to come, which reaches zero its duration after that start
 */
function projectedZeroTimeAt(state: TimerState | undefined, now: number): number | undefined {
	if (!state) return undefined
	const scheduledStart = state.paused ? state.resumesAt : null
	const isWaitingForScheduledStart = scheduledStart != null && scheduledStart > now
	return timerStateToZeroTime(state, isWaitingForScheduledStart ? scheduledStart : now)
}
/** The time in hand is published under-positive, and the header shows it over-positive */
function overUnderOf(playlistDoc: PlaylistTimingStateDoc | undefined, now: number): number | undefined {
	const timeInHand = durationAt(playlistDoc?.overUnder, now)
	return timeInHand === undefined ? undefined : 0 - timeInHand
}

/** What the screens show from the publication at the moment */
function publishedScreens(moment: Moment, docs: PublishedDocuments): ShownValues {
	const now = moment.now
	const playlistDoc = docs.playlist
	const currentPartInstanceId = moment.playlist.currentPartInfo?.partInstanceId
	// the on-air timers are shown only while they are about the on-air part
	const onAirTimer = (state: TimerState | undefined) =>
		currentPartInstanceId && playlistDoc?.currentPartInstanceId === currentPartInstanceId ? state : undefined
	const startedPlayback = zeroTimeAt(playlistDoc?.startedPlayback, now)
	const segmentDurations = (shown: (segmentDoc: SegmentTimingStateDoc) => number | undefined) =>
		listText(
			moment.segments.map((segment) => {
				const segmentDoc = docs.segments.get(unprotectString(segment._id))
				// a segment header shows nothing while its remaining duration is not published
				const isShown = segmentDoc !== undefined && segmentDoc.remaining !== undefined
				return [unprotectString(segment._id), isShown ? shown(segmentDoc) : undefined]
			})
		)
	const countdowns = countdownTexts(moment, (part) =>
		durationAt(
			partCountdown(
				docs.parts.find((doc) => doc.partId === part._id),
				playlistDoc
			),
			now
		)
	)

	return new Map([
		['Plan. Start', clockText(zeroTimeAt(playlistDoc?.plannedStart, now))],
		['Plan. Dur', lengthText(durationAt(playlistDoc?.plannedDuration, now))],
		['Plan. End', clockText(zeroTimeAt(playlistDoc?.plannedEnd, now))],
		['Started', clockText(startedPlayback)],
		[
			'Start In',
			lengthText(startedPlayback === undefined ? durationAt(playlistDoc?.plannedStart, now) : undefined),
		],
		['Rem. Dur', lengthText(durationAt(playlistDoc?.remainingDuration, now))],
		['Est. End', clockText(zeroTimeAt(playlistDoc?.estimatedEnd, now))],
		['Over/Under', overUnderText(overUnderOf(playlistDoc, now))],
		['On Air', lengthText(durationAt(onAirTimer(playlistDoc?.remainingOnCurrentPart), now))],
		['Seg. Budg.', lengthText(durationAt(onAirTimer(playlistDoc?.remainingBudgetOnCurrentSegment), now))],
		['segment durations', segmentDurations((segmentDoc) => durationAt(segmentDoc.remaining, now))],
		['fixed segment durations', segmentDurations((segmentDoc) => durationAt(segmentDoc.plannedDuration, now) ?? 0)],
		// the published played-out duration counts up by going negative, and the shelf shows it positive
		['segments counting up', segmentDurations((segmentDoc) => 0 - (durationAt(segmentDoc.playedOut, now) ?? 0))],
		['On Air In', countdowns.onAirIn],
		['part countdowns', countdowns.partCountdowns],
	])
}

/** The length of a segment's content, as the gateway adds it up: its planned, timed parts, as published */
function contentLength(docs: PublishedDocuments, segmentId: string): number {
	return docs.parts
		.filter((doc) => unprotectString(doc.segmentId) === segmentId && !doc.untimed && !doc.orphaned)
		.reduce((sum, doc) => sum + (durationAt(doc.expectedDuration, 0) ?? 0), 0)
}

/** What the gateway sends from the publication in a message at the moment: the documents it holds, evaluated then */
function publishedGateway(moment: Moment, docs: PublishedDocuments): ShownValues {
	if (!moment.playlist.activationId) return new Map()
	const now = moment.now
	const values: ShownValues = new Map([
		[
			'gateway segments',
			listText(
				moment.segments.map((segment) => {
					const key = unprotectString(segment._id)
					return [key, contentLength(docs, key)] as const
				})
			),
		],
		['gateway playlist timers', HEADER_TIMERS],
	])

	const onAir = onAirPartInstance(moment)
	if (!onAir) return values

	const partDoc = docs.parts.find((doc) => doc.partId === onAir.part._id)
	const startTime = onAir.timings?.plannedStartedPlayback ?? now
	const expectedDurationMs = durationAt(partDoc?.expectedDuration, 0) ?? 0
	const projectedEndTime =
		projectedZeroTimeAt(docs.playlist?.remainingOnCurrentPart, now) ?? startTime + expectedDurationMs
	const segmentKey = unprotectString(onAir.segmentId)
	const segmentEndTime = projectedZeroTimeAt(docs.segments.get(segmentKey)?.remaining, now) ?? now
	values.set('gateway part timing', partTimingText(startTime, expectedDurationMs, projectedEndTime))
	values.set('gateway segment timing', segmentTimingText(contentLength(docs, segmentKey), segmentEndTime))
	return values
}

// The rows

/** One value at one moment, in the timing modes where main and the publication show the same two texts */
interface ComparedRow {
	show: string
	moment: ShowInstant
	value: ValueName
	modes: readonly TimingModeName[]
	main: string
	publication: string
	/**
	 * Whether the playlist is active, whether it has started, whether the on-air part is waiting to start, and whether
	 * the next part has started on the timeline, which the gateway has not reported yet
	 */
	active: boolean
	started: boolean
	waitingToStart: boolean
	nextStartedUnreported: boolean
}

function compareMoment(show: ComparedShow, at: ComparedMoment): ComparedRow[] {
	const moment = readMoment(show.script, at)
	const onAirStart = onAirPartInstance(moment)?.timings?.plannedStartedPlayback
	const nextStart = nextPartInstance(moment)?.timings?.plannedStartedPlayback
	const facts = {
		active: !!moment.playlist.activationId,
		started: moment.playlist.startedPlayback !== undefined,
		waitingToStart: onAirStart !== undefined && onAirStart > moment.now,
		// once the gateway reports the start, the part is on air and no longer next
		nextStartedUnreported: nextStart !== undefined && nextStart <= moment.now,
	}
	const modes = TIMING_MODES.map(({ name, timing }) => {
		const docs = publishedDocuments(moment, timing)
		return {
			name,
			main: new Map([...mainScreens(moment, timing), ...mainGateway(moment)]),
			publication: new Map([...publishedScreens(moment, docs), ...publishedGateway(moment, docs)]),
		}
	})

	return VALUES.flatMap((value) => {
		const nothing = value.startsWith('gateway') ? NOT_SENT : HIDDEN
		const groups = new Map<string, ComparedRow>()
		for (const mode of modes) {
			const main = mode.main.get(value) ?? nothing
			const publication = mode.publication.get(value) ?? nothing
			const key = `${main}|${publication}`
			const group = groups.get(key)
			groups.set(
				key,
				group
					? { ...group, modes: [...group.modes, mode.name] }
					: { show: show.name, moment: at, value, modes: [mode.name], main, publication, ...facts }
			)
		}
		return [...groups.values()]
	})
}

// The known differences

interface KnownDifference {
	/** A short name, which the table prints after 'differs:' */
	name: string
	/** What differs from main, and why, in plain words */
	why: string
	explains: (row: ComparedRow) => boolean
}

const BACK_MODES: readonly TimingModeName[] = ['back end', 'back end+duration', 'back start+end']

/** The fields of a gateway timing row, in the order its text lists them */
const GATEWAY_TIMING_FIELDS: Partial<Record<ValueName, readonly string[]>> = {
	'gateway part timing': ['startTime', 'expectedDurationMs', 'projectedEndTime'],
	'gateway segment timing': ['expectedDurationMs', 'projectedEndTime'],
}

/** The entries of a list, as listText writes it: 'B 0:25 C 1:05' has 'B 0:25' and 'C 1:05' */
function listEntries(text: string): string[] {
	return _.chunk(text.split(' '), 2).map((entry) => entry.join(' '))
}

/** The fields of a row whose texts differ: those of a gateway timing, or the keys of a list, as 'C' */
function differingFields(row: ComparedRow): string[] {
	const fieldsOf = (text: string): Map<string, string> => {
		const timingFields = GATEWAY_TIMING_FIELDS[row.value]
		if (timingFields) {
			const words = text.split(' ')
			return new Map(timingFields.map((field, index) => [field, words[index]]))
		}
		return new Map(listEntries(text).map((entry) => [entry.split(' ')[0], entry]))
	}
	const main = fieldsOf(row.main)
	const publication = fieldsOf(row.publication)
	return _.union([...main.keys()], [...publication.keys()]).filter(
		(field) => main.get(field) !== publication.get(field)
	)
}

function differsOnlyIn(row: ComparedRow, field: string): boolean {
	return _.isEqual(differingFields(row), [field])
}

const KNOWN_DIFFERENCES: readonly KnownDifference[] = [
	{
		name: 'BackTime after deactivation',
		why:
			'Once a BackTime playlist has been deactivated, main measured it against its planned end as if the whole ' +
			'show were starting now, so its over/under kept moving with the clock. The publication compares the ' +
			'duration as played with the planned duration, as it does after deactivation in every mode but forward ' +
			'start+end, which measures against its end time. After deactivation the duration as played is the planned ' +
			'length of the parts, so here it holds at U 0:00, however the show went.',
		explains: (row) =>
			row.value === 'Over/Under' &&
			!row.active &&
			row.started &&
			row.modes.every((mode) => BACK_MODES.includes(mode)),
	},
	{
		name: 'a take in multi-gateway mode',
		why:
			'In multi-gateway mode a part starts a moment after its take (2 s here). In that moment main counted the ' +
			'part at its length, so its remaining duration held until the start. The calculator now counts the part to ' +
			'its end from its planned start, so that the projected end holds, and the remaining duration reads longer ' +
			'by the time left until the start. The estimated end and over/under therefore hold at what they read when ' +
			"the part starts, at the first take too, where main's moved on with the clock until then. They agree again " +
			'at the start.',
		explains: (row) => row.waitingToStart && ['Rem. Dur', 'Est. End', 'Over/Under'].includes(row.value),
	},
	{
		name: 'an auto-next start not yet reported',
		why:
			'In multi-gateway mode core schedules the start of the part that a part auto-nexts into, here B2 at ' +
			'12:00:57, and B1 stays on air until the gateway reports that start, here a second later. In that second ' +
			'the calculator counts B2 as started but not on air: it leaves B2 out of the remaining duration, so the ' +
			'estimated end reads 20 s early and the over/under 20 s further under; its countdowns take the end of B2 ' +
			"for its start, so the parts after B2 read 20 s late; and it counts the time since B2's start twice in B, " +
			'for B1 and for B2. Main calculated on every tick, and showed this for the whole second. The publication ' +
			"holds the documents of its last calculation, here at the report of B1's start, in which B1 runs over: the " +
			'remaining duration holds at 1:40, the estimated end moves on with the clock, and the countdowns hold at ' +
			'B2 due now. When the publication calculates again within the second, as it does when anything else it ' +
			'reads changes, it shows what main showed, but the time in B then counts once from that calculation, and ' +
			"the gateway's currentSegment.projectedEndTime reads early by the time B2 had run by then. They agree " +
			'again once the gateway reports the start.',
		explains: (row) =>
			row.nextStartedUnreported &&
			(['Rem. Dur', 'Est. End', 'Over/Under', 'On Air In', 'part countdowns'].includes(row.value) ||
				((row.value === 'segment durations' || row.value === 'segments counting up') &&
					differsOnlyIn(row, 'B')) ||
				(row.value === 'gateway segment timing' && differsOnlyIn(row, 'projectedEndTime'))),
	},
	{
		name: 'resolved lengths on the gateway',
		why:
			"The gateway now sends a part's length as the calculator resolves it: a part with no length of its own in a " +
			"display-duration group reads its share of the group, what the parts before it leave, and a segment's " +
			'expectedDurationMs adds up these lengths. So in the segments topic it changes during the show: C reads ' +
			"0:40 until C1 is cut short at 7 s, and 0:43 after, with C2's share of 0:03. Main's gateway sent the length " +
			'set on the part, 0:00, and C read 0:40 throughout.',
		explains: (row) =>
			row.show === DISPLAY_DURATION_GROUP.name &&
			(((row.value === 'gateway part timing' || row.value === 'gateway segment timing') &&
				differsOnlyIn(row, 'expectedDurationMs')) ||
				(row.value === 'gateway segments' && differsOnlyIn(row, 'C'))),
	},
	{
		name: 'a part taken again, on the gateway',
		why:
			'A part set as next again counts twice in its segment, in the segment header on main and on the ' +
			"publication alike. The gateway's currentSegment.projectedEndTime now comes from the same remaining time, " +
			"so it counts the part twice too; main's gateway counted it once.",
		explains: (row) =>
			row.show === A1_TAKEN_AGAIN.name &&
			row.value === 'gateway segment timing' &&
			differsOnlyIn(row, 'projectedEndTime'),
	},
	{
		name: 'new on the gateway',
		why:
			'The gateway now sends the playlist timers the header reads, remainingDuration, estimatedEnd and ' +
			"timeInHand, as timer states for a consumer to evaluate. Main's gateway sent none.",
		explains: (row) => row.value === 'gateway playlist timers' && row.main === NOT_SENT,
	},
]

function differenceExplaining(row: ComparedRow): KnownDifference | undefined {
	if (row.main === row.publication) return undefined
	const explaining = KNOWN_DIFFERENCES.filter((difference) => difference.explains(row))
	if (explaining.length !== 1) {
		const explainedBy = explaining.length === 0 ? 'no known difference' : 'more than one known difference'
		throw new Error(
			`${row.show}, ${row.moment.at}, ${row.value} in ${modesText(row.modes)}: main shows ${row.main} and the ` +
				`publication ${row.publication}, which ${explainedBy} explains`
		)
	}
	return explaining[0]
}

// The table

const MODE_FAMILIES = ['none', 'forward', 'back', 'duration'] as const
const EVERY_MODE: readonly TimingModeName[] = TIMING_MODES.map((mode) => mode.name)

/** The modes of a row, naming the modes of a family by the family when it has them all: 'the back modes' */
function modesText(modes: readonly TimingModeName[]): string {
	if (modes.length === EVERY_MODE.length) return 'every mode'
	if (modes.length > EVERY_MODE.length / 2) {
		return `every mode but ${modesText(EVERY_MODE.filter((mode) => !modes.includes(mode)))}`
	}
	return MODE_FAMILIES.flatMap((family) => {
		const ofFamily = EVERY_MODE.filter((mode) => mode.split(' ')[0] === family)
		const included = ofFamily.filter((mode) => modes.includes(mode))
		return included.length === ofFamily.length ? [`the ${family} modes`] : included
	}).join(', ')
}

const TABLE_FILE = path.join(__dirname, 'comparisonWithMain.txt')
const UPDATE_TABLE = process.env.UPDATE_TIMING_COMPARISON === '1'

/** Lines of at most this many characters, for prose */
const TEXT_WIDTH = 116
/** The width of the value column, and of the main and publication columns */
const VALUE_WIDTH = 23
const CELL_WIDTH = 28

/** Prose wrapped into lines, the first starting with the lead and the others indented as far */
function wrapped(lead: string, text: string): string[] {
	const indent = ' '.repeat(lead.length)
	const lines: string[] = []
	let line = ''
	for (const word of text.split(' ')) {
		const start = lines.length === 0 ? lead : indent
		if (line !== '' && start.length + line.length + 1 + word.length > TEXT_WIDTH) {
			lines.push(start + line)
			line = word
		} else {
			line = line === '' ? word : `${line} ${word}`
		}
	}
	lines.push((lines.length === 0 ? lead : indent) + line)
	return lines
}

const PREAMBLE = [
	'The timing publication against main.',
	'',
	...wrapped(
		'',
		'Written by comparisonWithMain.test.ts, next to this file. Do not edit it by hand: to rewrite it from what the ' +
			'code gives today, run that test with UPDATE_TIMING_COMPARISON=1 set, and review the diff.'
	),
	'',
	...wrapped(
		'',
		'Each block is one moment of one show. Each row is a value a screen or the gateway shows: as main showed it, as ' +
			'it is shown from the publication, and whether they are the same. A row says which timing modes it covers ' +
			'when it does not cover all twelve; "the back modes" are back end, back end+duration and back start+end, ' +
			'and likewise for the none, forward and duration modes. Lengths are m:ss, clock times are UTC, and ' +
			'Over/Under is O for over and U for under, as the header shows it. "Shown by neither" lists what no screen ' +
			'shows and the gateway does not send at that moment.'
	),
	'',
	...wrapped(
		'',
		'The screens: Plan. Start to Seg. Budg. are the values of the rundown header. Segment durations are what the ' +
			'segment headers show, fixed segment durations what they show in a view layout with a fixed segment ' +
			"duration, and segments counting up what the shelf's segment timing panel shows when it counts up. On Air " +
			'In are the countdowns to the first part of each segment, and part countdowns those to the other parts. ' +
			"The gateway: part timing is activePlaylist's currentPart.timing (startTime, expectedDurationMs, " +
			'projectedEndTime), segment timing its currentSegment.timing (expectedDurationMs, projectedEndTime), ' +
			"segments each segment's expectedDurationMs in the segments topic, and playlist timers activePlaylist's " +
			'timing.'
	),
	'',
	...wrapped(
		'',
		"The planned values and the gateway's playlist timers do not change during a show: every moment compares " +
			'them, but the table lists a row of theirs only the first time it reads as it does.'
	),
	'',
	'What differs from main:',
	...KNOWN_DIFFERENCES.flatMap((difference) => wrapped('- ', `${difference.name}: ${difference.why}`)),
	'',
	`  ${'value'.padEnd(VALUE_WIDTH)}  ${'main'.padEnd(CELL_WIDTH)}  ${'publication'.padEnd(CELL_WIDTH)}  verdict`,
]

/** A cell's lines: a list too long for its column wraps between its entries */
function cellLines(text: string): string[] {
	if (text.length <= CELL_WIDTH) return [text]
	const lines: string[] = []
	for (const entry of listEntries(text)) {
		const last = lines.length - 1
		if (last >= 0 && lines[last].length + 1 + entry.length <= CELL_WIDTH) lines[last] += ` ${entry}`
		else lines.push(entry)
	}
	return lines
}

function rowLines(row: ComparedRow): string[] {
	const difference = differenceExplaining(row)
	const inModes = row.modes.length === EVERY_MODE.length ? '' : ` in ${modesText(row.modes)}`
	const verdict = difference ? `differs${inModes}: ${difference.name}` : `same${inModes}`
	const main = cellLines(row.main)
	const publication = cellLines(row.publication)
	return _.range(Math.max(main.length, publication.length)).map((index) => {
		const value = index === 0 ? row.value : ''
		const line = `  ${value.padEnd(VALUE_WIDTH)}  ${(main[index] ?? '').padEnd(CELL_WIDTH)}  ${(publication[index] ?? '').padEnd(CELL_WIDTH)}`
		return index === 0 ? `${line}  ${verdict}` : line.trimEnd()
	})
}

function isShownByNeither(row: ComparedRow): boolean {
	return row.main === row.publication && (row.main === HIDDEN || row.main === NOT_SENT)
}

/** What a row of a value listed once reads: a row that reads the same as one listed before is not listed again */
function readingOf(row: ComparedRow): string {
	return [row.value, ...row.modes, row.main, row.publication].join('|')
}

function formatTable(rows: readonly ComparedRow[]): string {
	const lines = [...PREAMBLE]
	const listedOnce = new Set<string>()
	const isListedBefore = (row: ComparedRow) => LISTED_ONCE.has(row.value) && listedOnce.has(readingOf(row))
	for (const show of SHOWS) {
		lines.push('', `=== ${show.name}`)
		for (const moment of show.moments) {
			lines.push('', `${moment.at}  ${moment.what}`)
			const atMoment = rows.filter(
				(row) => row.show === show.name && row.moment === moment && !isListedBefore(row)
			)
			atMoment.filter((row) => LISTED_ONCE.has(row.value)).forEach((row) => listedOnce.add(readingOf(row)))
			lines.push(...atMoment.filter((row) => !isShownByNeither(row)).flatMap(rowLines))
			const shownByNeither = atMoment
				.filter(isShownByNeither)
				.map((row) =>
					row.modes.length === EVERY_MODE.length ? row.value : `${row.value} in ${modesText(row.modes)}`
				)
			if (shownByNeither.length > 0) lines.push(...wrapped('  shown by neither: ', shownByNeither.join(', ')))
		}
	}
	return lines.join('\n') + '\n'
}

describe('the timing publication against main', () => {
	const rows = SHOWS.flatMap((show) => show.moments.flatMap((moment) => compareMoment(show, moment)))

	afterAll(() => {
		if (UPDATE_TABLE) fs.writeFileSync(TABLE_FILE, formatTable(rows))
	})

	it('every difference from main is a known difference', () => {
		expect(() => rows.forEach(differenceExplaining)).not.toThrow()
	})

	it('every known difference is seen', () => {
		const seen = new Set(rows.map(differenceExplaining))
		expect(KNOWN_DIFFERENCES.filter((difference) => !seen.has(difference)).map(({ name }) => name)).toEqual([])
	})

	it('the table is as the file has it', () => {
		if (UPDATE_TABLE) return
		const text = fs.existsSync(TABLE_FILE) ? fs.readFileSync(TABLE_FILE, 'utf8') : ''
		expect(formatTable(rows)).toBe(text)
	})
})
