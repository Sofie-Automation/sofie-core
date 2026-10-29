import * as fs from 'fs'
import * as path from 'path'
import { PartHoldMode, PlaylistTimingType, type RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'
import { type Gateway, GATEWAY_CONFIRMING_AT_ONCE, type PlayoutScript, playoutScript } from './lib/playoutScript'
import { clock, length, referenceRundown, type RundownVariant } from './lib/referenceRundown'
import { type TimingText, timingTextSerializer } from './lib/renderTimingText'

/**
 * The playout driver against real playout. The job worker's timing inputs test
 * (packages/job-worker/src/playout/__tests__/timingInputs.test.ts) runs short shows through the real playout jobs, and
 * records what playout wrote as text, one trace per script, in a file next to it. These tests play the same scripts,
 * under the same names, through the driver, and check that the driver prints the same trace, line for line. The trace
 * holds everything playout writes that the publication reads, but for two things both sides check instead: a
 * PartInstance's playout timings, which are inert on this rundown, and the loop, which no script sets. So the driver
 * and real playout cannot drift apart without one of these tests failing.
 *
 * The file is read as data: this test has its own reader of it, and the driver its own printer of the trace, so no
 * code is shared with the job worker's test. When playout changes what it writes, the job worker's test fails until
 * the file is rewritten from real playout, and then these tests show where the driver no longer follows.
 *
 * The tests after those check what a read gives: the publication's inputs and documents at an instant.
 */

expect.addSnapshotSerializer(timingTextSerializer)

// The recording of real playout

/** The recording, by its path from the repository root, as the job worker's test names it */
const RECORDING_PATH = 'packages/job-worker/src/playout/__tests__/timingInputs.trace.txt'
/** This test is in packages/sofie-core/src/publications/playlistTimingState/__tests__/timing, seven folders below the root */
const REPOSITORY_ROOT = path.resolve(__dirname, '../../../../../../..')

/** Each trace in the recording follows a line with this mark and the script's name */
const SCRIPT_MARK = '=== '

/** The traces in the recording, by script name, in the order of the file */
function readRecording(): Map<string, string> {
	const text = fs.readFileSync(path.join(REPOSITORY_ROOT, RECORDING_PATH), 'utf8')
	const traces = new Map<string, string>()
	const [, ...sections] = text.split(`\n\n${SCRIPT_MARK}`)
	for (const section of sections) {
		const [name, ...traceLines] = section.trimEnd().split('\n')
		traces.set(name, traceLines.join('\n'))
	}
	return traces
}

// The scripts, as the job worker's test plays them

const NO_GATEWAY: Gateway = { kind: 'no gateway' }
const GATEWAY_CONFIRMING_AFTER_200_MS: Gateway = { kind: 'single gateway', confirmsAfterMs: 200 }
const GATEWAY_NEVER_CONFIRMING: Gateway = { kind: 'single gateway', confirmsAfterMs: 'never' }
const MULTI_GATEWAY: Gateway = { kind: 'multi gateway', latencyMs: 30 }

/** Each gateway mode, with the words the script names use for it */
const EVERY_GATEWAY: ReadonlyArray<{ gateway: Gateway; description: string }> = [
	{ gateway: NO_GATEWAY, description: 'with no gateway' },
	{ gateway: GATEWAY_CONFIRMING_AT_ONCE, description: 'with a gateway that confirms each start at once' },
	{ gateway: GATEWAY_CONFIRMING_AFTER_200_MS, description: 'with a gateway that confirms each start after 200 ms' },
	{ gateway: GATEWAY_NEVER_CONFIRMING, description: 'with a gateway that never confirms a start' },
	{ gateway: MULTI_GATEWAY, description: 'in multi-gateway mode' },
]

/** ForwardTime, planned to start at 12:00:00 and to last 2:30 */
const SHOW_TIMING: RundownPlaylistTiming = {
	type: PlaylistTimingType.ForwardTime,
	expectedStart: clock('12:00:00'),
	expectedDuration: length('2:30'),
}

/** Every trace is read after the last step of its script */
const AFTER_THE_SHOW = '12:10:00'

function startShow(options: { gateway: Gateway; variant?: RundownVariant }): PlayoutScript {
	return playoutScript({ rundown: referenceRundown(options.variant), timing: SHOW_TIMING, gateway: options.gateway })
}

const A1_AUTO_NEXTS: RundownVariant = { parts: { A1: { autoNext: true } } }
const HOLD_FROM_B1_TO_B2: RundownVariant = {
	parts: { B1: { holdMode: PartHoldMode.FROM }, B2: { holdMode: PartHoldMode.TO } },
}

interface Script {
	/** The name of the script in the recording */
	name: string
	gateway: Gateway
	/** The changes to the reference rundown, if any */
	variant?: RundownVariant
	play: (show: PlayoutScript) => PlayoutScript
}

const SCRIPTS: readonly Script[] = [
	{
		name: 'activating in rehearsal sets the first part as next',
		gateway: GATEWAY_CONFIRMING_AT_ONCE,
		play: (show) => show.activate('11:59:00', { rehearsal: true }),
	},
	{
		name: 'going on air during a rehearsal keeps the start and the selected parts, and drops parts played before',
		gateway: GATEWAY_CONFIRMING_AT_ONCE,
		play: (show) =>
			show
				.activate('11:58:00', { rehearsal: true })
				.take('11:58:30')
				.take('11:58:41')
				.take('11:58:57')
				.activate('11:59:30')
				.take('12:00:05'),
	},
	// Activated at 11:59:00; A1 taken 5 s late, A2 after 12 s, A3 after 13 s
	...EVERY_GATEWAY.map(
		({ gateway, description }): Script => ({
			name: `the first takes of a show, ${description}`,
			gateway,
			play: (show) => show.activate('11:59:00').take('12:00:05').take('12:00:17').take('12:00:30'),
		})
	),
	{
		name: 'set next forward, skipping a segment',
		gateway: NO_GATEWAY,
		play: (show) =>
			show.activate('11:59:00').take('12:00:05').setNext('12:00:09', 'C1').take('12:00:15').take('12:00:22'),
	},
	{
		name: 'set next back to an earlier part of the on-air segment',
		gateway: NO_GATEWAY,
		play: (show) =>
			show.activate('11:59:00').take('12:00:05').take('12:00:17').setNext('12:00:20', 'A1').take('12:00:23'),
	},
	{
		// With B2 on air after B1, only segments B and C are loaded, so A1 is not reset when A2 is set as next
		name: 'set next back into a segment that playout has not loaded',
		gateway: NO_GATEWAY,
		play: (show) =>
			show
				.activate('11:59:00')
				.take('12:00:05')
				.setNext('12:00:09', 'B1')
				.take('12:00:15')
				.take('12:00:36')
				.setNext('12:00:40', 'A2')
				.take('12:00:44')
				.take('12:00:51'),
	},
	// A1 taken at 12:00:05; A2 set to play from 0:05 in, and taken at 12:00:12
	...EVERY_GATEWAY.map(
		({ gateway, description }): Script => ({
			name: `playing a part from a point inside it, ${description}`,
			gateway,
			play: (show) =>
				show.activate('11:59:00').take('12:00:05').setNext('12:00:09', 'A2', { from: '0:05' }).take('12:00:12'),
		})
	),
	{
		name: 'auto-next from A1, with a gateway that confirms each start at once',
		gateway: GATEWAY_CONFIRMING_AT_ONCE,
		variant: A1_AUTO_NEXTS,
		play: (show) => show.activate('11:59:00').take('12:00:05').autoNext('12:00:15').take('12:00:27'),
	},
	{
		name: 'auto-next from A1 in multi-gateway mode, where the start of A2 is scheduled at the take of A1',
		gateway: MULTI_GATEWAY,
		variant: A1_AUTO_NEXTS,
		play: (show) => show.activate('11:59:00').take('12:00:05').autoNext('12:00:15.030').take('12:00:27'),
	},
	{
		name: 'auto-next from A1 in multi-gateway mode, where a part set as next while A1 is on air is scheduled to start when A1 ends',
		gateway: MULTI_GATEWAY,
		variant: A1_AUTO_NEXTS,
		play: (show) => show.activate('11:59:00').take('12:00:05').setNext('12:00:09', 'C1').autoNext('12:00:15.030'),
	},
	{
		name: 'a hold from B1 to B2, started, completed by the second take, and cleared by the third',
		gateway: GATEWAY_CONFIRMING_AT_ONCE,
		variant: HOLD_FROM_B1_TO_B2,
		play: (show) =>
			show
				.activate('11:59:00')
				.setNext('11:59:10', 'B1')
				.take('12:00:05')
				.startHold('12:00:20')
				.take('12:00:25')
				.take('12:00:40')
				.take('12:01:00'),
	},
	{
		name: 'a hold from B1 to B2, started and cancelled',
		gateway: GATEWAY_CONFIRMING_AT_ONCE,
		variant: HOLD_FROM_B1_TO_B2,
		play: (show) =>
			show
				.activate('11:59:00')
				.setNext('11:59:10', 'B1')
				.take('12:00:05')
				.startHold('12:00:20')
				.cancelHold('12:00:22'),
	},
	{
		name: 'deactivated during the show, reset, and activated again',
		gateway: GATEWAY_CONFIRMING_AT_ONCE,
		play: (show) =>
			show
				.activate('11:59:00')
				.take('12:00:05')
				.take('12:00:17')
				.deactivate('12:00:31')
				.reset('12:01:00')
				.reset('12:02:00', { thenActivate: 'on air' }),
	},
	{
		name: 'reset during a rehearsal, then on air',
		gateway: GATEWAY_CONFIRMING_AT_ONCE,
		play: (show) =>
			show.activate('11:58:00', { rehearsal: true }).take('11:58:30').reset('11:59:00').activate('11:59:30'),
	},
]

describe('the driver writes what real playout writes, on the reference rundown', () => {
	const recording = readRecording()

	it('plays every script of the recording, in its order, and no other', () => {
		expect(SCRIPTS.map((script) => script.name)).toEqual([...recording.keys()])
	})

	it.each(SCRIPTS)('$name', (script) => {
		const show = script.play(startShow({ gateway: script.gateway, variant: script.variant }))

		expect(show.traceAt(AFTER_THE_SHOW)).toBe(recording.get(script.name))
	})

	it('a script confirms a start for a gateway that never confirms one as a gateway confirming after 200 ms does', () => {
		const confirmedByTheScript = startShow({ gateway: GATEWAY_NEVER_CONFIRMING })
			.activate('11:59:00')
			.take('12:00:05')
			.confirmStart('12:00:05.200')
		const confirmedByTheGateway = startShow({ gateway: GATEWAY_CONFIRMING_AFTER_200_MS })
			.activate('11:59:00')
			.take('12:00:05')

		expect(confirmedByTheScript.traceAt(AFTER_THE_SHOW)).toBe(confirmedByTheGateway.traceAt(AFTER_THE_SHOW))
		expect(confirmedByTheScript.readAt('12:00:10')).toEqual(confirmedByTheGateway.readAt('12:00:10'))
	})
})

describe('reading the publication', () => {
	// A1 taken 5 s late, and confirmed at once
	const lateStart = startShow({ gateway: GATEWAY_CONFIRMING_AT_ONCE }).activate('11:59:00').take('12:00:05')

	it('reads the documents published at the last step, at a later instant', () => {
		expect(lateStart.readAt('12:00:10')).toMatchInlineSnapshot(`
		12:00:10, published 12:00:05
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started 12:00:05  remaining 2:25 runs until 12:00:15  ends 12:02:35 fixed until 12:00:15  in hand 0:00 holds until 12:00:15
		  on air     A1 in A  left 0:05 running since 12:00:05  budget none  auto-next no
		  segment A  parts  planned 0:30  played 0:05 runs  left 0:25 runs
		  segment B  parts  planned 0:40  played 0:00  left 0:40
		  segment C  parts  planned 1:00  played 0:00  left 1:00
		  segment D  parts  planned 0:20  played 0:00  left 0:20
		  order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
		  countdown  runs until 12:00:15: A2 0:05  A3 0:15  B1 0:25  B2 0:45  C1 1:05  C2 1:15  C3 1:35  D1 2:05  D2 2:15
		  as planned A3 B1 B2 C1 C2 C3 D1 D2
		  A1         on air  planned 0:10  drawn 0:10  played 0:05 running since 12:00:05  length 0:10 holds until 12:00:15  width 0:10 holds until 12:00:15
		  A2         next  planned 0:10  drawn 0:10  played 0:00  length 0:10  width 0:10
		  counted    all
		  untimed    none
		  orphaned   none
		  in loop    none
	`)
	})

	it('reads the show lines of each timing mode', () => {
		expect(
			lateStart.readAt('12:00:10', { view: 'show', modes: ['none', 'forward start+duration', 'duration 2:30'] })
		).toMatchInlineSnapshot(`
		12:00:10, published 12:00:05
		  none                   started 12:00:05  remaining 2:25 runs until 12:00:15  ends 12:02:35 fixed until 12:00:15  in hand 0:00 holds until 12:00:15
		  forward start+duration started 12:00:05  remaining 2:25 runs until 12:00:15  ends 12:02:35 fixed until 12:00:15  in hand 0:00 holds until 12:00:15
		  duration 2:30          started 12:00:05  remaining 2:25 runs  ends 12:02:35  in hand 0:00 holds until 12:00:15
		  on air     A1 in A  left 0:05 running since 12:00:05  budget none  auto-next no
	`)
	})

	it('reads only the steps at or before the instant', () => {
		expect(lateStart.readAt('12:00:04', { view: 'show' })).toMatchInlineSnapshot(`
		12:00:04, published 11:59:00
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started none  remaining 2:30  ends 12:02:34 moving since 12:00:00  in hand 0:00
		  on air     none in none  left none  budget none  auto-next no
	`)
		expect(lateStart.traceAt('12:00:04')).toEqual(
			startShow({ gateway: GATEWAY_CONFIRMING_AT_ONCE }).activate('11:59:00').traceAt('12:00:04')
		)
	})

	it('refuses a time of publication before the last step that changed what it reads, or after the instant', () => {
		expect(() => lateStart.readAt('12:00:10', { publishedAt: '12:00:00' })).toThrow(
			'The publication cannot have calculated at 12:00:00, before the last step that changed what it reads'
		)
		expect(() => lateStart.readAt('12:00:10', { publishedAt: '12:00:11' })).toThrow(
			'The publication cannot have calculated at 12:00:11, after the instant read'
		)
	})

	/** The first line of a read: the instant, and when the publication calculated the documents */
	function headline(text: TimingText): string {
		return text.text.split('\n')[0]
	}

	it('keeps the documents of the last step that changed what the publication reads', () => {
		// The publication does not read the hold state, so starting or cancelling a hold changes nothing it shows
		const onAir = startShow({ gateway: GATEWAY_CONFIRMING_AT_ONCE, variant: HOLD_FROM_B1_TO_B2 })
			.activate('11:59:00')
			.setNext('11:59:10', 'B1')
			.take('12:00:05')
		const heldAndCancelled = onAir.startHold('12:00:20').cancelHold('12:00:22')

		expect(headline(heldAndCancelled.readAt('12:00:21', { view: 'show' }))).toBe('12:00:21, published 12:00:05')
		expect(heldAndCancelled.readAt('12:00:23')).toEqual(onAir.readAt('12:00:23'))
	})

	it('reads a show that no step has changed yet as calculated at any time up to the instant', () => {
		const notActivated = startShow({ gateway: GATEWAY_CONFIRMING_AT_ONCE })

		expect(headline(notActivated.readAt('11:59:00', { view: 'show' }))).toBe('11:59:00, published 11:59:00')
		expect(headline(notActivated.readAt('11:59:00', { view: 'show', publishedAt: '11:30:00' }))).toBe(
			'11:59:00, published 11:30:00'
		)
		expect(() => notActivated.readAt('11:59:00', { publishedAt: '11:59:01' })).toThrow(
			'The publication cannot have calculated at 11:59:01, after the instant read'
		)
	})

	it('gives the publication no PartInstances while the playlist is inactive', () => {
		const show = lateStart.take('12:00:17').deactivate('12:00:31')

		expect(show.inputsAt('12:00:30').partInstances.map((partInstance) => partInstance._id)).toEqual([
			'A1_1',
			'A2_1',
			'A3_1',
		])
		expect(show.inputsAt('12:00:31').playlist.activationId).toBeUndefined()
		expect(show.inputsAt('12:00:31').partInstances).toEqual([])
	})

	it('gives the publication only the PartInstances of the current activation that are not reset', () => {
		const rehearsalThenOnAir = startShow({ gateway: GATEWAY_CONFIRMING_AT_ONCE })
			.activate('11:58:00', { rehearsal: true })
			.take('11:58:30')
			.take('11:58:41')
			.take('11:58:57')
			.activate('11:59:30')
		const backToA1 = startShow({ gateway: NO_GATEWAY })
			.activate('11:59:00')
			.take('12:00:05')
			.take('12:00:17')
			.setNext('12:00:20', 'A1')

		const ids = (show: PlayoutScript, instant: string) =>
			show.inputsAt(instant).partInstances.map((partInstance) => partInstance._id)
		expect(ids(rehearsalThenOnAir, '11:59:00')).toEqual(['A1_1', 'A2_1', 'A3_1', 'B1_1'])
		expect(ids(rehearsalThenOnAir, '11:59:30')).toEqual(['A2_1', 'A3_1', 'B1_1'])
		expect(ids(backToA1, '12:00:20')).toEqual(['A2_1', 'A1_2'])
	})

	it('refuses a step that real playout refuses, or that would go back in time', () => {
		const onAir = startShow({ gateway: NO_GATEWAY }).activate('11:59:00').take('12:00:05')

		expect(() => onAir.deactivate('12:00:10').take('12:00:15').traceAt(AFTER_THE_SHOW)).toThrow(
			'The playlist is not active'
		)
		expect(() => onAir.take('12:00:04').traceAt(AFTER_THE_SHOW)).toThrow(
			'A job at 12:00:04 would go back in time, after the job at 12:00:05'
		)
		expect(() =>
			startShow({ gateway: GATEWAY_CONFIRMING_AFTER_200_MS })
				.activate('11:59:00')
				.take('12:00:05')
				.take('12:00:05.100')
				.traceAt(AFTER_THE_SHOW)
		).toThrow('A job at 12:00:05.100 would go back in time, after the job at 12:00:05.200')
		expect(() => onAir.confirmStart('12:00:06').traceAt(AFTER_THE_SHOW)).toThrow(
			'Only a gateway that never confirms a start by itself needs the script to confirm it'
		)
		expect(() => onAir.autoNext('12:00:15').traceAt(AFTER_THE_SHOW)).toThrow(
			'Without a gateway nothing reports that the next part started'
		)
	})

	it('refuses a part that plays for no time at all, unless the step allows it', () => {
		const onAir = startShow({ gateway: NO_GATEWAY }).activate('11:59:00').take('12:00:05')

		expect(() => onAir.take('12:00:05').traceAt(AFTER_THE_SHOW)).toThrow(
			'At 12:00:05, PartInstance "A1_1" has played for no time at all; allow it on the step if this is intended'
		)
		expect(() =>
			onAir.take('12:00:05', { allowZeroLength: true }).take('12:00:15').traceAt(AFTER_THE_SHOW)
		).not.toThrow()
	})

	it('keeps a script unchanged when a step is added to it', () => {
		const base = startShow({ gateway: NO_GATEWAY }).activate('11:59:00')
		const before = base.traceAt(AFTER_THE_SHOW)
		base.take('12:00:05')

		expect(base.traceAt(AFTER_THE_SHOW)).toEqual(before)
	})
})
