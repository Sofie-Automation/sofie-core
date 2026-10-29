import { CountdownType } from '@sofie-automation/blueprints-integration'
import type { PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	offsetTimerState,
	type TimerState,
	timerStateToDuration,
	timerStateToZeroTime,
} from '@sofie-automation/corelib/dist/dataModel/TimerState'
import {
	getPartTimingStateDocId,
	getPlaylistTimingStateDocId,
	getSegmentTimingStateDocId,
	type PartTimingStateDoc,
	type PlaylistTimingStateDoc,
	type SegmentTimingStateDoc,
	type TimingStateDoc,
	type TimingStateDocId,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { formatClock, formatLength } from './referenceRundown'

/**
 * Renders the documents of the playlist timing publication as plain text, as a client holding them would read
 * them at one instant. The timing tests pin this text, so that a change in what the publication publishes shows
 * as a readable change of the text.
 *
 * A read in full looks like this:
 *
 *   12:00:10, published 12:00:05
 *     plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
 *     show       started 12:00:05  remaining 2:25 runs until 12:00:15  ends 12:02:35 fixed until 12:00:15  in hand 0:00 holds until 12:00:15
 *     on air     A1 in A  left 0:05 running since 12:00:05  budget none  auto-next no
 *     segment A  parts  planned 0:30  played 0:05 runs  left 0:25 runs
 *     ...        (one line per segment)
 *     order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
 *     countdown  runs until 12:00:15: A2 0:05  A3 0:15  B1 0:25  ...
 *     as planned A3 B1 B2 C1 C2 C3 D1 D2
 *     A1         on air  planned 0:10  drawn 0:10  played 0:05 running since 12:00:05  length 0:10 holds until 12:00:15  width 0:10 holds until 12:00:15
 *     A2         next  planned 0:10  drawn 0:10  played 0:00  length 0:10  width 0:10
 *     counted    all
 *     untimed    none
 *     orphaned   none
 *     in loop    none
 *
 * The first line is the instant, and when the publication last calculated the documents: the last change of its
 * inputs. Every value is the published value read at the instant. Then, line by line:
 * - plan: the playlist's timing type, planned start, planned end and planned duration.
 * - show: when the show started, the remaining duration, the estimated end, and the time in hand (positive is
 *   ahead of the plan, negative behind it).
 * - on air: the on-air part and its segment, the time left of the part and of the segment's budget, and whether
 *   the part will auto-next.
 * - segment: for each segment, in published order, what it counts down (its parts or its budget), its planned
 *   length, how much of it has played, and what is left.
 * - order: the parts by their published rank. An underscore stands for a rank no part document has, which happens
 *   when a later PartInstance of a part replaces an earlier one's document.
 * - countdown: the time until each part goes on air, one line per way the countdowns move, in rank order. Parts
 *   that are not listed have no countdown; 'countdown  none' when no part has one. A part's countdown is the
 *   playlist's base for the part countdowns shifted by the part's offset, as a client composes it.
 * - as planned: parts without a PartInstance whose part line would read exactly as planned and unplayed: the
 *   planned and drawn lengths and the length and width equal the part's planned length, nothing played, and none
 *   of it moving. Left out when there are none.
 * - finished: PartInstances that are not on air or next, whose planned and drawn lengths are the part's planned
 *   length, and whose played time, length and width are one length that does not move; that length is printed.
 *   Left out when there are none.
 * - a line for each other part, in rank order: on air, next, instance (a PartInstance that is neither) or no
 *   instance; the segment ('in C') when it is not the part's own segment in the rundown; then the planned length,
 *   the drawn length, the played time, the length, and the width (the drawn length as it grows while on air).
 * - counted: whether each part counts towards the playlist's timing: 'all', or 'all but' the parts that do not.
 * - untimed: the parts that are untimed, as set on the part, or 'none'.
 * - orphaned: the parts whose PartInstance has no part in the rundown (an adlib, or a part removed since), or
 *   'none'.
 * - in loop: the parts inside the loop, or 'none'.
 *
 * A replayed part is labelled by the order of its PartInstances, 'A2 (2nd take)', when the publication reads more
 * than one PartInstance of it.
 *
 * Lengths are m:ss, h:mm:ss from one hour, with .mmm only when the milliseconds are not zero, and a leading '-'
 * when negative. Clock times are UTC on the reference day. 'none' is a value that is not published.
 *
 * Played times, played-out times, lengths and widths are published counting down from zero as they grow (the
 * transport convention for a growing value); they are printed the way they grow, without that minus sign.
 *
 * How a value moves after the instant is said in words after it, so that the value and the words give back the
 * published timer state exactly:
 *
 *   timer state                        a length                   a clock time
 *   paused                             0:40                       12:02:40 moving
 *   paused, resumes after the instant  0:40 holds until t         12:02:40 moving until t
 *   paused, resumed by the instant     0:35 running since t       12:02:40 fixed since t
 *   running                            0:25 runs                  12:02:30
 *   running, pauses after the instant  2:25 runs until t          12:02:35 fixed until t
 *   running, paused by the instant     0:00 held since t          12:02:35 moving since t
 *
 * A countdown line names the movement once, before its parts: 'holds' for a paused countdown that does not resume.
 *
 * The documents a client holds were calculated when the publication's inputs last changed. A calculation at the
 * instant itself is made as well, and any value that it reads differently is followed by that value:
 * '0:40 (fresh 0:35)'.
 *
 * A read can compare timing modes: the same show calculated with each playlist timing. It then prints one row per
 * mode, named by the mode, instead of the plan and show lines; the 'plan' view prints the plan in each mode the
 * same way. Everything else is printed once, and the read fails if any mode would print it differently.
 *
 * Every field of every document is printed, or checked, by the field lists below. A document with a field the
 * text does not know is refused, so that a value the publication starts to publish has to be added to the text.
 * So is a document whose flag is missing or not true or false, which would otherwise read as false.
 */

/** The rendered text. The snapshot serializer prints it as it is, without quotes */
export class TimingText {
	constructor(readonly text: string) {}
}

/** For `expect.addSnapshotSerializer`: prints a TimingText as its plain text */
export const timingTextSerializer = {
	test: (value: unknown): boolean => value instanceof TimingText,
	serialize: (value: TimingText): string => value.text,
}

/**
 * What the text needs from the publication's inputs, which the documents do not say
 */
export interface TimingTextInputs {
	/**
	 * The rundown's parts at the read, as stored rather than as the publication adjusts them for a running loop:
	 * the planned length a part is compared with for 'as planned' and 'finished', and the segment it is in
	 */
	parts: ReadonlyArray<Pick<DBPart, '_id' | 'segmentId' | 'expectedDurationWithTransition'>>
	/** The PartInstances the publication read: those of the current activation that are not reset */
	partInstances: ReadonlyArray<Pick<DBPartInstance, '_id' | 'takeCount'> & { part: Pick<DBPart, '_id'> }>
	/** The Next PartInstance, which no document names */
	nextPartInstanceId: PartInstanceId | undefined
}

/** The documents of the publication for one playlist timing */
export interface TimingCalculation {
	/** The name of the timing mode, when the read compares modes */
	mode?: string
	/** The documents as published: calculated when the publication's inputs last changed */
	published: ReadonlyArray<TimingStateDoc>
	/** The documents a calculation at the instant itself gives, from the same inputs */
	fresh: ReadonlyArray<TimingStateDoc>
}

/**
 * Which lines a read prints:
 * - full: every line;
 * - show: the plan, show and on-air lines;
 * - plan: the plan line.
 */
export type TimingTextView = 'full' | 'show' | 'plan'

export interface TimingRead {
	/** The instant the documents are read at */
	instant: number
	/** When the publication calculated the published documents */
	publishedAt: number
	view: TimingTextView
	inputs: TimingTextInputs
	/** One calculation without a mode name, or one per timing mode in the order of the rows */
	calculations: ReadonlyArray<TimingCalculation>
}

// The fields of each document type, in the order the text prints them, and where

type FieldList<Doc> = { readonly [Field in keyof Doc]-?: string }

const PLAYLIST_FIELDS: FieldList<PlaylistTimingStateDoc> = {
	_id: 'checked: the playlist document id',
	type: 'checked: the document type',
	playlistId: 'checked: the same in every document',
	timingType: 'plan',
	plannedStart: 'plan: start',
	plannedEnd: 'plan: end',
	plannedDuration: 'plan: duration',
	startedPlayback: 'show: started',
	remainingDuration: 'show: remaining',
	estimatedEnd: 'show: ends',
	overUnder: 'show: in hand',
	currentPartInstanceId: 'on air: the part',
	currentSegmentId: 'on air: in',
	remainingOnCurrentPart: 'on air: left',
	remainingBudgetOnCurrentSegment: 'on air: budget',
	currentPartWillAutoNext: 'on air: auto-next',
	partCountdownBase: 'countdown: what every part countdown is a shift of',
}

const SEGMENT_FIELDS: FieldList<SegmentTimingStateDoc> = {
	_id: 'checked: the document id of the segment',
	type: 'checked: the document type',
	playlistId: 'checked: the same in every document',
	segmentId: 'segment: the key',
	countdownType: 'segment: parts or budget',
	plannedDuration: 'segment: planned',
	playedOut: 'segment: played',
	remaining: 'segment: left',
}

const PART_FIELDS: FieldList<PartTimingStateDoc> = {
	_id: 'checked: the document id of the part',
	type: 'checked: the document type',
	playlistId: 'checked: the same in every document',
	partId: 'part: the key',
	rank: 'order',
	countdownOffset: 'countdown',
	partInstanceId: 'part: on air, next, instance or no instance',
	segmentId: "part: in, when it is not the part's own segment",
	expectedDuration: 'part: planned',
	displayDuration: 'part: drawn',
	played: 'part: played',
	duration: 'part: length',
	liveDisplayDuration: 'part: width',
	countsTowardsTiming: 'counted',
	untimed: 'untimed',
	orphaned: 'orphaned',
	isInQuickLoop: 'in loop',
}

/** The fields the text knows, of each document type: for the tests of the text itself */
export const TIMING_TEXT_FIELDS: Readonly<Record<TimingStateDoc['type'], ReadonlyArray<string>>> = {
	playlist: Object.keys(PLAYLIST_FIELDS),
	segment: Object.keys(SEGMENT_FIELDS),
	part: Object.keys(PART_FIELDS),
}

/** The fields of a document type that are always true or false: a flag that is missing is refused, not read as false */
type Flags<Doc> = { readonly [Field in keyof Doc as Doc[Field] extends boolean ? Field : never]-?: true }

const PLAYLIST_FLAGS: Flags<PlaylistTimingStateDoc> = { currentPartWillAutoNext: true }
const SEGMENT_FLAGS: Flags<SegmentTimingStateDoc> = {}
const PART_FLAGS: Flags<PartTimingStateDoc> = {
	countsTowardsTiming: true,
	untimed: true,
	orphaned: true,
	isInQuickLoop: true,
}

const TIMER_STATE_FIELDS: ReadonlySet<string> = new Set(['paused', 'zeroTime', 'pauseTime', 'resumesAt', 'duration'])

// Reading the documents

/** The documents of one calculation, by type */
interface Documents {
	playlist: PlaylistTimingStateDoc
	/** In published order */
	segments: SegmentTimingStateDoc[]
	/** By rank */
	parts: PartTimingStateDoc[]
}

function checkFields(doc: object, fields: object, flags: object, what: string): void {
	const values = doc as Record<string, unknown>
	for (const [field, value] of Object.entries<unknown>(values)) {
		if (!Object.hasOwn(fields, field)) {
			throw new Error(`The ${what} has a field the timing text does not know: "${field}". Add it to the text`)
		}
		if (typeof value === 'object' && value !== null) checkTimerState(value, `${field} of the ${what}`)
	}
	for (const flag of Object.keys(flags)) {
		if (typeof values[flag] !== 'boolean') {
			throw new Error(`The ${what} has "${flag}" ${JSON.stringify(values[flag])}, not true or false`)
		}
	}
}

/** Every object in a timing document is a timer state, of one of its two shapes */
function checkTimerState(state: object, where: string): void {
	const fields = state as Record<string, unknown>
	for (const field of Object.keys(fields)) {
		if (!TIMER_STATE_FIELDS.has(field)) {
			throw new Error(`The timer state ${where} has a field the timing text does not know: "${field}"`)
		}
	}

	const isWholeNumber = (value: unknown) => Number.isInteger(value)
	const isAbsent = (value: unknown) => value === undefined || value === null
	const paused = fields.paused === true && isWholeNumber(fields.duration) && fields.zeroTime === undefined
	const running = fields.paused === false && isWholeNumber(fields.zeroTime) && fields.duration === undefined
	if (paused && isAbsent(fields.pauseTime) && (isAbsent(fields.resumesAt) || isWholeNumber(fields.resumesAt))) return
	if (running && isAbsent(fields.resumesAt) && (isAbsent(fields.pauseTime) || isWholeNumber(fields.pauseTime))) return

	throw new Error(`The timer state ${where} is not a paused or a running timer state: ${JSON.stringify(state)}`)
}

function readDocuments(docs: ReadonlyArray<TimingStateDoc>): Documents {
	const playlists = docs.filter((doc): doc is PlaylistTimingStateDoc => doc.type === 'playlist')
	if (playlists.length !== 1) throw new Error(`Expected one playlist document, not ${playlists.length}`)
	const playlist = playlists[0]
	const playlistId = playlist.playlistId

	const segments: SegmentTimingStateDoc[] = []
	const parts: PartTimingStateDoc[] = []
	for (const doc of docs) {
		if (doc.playlistId !== playlistId) {
			throw new Error(`Document "${doc._id}" is of playlist "${doc.playlistId}", not "${playlistId}"`)
		}

		switch (doc.type) {
			case 'playlist':
				checkFields(doc, PLAYLIST_FIELDS, PLAYLIST_FLAGS, 'playlist document')
				checkDocumentId(doc, getPlaylistTimingStateDocId(playlistId))
				break
			case 'segment':
				checkFields(doc, SEGMENT_FIELDS, SEGMENT_FLAGS, `document of segment ${doc.segmentId}`)
				checkDocumentId(doc, getSegmentTimingStateDocId(doc.segmentId))
				segments.push(doc)
				break
			case 'part':
				checkFields(doc, PART_FIELDS, PART_FLAGS, `document of part ${doc.partId}`)
				checkDocumentId(doc, getPartTimingStateDocId(doc.partId))
				checkCountdownOffset(doc)
				parts.push(doc)
				break
			default:
				throw new Error(`A document of a type the timing text does not know: ${JSON.stringify(doc)}`)
		}
	}

	parts.sort((a, b) => a.rank - b.rank)
	return { playlist, segments, parts }
}

/** A countdown offset, like every value of a timer state, is a whole number of milliseconds */
function checkCountdownOffset(doc: PartTimingStateDoc): void {
	const offset = doc.countdownOffset
	if (offset === undefined || Number.isInteger(offset)) return
	throw new Error(
		`The document of part ${doc.partId} has the countdown offset ${offset}, not a whole number of milliseconds`
	)
}

/** A part's countdown, as a client composes it: the playlist's base for the part countdowns, shifted by the part's offset */
function partCountdown(doc: PartTimingStateDoc, playlist: PlaylistTimingStateDoc): TimerState | undefined {
	if (doc.countdownOffset === undefined) return undefined
	return offsetTimerState(playlist.partCountdownBase, doc.countdownOffset)
}

function checkDocumentId(doc: TimingStateDoc, expectedId: TimingStateDocId): void {
	if (doc._id !== expectedId) throw new Error(`Document "${doc._id}" should have the id "${expectedId}"`)
}

function documentIds(documents: Documents): string {
	return [documents.playlist, ...documents.segments, ...documents.parts]
		.map((doc) => unprotectString(doc._id))
		.sort()
		.join(' ')
}

/** The published and the fresh documents of one calculation */
interface Calculation {
	mode: string | undefined
	published: Documents
	fresh: Documents
}

function readCalculation(calculation: TimingCalculation): Calculation {
	const published = readDocuments(calculation.published)
	const fresh = readDocuments(calculation.fresh)
	if (documentIds(published) !== documentIds(fresh)) {
		throw new Error(
			`The fresh calculation has other documents than the published one: ${documentIds(fresh)}, not ${documentIds(published)}`
		)
	}
	return { mode: calculation.mode, published, fresh }
}

// Values and how they move

/** A value as printed, read at the instant, and the same value with the words for how it moves from there */
interface Phrase {
	/** The value at the instant, which is what the fresh calculation is compared by */
	value: string
	text: string
}

const NONE: Phrase = { value: 'none', text: 'none' }

function plainPhrase(value: string): Phrase {
	return { value, text: value }
}

function withMotion(value: string, motion: string): Phrase {
	return { value, text: motion ? `${value} ${motion}` : value }
}

/** How a length moves after the instant; empty when it does not move at all */
function lengthMotion(state: TimerState, instant: number): string {
	if (state.paused) {
		if (state.resumesAt === undefined || state.resumesAt === null) return ''
		return state.resumesAt > instant
			? `holds until ${formatClock(state.resumesAt)}`
			: `running since ${formatClock(state.resumesAt)}`
	} else {
		if (state.pauseTime === undefined || state.pauseTime === null) return 'runs'
		return state.pauseTime > instant
			? `runs until ${formatClock(state.pauseTime)}`
			: `held since ${formatClock(state.pauseTime)}`
	}
}

/** How a clock time moves after the instant; empty when it does not move at all */
function clockMotion(state: TimerState, instant: number): string {
	if (state.paused) {
		if (state.resumesAt === undefined || state.resumesAt === null) return 'moving'
		return state.resumesAt > instant
			? `moving until ${formatClock(state.resumesAt)}`
			: `fixed since ${formatClock(state.resumesAt)}`
	} else {
		if (state.pauseTime === undefined || state.pauseTime === null) return ''
		return state.pauseTime > instant
			? `fixed until ${formatClock(state.pauseTime)}`
			: `moving since ${formatClock(state.pauseTime)}`
	}
}

/** A length: the timer state's duration read */
function lengthPhrase(state: TimerState | undefined, instant: number): Phrase {
	if (!state) return NONE
	return withMotion(formatLength(timerStateToDuration(state, instant)), lengthMotion(state, instant))
}

/** A growing length, published counting down from zero: printed the way it grows */
function countUpPhrase(state: TimerState | undefined, instant: number): Phrase {
	if (!state) return NONE
	// subtracting rather than negating, so that nothing played prints as 0:00
	return withMotion(formatLength(0 - timerStateToDuration(state, instant)), lengthMotion(state, instant))
}

/** A clock time: the timer state's zero time read */
function clockPhrase(state: TimerState | undefined, instant: number): Phrase {
	if (!state) return NONE
	return withMotion(formatClock(timerStateToZeroTime(state, instant)), clockMotion(state, instant))
}

/** The published phrase, followed by the fresh calculation's value when that reads differently */
function compared(published: Phrase, fresh: Phrase): string {
	return published.value === fresh.value ? published.text : `${published.text} (fresh ${fresh.value})`
}

/** 'name value', with the fresh value when it differs */
function field(name: string, published: Phrase, fresh: Phrase): string {
	return `${name} ${compared(published, fresh)}`
}

/** A value of the published document, with the fresh document's when that reads differently */
function comparedValue<Doc>(docs: readonly [published: Doc, fresh: Doc], phrase: (doc: Doc) => Phrase): string {
	return compared(phrase(docs[0]), phrase(docs[1]))
}

/** 'name value' for a value of the published document, with the fresh document's when that reads differently */
function documentField<Doc>(
	name: string,
	docs: readonly [published: Doc, fresh: Doc],
	phrase: (doc: Doc) => Phrase
): string {
	return field(name, phrase(docs[0]), phrase(docs[1]))
}

/** A paused timer state that does not resume, holding exactly this duration */
function holdsAt(state: TimerState | undefined, duration: number): boolean {
	return (
		!!state &&
		state.paused &&
		(state.resumesAt === undefined || state.resumesAt === null) &&
		state.duration === duration
	)
}

// Naming parts

function ordinal(n: number): string {
	const lastTwo = n % 100
	if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`
	switch (n % 10) {
		case 1:
			return `${n}st`
		case 2:
			return `${n}nd`
		case 3:
			return `${n}rd`
		default:
			return `${n}th`
	}
}

/** The label of each part and PartInstance, and what the rundown says of each part */
class PartNames {
	readonly #instanceLabels = new Map<PartInstanceId, string>()
	readonly #instanceParts = new Map<PartInstanceId, PartId>()
	readonly #rundownParts = new Map<PartId, Pick<DBPart, '_id' | 'segmentId' | 'expectedDurationWithTransition'>>()

	constructor(inputs: TimingTextInputs) {
		for (const part of inputs.parts) this.#rundownParts.set(part._id, part)

		const instancesByPart = new Map<PartId, Array<TimingTextInputs['partInstances'][number]>>()
		for (const partInstance of inputs.partInstances) {
			const instances = instancesByPart.get(partInstance.part._id) ?? []
			instances.push(partInstance)
			instancesByPart.set(partInstance.part._id, instances)
		}
		for (const [partId, instances] of instancesByPart) {
			instances.sort((a, b) => a.takeCount - b.takeCount)
			instances.forEach((partInstance, index) => {
				const label =
					instances.length === 1
						? unprotectString(partId)
						: `${unprotectString(partId)} (${ordinal(index + 1)} take)`
				this.#instanceLabels.set(partInstance._id, label)
				this.#instanceParts.set(partInstance._id, partId)
			})
		}

		if (inputs.nextPartInstanceId !== undefined) this.partInstance(inputs.nextPartInstanceId)
	}

	partInstance(partInstanceId: PartInstanceId): string {
		const label = this.#instanceLabels.get(partInstanceId)
		if (label === undefined) {
			throw new Error(`PartInstance "${partInstanceId}" is not one of the PartInstances the publication read`)
		}
		return label
	}

	/** The label of the part or PartInstance a part document describes */
	document(doc: PartTimingStateDoc): string {
		if (doc.partInstanceId === undefined) {
			if (!this.#rundownParts.has(doc.partId)) {
				throw new Error(`Part "${doc.partId}" has no PartInstance and is not one of the rundown's parts`)
			}
			return unprotectString(doc.partId)
		}

		const label = this.partInstance(doc.partInstanceId)
		if (this.#instanceParts.get(doc.partInstanceId) !== doc.partId) {
			throw new Error(`PartInstance "${doc.partInstanceId}" is not of part "${doc.partId}"`)
		}
		return label
	}

	/** The part's planned length in the rundown, when it is one of the rundown's parts and has one */
	plannedLength(partId: PartId): number | undefined {
		return this.#rundownParts.get(partId)?.expectedDurationWithTransition
	}

	/** The segment, when it is not the part's own segment in the rundown */
	segmentIfNotItsOwn(doc: PartTimingStateDoc): Phrase | undefined {
		if (this.#rundownParts.get(doc.partId)?.segmentId === doc.segmentId) return undefined
		return plainPhrase(unprotectString(doc.segmentId))
	}
}

