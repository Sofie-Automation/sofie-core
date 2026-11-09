import * as fs from 'fs'
import * as path from 'path'
import { PartHoldMode, PlaylistTimingType, RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'
import { RundownPlaylistActivationId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance, PartInstanceTimings } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	DBRundownPlaylist,
	RundownHoldState,
	SelectedPartInstance,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import type { MockJobContext } from '../../__mocks__/context.js'
import {
	clock,
	formatClock,
	formatLength,
	length,
	REFERENCE_DAY,
	REFERENCE_PLAYLIST_ID,
	REFERENCE_RUNDOWN,
	REFERENCE_RUNDOWN_ID,
	RundownVariant,
} from '@sofie-automation/corelib/dist/testing/referenceRundown'
import {
	type ReferenceShow,
	type ReferenceShowGateway,
	type ReferenceShowJob,
	startReferenceShow,
} from '../../__mocks__/referenceShow.js'
import { useRealCurrentTime } from '../../__mocks__/time.js'

/**
 * These tests run real playout jobs on the reference rundown, and record as text everything playout writes that the
 * timing publication reads: the playlist's activation, start times and selected parts, and every PartInstance the
 * publication would see. A few fields the publication does not read (rehearsal, previous parts, next offset, hold)
 * are included as well, because they explain the others. One field the publication reads is left out: a
 * PartInstance's `partPlayoutTimings`. On this rundown it is absent before the take and all zero after it, which
 * gives the same lengths as the part's own `expectedDurationWithTransition`; the trace checks that. The scripts set
 * no loop markers, and the trace checks that no loop appears.
 *
 * Each script is a short show: activate, take, set next, play from a point inside a part, auto-next, hold,
 * deactivate and reset, with the gateway reporting what the takes changed. Where gateways change what is written,
 * a script runs in each gateway mode: no gateway, one gateway that confirms a start at once, after 200 ms or never,
 * and multi-gateway mode.
 *
 * The traces are kept in a text file next to this test, timingInputs.trace.txt, one trace per script, and each test
 * compares its trace with the file exactly. To rewrite the file from what playout writes today, run this test with
 * UPDATE_TIMING_TRACE=1 set, and review the diff:
 *
 *   UPDATE_TIMING_TRACE=1 yarn unit --testPathPatterns playout/__tests__/timingInputs
 *
 * After each job a trace prints only what changed. The shows are played by the shared driver in
 * __mocks__/referenceShow.ts, which the timing tests of the playlist timing publication play their shows with too.
 */

// The recording

/** The recording, by its path from the repository root, so that a test in another package can read it the same way */
const RECORDING_PATH = 'packages/job-worker/src/playout/__tests__/timingInputs.trace.txt'
/** This test is in packages/job-worker/src/playout/__tests__, five folders below the repository root */
const REPOSITORY_ROOT = path.resolve(__dirname, '../../../../..')
const RECORDING_FILE = path.join(REPOSITORY_ROOT, RECORDING_PATH)

/** Set to rewrite the recording from what playout writes today, instead of comparing with it */
const UPDATE_RECORDING = process.env.UPDATE_TIMING_TRACE === '1'

/** Each trace in the recording follows a line with this mark and the script's name */
const SCRIPT_MARK = '=== '

const RECORDING_PREAMBLE = [
	'Timing inputs written by playout, on the reference rundown.',
	'',
	'Recorded from real playout jobs by timingInputs.test.ts, next to this file. Do not edit it by hand: to rewrite',
	'it from what playout writes today, run that test with UPDATE_TIMING_TRACE=1 set, and review the diff.',
	'',
	'There is one trace per script, after a line with "=== " and the name of the script. Each block of a trace is',
	'one job: the clock time it ran at (UTC) and what it did, then, two spaces in, what it changed. A PartInstance',
	'takes two lines: what it is, then its timings. Generated ids are labelled in order of appearance: activation#1,',
	'A1#2 (the second PartInstance of part A1), A#1 (the first time segment A plays).',
].join('\n')

/** The recording as a file: the preamble, then each script's name and trace, with a blank line before each */
function formatRecording(traces: ReadonlyArray<{ name: string; trace: string }>): string {
	const sections = traces.map(({ name, trace }) => `${SCRIPT_MARK}${name}\n${trace}`)
	return [RECORDING_PREAMBLE, ...sections].join('\n\n') + '\n'
}

/** The traces in the recording, by script name, in the order of the file */
function parseRecording(text: string): Map<string, string> {
	const traces = new Map<string, string>()
	const [, ...sections] = text.split(`\n\n${SCRIPT_MARK}`)
	for (const section of sections) {
		const [name, ...traceLines] = section.trimEnd().split('\n')
		traces.set(name, traceLines.join('\n'))
	}
	return traces
}

function readRecording(): { text: string; traces: Map<string, string> } {
	const text = fs.existsSync(RECORDING_FILE) ? fs.readFileSync(RECORDING_FILE, 'utf8') : ''
	return { text, traces: parseRecording(text) }
}

// Labels for generated ids

const SEGMENT_KEYS: readonly string[] = REFERENCE_RUNDOWN.map((row) => row.segment)
const PART_KEYS: ReadonlySet<string> = new Set(REFERENCE_RUNDOWN.flatMap((row) => row.parts.map(([key]) => key)))

function segmentIndex(segmentId: SegmentId): number {
	const index = SEGMENT_KEYS.indexOf(unprotectString(segmentId))
	if (index === -1) throw new Error(`Segment "${segmentId}" is not in the reference rundown`)
	return index
}

/** Compare PartInstances by where they are in the rundown, then by take count */
function compareInRundownOrder(a: DBPartInstance, b: DBPartInstance): number {
	return (
		segmentIndex(a.segmentId) - segmentIndex(b.segmentId) ||
		a.part._rank - b.part._rank ||
		a.takeCount - b.takeCount
	)
}

/** Compare PartInstances by take count, then by where they are in the rundown */
function compareByTakeCount(a: DBPartInstance, b: DBPartInstance): number {
	return (
		a.takeCount - b.takeCount ||
		segmentIndex(a.segmentId) - segmentIndex(b.segmentId) ||
		a.part._rank - b.part._rank
	)
}

/** Count one more for the key, and return the new count */
function nextNumber(counts: Map<string, number>, key: string): number {
	const count = (counts.get(key) ?? 0) + 1
	counts.set(key, count)
	return count
}

interface SegmentPlayoutLabel {
	label: string
	segmentIndex: number
	pass: number
}

/**
 * Generated ids get stable labels, numbered in order of appearance:
 * - activations: activation#1, activation#2, ...
 * - PartInstances: the part's key and a count per part: A1#1, A1#2
 * - segment playouts: the segment's key and a count per segment: A#1, A#2
 */
class TraceLabels {
	readonly #activations = new Map<string, string>()
	readonly #partInstances = new Map<string, string>()
	readonly #segmentPlayouts = new Map<string, SegmentPlayoutLabel>()
	readonly #instanceCountPerPart = new Map<string, number>()
	readonly #playoutCountPerSegment = new Map<string, number>()

	/** Give labels to the ids that appear for the first time in this state */
	learn(state: PlayoutState): void {
		const activationId = state.playlist.activationId
		if (activationId && !this.#activations.has(unprotectString(activationId))) {
			this.#activations.set(unprotectString(activationId), `activation#${this.#activations.size + 1}`)
		}

		const newPartInstances = state.partInstances
			.filter((partInstance) => !this.#partInstances.has(unprotectString(partInstance._id)))
			.sort(compareByTakeCount)
		for (let i = 1; i < newPartInstances.length; i++) {
			if (compareByTakeCount(newPartInstances[i - 1], newPartInstances[i]) === 0) {
				throw new Error(
					'Two new PartInstances have the same take count and place, so their labels are ambiguous'
				)
			}
		}

		for (const partInstance of newPartInstances) {
			const partKey = unprotectString(partInstance.part._id)
			if (!PART_KEYS.has(partKey)) throw new Error(`Part "${partKey}" is not in the reference rundown`)
			const instanceNumber = nextNumber(this.#instanceCountPerPart, partKey)
			this.#partInstances.set(unprotectString(partInstance._id), `${partKey}#${instanceNumber}`)

			const segmentPlayoutId = unprotectString(partInstance.segmentPlayoutId)
			if (!this.#segmentPlayouts.has(segmentPlayoutId)) {
				const segmentKey = unprotectString(partInstance.segmentId)
				const pass = nextNumber(this.#playoutCountPerSegment, segmentKey)
				this.#segmentPlayouts.set(segmentPlayoutId, {
					label: `${segmentKey}#${pass}`,
					segmentIndex: segmentIndex(partInstance.segmentId),
					pass,
				})
			}
		}
	}

	activation(id: RundownPlaylistActivationId): string {
		return this.#get(this.#activations, unprotectString(id))
	}
	partInstance(id: string): string {
		return this.#get(this.#partInstances, id)
	}
	segmentPlayout(id: string): SegmentPlayoutLabel {
		const segmentPlayout = this.#segmentPlayouts.get(id)
		if (!segmentPlayout) throw new Error(`Segment playout "${id}" has no label`)
		return segmentPlayout
	}

	#get(labels: Map<string, string>, id: string): string {
		const label = labels.get(id)
		if (!label) throw new Error(`"${id}" has no label`)
		return label
	}
}

// Printing the state

interface PlayoutState {
	playlist: DBRundownPlaylist
	/** Every PartInstance in the database, of any activation, reset or not */
	partInstances: DBPartInstance[]
	/** The rundown's parts, as stored */
	parts: DBPart[]
}

/** One keyed item of the trace. The first line follows the key, the others are continuation lines */
interface TraceEntry {
	key: string
	lines: string[]
	/** Set for the entry of a PartInstance */
	partInstanceId?: string
}

const KEY_WIDTH = 11

function formatLine(key: string, value: string): string {
	return `  ${key.padEnd(KEY_WIDTH)} ${value}`
}
function formatContinuationLine(value: string): string {
	return `  ${''.padEnd(KEY_WIDTH)} ${value}`
}

function clockOrNone(time: number | null | undefined): string {
	return time === undefined || time === null ? 'none' : formatClock(time)
}
function lengthOrNone(duration: number | null | undefined): string {
	return duration === undefined || duration === null ? 'none' : formatLength(duration)
}

function describeSelectedPartInstance(selected: SelectedPartInstance | null | undefined, labels: TraceLabels): string {
	if (!selected) return 'none'
	if (selected.rundownId !== REFERENCE_RUNDOWN_ID) throw new Error(`Unexpected rundown "${selected.rundownId}"`)

	const fields = [labels.partInstance(unprotectString(selected.partInstanceId))]
	if (selected.manuallySelected) fields.push('manual')
	if (selected.consumesQueuedSegmentId) fields.push('consumes queued segment')
	return fields.join('  ')
}

/**
 * The previous parts, most recent first. Playout keeps an earlier part in the list while the part after it may still
 * overlap it, which it assumes for as long as that part has no planned start
 */
function describePreviousPartInstances(
	previous: readonly SelectedPartInstance[] | undefined,
	labels: TraceLabels
): string {
	if (!previous || previous.length === 0) return 'none'
	return previous.map((selected) => describeSelectedPartInstance(selected, labels)).join(', ')
}

function describeSegmentStarts(starts: Record<string, number> | undefined, labels: TraceLabels): string {
	const entries = Object.entries<number>(starts ?? {}).map(([segmentPlayoutId, time]) => ({
		segmentPlayout: labels.segmentPlayout(segmentPlayoutId),
		time,
	}))
	if (entries.length === 0) return 'none'

	entries.sort(
		(a, b) =>
			a.segmentPlayout.segmentIndex - b.segmentPlayout.segmentIndex ||
			a.segmentPlayout.pass - b.segmentPlayout.pass
	)
	return entries.map((entry) => `${entry.segmentPlayout.label} ${formatClock(entry.time)}`).join('  ')
}

function describeHold(holdState: RundownHoldState | undefined): string {
	switch (holdState) {
		case undefined:
		case RundownHoldState.NONE:
			return 'none'
		case RundownHoldState.PENDING:
			return 'pending'
		case RundownHoldState.ACTIVE:
			return 'active'
		case RundownHoldState.COMPLETE:
			return 'complete'
		default:
			assertNever(holdState)
			return 'unknown'
	}
}

function describeTiming(timing: RundownPlaylistTiming): string {
	const fields: string[] = [timing.type]
	if ('expectedStart' in timing && timing.expectedStart !== undefined) {
		fields.push(`start ${formatClock(timing.expectedStart)}`)
	}
	if (timing.expectedDuration !== undefined) fields.push(`duration ${formatLength(timing.expectedDuration)}`)
	if ('expectedEnd' in timing && timing.expectedEnd !== undefined) {
		fields.push(`end ${formatClock(timing.expectedEnd)}`)
	}
	return fields.join('  ')
}

function singleLineEntry(key: string, value: string): TraceEntry {
	return { key, lines: [value] }
}

/**
 * What the first block of a trace is compared with: a playlist with nothing set, and no PartInstances.
 * So the first block prints only the lines that differ from these.
 */
const EMPTY_PLAYLIST_ENTRIES: readonly TraceEntry[] = [
	singleLineEntry('activation', 'none'),
	singleLineEntry('rehearsal', 'no'),
	singleLineEntry('started', 'none'),
	singleLineEntry('segments', 'none'),
	singleLineEntry('previous', 'none'),
	singleLineEntry('current', 'none'),
	singleLineEntry('next', 'none'),
	singleLineEntry('next offset', 'none'),
	singleLineEntry('hold', 'none'),
	singleLineEntry('timing', 'none'),
]

function playlistEntries(playlist: DBRundownPlaylist, labels: TraceLabels): TraceEntry[] {
	// The publication reads the loop too; no script sets one
	expect(playlist.quickLoop).toBeUndefined()

	return [
		singleLineEntry('activation', playlist.activationId ? labels.activation(playlist.activationId) : 'none'),
		singleLineEntry('rehearsal', playlist.rehearsal ? 'yes' : 'no'),
		singleLineEntry('started', clockOrNone(playlist.startedPlayback)),
		singleLineEntry('segments', describeSegmentStarts(playlist.segmentsStartedPlayback, labels)),
		singleLineEntry('previous', describePreviousPartInstances(playlist.previousPartsInfo, labels)),
		singleLineEntry('current', describeSelectedPartInstance(playlist.currentPartInfo, labels)),
		singleLineEntry('next', describeSelectedPartInstance(playlist.nextPartInfo, labels)),
		singleLineEntry('next offset', lengthOrNone(playlist.nextTimeOffset)),
		singleLineEntry('hold', describeHold(playlist.holdState)),
		singleLineEntry('timing', describeTiming(playlist.timing)),
	]
}

/** A PartInstance holds a copy of its part, so the trace prints only the part's key and checks the copy */
function describePart(partInstance: DBPartInstance, parts: DBPart[]): string {
	const rundownPart = parts.find((part) => part._id === partInstance.part._id)
	if (!rundownPart) throw new Error(`Part "${partInstance.part._id}" is not in the rundown`)
	expect(partInstance.part).toEqual(rundownPart)
	return unprotectString(rundownPart._id)
}

function describeTimings(timings: PartInstanceTimings | undefined): string {
	const fields: string[] = []
	const addClock = (name: string, time: number | undefined) => {
		if (time !== undefined) fields.push(`${name} ${formatClock(time)}`)
	}
	const addLength = (name: string, duration: number | undefined) => {
		if (duration !== undefined) fields.push(`${name} ${formatLength(duration)}`)
	}

	addClock('setAsNext', timings?.setAsNext)
	addClock('take', timings?.take)
	addLength('playOffset', timings?.playOffset)
	addClock('plannedStart', timings?.plannedStartedPlayback)
	addClock('reportedStart', timings?.reportedStartedPlayback)
	addClock('plannedStop', timings?.plannedStoppedPlayback)
	addClock('reportedStop', timings?.reportedStoppedPlayback)
	addLength('duration', timings?.duration)

	return fields.length === 0 ? 'no timings' : fields.join('  ')
}

/** The PartInstances the publication sees: those of the current activation that are not reset */
function partInstanceEntries(state: PlayoutState, labels: TraceLabels): TraceEntry[] {
	const activationId = state.playlist.activationId
	if (!activationId) return []

	return state.partInstances
		.filter((partInstance) => partInstance.playlistActivationId === activationId && !partInstance.reset)
		.sort(compareInRundownOrder)
		.map((partInstance) => {
			assertPartPlayoutTimingsInert(partInstance)
			const fields = [
				`part ${describePart(partInstance, state.parts)}`,
				`playout ${labels.segmentPlayout(unprotectString(partInstance.segmentPlayoutId)).label}`,
				`takeCount ${partInstance.takeCount}`,
			]
			if (partInstance.isTaken) fields.push('taken')
			if (partInstance.orphaned) fields.push(`orphaned ${partInstance.orphaned}`)

			return {
				key: labels.partInstance(unprotectString(partInstance._id)),
				lines: [fields.join('  '), describeTimings(partInstance.timings)],
				partInstanceId: unprotectString(partInstance._id),
			}
		})
}

/** The playout timings of a part without pieces or transitions: they change no length the publication reads */
const INERT_PART_PLAYOUT_TIMINGS = {
	inTransitionStart: null,
	toPartDelay: 0,
	toPartPostroll: 0,
	fromPartRemaining: 0,
	fromPartPostroll: 0,
	fromPartKeepalive: 0,
}

/** The trace leaves out `partPlayoutTimings`; fail if a PartInstance has any that would change its lengths */
function assertPartPlayoutTimingsInert(partInstance: DBPartInstance): void {
	if (partInstance.partPlayoutTimings === undefined) return
	expect(partInstance.partPlayoutTimings).toEqual(INERT_PART_PLAYOUT_TIMINGS)
}

/** Why a PartInstance the publication saw after the previous job is no longer seen */
function whyGone(partInstanceId: string, state: PlayoutState): string {
	const partInstance = state.partInstances.find((candidate) => unprotectString(candidate._id) === partInstanceId)
	if (!partInstance) return 'deleted'
	if (partInstance.reset) return 'reset'
	if (!state.playlist.activationId) return 'inactive'
	return 'other activation'
}

/** The trace of one show: a block per job, listing what changed */
class TimingInputsTrace {
	readonly #labels = new TraceLabels()
	readonly #blocks: string[] = []
	#previousEntries: readonly TraceEntry[] = EMPTY_PLAYLIST_ENTRIES

	get labels(): TraceLabels {
		return this.#labels
	}

	get text(): string {
		return this.#blocks.join('\n')
	}

	record(header: string, state: PlayoutState): void {
		this.#labels.learn(state)

		const entries = [...playlistEntries(state.playlist, this.#labels), ...partInstanceEntries(state, this.#labels)]
		const previousByKey = new Map(this.#previousEntries.map((entry) => [entry.key, entry]))
		const currentKeys = new Set(entries.map((entry) => entry.key))

		const lines = [header]
		for (const entry of entries) {
			const previous = previousByKey.get(entry.key)
			if (previous && previous.lines.join('\n') === entry.lines.join('\n')) continue

			const [firstLine, ...continuationLines] = entry.lines
			lines.push(formatLine(entry.key, firstLine), ...continuationLines.map(formatContinuationLine))
		}
		for (const previous of this.#previousEntries) {
			if (currentKeys.has(previous.key) || !previous.partInstanceId) continue
			lines.push(formatLine(previous.key, `gone (${whyGone(previous.partInstanceId, state)})`))
		}
		if (lines.length === 1) lines.push('  no change')

		this.#blocks.push(lines.join('\n'))
		this.#previousEntries = entries
	}
}

// Running a show

type Gateway = ReferenceShowGateway & {
	/** The gateway in plain words, as the script names use it */
	description: string
}

const NO_GATEWAY: Gateway = { kind: 'no gateway', description: 'with no gateway' }
const GATEWAY_CONFIRMING_AT_ONCE: Gateway = {
	kind: 'single gateway',
	description: 'with a gateway that confirms each start at once',
	confirmsAfterMs: 0,
}
const GATEWAY_CONFIRMING_AFTER_200_MS: Gateway = {
	kind: 'single gateway',
	description: 'with a gateway that confirms each start after 200 ms',
	confirmsAfterMs: 200,
}
const GATEWAY_NEVER_CONFIRMING: Gateway = {
	kind: 'single gateway',
	description: 'with a gateway that never confirms a start',
	confirmsAfterMs: 'never',
}
const MULTI_GATEWAY: Gateway = { kind: 'multi gateway', description: 'in multi-gateway mode', latencyMs: 30 }

const EVERY_GATEWAY: readonly Gateway[] = [
	NO_GATEWAY,
	GATEWAY_CONFIRMING_AT_ONCE,
	GATEWAY_CONFIRMING_AFTER_200_MS,
	GATEWAY_NEVER_CONFIRMING,
	MULTI_GATEWAY,
]

/** ForwardTime, planned to start at 12:00:00 and to last 2:30 */
const SHOW_TIMING: RundownPlaylistTiming = {
	type: PlaylistTimingType.ForwardTime,
	expectedStart: clock('12:00:00'),
	expectedDuration: length('2:30'),
}

/** What a job did, as the header of its block names it */
function describeJob(job: ReferenceShowJob, labels: TraceLabels): string {
	switch (job.kind) {
		case 'activate':
			return `activate ${job.rehearsal ? 'in rehearsal' : 'on air'}`
		case 'deactivate':
			return 'deactivate'
		case 'reset':
			return job.thenActivate === undefined ? 'reset' : `reset and activate ${job.thenActivate}`
		case 'set next':
			return job.from === undefined
				? `set next ${job.part}`
				: `set next ${job.part} from ${formatLength(job.from)}`
		case 'take':
			return 'take'
		case 'gateway report': {
			// The header names the started part first
			const reported: string[] = []
			if (job.started) reported.push(`${labels.partInstance(unprotectString(job.started))} started`)
			if (job.stopped) reported.push(`${labels.partInstance(unprotectString(job.stopped))} stopped`)
			const reportText = `gateway reports ${reported.join(' and ')}`
			return job.cause === 'auto-next' ? `auto-next: ${reportText}` : reportText
		}
		case 'start a hold':
			return 'start a hold'
		case 'cancel the hold':
			return 'cancel the hold'
		default:
			assertNever(job)
			return 'unknown'
	}
}

/** The reference rundown played by the real jobs, with a trace block recorded after each job */
async function startShow(
	gateway: Gateway,
	variant: RundownVariant | undefined
): Promise<{ show: ReferenceShow; trace: TimingInputsTrace }> {
	const trace = new TimingInputsTrace()
	const state = async (context: MockJobContext): Promise<PlayoutState> => {
		const playlist = await context.mockCollections.RundownPlaylists.findOne(REFERENCE_PLAYLIST_ID)
		if (!playlist) throw new Error('The reference playlist is missing')
		return {
			playlist,
			partInstances: await context.mockCollections.PartInstances.findFetch({}),
			parts: await context.mockCollections.Parts.findFetch({}),
		}
	}

	const show = await startReferenceShow({
		timing: SHOW_TIMING,
		gateway,
		variant,
		onJob: async (at, job, context) => {
			trace.record(`${formatClock(at)} ${describeJob(job, trace.labels)}`, await state(context))
		},
	})

	// The first block: the state after setup, before any job has run
	trace.record('before any job', await state(show.context))
	return { show, trace }
}

// The scripts

interface Script {
	/** What the script shows. Its trace follows this name in the recording */
	name: string
	gateway: Gateway
	/** The changes to the reference rundown, if any */
	variant?: RundownVariant
	play: (show: ReferenceShow) => Promise<void>
}

const A1_AUTO_NEXTS: RundownVariant = { parts: { A1: { autoNext: true } } }
const HOLD_FROM_B1_TO_B2: RundownVariant = {
	parts: { B1: { holdMode: PartHoldMode.FROM }, B2: { holdMode: PartHoldMode.TO } },
}

const SCRIPTS: readonly Script[] = [
	{
		name: 'activating in rehearsal sets the first part as next',
		gateway: GATEWAY_CONFIRMING_AT_ONCE,
		play: async (show) => {
			await show.activate('11:59:00', { rehearsal: true })
		},
	},
	{
		name: 'going on air during a rehearsal keeps the start and the selected parts, and drops parts played before',
		gateway: GATEWAY_CONFIRMING_AT_ONCE,
		play: async (show) => {
			await show.activate('11:58:00', { rehearsal: true })
			await show.take('11:58:30')
			await show.take('11:58:41')
			await show.take('11:58:57')
			await show.activate('11:59:30')
			await show.take('12:00:05')
		},
	},
	// Activated at 11:59:00; A1 taken 5 s late, A2 after 12 s, A3 after 13 s
	...EVERY_GATEWAY.map(
		(gateway): Script => ({
			name: `the first takes of a show, ${gateway.description}`,
			gateway,
			play: async (show) => {
				await show.activate('11:59:00')
				await show.take('12:00:05')
				await show.take('12:00:17')
				await show.take('12:00:30')
			},
		})
	),
	{
		name: 'set next forward, skipping a segment',
		gateway: NO_GATEWAY,
		play: async (show) => {
			await show.activate('11:59:00')
			await show.take('12:00:05')
			await show.setNext('12:00:09', 'C1')
			await show.take('12:00:15')
			await show.take('12:00:22')
		},
	},
	{
		name: 'set next back to an earlier part of the on-air segment',
		gateway: NO_GATEWAY,
		play: async (show) => {
			await show.activate('11:59:00')
			await show.take('12:00:05')
			await show.take('12:00:17')
			await show.setNext('12:00:20', 'A1')
			await show.take('12:00:23')
		},
	},
	{
		// With B2 on air after B1, only segments B and C are loaded, so A1 is not reset when A2 is set as next
		name: 'set next back into a segment that playout has not loaded',
		gateway: NO_GATEWAY,
		play: async (show) => {
			await show.activate('11:59:00')
			await show.take('12:00:05')
			await show.setNext('12:00:09', 'B1')
			await show.take('12:00:15')
			await show.take('12:00:36')
			await show.setNext('12:00:40', 'A2')
			await show.take('12:00:44')
			await show.take('12:00:51')
		},
	},
	// A1 taken at 12:00:05; A2 set to play from 0:05 in, and taken at 12:00:12
	...EVERY_GATEWAY.map(
		(gateway): Script => ({
			name: `playing a part from a point inside it, ${gateway.description}`,
			gateway,
			play: async (show) => {
				await show.activate('11:59:00')
				await show.take('12:00:05')
				await show.setNext('12:00:09', 'A2', { from: length('0:05') })
				await show.take('12:00:12')
			},
		})
	),
	{
		name: `auto-next from A1, ${GATEWAY_CONFIRMING_AT_ONCE.description}`,
		gateway: GATEWAY_CONFIRMING_AT_ONCE,
		variant: A1_AUTO_NEXTS,
		play: async (show) => {
			await show.activate('11:59:00')
			await show.take('12:00:05')
			await show.autoNext('12:00:15')
			await show.take('12:00:27')
		},
	},
	{
		name: 'auto-next from A1 in multi-gateway mode, where the start of A2 is scheduled at the take of A1',
		gateway: MULTI_GATEWAY,
		variant: A1_AUTO_NEXTS,
		play: async (show) => {
			await show.activate('11:59:00')
			await show.take('12:00:05')
			await show.autoNext('12:00:15.030')
			await show.take('12:00:27')
		},
	},
	{
		name: 'auto-next from A1 in multi-gateway mode, where a part set as next while A1 is on air is scheduled to start when A1 ends',
		gateway: MULTI_GATEWAY,
		variant: A1_AUTO_NEXTS,
		play: async (show) => {
			await show.activate('11:59:00')
			await show.take('12:00:05')
			await show.setNext('12:00:09', 'C1')
			await show.autoNext('12:00:15.030')
		},
	},
	{
		name: 'a hold from B1 to B2, started, completed by the second take, and cleared by the third',
		gateway: GATEWAY_CONFIRMING_AT_ONCE,
		variant: HOLD_FROM_B1_TO_B2,
		play: async (show) => {
			await show.activate('11:59:00')
			await show.setNext('11:59:10', 'B1')
			await show.take('12:00:05')
			await show.startHold('12:00:20')
			await show.take('12:00:25')
			await show.take('12:00:40')
			await show.take('12:01:00')
		},
	},
	{
		name: 'a hold from B1 to B2, started and cancelled',
		gateway: GATEWAY_CONFIRMING_AT_ONCE,
		variant: HOLD_FROM_B1_TO_B2,
		play: async (show) => {
			await show.activate('11:59:00')
			await show.setNext('11:59:10', 'B1')
			await show.take('12:00:05')
			await show.startHold('12:00:20')
			await show.cancelHold('12:00:22')
		},
	},
	{
		name: 'deactivated during the show, reset, and activated again',
		gateway: GATEWAY_CONFIRMING_AT_ONCE,
		play: async (show) => {
			await show.activate('11:59:00')
			await show.take('12:00:05')
			await show.take('12:00:17')
			await show.deactivate('12:00:31')
			await show.reset('12:01:00')
			await show.reset('12:02:00', { thenActivate: 'on air' })
		},
	},
	{
		name: 'reset during a rehearsal, then on air',
		gateway: GATEWAY_CONFIRMING_AT_ONCE,
		play: async (show) => {
			await show.activate('11:58:00', { rehearsal: true })
			await show.take('11:58:30')
			await show.reset('11:59:00')
			await show.activate('11:59:30')
		},
	},
]

describe('timing inputs written by playout, on the reference rundown', () => {
	const recording = readRecording()
	/** The traces written in this run, when the recording is being rewritten */
	const newTraces = new Map<string, string>()

	afterEach(() => {
		useRealCurrentTime()
	})

	afterAll(() => {
		if (!UPDATE_RECORDING) return
		// A script that did not run in this run keeps its trace
		const traces = SCRIPTS.map((script) => ({
			name: script.name,
			trace: newTraces.get(script.name) ?? recording.traces.get(script.name),
		})).filter((entry): entry is { name: string; trace: string } => entry.trace !== undefined)
		fs.writeFileSync(RECORDING_FILE, formatRecording(traces))
	})

	it('prints clock times and lengths exactly', () => {
		expect(formatClock(clock('12:00:05'))).toBe('12:00:05')
		expect(formatClock(clock('12:00:05.030'))).toBe('12:00:05.030')
		expect(formatClock(REFERENCE_DAY - 1)).toBe('2026-01-04T23:59:59.999Z')
		expect(formatLength(length('2:30'))).toBe('2:30')
		expect(formatLength(-length('0:09.800'))).toBe('-0:09.800')
		expect(formatLength(0)).toBe('0:00')
		expect(formatLength(length('61:01'))).toBe('1:01:01')
	})

	it('the recording holds the trace of every script, in the order of the scripts, and nothing else', () => {
		if (UPDATE_RECORDING) return
		expect([...recording.traces.keys()]).toEqual(SCRIPTS.map((script) => script.name))
		// So that the file is exactly what a rewrite gives: the preamble, the blank lines and the last newline too
		const traces = SCRIPTS.map((script) => ({ name: script.name, trace: recording.traces.get(script.name) ?? '' }))
		expect(recording.text).toBe(formatRecording(traces))
	})

	it.each(SCRIPTS)('$name', async (script) => {
		const { show, trace } = await startShow(script.gateway, script.variant)
		await script.play(show)

		if (UPDATE_RECORDING) {
			newTraces.set(script.name, trace.text)
			return
		}
		const recordedTrace = recording.traces.get(script.name)
		if (recordedTrace === undefined) {
			throw new Error(`${RECORDING_PATH} has no trace for this script; set UPDATE_TIMING_TRACE=1 to add it`)
		}
		expect(trace.text).toBe(recordedTrace)
	})
})
