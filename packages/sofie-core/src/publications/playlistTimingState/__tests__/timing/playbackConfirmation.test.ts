import { isPlaylistTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { manipulatePlaylistTimingStatePublicationData } from '../../publication'
import { createReactiveContentCache } from '../../reactiveContentCache'
import { type Gateway, playoutScript, type PublicationInputs } from './lib/playoutScript'
import { REFERENCE_PLAYLIST_ID, referenceRundown, type RundownVariant } from './lib/referenceRundown'
import { timingTextSerializer } from './lib/renderTimingText'
import { PLANNED_TIMING } from './lib/standardShows'

/**
 * Playback confirmation: what the playlist timing publication gives between a take and the playout gateway's report
 * that the taken part has started, when the gateway confirms 0.2 s after the take, when it never confirms, and in
 * multi-gateway mode, where core schedules each start 2 s ahead and the gateway reports it then, and reports the
 * previous part stopped at the take. Every cell pins today's text.
 *
 * A client holds the documents calculated when what the publication reads last changed. A value that a calculation at
 * the instant itself reads differently is followed by that value, marked fresh. Main's screens calculated on every
 * tick, and so showed the fresh values, but for the differences the comparison with main lists, such as the one
 * between a take and the start in multi-gateway mode.
 *
 * The take read is that of B1, the first part of B, in the middle of the show. The show is planned to start at
 * 12:00:00 and to last 2:30, the playlist is activated at 11:59:00, and A1, A2, A3 and B1 are taken at 12:00:00,
 * 12:00:13, 12:00:22 and 12:00:35, so that A1 runs 13 s, A2 9 s and A3 13 s (11 s, 7 s and 11 s in multi-gateway
 * mode, where each part starts 2 s after its take and is reported stopped at the next take).
 *
 * At a take the job worker writes the playlist and the PartInstances at the same time, and the publication observes
 * them separately. When the playlist arrives first, it names a PartInstance the publication cannot see yet, and the
 * publication then publishes nothing new until that PartInstance arrives, so that no client reads documents
 * calculated from that half of the take. When the PartInstances arrive first, every PartInstance the playlist names
 * is already there, and the publication calculates as usual; that order is not pinned here.
 */

expect.addSnapshotSerializer(timingTextSerializer)

const GATEWAY_CONFIRMING_AFTER_200_MS: Gateway = { kind: 'single gateway', confirmsAfterMs: 200 }
const GATEWAY_NEVER_CONFIRMING: Gateway = { kind: 'single gateway', confirmsAfterMs: 'never' }
const MULTI_GATEWAY_2_S_AHEAD: Gateway = { kind: 'multi gateway', latencyMs: 2000 }

/** The show activated, and A1, A2 and A3 taken; the gateway confirms them as its mode says */
function untilA3OnAir(gateway: Gateway, variant?: RundownVariant) {
	return playoutScript({ rundown: referenceRundown(variant), timing: PLANNED_TIMING, gateway })
		.activate('11:59:00')
		.take('12:00:00')
		.take('12:00:13')
		.take('12:00:22')
}

/**
 * What the publication does when its cache holds these inputs: the documents it publishes, or null, which leaves the
 * documents it published before in place. It calculates them at the wall clock's time, not at the show's, so their
 * timers mean nothing here: a test reads only whether it publishes, and which take the documents are about
 */
function publish(inputs: PublicationInputs) {
	const cache = createReactiveContentCache()
	cache.StudioSettings.insert(inputs.studioSettings)
	cache.RundownPlaylists.insert(inputs.playlist)
	for (const segment of inputs.segments) cache.Segments.insert(segment)
	for (const part of inputs.parts) cache.Parts.insert(part)
	for (const partInstance of inputs.partInstances) cache.PartInstances.insert(partInstance)
	return manipulatePlaylistTimingStatePublicationData({ playlistId: REFERENCE_PLAYLIST_ID }, {}, { newCache: cache })
}

describe('a gateway that confirms each start 0.2 s after the take', () => {
	// A3 confirmed at 12:00:22.200
	const a3OnAir = untilA3OnAir(GATEWAY_CONFIRMING_AFTER_200_MS)
	// B1 taken at 12:00:35, and confirmed at 12:00:35.200
	const b1Taken = a3OnAir.take('12:00:35')

	it('B1 at its take', () => {
		expect(b1Taken.readAt('12:00:35.000')).toMatchInlineSnapshot(`
		12:00:35, published 12:00:35
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started 12:00:00.200  remaining 2:00  ends 12:02:35  in hand -0:04.800
		  on air     B1 in B  left 0:20  budget none  auto-next no
		  segment A  parts  planned 0:30  played 0:34.800  left -0:04.800
		  segment B  parts  planned 0:40  played 0:00  left 0:40
		  segment C  parts  planned 1:00  played 0:00  left 1:00
		  segment D  parts  planned 0:20  played 0:00  left 0:20
		  order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
		  countdown  holds: B2 0:20  C1 0:40  C2 0:50  C3 1:10  D1 1:40  D2 1:50
		  as planned C1 C2 C3 D1 D2
		  finished   A3 0:12.800
		  A1         instance  planned 0:10  drawn 0:13  played 0:13  length 0:13  width 0:13
		  A2         instance  planned 0:10  drawn 0:09  played 0:09  length 0:09  width 0:09
		  B1         on air  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  B2         next  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  counted    all but A1 A2 A3
		  untimed    none
		  orphaned   none
		  in loop    none
	`)
	})

	it("B1 at its take, when the playlist arrives before B2's new PartInstance", async () => {
		// The playlist as the take of B1 wrote it, which names B2's new PartInstance as next, with the PartInstances as
		// they were before the take
		const beforeTheTake = a3OnAir.inputsAt('12:00:35')
		const afterTheTake = b1Taken.inputsAt('12:00:35')
		const playlistArrivedFirst = { ...beforeTheTake, playlist: afterTheTake.playlist }

		expect(await publish(playlistArrivedFirst)).toBeNull()
		const published = await publish(afterTheTake)
		expect(published?.find(isPlaylistTimingStateDoc)?.currentPartInstanceId).toBe(protectString('B1_1'))

		/*
		 * So until B2's PartInstance arrives, a client reads the documents published at the confirmation of A3. They
		 * read the same remaining time, end and time in hand as the documents of the take, in the cell above
		 */
		expect(a3OnAir.readAt('12:00:35')).toMatchInlineSnapshot(`
		12:00:35, published 12:00:22.200
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started 12:00:00.200  remaining 2:00 held since 12:00:32.200  ends 12:02:35 moving since 12:00:32.200  in hand -0:04.800 running since 12:00:32.200
		  on air     A3 in A  left -0:02.800 running since 12:00:22.200  budget none  auto-next no
		  segment A  parts  planned 0:30  played 0:34.800 runs  left -0:04.800 runs
		  segment B  parts  planned 0:40  played 0:00  left 0:40
		  segment C  parts  planned 1:00  played 0:00  left 1:00
		  segment D  parts  planned 0:20  played 0:00  left 0:20
		  order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
		  countdown  held since 12:00:32.200: B1 0:00  B2 0:20  C1 0:40  C2 0:50  C3 1:10  D1 1:40  D2 1:50
		  as planned B2 C1 C2 C3 D1 D2
		  A1         instance  planned 0:10  drawn 0:13  played 0:13  length 0:13  width 0:13
		  A2         instance  planned 0:10  drawn 0:09  played 0:09  length 0:09  width 0:09
		  A3         on air  planned 0:10  drawn 0:10  played 0:12.800 running since 12:00:22.200  length 0:12.800 running since 12:00:32.200  width 0:12.800 running since 12:00:32.200
		  B1         next  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  counted    all but A1 A2
		  untimed    none
		  orphaned   none
		  in loop    none
	`)
	})

	it('B1 taken 0.1 s ago, not yet confirmed', () => {
		expect(b1Taken.readAt('12:00:35.100')).toMatchInlineSnapshot(`
		12:00:35.100, published 12:00:35
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started 12:00:00.200  remaining 2:00  ends 12:02:35  in hand -0:04.800
		  on air     B1 in B  left 0:20  budget none  auto-next no
		  segment A  parts  planned 0:30  played 0:34.800 (fresh 0:34.900)  left -0:04.800 (fresh -0:04.900)
		  segment B  parts  planned 0:40  played 0:00  left 0:40
		  segment C  parts  planned 1:00  played 0:00  left 1:00
		  segment D  parts  planned 0:20  played 0:00  left 0:20
		  order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
		  countdown  holds: B2 0:20  C1 0:40  C2 0:50  C3 1:10  D1 1:40  D2 1:50
		  as planned C1 C2 C3 D1 D2
		  A1         instance  planned 0:10  drawn 0:13  played 0:13  length 0:13  width 0:13
		  A2         instance  planned 0:10  drawn 0:09  played 0:09  length 0:09  width 0:09
		  A3         instance  planned 0:10  drawn 0:10  played 0:12.800 (fresh 0:12.900)  length 0:12.800 (fresh 0:12.900)  width 0:12.800 (fresh 0:12.900)
		  B1         on air  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  B2         next  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  counted    all but A1 A2 A3
		  untimed    none
		  orphaned   none
		  in loop    none
	`)
	})

	it('B1 confirmed 0.1 s ago', () => {
		expect(b1Taken.readAt('12:00:35.300')).toMatchInlineSnapshot(`
		12:00:35.300, published 12:00:35.200
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started 12:00:00.200  remaining 1:59.900 runs until 12:00:55.200  ends 12:02:35.200 fixed until 12:00:55.200  in hand -0:05 holds until 12:00:55.200
		  on air     B1 in B  left 0:19.900 running since 12:00:35.200  budget none  auto-next no
		  segment A  parts  planned 0:30  played 0:35  left -0:05
		  segment B  parts  planned 0:40  played 0:00.100 runs  left 0:39.900 runs
		  segment C  parts  planned 1:00  played 0:00  left 1:00
		  segment D  parts  planned 0:20  played 0:00  left 0:20
		  order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
		  countdown  runs until 12:00:55.200: B2 0:19.900  C1 0:39.900  C2 0:49.900  C3 1:09.900  D1 1:39.900  D2 1:49.900
		  as planned C1 C2 C3 D1 D2
		  A1         instance  planned 0:10  drawn 0:13  played 0:13  length 0:13  width 0:13
		  A2         instance  planned 0:10  drawn 0:09  played 0:09  length 0:09  width 0:09
		  A3         instance  planned 0:10  drawn 0:13  played 0:13  length 0:13  width 0:13
		  B1         on air  planned 0:20  drawn 0:20  played 0:00.100 running since 12:00:35.200  length 0:20 holds until 12:00:55.200  width 0:20 holds until 12:00:55.200
		  B2         next  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  counted    all but A1 A2 A3
		  untimed    none
		  orphaned   none
		  in loop    none
	`)
	})
})

describe('a take that ends the previous part before its planned end, with a gateway that confirms 0.2 s after it', () => {
	// A3 started at 12:00:22.200 and is planned to end at 12:00:32.200; B1 is taken 2.2 s before that
	const b1TakenEarly = untilA3OnAir(GATEWAY_CONFIRMING_AFTER_200_MS).take('12:00:30')

	it('keeps the estimated end and the over/under from before the take until the start is reported', () => {
		// before the take, the show was to end at A3's planned end + 2:00
		expect(b1TakenEarly.readAt('12:00:30.100')).toMatchInlineSnapshot(`
		12:00:30.100, published 12:00:30
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started 12:00:00.200  remaining 2:00  ends 12:02:32.200  in hand -0:02
		  on air     B1 in B  left 0:20  budget none  auto-next no
		  segment A  parts  planned 0:30  played 0:29.800 (fresh 0:29.900)  left 0:00.200 (fresh 0:00.100)
		  segment B  parts  planned 0:40  played 0:00  left 0:40
		  segment C  parts  planned 1:00  played 0:00  left 1:00
		  segment D  parts  planned 0:20  played 0:00  left 0:20
		  order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
		  countdown  holds: B2 0:20  C1 0:40  C2 0:50  C3 1:10  D1 1:40  D2 1:50
		  as planned C1 C2 C3 D1 D2
		  A1         instance  planned 0:10  drawn 0:13  played 0:13  length 0:13  width 0:13
		  A2         instance  planned 0:10  drawn 0:09  played 0:09  length 0:09  width 0:09
		  A3         instance  planned 0:10  drawn 0:10  played 0:07.800 (fresh 0:07.900)  length 0:10  width 0:10
		  B1         on air  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  B2         next  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  counted    all but A1 A2 A3
		  untimed    none
		  orphaned   none
		  in loop    none
	`)
	})

	it('changes them once, when the start is reported', () => {
		expect(b1TakenEarly.readAt('12:00:30.300')).toMatchInlineSnapshot(`
		12:00:30.300, published 12:00:30.200
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started 12:00:00.200  remaining 1:59.900 runs until 12:00:50.200  ends 12:02:30.200 fixed until 12:00:50.200  in hand 0:00 holds until 12:00:50.200
		  on air     B1 in B  left 0:19.900 running since 12:00:30.200  budget none  auto-next no
		  segment A  parts  planned 0:30  played 0:30  left 0:00
		  segment B  parts  planned 0:40  played 0:00.100 runs  left 0:39.900 runs
		  segment C  parts  planned 1:00  played 0:00  left 1:00
		  segment D  parts  planned 0:20  played 0:00  left 0:20
		  order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
		  countdown  runs until 12:00:50.200: B2 0:19.900  C1 0:39.900  C2 0:49.900  C3 1:09.900  D1 1:39.900  D2 1:49.900
		  as planned C1 C2 C3 D1 D2
		  A1         instance  planned 0:10  drawn 0:13  played 0:13  length 0:13  width 0:13
		  A2         instance  planned 0:10  drawn 0:09  played 0:09  length 0:09  width 0:09
		  A3         instance  planned 0:10  drawn 0:08  played 0:08  length 0:08  width 0:08
		  B1         on air  planned 0:20  drawn 0:20  played 0:00.100 running since 12:00:30.200  length 0:20 holds until 12:00:50.200  width 0:20 holds until 12:00:50.200
		  B2         next  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  counted    all but A1 A2 A3
		  untimed    none
		  orphaned   none
		  in loop    none
	`)
	})
})

describe('a gateway that never confirms the start of B1', () => {
	// The gateway confirms A1, A2 and A3 at their takes; B1 is taken at 12:00:35 and never confirmed
	const b1Taken = playoutScript({
		rundown: referenceRundown(),
		timing: PLANNED_TIMING,
		gateway: GATEWAY_NEVER_CONFIRMING,
	})
		.activate('11:59:00')
		.take('12:00:00')
		.confirmStart('12:00:00')
		.take('12:00:13')
		.confirmStart('12:00:13')
		.take('12:00:22')
		.confirmStart('12:00:22')
		.take('12:00:35')

	it('B1 at its take', () => {
		expect(b1Taken.readAt('12:00:35')).toMatchInlineSnapshot(`
		12:00:35, published 12:00:35
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started 12:00:00  remaining 2:00  ends 12:02:35  in hand -0:05
		  on air     B1 in B  left 0:20  budget none  auto-next no
		  segment A  parts  planned 0:30  played 0:35  left -0:05
		  segment B  parts  planned 0:40  played 0:00  left 0:40
		  segment C  parts  planned 1:00  played 0:00  left 1:00
		  segment D  parts  planned 0:20  played 0:00  left 0:20
		  order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
		  countdown  holds: B2 0:20  C1 0:40  C2 0:50  C3 1:10  D1 1:40  D2 1:50
		  as planned C1 C2 C3 D1 D2
		  finished   A3 0:13
		  A1         instance  planned 0:10  drawn 0:13  played 0:13  length 0:13  width 0:13
		  A2         instance  planned 0:10  drawn 0:09  played 0:09  length 0:09  width 0:09
		  B1         on air  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  B2         next  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  counted    all but A1 A2 A3
		  untimed    none
		  orphaned   none
		  in loop    none
	`)
	})

	it('10 s after the take of B1, still not confirmed', () => {
		expect(b1Taken.readAt('12:00:45')).toMatchInlineSnapshot(`
		12:00:45, published 12:00:35
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started 12:00:00  remaining 2:00  ends 12:02:35  in hand -0:05
		  on air     B1 in B  left 0:20  budget none  auto-next no
		  segment A  parts  planned 0:30  played 0:35 (fresh 0:45)  left -0:05 (fresh -0:15)
		  segment B  parts  planned 0:40  played 0:00  left 0:40
		  segment C  parts  planned 1:00  played 0:00  left 1:00
		  segment D  parts  planned 0:20  played 0:00  left 0:20
		  order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
		  countdown  holds: B2 0:20  C1 0:40  C2 0:50  C3 1:10  D1 1:40  D2 1:50
		  as planned C1 C2 C3 D1 D2
		  A1         instance  planned 0:10  drawn 0:13  played 0:13  length 0:13  width 0:13
		  A2         instance  planned 0:10  drawn 0:09  played 0:09  length 0:09  width 0:09
		  A3         instance  planned 0:10  drawn 0:10  played 0:13 (fresh 0:23)  length 0:13 (fresh 0:23)  width 0:13 (fresh 0:23)
		  B1         on air  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  B2         next  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  counted    all but A1 A2 A3
		  untimed    none
		  orphaned   none
		  in loop    none
	`)
	})

	it('10 s after the take of B1, still not confirmed, in a timing mode of each kind planned to last 2:30', () => {
		/*
		 * In the forward and back modes the time in hand runs on with the clock, as on main. In the none and duration
		 * modes it holds at what it read at the take, where main's, the fresh value, moved on with the clock: 10 s apart
		 * by now. The comparison with main does not play this show
		 */
		expect(
			b1Taken.readAt('12:00:45', {
				view: 'show',
				modes: ['none 2:30', 'forward start+duration', 'back end+duration', 'duration 2:30'],
			})
		).toMatchInlineSnapshot(`
		12:00:45, published 12:00:35
		  none 2:30              started 12:00:00  remaining 2:00  ends 12:02:35  in hand -0:05 (fresh -0:15)
		  forward start+duration started 12:00:00  remaining 2:00  ends 12:02:35  in hand -0:05
		  back end+duration      started 12:00:00  remaining 2:00  ends 12:02:35  in hand -0:05
		  duration 2:30          started 12:00:00  remaining 1:45 runs  ends 12:02:30  in hand -0:05 (fresh -0:15)
		  on air     B1 in B  left 0:20  budget none  auto-next no
	`)
	})
})

describe('multi-gateway mode, each start scheduled 2 s after its take', () => {
	// B1 taken at 12:00:35, its start scheduled at 12:00:37, and reported by the gateway then
	const b1Taken = untilA3OnAir(MULTI_GATEWAY_2_S_AHEAD).take('12:00:35')

	it('B1 at its take, its start 2 s ahead', () => {
		expect(b1Taken.readAt('12:00:35')).toMatchInlineSnapshot(`
		12:00:35, published 12:00:35
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started 12:00:02  remaining 2:02 runs until 12:00:57  ends 12:02:37 fixed until 12:00:57  in hand -0:05 holds until 12:00:57
		  on air     B1 in B  left 0:20 holds until 12:00:37  budget none  auto-next no
		  segment A  parts  planned 0:30  played 0:29  left 0:01
		  segment B  parts  planned 0:40  played 0:00 holds until 12:00:37  left 0:40 holds until 12:00:37
		  segment C  parts  planned 1:00  played 0:00  left 1:00
		  segment D  parts  planned 0:20  played 0:00  left 0:20
		  order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
		  countdown  holds until 12:00:37: B2 0:20  C1 0:40  C2 0:50  C3 1:10  D1 1:40  D2 1:50
		  as planned C1 C2 C3 D1 D2
		  A1         instance  planned 0:10  drawn 0:11  played 0:11  length 0:11  width 0:11
		  A2         instance  planned 0:10  drawn 0:07  played 0:07  length 0:07  width 0:07
		  A3         instance  planned 0:10  drawn 0:11  played 0:11  length 0:11  width 0:11
		  B1         on air  planned 0:20  drawn 0:20  played 0:00 holds until 12:00:37  length 0:20 holds until 12:00:57  width 0:20 holds until 12:00:57
		  B2         next  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  counted    all but A1 A2 A3
		  untimed    none
		  orphaned   none
		  in loop    none
	`)
	})

	it('B1 taken 1 s ago, its start 1 s ahead', () => {
		expect(b1Taken.readAt('12:00:36')).toMatchInlineSnapshot(`
		12:00:36, published 12:00:35
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started 12:00:02  remaining 2:01 runs until 12:00:57  ends 12:02:37 fixed until 12:00:57  in hand -0:05 holds until 12:00:57
		  on air     B1 in B  left 0:20 holds until 12:00:37  budget none  auto-next no
		  segment A  parts  planned 0:30  played 0:29  left 0:01
		  segment B  parts  planned 0:40  played 0:00 holds until 12:00:37  left 0:40 holds until 12:00:37
		  segment C  parts  planned 1:00  played 0:00  left 1:00
		  segment D  parts  planned 0:20  played 0:00  left 0:20
		  order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
		  countdown  holds until 12:00:37: B2 0:20  C1 0:40  C2 0:50  C3 1:10  D1 1:40  D2 1:50
		  as planned C1 C2 C3 D1 D2
		  A1         instance  planned 0:10  drawn 0:11  played 0:11  length 0:11  width 0:11
		  A2         instance  planned 0:10  drawn 0:07  played 0:07  length 0:07  width 0:07
		  A3         instance  planned 0:10  drawn 0:11  played 0:11  length 0:11  width 0:11
		  B1         on air  planned 0:20  drawn 0:20  played 0:00 holds until 12:00:37  length 0:20 holds until 12:00:57  width 0:20 holds until 12:00:57
		  B2         next  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  counted    all but A1 A2 A3
		  untimed    none
		  orphaned   none
		  in loop    none
	`)
	})

	it('B1 started 1 s ago, as the gateway reported', () => {
		expect(b1Taken.readAt('12:00:38')).toMatchInlineSnapshot(`
		12:00:38, published 12:00:37
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started 12:00:02  remaining 1:59 runs until 12:00:57  ends 12:02:37 fixed until 12:00:57  in hand -0:05 holds until 12:00:57
		  on air     B1 in B  left 0:19 running since 12:00:37  budget none  auto-next no
		  segment A  parts  planned 0:30  played 0:29  left 0:01
		  segment B  parts  planned 0:40  played 0:01 runs  left 0:39 runs
		  segment C  parts  planned 1:00  played 0:00  left 1:00
		  segment D  parts  planned 0:20  played 0:00  left 0:20
		  order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
		  countdown  runs until 12:00:57: B2 0:19  C1 0:39  C2 0:49  C3 1:09  D1 1:39  D2 1:49
		  as planned C1 C2 C3 D1 D2
		  A1         instance  planned 0:10  drawn 0:11  played 0:11  length 0:11  width 0:11
		  A2         instance  planned 0:10  drawn 0:07  played 0:07  length 0:07  width 0:07
		  A3         instance  planned 0:10  drawn 0:11  played 0:11  length 0:11  width 0:11
		  B1         on air  planned 0:20  drawn 0:20  played 0:01 running since 12:00:37  length 0:20 holds until 12:00:57  width 0:20 holds until 12:00:57
		  B2         next  planned 0:20  drawn 0:20  played 0:00  length 0:20  width 0:20
		  counted    all but A1 A2 A3
		  untimed    none
		  orphaned   none
		  in loop    none
	`)
	})

	it('B1 auto-nexts into B2 at its scheduled start, read before the gateway reports it', () => {
		/*
		 * B1 auto-nexts. Building the timeline at the take of B1 schedules B2 to start when B1 ends, at 12:00:57, and
		 * the publication last calculated when the gateway reported the start of B1, at 12:00:37. The gateway reports
		 * the start of B2 a second after it, so a client reads the documents of 12:00:37 at 12:00:57.500.
		 *
		 * Main's screens calculated on every tick, and showed the values marked fresh for this whole second: B2 left
		 * out of the remaining time, the end 20 s early and the time in hand 20 s ahead. The publication shows those
		 * values only if something else it reads changes inside that second. The comparison with main plays this show,
		 * and lists what differs from main in that second.
		 */
		const autoNext = untilA3OnAir(MULTI_GATEWAY_2_S_AHEAD, { parts: { B1: { autoNext: true } } })
			.take('12:00:35')
			.autoNext('12:00:58')

		expect(autoNext.readAt('12:00:57.500')).toMatchInlineSnapshot(`
		12:00:57.500, published 12:00:37
		  plan       forward-time  start 12:00:00  end 12:02:30  duration 2:30
		  show       started 12:00:02  remaining 1:40 held since 12:00:57 (fresh 1:20)  ends 12:02:37.500 moving since 12:00:57 (fresh 12:02:17.500)  in hand -0:05.500 running since 12:00:57 (fresh 0:14.500)
		  on air     B1 in B  left -0:00.500 running since 12:00:37  budget none  auto-next yes
		  segment A  parts  planned 0:30  played 0:29  left 0:01
		  segment B  parts  planned 0:40  played 0:20.500 runs (fresh 0:21)  left 0:19.500 runs (fresh 0:19)
		  segment C  parts  planned 1:00  played 0:00  left 1:00
		  segment D  parts  planned 0:20  played 0:00  left 0:20
		  order      A1 A2 A3 B1 B2 C1 C2 C3 D1 D2
		  countdown  held since 12:00:57: B2 0:00 (fresh 0:19.500)  C1 0:20 (fresh 0:39.500)  C2 0:30 (fresh 0:49.500)  C3 0:50 (fresh 1:09.500)  D1 1:20 (fresh 1:39.500)  D2 1:30 (fresh 1:49.500)
		  as planned C1 C2 C3 D1 D2
		  A1         instance  planned 0:10  drawn 0:11  played 0:11  length 0:11  width 0:11
		  A2         instance  planned 0:10  drawn 0:07  played 0:07  length 0:07  width 0:07
		  A3         instance  planned 0:10  drawn 0:11  played 0:11  length 0:11  width 0:11
		  B1         on air  planned 0:20  drawn 0:20  played 0:20.500 running since 12:00:37  length 0:20.500 running since 12:00:57  width 0:20.500 running since 12:00:57
		  B2         next  planned 0:20  drawn 0:20  played 0:00 (fresh 0:00.500)  length 0:20  width 0:20
		  counted    all but A1 A2 A3
		  untimed    none
		  orphaned   none
		  in loop    none
	`)
	})
})