// The lines

const KEY_WIDTH = 10

function formatLine(key: string, value: string): string {
	return `  ${key.padEnd(KEY_WIDTH)} ${value}`
}

/** Everything one line is rendered from: one calculation, at the instant */
interface LineContext {
	instant: number
	names: PartNames
	nextPartInstanceId: PartInstanceId | undefined
	calculation: Calculation
}

function planFields({ instant, calculation }: LineContext): string {
	const playlists = [calculation.published.playlist, calculation.fresh.playlist] as const
	return [
		comparedValue(playlists, (playlist) => plainPhrase(playlist.timingType)),
		documentField('start', playlists, (playlist) => clockPhrase(playlist.plannedStart, instant)),
		documentField('end', playlists, (playlist) => clockPhrase(playlist.plannedEnd, instant)),
		documentField('duration', playlists, (playlist) => lengthPhrase(playlist.plannedDuration, instant)),
	].join('  ')
}

function showFields({ instant, calculation }: LineContext): string {
	const playlists = [calculation.published.playlist, calculation.fresh.playlist] as const
	return [
		documentField('started', playlists, (playlist) => clockPhrase(playlist.startedPlayback, instant)),
		documentField('remaining', playlists, (playlist) => lengthPhrase(playlist.remainingDuration, instant)),
		documentField('ends', playlists, (playlist) => clockPhrase(playlist.estimatedEnd, instant)),
		documentField('in hand', playlists, (playlist) => lengthPhrase(playlist.overUnder, instant)),
	].join('  ')
}

