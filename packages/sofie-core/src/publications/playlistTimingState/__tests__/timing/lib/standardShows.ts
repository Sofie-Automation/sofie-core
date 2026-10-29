import { PlaylistTimingType, type RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'
import { type Gateway, GATEWAY_CONFIRMING_AT_ONCE, playoutScript, type PlayoutScript } from './playoutScript'
import { clock, length, referenceRundown, type RundownVariant } from './referenceRundown'

/**
 * The standard shows of the timing tests: the reference rundown played from A1 to D2 on time, late and early, a
 * run-through before the show, and the first takes in multi-gateway mode. Unless a show says otherwise, a gateway
 * confirms every start at once.
 *
 * A show is written as its steps rather than as a script, so that a test can play the same show with another playlist
 * timing, in rehearsal, with a changed rundown, or deactivated part way through:
 *
 *   playShow(LATE_SHOW)                                        // on air, planned to start at 12:00:00 and last 2:30
 *   playShow(LATE_SHOW, { rehearsal: true })
 *   playShow(LATE_SHOW, { variant: { segments: { C: budget('1:00') } } })
 *   playShow(deactivatedAt(LATE_SHOW, '12:01:23', instants))   // the same show, deactivated while B1 is 13 s over
 *
 * Each show lists the moments worth reading it at, each with what is happening then in plain words.
 */

/** The playlist timing every standard show is planned with, unless a test plays it with another: from 12:00:00 for 2:30 */
export const PLANNED_TIMING: RundownPlaylistTiming = {
	type: PlaylistTimingType.ForwardTime,
	expectedStart: clock('12:00:00'),
	expectedDuration: length('2:30'),
}

/** A moment a show is read at, and what is happening then */
export interface ShowInstant {
	/** A clock time: '12:01:23' */
	at: string
	/** In plain words: 'B1 13 s over' */
	what: string
}

/** A show of the reference rundown: when it is activated, when each part is taken, and when it is deactivated */
export interface StandardShow {
	/** The show in plain words, as test names use it */
	name: string
	/** A gateway that confirms each start at once, unless set */
	gateway?: Gateway
	activateAt: string
	/** When each part is taken: the first take takes A1, and each take after it the next part in the rundown */
	takes: readonly string[]
	/** When the playlist is deactivated; a show without one stays active */
	deactivateAt?: string
	/** The moments worth reading the show at, in time order */
	instants: readonly ShowInstant[]
}

/** How a test plays a standard show, when not as planned */
export interface ShowOptions {
	/** The playlist timing; PLANNED_TIMING unless set */
	timing?: RundownPlaylistTiming
	/** Activate the playlist in rehearsal rather than on air */
	rehearsal?: boolean
	variant?: RundownVariant
}

/** The script of a standard show */
export function playShow(show: StandardShow, options: ShowOptions = {}): PlayoutScript {
	let script = playoutScript({
		rundown: referenceRundown(options.variant),
		timing: options.timing ?? PLANNED_TIMING,
		gateway: show.gateway ?? GATEWAY_CONFIRMING_AT_ONCE,
	}).activate(show.activateAt, { rehearsal: options.rehearsal ?? false })
	for (const takeAt of show.takes) script = script.take(takeAt)
	if (show.deactivateAt !== undefined) script = script.deactivate(show.deactivateAt)
	return script
}

/**
 * The show up to a clock time, deactivated then: the takes before that time, and the deactivation, read at the moments
 * given. A gateway that confirms at once has reported every take by then
 */
export function deactivatedAt(show: StandardShow, at: string, instants: readonly ShowInstant[]): StandardShow {
	const deactivation = clock(at)
	const isAfterShowEnd = show.deactivateAt !== undefined && deactivation >= clock(show.deactivateAt)
	if (deactivation <= clock(show.activateAt) || isAfterShowEnd) {
		throw new Error(`${show.name} is not active at ${at}`)
	}
	if (show.gateway !== undefined && show.gateway !== GATEWAY_CONFIRMING_AT_ONCE) {
		throw new Error(`${show.name} has a gateway that may report a take after ${at}`)
	}

	return {
		name: `${show.name}, deactivated at ${at}`,
		activateAt: show.activateAt,
		takes: show.takes.filter((takeAt) => clock(takeAt) < deactivation),
		deactivateAt: at,
		instants,
	}
}

/** Every part taken at its planned time, and the playlist deactivated at the planned end */
export const ON_TIME_SHOW: StandardShow = {
	name: 'the show on time',
	activateAt: '11:59:00',
	takes: [
		'12:00:00',
		'12:00:10',
		'12:00:20',
		'12:00:30',
		'12:00:50',
		'12:01:10',
		'12:01:20',
		'12:01:40',
		'12:02:10',
		'12:02:20',
	],
	deactivateAt: '12:02:30',
	instants: [
		{ at: '11:59:45', what: 'activated, 15 s before the planned start' },
		{ at: '12:00:05', what: 'A1 5 s in' },
		{ at: '12:01:55', what: 'C3 15 s in' },
		{ at: '12:02:25', what: 'D2, the last part, 5 s in' },
		{ at: '12:02:45', what: '15 s after the deactivation at the planned end' },
	],
}

/**
 * The first take 20 s late; B1 runs 53 s, 33 s over; C1 is cut short at 7 s; the last part ends at 12:03:20, 50 s after
 * the planned end, and the playlist stays active 20 s more, with nothing next
 */
export const LATE_SHOW: StandardShow = {
	name: 'the late show',
	activateAt: '11:59:00',
	takes: [
		'12:00:20',
		'12:00:30',
		'12:00:40',
		'12:00:50',
		'12:01:43',
		'12:02:03',
		'12:02:10',
		'12:02:30',
		'12:03:00',
		'12:03:10',
	],
	deactivateAt: '12:03:40',
	instants: [
		{ at: '11:58:30', what: 'not yet activated' },
		{ at: '11:59:30', what: 'activated, nothing taken' },
		{ at: '12:00:10', what: 'the planned start passed, nothing taken' },
		{ at: '12:00:20', what: 'A1 taken 20 s late' },
		{ at: '12:00:25', what: 'A1 5 s in' },
		{ at: '12:01:10', what: 'B1 at its planned end' },
		{ at: '12:01:23', what: 'B1 13 s over' },
		{ at: '12:01:40', what: 'B1 30 s over' },
		{ at: '12:01:43', what: 'B2 taken after B1 ran 53 s' },
		{ at: '12:02:10', what: 'C2 taken, C1 cut short at 7 s' },
		{ at: '12:02:35', what: 'past the planned end' },
		{ at: '12:03:15', what: 'the last part 5 s in' },
		{ at: '12:03:35', what: 'the last part 15 s past its end, nothing next' },
		{ at: '12:03:45', what: '5 s after the deactivation' },
	],
}

/** The first take 10 s early, every part a little off its planned length, and the show 11 s early */
export const EARLY_SHOW: StandardShow = {
	name: 'the early show',
	activateAt: '11:59:00',
	takes: [
		'11:59:50',
		'12:00:03',
		'12:00:14',
		'12:00:21',
		'12:00:44',
		'12:01:01',
		'12:01:12',
		'12:01:29',
		'12:01:58',
		'12:02:07',
	],
	deactivateAt: '12:02:19',
	instants: [
		{ at: '11:59:50', what: 'A1 taken 10 s early' },
		{ at: '11:59:55', what: 'A1 5 s in, before the planned start' },
		{ at: '12:00:00', what: 'the planned start, A1 at its planned end' },
		{ at: '12:00:15', what: 'A3 1 s in' },
		{ at: '12:02:07', what: 'D2 taken' },
		{ at: '12:02:35', what: 'after the planned end, deactivated 11 s before it' },
	],
}

/** A1 to A3 run through three minutes before the planned start, and the playlist deactivated again */
export const RUN_THROUGH_BEFORE_THE_SHOW: StandardShow = {
	name: 'a run-through three minutes before the show',
	activateAt: '11:57:00',
	takes: ['11:57:10', '11:57:21', '11:57:33'],
	deactivateAt: '11:57:50',
	instants: [
		{ at: '11:57:55', what: '5 s after the run-through' },
		{ at: '11:59:45', what: '15 s before the planned start' },
		{ at: '12:00:10', what: '10 s after the planned start' },
	],
}

/** The first two takes in multi-gateway mode, each part scheduled to start 2 s after its take */
export const FIRST_TAKES_IN_MULTI_GATEWAY_MODE: StandardShow = {
	name: 'the first takes in multi-gateway mode',
	gateway: { kind: 'multi gateway', latencyMs: 2000 },
	activateAt: '11:59:00',
	takes: ['12:00:20', '12:00:33'],
	instants: [
		{ at: '12:00:21', what: 'A1 taken 1 s ago, scheduled to start 2 s after the take' },
		{ at: '12:00:22', what: 'the gateway reports A1 started' },
		{ at: '12:00:34', what: 'A2 taken 1 s ago, still waiting to start' },
	],
}
