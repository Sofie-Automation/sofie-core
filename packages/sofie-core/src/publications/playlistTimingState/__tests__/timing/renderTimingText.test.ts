import { CountdownType, PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import type { PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { offsetTimerState, type TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import {
	getPartTimingStateDocId,
	getPlaylistTimingStateDocId,
	getSegmentTimingStateDocId,
	type PartTimingStateDoc,
	type PlaylistTimingStateDoc,
	type SegmentTimingStateDoc,
	type TimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { clock, length, REFERENCE_PLAYLIST_ID, referenceRundown } from './lib/referenceRundown'
import {
	renderTimingText,
	type TimingCalculation,
	TIMING_TEXT_FIELDS,
	TimingText,
	type TimingTextInputs,
	type TimingTextView,
	timingTextSerializer,
} from './lib/renderTimingText'

expect.addSnapshotSerializer(timingTextSerializer)

// Documents written by hand, in the shapes the publication gives them. These tests are about the text, not about
// what the publication calculates

function paused(duration: number, resumesAt?: number): TimerState {
	return { paused: true, duration, resumesAt: resumesAt ?? null }
}
function running(zeroTime: number, pauseTime?: number): TimerState {
	return { paused: false, zeroTime, pauseTime: pauseTime ?? null }
}

function playlistDoc(values: Partial<PlaylistTimingStateDoc>): PlaylistTimingStateDoc {
	return {
		_id: getPlaylistTimingStateDocId(REFERENCE_PLAYLIST_ID),
		type: 'playlist',
		playlistId: REFERENCE_PLAYLIST_ID,
		timingType: PlaylistTimingType.None,
		currentPartWillAutoNext: false,
		partCountdownBase: paused(0),
		...values,
	}
}

/** A segment that, unless the values say otherwise, has not played: its planned length left */
function segmentDoc(segment: string, planned: string, values?: Partial<SegmentTimingStateDoc>): SegmentTimingStateDoc {
	const segmentId = protectString<SegmentId>(segment)
	return {
		_id: getSegmentTimingStateDocId(segmentId),
		type: 'segment',
		playlistId: REFERENCE_PLAYLIST_ID,
		segmentId,
		countdownType: CountdownType.PART_EXPECTED_DURATION,
		plannedDuration: paused(length(planned)),
		playedOut: paused(0),
		remaining: paused(length(planned)),
		...values,
	}
}

/** A part that, unless the values say otherwise, reads as planned and unplayed: its planned length everywhere */
function partDoc(part: string, rank: number, values: Partial<PartTimingStateDoc> = {}): PartTimingStateDoc {
	const partId = protectString(part)
	const plannedLength = referenceRundown().parts.find((doc) => doc._id === partId)?.expectedDuration ?? 0
	return {
		_id: getPartTimingStateDocId(partId),
		type: 'part',
		playlistId: REFERENCE_PLAYLIST_ID,
		segmentId: protectString(part[0]),
		partId,
		rank,
		isInQuickLoop: false,
		countsTowardsTiming: true,
		untimed: false,
		orphaned: false,
		expectedDuration: paused(plannedLength),
		displayDuration: paused(plannedLength),
		played: paused(0),
		duration: paused(0 - plannedLength),
		liveDisplayDuration: paused(0 - plannedLength),
		...values,
	}
}

/** A finished part's drawn length, played time, length and width: the length it played (the last three negated) */
function playedFor(played: string): Partial<PartTimingStateDoc> {
	const grown = paused(0 - length(played))
	return { displayDuration: paused(length(played)), played: grown, duration: grown, liveDisplayDuration: grown }
}

/** The PartInstances the publication read, as 'id of part' in the order of their takes, and the Next one */
function inputs(partInstances: string[], nextPartInstanceId?: string): TimingTextInputs {
	return {
		parts: referenceRundown().parts,
		partInstances: partInstances.map((text, takeCount) => {
			const [id, part] = text.split(' of ')
			return { _id: protectString<PartInstanceId>(id), takeCount, part: { _id: protectString(part) } }
		}),
		nextPartInstanceId: nextPartInstanceId === undefined ? undefined : protectString(nextPartInstanceId),
	}
}

/** The documents, with one field of the document with this id set to the value */
function withField(docs: TimingStateDoc[], docId: string, field: string, value: unknown): TimingStateDoc[] {
	return docs.map((doc) =>
		unprotectString(doc._id) === docId ? ({ ...doc, [field]: value } as TimingStateDoc) : doc
	)
}

/**
 * A ForwardTime show planned from 12:00:00 to 12:02:30, read at 12:00:33. It started 5 s late, at 12:00:05. A1
 * played 0:11, A2 exactly its 0:10, and an adlibbed part 0:05; A3 has been on air since 12:00:31, the last
 * change, and B1 is next. B2 is untimed, so it is left out of segment B's planned length and of the remaining
 * duration. The values are the ones the publication calculates for this show, for segments A and B only
 */
const INSTANT = clock('12:00:33')
const PUBLISHED_AT = clock('12:00:31')
const SHOW_INPUTS = inputs(['A1_1 of A1', 'A2_2 of A2', 'adlib1_3 of adlib1', 'A3_4 of A3', 'B1_5 of B1'], 'B1_5')
function showDocs(): TimingStateDoc[] {
	const onAirEnds = clock('12:00:41')
	// the parts played before the on-air part no longer count towards the timing
	const noLongerCounted = { countsTowardsTiming: false }
	return [
		playlistDoc({
			timingType: PlaylistTimingType.ForwardTime,
			plannedStart: running(clock('12:00:00')),
			plannedEnd: running(clock('12:02:30')),
			plannedDuration: paused(length('2:30')),
			startedPlayback: running(clock('12:00:05')),
			remainingDuration: running(clock('12:02:21'), onAirEnds),
			estimatedEnd: running(clock('12:02:21'), onAirEnds),
			overUnder: paused(length('0:14'), onAirEnds),
			currentPartInstanceId: protectString('A3_4'),
			currentSegmentId: protectString('A'),
			remainingOnCurrentPart: paused(length('0:10'), PUBLISHED_AT),
			// the countdown to the end of D2, the last part
			partCountdownBase: running(clock('12:02:41'), onAirEnds),
		}),
		segmentDoc('A', '0:30', { playedOut: running(clock('12:00:05')), remaining: running(clock('12:00:35')) }),
		segmentDoc('B', '0:20'),
		partDoc('A1', 0, { partInstanceId: protectString('A1_1'), ...playedFor('0:11'), ...noLongerCounted }),
		partDoc('A2', 1, { partInstanceId: protectString('A2_2'), ...playedFor('0:10'), ...noLongerCounted }),
		partDoc('adlib1', 2, {
			segmentId: protectString('A'),
			partInstanceId: protectString('adlib1_3'),
			orphaned: true,
			expectedDuration: paused(length('0:05')),
			...playedFor('0:05'),
			...noLongerCounted,
		}),
		partDoc('A3', 3, {
			partInstanceId: protectString('A3_4'),
			// published negated: the played time grows from the take, the length and width hold, then grow
			played: paused(0, PUBLISHED_AT),
			duration: paused(-length('0:10'), onAirEnds),
			liveDisplayDuration: paused(-length('0:10'), onAirEnds),
		}),
		partDoc('B1', 4, { partInstanceId: protectString('B1_5'), countdownOffset: -length('2:00') }),
		partDoc('B2', 5, { untimed: true, countdownOffset: -length('1:40') }),
	]
}

function readShow(docs: TimingStateDoc[], view: TimingTextView = 'full', fresh = docs): TimingText {
	const calculations = [{ published: docs, fresh }]
	return renderTimingText({ instant: INSTANT, publishedAt: PUBLISHED_AT, view, inputs: SHOW_INPUTS, calculations })
}

function linesOf(text: TimingText, ...keys: string[]): string[] {
	return text.text.split('\n').filter((line) => keys.some((key) => line.startsWith(`  ${key}`)))
}

describe('the readable text of the timing documents', () => {
	it('prints a read in full, and the first lines of it in the show and plan views', () => {
		const text = readShow(showDocs())
		expect(text).toMatchInlineSnapshot(`
		12:00:33, published 12:00:31
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started 12:00:05  remaining 1:48 runs until 12:00:41  ends 12:02:21 fixed until 12:00:41  in hand 0:14 holds until 12:00:41
		  on air     A3 in A  left 0:08 running since 12:00:31  budget none  auto-next no
		  segment A  parts  planned 0:30  played 0:28 runs  left 0:02 runs
		  segment B  parts  planned 0:20  played 0:00  left 0:20
		  order      A1 A2 adlib1 A3 B1 B2
		  countdown  runs until 12:00:41: B1 0:08  B2 0:28
		  as planned B2
		  finished   A2 0:10
		  A1         instance  planned 0:10  drawn 0:11  played 0:11  length 0:11  width 0:11
		  adlib1     instance  in A  planned 0:05  drawn 0:05  played 0:05  length 0:05  width 0:05
		  A3         on air  planned 0:10  drawn 0:10  played 0:02 running since 12:00:31  length 0:10 holds until 12:00:41  width 0:10 holds until 12:00:41
		  B1         next  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  counted    all but A1 A2 adlib1
		  untimed    B2
		  orphaned   adlib1
		  in loop    none
	`)

		const fullLines = text.text.split('\n')
		expect(readShow(showDocs(), 'show').text).toBe(fullLines.slice(0, 4).join('\n'))
		expect(readShow(showDocs(), 'plan').text).toBe(fullLines.slice(0, 2).join('\n'))
	})

	it('says after each value how it moves, so that the value and the words give back the timer state', () => {
		// Each state read at 12:00:33, as a length (the remaining duration) and as a clock time (the estimated end)
		const [before, after, end] = ['12:00:28', '12:00:38', '12:02:58'].map(clock)
		const forty = length('0:40')
		const states: Array<[state: TimerState, asLength: string, asClock: string]> = [
			[paused(forty), '0:40', '12:01:13 moving'],
			[paused(forty, after), '0:40 holds until 12:00:38', '12:01:13 moving until 12:00:38'],
			[paused(forty, before), '0:35 running since 12:00:28', '12:01:08 fixed since 12:00:28'],
			[paused(forty, INSTANT), '0:40 running since 12:00:33', '12:01:13 fixed since 12:00:33'],
			[running(clock('12:00:58')), '0:25 runs', '12:00:58'],
			[running(end, after), '2:25 runs until 12:00:38', '12:02:58 fixed until 12:00:38'],
			[running(end, before), '2:30 held since 12:00:28', '12:03:03 moving since 12:00:28'],
			[running(end, INSTANT), '2:25 held since 12:00:33', '12:02:58 moving since 12:00:33'],
		]

		const phrases = states.map(([state]) => {
			const [showLine] = linesOf(
				readShow([playlistDoc({ remainingDuration: state, estimatedEnd: state })]),
				'show'
			)
			return /remaining (.*) {2}ends (.*) {2}in hand/.exec(showLine)?.slice(1)
		})
		expect(phrases).toEqual(states.map(([, asLength, asClock]) => [asLength, asClock]))
	})

	it('reads differently when any one field of any document changes, unless it refuses the documents', () => {
		const baseline = showDocs()
		const before = readShow(baseline).text.split('\n')

		/** The keys of the lines that read differently once the field of the document has its other value */
		const changedLines = (docId: string, field: string): string => {
			const doc: object = baseline.find((other) => unprotectString(other._id) === docId) ?? {}
			const value = (doc as Record<string, unknown>)[field]
			let after: string[]
			try {
				after = readShow(withField(baseline, docId, field, otherValue(field, value))).text.split('\n')
			} catch {
				return 'refused'
			}
			const differing = [...before, ...after].filter((line) => !before.includes(line) || !after.includes(line))
			const keys = new Set(differing.map((line) => line.slice(2, 12).trim()))
			return keys.size === 0 ? 'NO CHANGE' : Array.from(keys).join(', ')
		}

		/** A row per field the text knows, in the order it prints them, and a column per document */
		const row = (cells: string[]) =>
			cells
				.map((cell) => cell.padEnd(34))
				.join('')
				.trimEnd()
		const table = (type: TimingStateDoc['type'], columns: Array<[label: string, docId: string]>) => [
			row([type, ...columns.map(([label]) => label)]),
			...TIMING_TEXT_FIELDS[type].map((field) =>
				row([`  ${field}`, ...columns.map(([, id]) => changedLines(id, field))])
			),
		]

		const text = [
			...table('playlist', [['', 'playlist_referencePlaylist']]),
			...table('segment', [['A', 'segment_A']]),
			...table('part', [
				['A2, finished', 'part_A2'],
				['A3, on air', 'part_A3'],
				['B2, as planned', 'part_B2'],
			]),
		].join('\n')
		expect(text).not.toContain('NO CHANGE')
		expect(new TimingText(text)).toMatchInlineSnapshot(`
		playlist
		  _id                             refused
		  type                            refused
		  playlistId                      refused
		  timingType                      plan
		  plannedStart                    plan
		  plannedEnd                      plan
		  plannedDuration                 plan
		  startedPlayback                 show
		  remainingDuration               show
		  estimatedEnd                    show
		  overUnder                       show
		  currentPartInstanceId           on air, A3, B1
		  currentSegmentId                on air
		  remainingOnCurrentPart          on air
		  remainingBudgetOnCurrentSegment on air
		  currentPartWillAutoNext         on air
		  partCountdownBase               countdown
		segment                           A
		  _id                             refused
		  type                            refused
		  playlistId                      refused
		  segmentId                       refused
		  countdownType                   segment A
		  plannedDuration                 segment A
		  playedOut                       segment A
		  remaining                       segment A
		part                              A2, finished                      A3, on air                        B2, as planned
		  _id                             refused                           refused                           refused
		  type                            refused                           refused                           refused
		  playlistId                      refused                           refused                           refused
		  partId                          refused                           refused                           refused
		  rank                            order, counted                    order                             order
		  countdownOffset                 countdown                         countdown                         countdown
		  partInstanceId                  finished, A2                      A3                                refused
		  segmentId                       finished, A2                      A3                                as planned, B2
		  expectedDuration                finished, A2                      A3                                as planned, B2
		  displayDuration                 finished, A2                      A3                                as planned, B2
		  played                          finished, A2                      A3                                as planned, B2
		  duration                        finished, A2                      A3                                as planned, B2
		  liveDisplayDuration             finished, A2                      A3                                as planned, B2
		  countsTowardsTiming             counted                           counted                           counted
		  untimed                         untimed                           untimed                           untimed
		  orphaned                        orphaned                          orphaned                          orphaned
		  isInQuickLoop                   in loop                           in loop                           in loop
	`)
	})

	it('follows a value with the fresh calculation when that reads it differently', () => {
		const published = showDocs()
		const freshChanges: Array<[docId: string, field: string, value: unknown]> = [
			['segment_A', 'remaining', paused(0)],
			['part_A1', 'displayDuration', paused(length('0:10'))],
			['part_B2', 'untimed', false],
		]
		const fresh = freshChanges.reduce(
			(docs, [docId, field, value]) => withField(docs, docId, field, value),
			published
		)

		expect(linesOf(readShow(published, 'full', fresh), 'segment A', 'A1', 'untimed')).toEqual([
			'  segment A  parts  planned 0:30  played 0:28 runs  left 0:02 runs (fresh 0:00)',
			'  A1         instance  planned 0:10  drawn 0:11 (fresh 0:10)  played 0:11  length 0:11  width 0:11',
			'  untimed    B2 (fresh none)',
		])
	})

	it('compares timing modes: a row per mode, every other line once, refused when a mode prints it differently', () => {
		const onAir = {
			currentPartInstanceId: protectString<PartInstanceId>('A1_1'),
			currentSegmentId: protectString<SegmentId>('A'),
		}
		const modeInputs = inputs(['A1_1 of A1'])
		const inMode = (mode: string, playlist: Partial<PlaylistTimingStateDoc>): TimingCalculation => {
			const docs = [
				playlistDoc({ ...onAir, ...playlist }),
				partDoc('A1', 0, { partInstanceId: onAir.currentPartInstanceId }),
			]
			return { mode, published: docs, fresh: docs }
		}
		const readModes = (view: TimingTextView, calculations: TimingCalculation[]) =>
			renderTimingText({ instant: INSTANT, publishedAt: INSTANT, view, inputs: modeInputs, calculations })

		const none = inMode('none', { remainingDuration: paused(length('0:20')), overUnder: paused(0) })
		const duration = inMode('duration 2:30', {
			timingType: PlaylistTimingType.Duration,
			plannedDuration: paused(length('2:30')),
			overUnder: paused(length('2:10')),
		})
		expect(readModes('full', [none, duration])).toMatchInlineSnapshot(`
		12:00:33, published 12:00:33
		  none          started none  remaining 0:20  ends none  in hand 0:00
		  duration 2:30 started none  remaining none  ends none  in hand 2:10
		  on air     A1 in A  left none  budget none  auto-next no
		  order      A1
		  countdown  none
		  A1         on air  planned 0:10  drawn 0:10  played 0:00  length 0:10  width 0:10
		  counted    all
		  untimed    none
		  orphaned   none
		  in loop    none
	`)
		expect(readModes('plan', [none, duration])).toMatchInlineSnapshot(`
		12:00:33, published 12:00:33
		  none          none  start none  end none  duration none
		  duration 2:30 duration  start none  end none  duration 2:30
	`)

		expect(() => readModes('show', [none, inMode('none 2:30', { currentPartWillAutoNext: true })])).toThrow(
			'The on-air lines differ between the timing modes "none" and "none 2:30"'
		)
		const untimed = inMode('none 2:30', {})
		untimed.published = untimed.published.map((doc) => (doc.type === 'part' ? { ...doc, untimed: true } : doc))
		expect(() => readModes('full', [none, untimed])).toThrow(
			'The segment and part lines differ between the timing modes "none" and "none 2:30"'
		)
	})

	it('refuses a field it does not know, so that a newly published value has to be added to the text', () => {
		const refusal = (docId: string, field: string, value: unknown) => {
			try {
				readShow(withField(showDocs(), docId, field, value))
				return 'not refused'
			} catch (error) {
				return (error as Error).message
			}
		}
		const playlist = 'playlist_referencePlaylist'

		const refusals = [
			...[playlist, 'segment_A', 'part_A1'].map((docId) => refusal(docId, 'newValue', 1)),
			refusal(playlist, 'overUnder', { paused: true, duration: 0, slope: 2 }),
			// a flag that is missing, or not true or false, would read as false
			refusal('part_A1', 'orphaned', undefined),
			refusal(playlist, 'currentPartWillAutoNext', 1),
			refusal('segment_A', 'countdownType', 'x'),
			// a timer state of neither shape
			...[
				{ paused: true, zeroTime: 0 },
				{ paused: true, duration: 0, pauseTime: 5 },
				{ paused: false, zeroTime: 0, resumesAt: 5 },
				{ paused: false, zeroTime: 0.5 },
			].map((state) => refusal('part_A1', 'played', state)),
			// an offset that is not a whole number of milliseconds
			refusal('part_B1', 'countdownOffset', 0.5),
		]
		expect(new TimingText(refusals.join('\n'))).toMatchInlineSnapshot(`
		The playlist document has a field the timing text does not know: "newValue". Add it to the text
		The document of segment A has a field the timing text does not know: "newValue". Add it to the text
		The document of part A1 has a field the timing text does not know: "newValue". Add it to the text
		The timer state overUnder of the playlist document has a field the timing text does not know: "slope"
		The document of part A1 has "orphaned" undefined, not true or false
		The playlist document has "currentPartWillAutoNext" 1, not true or false
		A countdown type the timing text does not know: "x"
		The timer state played of the document of part A1 is not a paused or a running timer state: {"paused":true,"zeroTime":0}
		The timer state played of the document of part A1 is not a paused or a running timer state: {"paused":true,"duration":0,"pauseTime":5}
		The timer state played of the document of part A1 is not a paused or a running timer state: {"paused":false,"zeroTime":0,"resumesAt":5}
		The timer state played of the document of part A1 is not a paused or a running timer state: {"paused":false,"zeroTime":0.5}
		The document of part B1 has the countdown offset 0.5, not a whole number of milliseconds
	`)
	})
})

// The other value a field takes in the test of what reads differently: as listed here, or else one second more for
// a timer state (or one second where there is none), and the other value for a flag
const OTHER_VALUES: Readonly<Record<string, (value: unknown) => unknown>> = {
	_id: () => protectString('otherDocument'),
	type: () => 'rundown',
	playlistId: () => protectString('otherPlaylist'),
	timingType: () => PlaylistTimingType.BackTime,
	currentPartInstanceId: () => protectString('B1_5'),
	currentSegmentId: () => protectString('D'),
	countdownType: () => CountdownType.SEGMENT_BUDGET_DURATION,
	segmentId: () => protectString('D'),
	partId: () => protectString('D2'),
	rank: () => 10,
	// one second more, and for a part that has none, the offset of a part ten seconds before the end
	countdownOffset: (offset) => (typeof offset === 'number' ? offset + 1000 : -length('0:10')),
	// none for a part that has a PartInstance, and B1's for a part that has none
	partInstanceId: (partInstanceId) => (partInstanceId ? undefined : protectString('B1_5')),
}
function otherValue(field: string, value: unknown): unknown {
	const listed = OTHER_VALUES[field]
	if (listed) return listed(value)
	if (typeof value === 'boolean') return !value
	return value === undefined ? paused(1000) : offsetTimerState(value as TimerState, 1000)
}