function onAirLine({ instant, names, calculation }: LineContext): string {
	const playlists = [calculation.published.playlist, calculation.fresh.playlist] as const
	const onAir = (playlist: PlaylistTimingStateDoc) => {
		const part = playlist.currentPartInstanceId ? names.partInstance(playlist.currentPartInstanceId) : 'none'
		const segment = playlist.currentSegmentId ? unprotectString(playlist.currentSegmentId) : 'none'
		return plainPhrase(`${part} in ${segment}`)
	}

	return formatLine(
		'on air',
		[
			comparedValue(playlists, onAir),
			documentField('left', playlists, (playlist) => lengthPhrase(playlist.remainingOnCurrentPart, instant)),
			documentField('budget', playlists, (playlist) =>
				lengthPhrase(playlist.remainingBudgetOnCurrentSegment, instant)
			),
			documentField('auto-next', playlists, (playlist) =>
				plainPhrase(playlist.currentPartWillAutoNext ? 'yes' : 'no')
			),
		].join('  ')
	)
}

function countdownTypeName(countdownType: CountdownType): string {
	switch (countdownType) {
		case CountdownType.PART_EXPECTED_DURATION:
			return 'parts'
		case CountdownType.SEGMENT_BUDGET_DURATION:
			return 'budget'
		default:
			throw new Error(`A countdown type the timing text does not know: "${countdownType}"`)
	}
}

