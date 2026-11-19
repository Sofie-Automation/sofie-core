import { PartHoldMode, PlaylistTimingType, type RundownPlaylistTiming } from '@sofie-automation/blueprints-integration'
import { type Gateway, GATEWAY_CONFIRMING_AT_ONCE, type PlayoutScript, playoutScript } from './lib/playoutScript'
import {
	clock,
	length,
	referenceRundown,
	type RundownVariant,
} from '@sofie-automation/corelib/dist/testing/referenceRundown'
import { type TimingText, timingTextSerializer } from './lib/renderTimingText'

/**
 * The playout script: what a read gives, the publication's inputs and documents at an instant, of a show the job
 * worker's real playout jobs play. What playout writes itself is pinned by the job worker's timing inputs test
 * (packages/job-worker/src/playout/__tests__/timingInputs.test.ts), which plays its shows with the same driver.
 */

expect.addSnapshotSerializer(timingTextSerializer)

const NO_GATEWAY: Gateway = { kind: 'no gateway' }
const GATEWAY_CONFIRMING_AFTER_200_MS: Gateway = { kind: 'single gateway', confirmsAfterMs: 200 }
const GATEWAY_NEVER_CONFIRMING: Gateway = { kind: 'single gateway', confirmsAfterMs: 'never' }

/** ForwardTime, planned to start at 12:00:00 and to last 2:30 */
const SHOW_TIMING: RundownPlaylistTiming = {
	type: PlaylistTimingType.ForwardTime,
	expectedStart: clock('12:00:00'),
	expectedDuration: length('2:30'),
}

/** A read after the last step of every script */
const AFTER_THE_SHOW = '12:10:00'

function startShow(options: { gateway: Gateway; variant?: RundownVariant }): PlayoutScript {
	return playoutScript({ rundown: referenceRundown(options.variant), timing: SHOW_TIMING, gateway: options.gateway })
}

const HOLD_FROM_B1_TO_B2: RundownVariant = {
	parts: { B1: { holdMode: PartHoldMode.FROM }, B2: { holdMode: PartHoldMode.TO } },
}