function segmentLines({ instant, calculation: { published, fresh } }: LineContext): string[] {
	return published.segments.map((segment) => {
		const freshSegment = fresh.segments.find((doc) => doc.segmentId === segment.segmentId)
		if (!freshSegment) throw new Error(`The fresh calculation has no document of segment ${segment.segmentId}`)

		const segments = [segment, freshSegment] as const
		return formatLine(
			`segment ${unprotectString(segment.segmentId)}`,
			[
				comparedValue(segments, (doc) => plainPhrase(countdownTypeName(doc.countdownType))),
				documentField('planned', segments, (doc) => lengthPhrase(doc.plannedDuration, instant)),
				documentField('played', segments, (doc) => countUpPhrase(doc.playedOut, instant)),
				documentField('left', segments, (doc) => lengthPhrase(doc.remaining, instant)),
			].join('  ')
		)
	})
}

/** A whole line's value, followed by the fresh calculation's when that differs */
function comparedLine(key: string, published: string, fresh: string): string {
	return formatLine(key, compared(plainPhrase(published), plainPhrase(fresh)))
}

function orderValue(documents: Documents, names: PartNames): string {
	const slots: string[] = []
	for (const doc of documents.parts) {
		if (!Number.isInteger(doc.rank) || doc.rank < 0) throw new Error(`Part ${doc.partId} has the rank ${doc.rank}`)
		if (slots[doc.rank] !== undefined) throw new Error(`Two part documents have the rank ${doc.rank}`)
		slots[doc.rank] = names.document(doc)
	}
	return Array.from(slots, (label) => label ?? '_').join(' ')
}

function countedValue(documents: Documents, names: PartNames): string {
	const notCounted = documents.parts.filter((doc) => !doc.countsTowardsTiming).map((doc) => names.document(doc))
	return notCounted.length === 0 ? 'all' : `all but ${notCounted.join(' ')}`
}

/** The parts whose document has the flag set, in rank order, or 'none' */
function flaggedValue(documents: Documents, names: PartNames, flag: keyof typeof PART_FLAGS): string {
	const flagged = documents.parts.filter((doc) => doc[flag]).map((doc) => names.document(doc))
	return flagged.length === 0 ? 'none' : flagged.join(' ')
}

/** The published and the fresh document of each part, by rank */
function pairedParts({
	calculation: { published, fresh },
}: LineContext): Array<[PartTimingStateDoc, PartTimingStateDoc]> {
	return published.parts.map((doc) => {
		const freshDoc = fresh.parts.find((other) => other.partId === doc.partId)
		if (!freshDoc) throw new Error(`The fresh calculation has no document of part ${doc.partId}`)
		return [doc, freshDoc]
	})
}

function countdownLines(context: LineContext): string[] {
	const { instant, names, calculation } = context

	// One group per way the countdowns move, in the order the groups first appear
	const groups = new Map<string, string[]>()
	for (const [doc, freshDoc] of pairedParts(context)) {
		const countdown = partCountdown(doc, calculation.published.playlist)
		const freshCountdown = partCountdown(freshDoc, calculation.fresh.playlist)
		if (!countdown && !freshCountdown) continue

		const published = lengthPhrase(countdown, instant)
		const motion = countdown ? lengthMotion(countdown, instant) || 'holds' : 'none'
		const item = `${names.document(doc)} ${compared(plainPhrase(published.value), lengthPhrase(freshCountdown, instant))}`

		const group = groups.get(motion) ?? []
		group.push(item)
		groups.set(motion, group)
	}

	if (groups.size === 0) return [formatLine('countdown', 'none')]
	return Array.from(groups, ([motion, items]) => formatLine('countdown', `${motion}: ${items.join('  ')}`))
}