describe('reading the publication', () => {
	// A1 taken 5 s late, and confirmed at once
	const lateStart = startShow({ gateway: GATEWAY_CONFIRMING_AT_ONCE }).activate('11:59:00').take('12:00:05')

	it('reads the documents published at the last step, at a later instant', async () => {
		expect(await lateStart.readAt('12:00:10')).toMatchInlineSnapshot(`
		12:00:10, published 12:00:05
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30  target 2:30
		  show       started 12:00:05  remaining 2:25 runs until 12:00:15  ends 12:02:35 fixed until 12:00:15  in hand 0:00 holds until 12:00:15
		  on air     A1 in A  left 0:05 running since 12:00:05  budget none  auto-next no
		  segment A  parts  target 0:30  content 0:30  played 0:05 runs  left 0:25 runs
		  segment B  parts  target 0:40  content 0:40  played 0:00  left 0:40
		  segment C  parts  target 1:00  content 1:00  played 0:00  left 1:00
		  segment D  parts  target 0:20  content 0:20  played 0:00  left 0:20
		  order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
		  countdown  runs until 12:00:15: A2 0:05  A3 0:15  B1 0:25  B2 0:45  C1 1:05  C2 1:15  C3 1:35  D1 2:05  D2 2:15
		  as planned A3 B1 B2 C1 C2 C3 D1 D2
		  A1         on air  planned 0:10  drawn 0:10  played 0:05 running since 12:00:05  length 0:10 holds until 12:00:15  width 0:10 holds until 12:00:15
		  A2         next  planned 0:10  drawn 0:10  played 0:00  length 0:10  width 0:10
		  counted    all
		  in loop    none
	`)
	})

	it('reads the show lines of each timing mode', async () => {
		expect(
			await lateStart.readAt('12:00:10', {
				view: 'show',
				modes: ['none', 'forward start+duration', 'duration 2:30'],
			})
		).toMatchInlineSnapshot(`
		12:00:10, published 12:00:05
		  none                   started 12:00:05  remaining 2:25 runs until 12:00:15  ends 12:02:35 fixed until 12:00:15  in hand 0:00 holds until 12:00:15
		  forward start+duration started 12:00:05  remaining 2:25 runs until 12:00:15  ends 12:02:35 fixed until 12:00:15  in hand 0:00 holds until 12:00:15
		  duration 2:30          started 12:00:05  remaining 2:25 runs  ends 12:02:35  in hand 0:00 holds until 12:00:15
		  on air     A1 in A  left 0:05 running since 12:00:05  budget none  auto-next no
	`)
	})

	it('reads only the steps at or before the instant', async () => {
		expect(await lateStart.readAt('12:00:04', { view: 'show' })).toMatchInlineSnapshot(`
		12:00:04, published 11:59:00
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30  target 2:30
		  show       started none  remaining 2:30  ends 12:02:34 moving since 12:00:00  in hand 0:00
		  on air     none in none  left none  budget none  auto-next no
	`)
		// Each show makes ids of its own, so the two are compared as text
		expect(await lateStart.readAt('12:00:04')).toEqual(
			await startShow({ gateway: GATEWAY_CONFIRMING_AT_ONCE }).activate('11:59:00').readAt('12:00:04')
		)
	})

	it('refuses a time of publication before the last step that changed what it reads, or after the instant', async () => {
		await expect(lateStart.readAt('12:00:10', { publishedAt: '12:00:00' })).rejects.toThrow(
			'The publication cannot have calculated at 12:00:00, before the last step that changed what it reads'
		)
		await expect(lateStart.readAt('12:00:10', { publishedAt: '12:00:11' })).rejects.toThrow(
			'The publication cannot have calculated at 12:00:11, after the instant read'
		)
	})

	/** The first line of a read: the instant, and when the publication calculated the documents */
	function headline(text: TimingText): string {
		return text.text.split('\n')[0]
	}

	it('keeps the documents of the last step that changed what the publication reads', async () => {
		// The publication does not read the hold state, so starting or cancelling a hold changes nothing it shows
		const onAir = startShow({ gateway: GATEWAY_CONFIRMING_AT_ONCE, variant: HOLD_FROM_B1_TO_B2 })
			.activate('11:59:00')
			.setNext('11:59:10', 'B1')
			.take('12:00:05')
		const heldAndCancelled = onAir.startHold('12:00:20').cancelHold('12:00:22')

		expect(headline(await heldAndCancelled.readAt('12:00:21', { view: 'show' }))).toBe(
			'12:00:21, published 12:00:05'
		)
		expect(await heldAndCancelled.readAt('12:00:23')).toEqual(await onAir.readAt('12:00:23'))
	})

	it('reads a show that no step has changed yet as calculated at any time up to the instant', async () => {
		const notActivated = startShow({ gateway: GATEWAY_CONFIRMING_AT_ONCE })

		expect(headline(await notActivated.readAt('11:59:00', { view: 'show' }))).toBe('11:59:00, published 11:59:00')
		expect(headline(await notActivated.readAt('11:59:00', { view: 'show', publishedAt: '11:30:00' }))).toBe(
			'11:59:00, published 11:30:00'
		)
		await expect(notActivated.readAt('11:59:00', { publishedAt: '11:59:01' })).rejects.toThrow(
			'The publication cannot have calculated at 11:59:01, after the instant read'
		)
	})

	it('gives the publication no PartInstances while the playlist is inactive', async () => {
		const show = lateStart.take('12:00:17').deactivate('12:00:31')

		expect(await show.partInstanceLabelsAt('12:00:30')).toEqual(['A1#1', 'A2#1', 'A3#1'])
		expect((await show.inputsAt('12:00:31')).playlist.activationId).toBeUndefined()
		expect((await show.inputsAt('12:00:31')).partInstances).toEqual([])
	})

	it('gives the publication only the PartInstances of the current activation that are not reset', async () => {
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

		expect(await rehearsalThenOnAir.partInstanceLabelsAt('11:59:00')).toEqual(['A1#1', 'A2#1', 'A3#1', 'B1#1'])
		expect(await rehearsalThenOnAir.partInstanceLabelsAt('11:59:30')).toEqual(['A2#1', 'A3#1', 'B1#1'])
		expect(await backToA1.partInstanceLabelsAt('12:00:20')).toEqual(['A2#1', 'A1#2'])
	})

	it('refuses a step that real playout refuses, or that would go back in time', async () => {
		const onAir = startShow({ gateway: NO_GATEWAY }).activate('11:59:00').take('12:00:05')

		await expect(onAir.deactivate('12:00:10').take('12:00:15').played()).rejects.toThrow('Rundown must be active!')
		await expect(onAir.take('12:00:04').played()).rejects.toThrow(
			'A job at 12:00:04 would go back in time, after 12:00:05'
		)
		await expect(
			startShow({ gateway: GATEWAY_CONFIRMING_AFTER_200_MS })
				.activate('11:59:00')
				.take('12:00:05')
				.take('12:00:05.100')
				.played()
		).rejects.toThrow('A job at 12:00:05.100 would go back in time, after 12:00:05.200')
		await expect(onAir.confirmStart('12:00:06').played()).rejects.toThrow(
			'Only a gateway that never confirms a start by itself needs to be told to confirm it'
		)
		await expect(onAir.autoNext('12:00:15').played()).rejects.toThrow(
			'Without a gateway nothing reports that the next part started'
		)
	})

	it('refuses a part that plays for no time at all, unless the step allows it', async () => {
		const onAir = startShow({ gateway: NO_GATEWAY }).activate('11:59:00').take('12:00:05')

		await expect(onAir.take('12:00:05').played()).rejects.toThrow(
			'At 12:00:05, PartInstance A1#1 has played for no time at all; allow it on the step if this is intended'
		)
		await expect(onAir.take('12:00:05', { allowZeroLength: true }).take('12:00:15').played()).resolves.toBeDefined()
	})

	it('a script confirms a start for a gateway that never confirms one as a gateway confirming after 200 ms does', async () => {
		const confirmedByTheScript = startShow({ gateway: GATEWAY_NEVER_CONFIRMING })
			.activate('11:59:00')
			.take('12:00:05')
			.confirmStart('12:00:05.200')
		const confirmedByTheGateway = startShow({ gateway: GATEWAY_CONFIRMING_AFTER_200_MS })
			.activate('11:59:00')
			.take('12:00:05')

		expect(await confirmedByTheScript.readAt('12:00:10')).toEqual(await confirmedByTheGateway.readAt('12:00:10'))
	})

	it('keeps a script unchanged when a step is added to it', async () => {
		const base = startShow({ gateway: NO_GATEWAY }).activate('11:59:00')
		const before = await base.inputsAt(AFTER_THE_SHOW)
		base.take('12:00:05')

		expect(await base.inputsAt(AFTER_THE_SHOW)).toEqual(before)
	})
})