type PartRole = 'on air' | 'next' | 'instance' | 'no instance'

function partRole(doc: PartTimingStateDoc, documents: Documents, context: LineContext): PartRole {
	if (doc.partInstanceId === undefined) return 'no instance'
	if (doc.partInstanceId === documents.playlist.currentPartInstanceId) return 'on air'
	if (doc.partInstanceId === context.nextPartInstanceId) return 'next'
	return 'instance'
}

/**
 * Whether a part document reads exactly as the part is planned, unplayed: its planned and drawn lengths, its length
 * and its width are the part's planned length, nothing has played, none of it moves, and it is in its own segment
 */
function readsAsPlanned(doc: PartTimingStateDoc, context: LineContext): boolean {
	const plannedLength = context.names.plannedLength(doc.partId)
	return (
		plannedLength !== undefined &&
		!context.names.segmentIfNotItsOwn(doc) &&
		holdsAt(doc.expectedDuration, plannedLength) &&
		holdsAt(doc.displayDuration, plannedLength) &&
		holdsAt(doc.played, 0) &&
		holdsAt(doc.duration, 0 - plannedLength) &&
		holdsAt(doc.liveDisplayDuration, 0 - plannedLength)
	)
}

/**
 * The length a finished part played, when its document reads as finished: planned and drawn as the part is
 * planned, in its own segment, and the played time, length and width one length that does not move
 */
function finishedLength(doc: PartTimingStateDoc, context: LineContext): string | undefined {
	const plannedLength = context.names.plannedLength(doc.partId)
	if (plannedLength === undefined || context.names.segmentIfNotItsOwn(doc)) return undefined
	if (!holdsAt(doc.expectedDuration, plannedLength) || !holdsAt(doc.displayDuration, plannedLength)) return undefined

	const played = doc.played
	if (!played?.paused) return undefined
	const playedLength = played.duration
	const isOneLength =
		holdsAt(played, playedLength) &&
		holdsAt(doc.duration, playedLength) &&
		holdsAt(doc.liveDisplayDuration, playedLength)
	return isOneLength ? formatLength(0 - playedLength) : undefined
}

function partLines(context: LineContext): string[] {
	const { instant, names, calculation } = context

	const asPlanned: string[] = []
	const finished: string[] = []
	const lines: string[] = []
	for (const [doc, freshDoc] of pairedParts(context)) {
		const label = names.document(doc)
		const role = partRole(doc, calculation.published, context)
		const freshRole = partRole(freshDoc, calculation.fresh, context)

		// A part is listed rather than given a line only when the fresh calculation reads it the same way
		const isUnplayedAsPlanned =
			role === 'no instance' &&
			freshRole === role &&
			readsAsPlanned(doc, context) &&
			readsAsPlanned(freshDoc, context)
		if (isUnplayedAsPlanned) {
			asPlanned.push(label)
			continue
		}

		const playedLength = role === 'instance' && freshRole === role ? finishedLength(doc, context) : undefined
		const isFinished = playedLength !== undefined && playedLength === finishedLength(freshDoc, context)
		if (isFinished) {
			finished.push(`${label} ${playedLength}`)
			continue
		}

		const docs = [doc, freshDoc] as const
		const fields = [compared(plainPhrase(role), plainPhrase(freshRole))]
		if (names.segmentIfNotItsOwn(doc) || names.segmentIfNotItsOwn(freshDoc)) {
			fields.push(documentField('in', docs, (part) => names.segmentIfNotItsOwn(part) ?? NONE))
		}
		fields.push(
			documentField('planned', docs, (part) => lengthPhrase(part.expectedDuration, instant)),
			documentField('drawn', docs, (part) => lengthPhrase(part.displayDuration, instant)),
			documentField('played', docs, (part) => countUpPhrase(part.played, instant)),
			documentField('length', docs, (part) => countUpPhrase(part.duration, instant)),
			documentField('width', docs, (part) => countUpPhrase(part.liveDisplayDuration, instant))
		)
		lines.push(formatLine(label, fields.join('  ')))
	}

	return [
		...(asPlanned.length ? [formatLine('as planned', asPlanned.join(' '))] : []),
		...(finished.length ? [formatLine('finished', finished.join('  '))] : []),
		...lines,
	]
}

/** The lines after the on-air line: segments and parts */
function contentLines(context: LineContext): string[] {
	const { names, calculation } = context
	const flagLine = (key: string, flag: keyof typeof PART_FLAGS) =>
		comparedLine(
			key,
			flaggedValue(calculation.published, names, flag),
			flaggedValue(calculation.fresh, names, flag)
		)
	return [
		...segmentLines(context),
		comparedLine('order', orderValue(calculation.published, names), orderValue(calculation.fresh, names)),
		...countdownLines(context),
		...partLines(context),
		comparedLine('counted', countedValue(calculation.published, names), countedValue(calculation.fresh, names)),
		flagLine('untimed', 'untimed'),
		flagLine('orphaned', 'orphaned'),
		flagLine('in loop', 'isInQuickLoop'),
	]
}

/** Lines that do not depend on the timing mode: rendered for every mode, and refused when any mode differs */
function sameInEveryMode(contexts: LineContext[], render: (context: LineContext) => string[], what: string): string[] {
	const [first, ...others] = contexts.map((context) => ({ mode: context.calculation.mode, lines: render(context) }))
	for (const other of others) {
		const lineCount = Math.max(first.lines.length, other.lines.length)
		for (let index = 0; index < lineCount; index++) {
			if (first.lines[index] === other.lines[index]) continue
			throw new Error(
				`The ${what} differ between the timing modes "${first.mode}" and "${other.mode}":\n` +
					`${first.lines[index] ?? '(no line)'}\n${other.lines[index] ?? '(no line)'}`
			)
		}
	}
	return first.lines
}

/** Render the publication's documents as a client holding them reads them at the instant */
export function renderTimingText(read: TimingRead): TimingText {
	if (read.publishedAt > read.instant) {
		throw new Error(
			`The documents were published at ${formatClock(read.publishedAt)}, after the read at ${formatClock(read.instant)}`
		)
	}
	if (read.calculations.length === 0) throw new Error('A read needs the documents of at least one calculation')

	const names = new PartNames(read.inputs)
	const contexts: LineContext[] = read.calculations.map((calculation) => ({
		instant: read.instant,
		names,
		nextPartInstanceId: read.inputs.nextPartInstanceId,
		calculation: readCalculation(calculation),
	}))

	const lines = [`${formatClock(read.instant)}, published ${formatClock(read.publishedAt)}`]

	const modeNames = read.calculations.map((calculation) => calculation.mode)
	if (modeNames.length === 1 && modeNames[0] === undefined) {
		const [context] = contexts
		lines.push(formatLine('plan', planFields(context)))
		if (read.view !== 'plan') lines.push(formatLine('show', showFields(context)), onAirLine(context))
		if (read.view === 'full') lines.push(...contentLines(context))
		return new TimingText(lines.join('\n'))
	}

	if (modeNames.some((mode) => mode === undefined)) {
		throw new Error('When a read compares timing modes, every calculation needs the name of its mode')
	}
	if (new Set(modeNames).size !== modeNames.length) throw new Error('Two calculations have the same mode name')

	const modeWidth = Math.max(...modeNames.map((mode) => mode?.length ?? 0))
	const modeRows = (renderFields: (context: LineContext) => string) =>
		contexts.map((context) => `  ${(context.calculation.mode ?? '').padEnd(modeWidth)} ${renderFields(context)}`)

	if (read.view === 'plan') {
		lines.push(...modeRows(planFields))
	} else {
		lines.push(...modeRows(showFields))
		lines.push(...sameInEveryMode(contexts, (context) => [onAirLine(context)], 'on-air lines'))
		if (read.view === 'full') lines.push(...sameInEveryMode(contexts, contentLines, 'segment and part lines'))
	}
	return new TimingText(lines.join('\n'))
}
