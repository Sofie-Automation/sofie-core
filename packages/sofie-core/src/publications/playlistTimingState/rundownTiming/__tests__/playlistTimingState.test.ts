import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import {
	CountdownType,
	PlaylistTimingType,
	type RundownPlaylistTiming,
	type SegmentTimingInfo,
} from '@sofie-automation/blueprints-integration'
import type { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { wrapPartToTemporaryInstance } from '@sofie-automation/corelib/dist/playout/stateCacheResolver'
import {
	timerStateToDuration,
	timerStateToZeroTime,
	type TimerState,
} from '@sofie-automation/corelib/dist/dataModel/TimerState'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { ForceQuickLoopAutoNext } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import { RundownTimingCalculator, findPartInstancesInQuickLoop } from '../index'
import { calculatePlaylistTimingStates, getPlaylistTimingDiff } from '../playlistTimingState'

const DEFAULT_DURATION = 0

function makeMockPlaylist(): DBRundownPlaylist {
	return literal<DBRundownPlaylist>({
		_id: protectString('mock-playlist'),
		externalId: 'mock-playlist',
		studioId: protectString('studio0'),
		name: 'Mock Playlist',
		created: 0,
		modified: 0,
		defaultBrandingId: null,
		currentPartInfo: null,
		nextPartInfo: null,
		previousPartsInfo: [],
		timing: {
			type: PlaylistTimingType.None,
		},
		rundownIdsInOrder: [],

		tTimers: [
			{ index: 1, label: '', mode: null, state: null },
			{ index: 2, label: '', mode: null, state: null },
			{ index: 3, label: '', mode: null, state: null },
		],
	})
}

function makeMockPart(
	id: string,
	rank: number,
	rundownId: string,
	segmentId: string,
	expectedDuration: number | undefined
): DBPart {
	return literal<DBPart>({
		_id: protectString(id),
		externalId: id,
		title: '',
		segmentId: protectString(segmentId),
		_rank: rank,
		rundownId: protectString(rundownId),
		expectedDuration,
		expectedDurationWithTransition: expectedDuration,
	})
}

function makeMockSegment(id: string, rank: number, rundownId: string, timing?: SegmentTimingInfo): DBSegment {
	return literal<DBSegment>({
		_id: protectString(id),
		name: 'mock-segment',
		externalId: id,
		_rank: rank,
		rundownId: protectString(rundownId),
		segmentTiming: timing,
	})
}

interface MockScenario {
	playlist: DBRundownPlaylist
	partInstances: PartInstance[]
	segmentsMap: Map<SegmentId, DBSegment>
}

/**
 * Build a simple playlist of 4 parts across 2 segments, 10s each (40s planned content).
 */
function makeStandardScenario(segmentTiming?: SegmentTimingInfo): MockScenario {
	const rundownId = 'rundown1'
	const playlist = makeMockPlaylist()

	const segmentsMap = new Map<SegmentId, DBSegment>()
	segmentsMap.set(protectString('segment1'), makeMockSegment('segment1', 0, rundownId, segmentTiming))
	segmentsMap.set(protectString('segment2'), makeMockSegment('segment2', 1, rundownId))

	const parts: DBPart[] = [
		makeMockPart('part1', 0, rundownId, 'segment1', 10000),
		makeMockPart('part2', 1, rundownId, 'segment1', 10000),
		makeMockPart('part3', 2, rundownId, 'segment2', 10000),
		makeMockPart('part4', 3, rundownId, 'segment2', 10000),
	]
	const partInstances = parts.map((part) => wrapPartToTemporaryInstance(protectString(''), part))

	return { playlist, partInstances, segmentsMap }
}

/**
 * Put the first part of the scenario on air.
 * @param startedPlayback When the part (and playlist) started playing
 */
function putFirstPartOnAir(scenario: MockScenario, startedPlayback: number): void {
	const livePartInstance = scenario.partInstances[0]
	livePartInstance.timings = {
		take: startedPlayback,
		plannedStartedPlayback: startedPlayback,
	}
	scenario.playlist.activationId = protectString<RundownPlaylistActivationId>('active')
	scenario.playlist.startedPlayback = startedPlayback
	scenario.playlist.currentPartInfo = {
		partInstanceId: livePartInstance._id,
		rundownId: livePartInstance.rundownId,
		manuallySelected: false,
		consumesQueuedSegmentId: false,
	}
	scenario.playlist.nextPartInfo = {
		partInstanceId: scenario.partInstances[1]._id,
		rundownId: scenario.partInstances[1].rundownId,
		manuallySelected: false,
		consumesQueuedSegmentId: false,
	}
}

/**
 * Assert that the published TimerStates, evaluated at several points in time after `now`,
 * are equivalent to what the ported calculator + PlaylistTiming helpers + getPlaylistTimingDiff
 * produce when run at those times (with unchanged inputs).
 */
function assertEquivalence(
	scenario: MockScenario,
	now: number,
	offsets: number[],
	partsInQuickLoop: Record<string, boolean> = {}
): void {
	const { playlist, partInstances, segmentsMap } = scenario

	const states = calculatePlaylistTimingStates(
		now,
		playlist,
		partInstances,
		segmentsMap,
		DEFAULT_DURATION,
		partsInQuickLoop
	)

	for (const offset of offsets) {
		const t = now + offset

		// Reference values, computed the "old way" at time t
		const referenceContext = new RundownTimingCalculator().updateDurations(
			t,
			false,
			playlist,
			partInstances,
			segmentsMap,
			DEFAULT_DURATION,
			partsInQuickLoop
		)
		const gatedStartedPlayback = playlist.activationId ? playlist.startedPlayback : undefined
		const referenceRemaining = PlaylistTiming.getRemainingDuration(
			playlist.timing,
			t,
			referenceContext.remainingPlaylistDuration,
			gatedStartedPlayback
		)
		const referenceEstimatedEnd = PlaylistTiming.getEstimatedEnd(
			playlist.timing,
			t,
			referenceContext.remainingPlaylistDuration,
			gatedStartedPlayback
		)
		const referenceDiff = getPlaylistTimingDiff(playlist, referenceContext, t)

		// Static values
		expect(evalZeroTime(states.plannedStart, t)).toBe(PlaylistTiming.getExpectedStart(playlist.timing))
		expect(evalZeroTime(states.plannedEnd, t)).toBe(PlaylistTiming.getExpectedEnd(playlist.timing))
		expect(evalDuration(states.plannedDuration, t)).toBe(PlaylistTiming.getExpectedDuration(playlist.timing))
		expect(evalZeroTime(states.startedPlayback, t)).toBe(gatedStartedPlayback)

		// Live values
		expect({ offset, value: evalDuration(states.remainingDuration, t) }).toEqual({
			offset,
			value: referenceRemaining,
		})
		expect({ offset, value: evalZeroTime(states.estimatedEnd, t) }).toEqual({
			offset,
			value: referenceEstimatedEnd,
		})

		// the published state reads as time in hand, the reference diff is over-positive
		const publishedDiff = states.overUnder ? 0 - timerStateToDuration(states.overUnder, t) : undefined
		expect({ offset, value: publishedDiff }).toEqual({ offset, value: referenceDiff })
	}
}

function evalDuration(state: TimerState | undefined, now: number): number | undefined {
	return state ? timerStateToDuration(state, now) : undefined
}
function evalZeroTime(state: TimerState | undefined, now: number): number | undefined {
	return state ? timerStateToZeroTime(state, now) : undefined
}

describe('calculatePlaylistTimingStates', () => {
	describe('ForwardTime', () => {
		it('matches the reference before playback, spanning the planned start', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedDuration: 40000,
			}

			// now = 10000: planned start is 10s away; offsets span past it
			assertEquivalence(scenario, 10000, [0, 1000, 9999, 10000, 15000, 60000])
		})

		it('matches the reference with an expectedEnd, before playback', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedDuration: 40000,
				expectedEnd: 60000,
			}

			assertEquivalence(scenario, 10000, [0, 1000, 9999, 10000, 15000, 60000])
		})

		it('matches the reference during playback, spanning the on-air part overrunning', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedDuration: 40000,
				expectedEnd: 60000,
			}
			putFirstPartOnAir(scenario, 20000)

			// now = 25000: 5s into a 10s part; the part overruns at 30000
			assertEquivalence(scenario, 25000, [0, 1000, 4999, 5000, 5001, 10000, 60000])
		})

		it('matches the reference when the doc is generated while already overrunning', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedEnd: 60000,
			}
			putFirstPartOnAir(scenario, 20000)

			// now = 35000: the 10s part has been overrunning for 5s
			assertEquivalence(scenario, 35000, [0, 1000, 30000])
		})

		it('matches the reference once deactivated after playout', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedDuration: 40000,
				expectedEnd: 60000,
			}
			// played out: all parts have durations
			for (const partInstance of scenario.partInstances) {
				partInstance.timings = {
					take: 0,
					plannedStartedPlayback: 0,
					duration: 11000,
				}
			}
			scenario.playlist.activationId = undefined
			scenario.playlist.startedPlayback = 20000

			assertEquivalence(scenario, 70000, [0, 1000, 30000])
		})

		it('matches the reference once deactivated after playout, without an expectedEnd', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedDuration: 40000,
			}
			for (const partInstance of scenario.partInstances) {
				partInstance.timings = {
					take: 0,
					plannedStartedPlayback: 0,
					duration: 9000,
				}
			}
			scenario.playlist.activationId = undefined
			scenario.playlist.startedPlayback = 20000

			assertEquivalence(scenario, 70000, [0, 1000, 30000])
		})
	})

	describe('BackTime', () => {
		it('matches the reference during playback, spanning the on-air part overrunning', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.BackTime,
				expectedEnd: 60000,
			}
			putFirstPartOnAir(scenario, 20000)

			assertEquivalence(scenario, 25000, [0, 1000, 4999, 5000, 5001, 10000, 60000])
		})

		it('matches the reference before playback', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.BackTime,
				expectedEnd: 60000,
				expectedDuration: 40000,
			}

			assertEquivalence(scenario, 10000, [0, 1000, 30000])
		})
	})

	describe('None', () => {
		it('publishes no overUnder for an untimed playlist that has never been played', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.None,
			}

			const states = calculatePlaylistTimingStates(
				10000,
				scenario.playlist,
				scenario.partInstances,
				scenario.segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(states.overUnder).toBeUndefined()
			expect(states.plannedStart).toBeUndefined()
			expect(states.plannedEnd).toBeUndefined()
			expect(states.plannedDuration).toBeUndefined()
		})

		it('matches the reference during playback, spanning the on-air part overrunning', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.None,
				expectedDuration: 40000,
			}
			putFirstPartOnAir(scenario, 20000)

			assertEquivalence(scenario, 25000, [0, 1000, 4999, 5000, 5001, 10000, 60000])
		})
	})

	describe('Duration', () => {
		it('matches the reference during playback, spanning the on-air part overrunning', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.Duration,
				expectedDuration: 40000,
			}
			putFirstPartOnAir(scenario, 20000)

			assertEquivalence(scenario, 25000, [0, 1000, 4999, 5000, 5001, 10000, 60000])
		})

		it('matches the reference before playback, with an expectedStart', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.Duration,
				expectedDuration: 40000,
				expectedStart: 20000,
			}

			assertEquivalence(scenario, 10000, [0, 1000, 9999, 10000, 15000, 60000])
		})
	})

	describe('Segment budget durations', () => {
		it('matches the reference during playback, spanning the budget overrunning', () => {
			const scenario = makeStandardScenario({
				budgetDuration: 25000,
				countdownType: CountdownType.SEGMENT_BUDGET_DURATION,
			})
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedEnd: 70000,
			}
			putFirstPartOnAir(scenario, 20000)
			scenario.playlist.segmentsStartedPlayback = {
				[scenario.partInstances[0].segmentPlayoutId as unknown as string]: 20000,
			}

			// now = 30000: 10s into a 25s budget; the budget overruns at 45000
			assertEquivalence(scenario, 30000, [0, 1000, 14999, 15000, 15001, 30000])
		})
	})

	describe('Untimed parts', () => {
		it('matches the reference when some parts are untimed', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedEnd: 60000,
			}
			// the last part does not count towards the playlist timing
			scenario.partInstances[3].part.untimed = true
			putFirstPartOnAir(scenario, 20000)

			assertEquivalence(scenario, 25000, [0, 1000, 4999, 5000, 5001, 10000, 60000])
		})

		it('matches the reference when the on-air part is untimed', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedEnd: 60000,
			}
			putFirstPartOnAir(scenario, 20000)
			scenario.partInstances[0].part.untimed = true

			assertEquivalence(scenario, 25000, [0, 1000, 5000, 10000, 60000])
		})
	})

	/**
	 * Multi-gateway studios schedule a take a little into the future (getNowInPlayout adds the
	 * gateway latency), so for a moment after every take the on-air part has a planned start that
	 * has not been reached yet. The states must describe the part that is about to play, not a
	 * playlist with nothing playing - otherwise the projected end pushes with the clock, and stays
	 * wrong until the gateway reports playback, because nothing recomputes at the planned start.
	 */
	describe('taken but not yet started', () => {
		const TAKE_TIME = 20000
		const GATEWAY_LATENCY = 400
		const PLANNED_START = TAKE_TIME + GATEWAY_LATENCY

		function makePreRollScenario(): MockScenario {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: TAKE_TIME,
				expectedEnd: 60000,
			}
			putFirstPartOnAir(scenario, PLANNED_START)
			scenario.playlist.startedPlayback = TAKE_TIME
			return scenario
		}

		it('holds the projected end fixed across the wait and beyond', () => {
			const scenario = makePreRollScenario()
			const { playlist, partInstances, segmentsMap } = scenario

			// the playlist ends one part duration after the planned start, plus the rest
			const expectedEnd = PLANNED_START + 4 * 10000

			for (const now of [TAKE_TIME, TAKE_TIME + 100, PLANNED_START - 1, PLANNED_START, PLANNED_START + 5000]) {
				const states = calculatePlaylistTimingStates(
					now,
					playlist,
					partInstances,
					segmentsMap,
					DEFAULT_DURATION,
					{}
				)
				expect({ now, estimatedEnd: evalZeroTime(states.estimatedEnd, now) }).toEqual({
					now,
					estimatedEnd: expectedEnd,
				})
			}
		})

		it('publishes a document that stays correct without recomputing at the planned start', () => {
			const scenario = makePreRollScenario()
			const { playlist, partInstances, segmentsMap } = scenario

			// computed once, just after the take, while the start is still in the future
			const states = calculatePlaylistTimingStates(
				TAKE_TIME,
				playlist,
				partInstances,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)

			const expectedEnd = PLANNED_START + 4 * 10000
			// evaluating that same document later, across the planned start, must not drift
			for (const now of [TAKE_TIME, PLANNED_START - 1, PLANNED_START, PLANNED_START + 5000]) {
				expect({ now, estimatedEnd: evalZeroTime(states.estimatedEnd, now) }).toEqual({
					now,
					estimatedEnd: expectedEnd,
				})
			}

			// and the remaining duration counts down through the wait rather than holding
			expect(evalDuration(states.remainingDuration, TAKE_TIME)).toBe(expectedEnd - TAKE_TIME)
			expect(evalDuration(states.remainingDuration, PLANNED_START)).toBe(expectedEnd - PLANNED_START)
		})

		it('still freezes when the on-air part overruns', () => {
			const scenario = makePreRollScenario()
			const { playlist, partInstances, segmentsMap } = scenario

			const states = calculatePlaylistTimingStates(
				TAKE_TIME,
				playlist,
				partInstances,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)

			// the part is due to end at PLANNED_START + 10000; past that the remaining pool holds
			const overrunsAt = PLANNED_START + 10000
			const remainingAtOverrun = evalDuration(states.remainingDuration, overrunsAt)
			expect(remainingAtOverrun).toBe(3 * 10000)
			expect(evalDuration(states.remainingDuration, overrunsAt + 5000)).toBe(remainingAtOverrun)
		})

		it('matches the reference throughout', () => {
			assertEquivalence(makePreRollScenario(), TAKE_TIME, [0, 100, 399, 400, 401, 5000, 15000])
		})
	})

	/**
	 * The same wait at the first take, before the playlist has started: it has no startedPlayback until
	 * the gateway reports the start of the first Part. The remaining duration counts down from the take
	 * here too, so the estimated end and the over/under must hold across the wait, at what they read once
	 * the start is reported, rather than move on with the clock from the take and jump back at the start.
	 */
	describe('the first take, before the playlist has started', () => {
		const TAKE_TIME = 20000
		const GATEWAY_LATENCY = 400
		const PLANNED_START = TAKE_TIME + GATEWAY_LATENCY

		/**
		 * A take with a time offset plays its Part from a point inside it, so the take plans the start in the
		 * past, by the offset, in either gateway mode. The start is reported a moment after the take
		 */
		const TIME_OFFSET = 3000
		const PLANNED_START_FROM_A_TIME_OFFSET = TAKE_TIME - TIME_OFFSET
		const START_REPORTED_AT = TAKE_TIME + GATEWAY_LATENCY

		/** The playlist with its first Part taken at TAKE_TIME, and planned to start at plannedStart */
		function makeFirstTakeScenario(timing: RundownPlaylistTiming, plannedStart = PLANNED_START): MockScenario {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = timing
			putFirstPartOnAir(scenario, plannedStart)
			scenario.partInstances[0].timings = { take: TAKE_TIME, plannedStartedPlayback: plannedStart }
			scenario.playlist.startedPlayback = undefined
			return scenario
		}

		/**
		 * The same playlist once the gateway has reported the start of the first Part: the start of its part group,
		 * which the take planned
		 */
		function makeReportedStartScenario(timing: RundownPlaylistTiming, plannedStart = PLANNED_START): MockScenario {
			const scenario = makeFirstTakeScenario(timing, plannedStart)
			scenario.playlist.startedPlayback = plannedStart
			return scenario
		}

		function calculateAt(now: number, scenario: MockScenario) {
			return calculatePlaylistTimingStates(
				now,
				scenario.playlist,
				scenario.partInstances,
				scenario.segmentsMap,
				DEFAULT_DURATION,
				{}
			)
		}

		const TIMINGS: Array<{ name: string; timing: RundownPlaylistTiming }> = [
			{
				name: 'forward-time, taken after the planned start',
				timing: { type: PlaylistTimingType.ForwardTime, expectedStart: 10000, expectedDuration: 40000 },
			},
			{
				name: 'forward-time with a planned end, taken after the planned start',
				timing: { type: PlaylistTimingType.ForwardTime, expectedStart: 10000, expectedEnd: 65000 },
			},
			{
				name: 'forward-time, taken before the planned start',
				timing: { type: PlaylistTimingType.ForwardTime, expectedStart: 30000, expectedDuration: 40000 },
			},
			{
				name: 'forward-time with a planned end, taken before the planned start',
				timing: { type: PlaylistTimingType.ForwardTime, expectedStart: 30000, expectedEnd: 65000 },
			},
			{
				name: 'back-time with a planned duration, taken before the planned start',
				timing: { type: PlaylistTimingType.BackTime, expectedEnd: 65000, expectedDuration: 40000 },
			},
			{
				name: 'none, with a planned duration',
				timing: { type: PlaylistTimingType.None, expectedDuration: 40000 },
			},
		]

		it.each(TIMINGS)('holds at what the reported start reads, in $name', ({ timing }) => {
			const atTheTake = calculateAt(TAKE_TIME, makeFirstTakeScenario(timing))
			const atTheStart = calculateAt(PLANNED_START, makeReportedStartScenario(timing))

			// the first Part and the three after it, 10 s each, from its planned start
			const projectedEnd = PLANNED_START + 4 * 10000
			const timeInHandAtTheStart = evalDuration(atTheStart.overUnder, PLANNED_START)
			expect(evalZeroTime(atTheStart.estimatedEnd, PLANNED_START)).toBe(projectedEnd)

			for (const now of [TAKE_TIME, TAKE_TIME + 100, PLANNED_START - 1, PLANNED_START]) {
				expect({ now, estimatedEnd: evalZeroTime(atTheTake.estimatedEnd, now) }).toEqual({
					now,
					estimatedEnd: projectedEnd,
				})
				expect({ now, timeInHand: evalDuration(atTheTake.overUnder, now) }).toEqual({
					now,
					timeInHand: timeInHandAtTheStart,
				})
			}
		})

		it.each(TIMINGS)(
			'holds at what the reported start reads, after a take with a time offset, in $name',
			({ timing }) => {
				const atTheTake = calculateAt(
					TAKE_TIME,
					makeFirstTakeScenario(timing, PLANNED_START_FROM_A_TIME_OFFSET)
				)
				const atTheReport = calculateAt(
					START_REPORTED_AT,
					makeReportedStartScenario(timing, PLANNED_START_FROM_A_TIME_OFFSET)
				)

				// the first Part and the three after it, 10 s each, from its planned start
				const projectedEnd = PLANNED_START_FROM_A_TIME_OFFSET + 4 * 10000
				const timeInHandAtTheReport = evalDuration(atTheReport.overUnder, START_REPORTED_AT)
				expect(evalZeroTime(atTheReport.estimatedEnd, START_REPORTED_AT)).toBe(projectedEnd)

				for (const now of [TAKE_TIME, TAKE_TIME + 100, START_REPORTED_AT - 1, START_REPORTED_AT]) {
					expect({ now, estimatedEnd: evalZeroTime(atTheTake.estimatedEnd, now) }).toEqual({
						now,
						estimatedEnd: projectedEnd,
					})
					expect({ now, timeInHand: evalDuration(atTheTake.overUnder, now) }).toEqual({
						now,
						timeInHand: timeInHandAtTheReport,
					})
				}
			}
		)

		it("counts the planned duration from the first Part's planned start, in forward-time without a planned end", () => {
			const atTheTake = calculateAt(
				TAKE_TIME,
				makeFirstTakeScenario({
					type: PlaylistTimingType.ForwardTime,
					expectedStart: 10000,
					expectedDuration: 40000,
				})
			)

			// planned 40 s, and 40 s of parts to play: on time, not over by the wait
			expect(evalDuration(atTheTake.overUnder, TAKE_TIME)).toBe(0)
			expect(evalDuration(atTheTake.overUnder, PLANNED_START - 1)).toBe(0)
		})

		it('matches the reference throughout', () => {
			const scenario = makeFirstTakeScenario({
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 10000,
				expectedEnd: 65000,
			})
			assertEquivalence(scenario, TAKE_TIME, [0, 100, 399, 400, 401, 5000, 15000])
		})
	})

	/**
	 * An untimed Part does not start the playlist, but in a segment with a budget the budget counts down from the
	 * segment's start, so the remaining duration counts down before the playlist has started. The playlist starts
	 * with its first timed Part, not with the untimed one.
	 */
	describe('an untimed opening Part in a segment with a budget, before the playlist has started', () => {
		const SEGMENT_STARTED = 20000
		const NOW = 25000

		/** The first segment, with a budget of 20 s, started at SEGMENT_STARTED with its untimed first Part */
		function makeUntimedOpeningScenario(timing: RundownPlaylistTiming): MockScenario {
			const scenario = makeStandardScenario({
				budgetDuration: 20000,
				countdownType: CountdownType.SEGMENT_BUDGET_DURATION,
			})
			scenario.playlist.timing = timing
			scenario.partInstances[0].part.untimed = true
			putFirstPartOnAir(scenario, SEGMENT_STARTED)
			scenario.playlist.startedPlayback = undefined
			scenario.playlist.segmentsStartedPlayback = {
				[scenario.partInstances[0].segmentPlayoutId as unknown as string]: SEGMENT_STARTED,
			}
			return scenario
		}

		it('matches the reference throughout', () => {
			const scenario = makeUntimedOpeningScenario({
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 10000,
				expectedEnd: 65000,
			})
			// the budget runs out at 40000
			assertEquivalence(scenario, NOW, [0, 1000, 14999, 15000, 15001, 20000])
		})

		it("counts the planned duration from now, not from the untimed Part's start, in forward-time without a planned end", () => {
			const scenario = makeUntimedOpeningScenario({
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 10000,
				expectedDuration: 40000,
			})
			const states = calculatePlaylistTimingStates(
				NOW,
				scenario.playlist,
				scenario.partInstances,
				scenario.segmentsMap,
				DEFAULT_DURATION,
				{}
			)

			// planned 40 s from now, against 15 s left of the budget and the second segment's 20 s
			expect(evalDuration(states.overUnder, NOW)).toBe(5000)
		})
	})

	/**
	 * The two on-air scalars. Both are published as TimerStates, so a consumer evaluates them
	 * locally between recomputes; these check they agree with the calculator's own numbers, which
	 * are the values the client has always displayed.
	 */
	describe('on-air timers', () => {
		function expectMatchesCalculator(scenario: MockScenario, now: number, offsets: number[]): void {
			const { playlist, partInstances, segmentsMap } = scenario
			const states = calculatePlaylistTimingStates(
				now,
				playlist,
				partInstances,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)

			for (const offset of offsets) {
				const t = now + offset
				const reference = new RundownTimingCalculator().updateDurations(
					t,
					false,
					playlist,
					partInstances,
					segmentsMap,
					DEFAULT_DURATION,
					{}
				)

				expect({ offset, value: evalDuration(states.remainingOnCurrentPart, t) }).toEqual({
					offset,
					value: reference.remainingTimeOnCurrentPart,
				})
				expect({ offset, value: evalDuration(states.remainingBudgetOnCurrentSegment, t) }).toEqual({
					offset,
					value: reference.remainingBudgetOnCurrentSegment,
				})
			}
		}

		it('publishes the identities consumers guard on', () => {
			const scenario = makeStandardScenario()
			putFirstPartOnAir(scenario, 20000)

			const states = calculatePlaylistTimingStates(
				25000,
				scenario.playlist,
				scenario.partInstances,
				scenario.segmentsMap,
				DEFAULT_DURATION,
				{}
			)

			expect(states.currentPartInstanceId).toBe(scenario.partInstances[0]._id)
			expect(states.currentSegmentId).toBe(scenario.partInstances[0].segmentId)
		})

		it('counts the on-air part down, through the overrun', () => {
			const scenario = makeStandardScenario()
			putFirstPartOnAir(scenario, 20000)

			// a 10s part started at 20000
			expectMatchesCalculator(scenario, 25000, [0, 1000, 4999, 5000, 5001, 20000])
		})

		it('holds the on-air part at its full duration until it starts', () => {
			const scenario = makeStandardScenario()
			// taken at 20000 but scheduled to start at 20400, as in a multi-gateway studio
			putFirstPartOnAir(scenario, 20400)
			scenario.playlist.startedPlayback = 20000

			const states = calculatePlaylistTimingStates(
				20000,
				scenario.playlist,
				scenario.partInstances,
				scenario.segmentsMap,
				DEFAULT_DURATION,
				{}
			)

			// holds at the full duration across the wait, then counts down from the start
			expect(evalDuration(states.remainingOnCurrentPart, 20000)).toBe(10000)
			expect(evalDuration(states.remainingOnCurrentPart, 20399)).toBe(10000)
			expect(evalDuration(states.remainingOnCurrentPart, 20400)).toBe(10000)
			expect(evalDuration(states.remainingOnCurrentPart, 21400)).toBe(9000)

			expectMatchesCalculator(scenario, 20000, [0, 399, 400, 401, 5000, 15000])
		})

		it('has no on-air timers when nothing is playing', () => {
			const scenario = makeStandardScenario()

			const states = calculatePlaylistTimingStates(
				10000,
				scenario.playlist,
				scenario.partInstances,
				scenario.segmentsMap,
				DEFAULT_DURATION,
				{}
			)

			expect(states.currentPartInstanceId).toBeUndefined()
			expect(states.remainingOnCurrentPart).toBeUndefined()
			expect(states.remainingBudgetOnCurrentSegment).toBeUndefined()
		})

		describe('segment budget', () => {
			function makeBudgetScenario(): MockScenario {
				const scenario = makeStandardScenario({
					budgetDuration: 25000,
					countdownType: CountdownType.SEGMENT_BUDGET_DURATION,
				})
				putFirstPartOnAir(scenario, 20000)
				scenario.playlist.segmentsStartedPlayback = {
					[scenario.partInstances[0].segmentPlayoutId as unknown as string]: 20000,
				}
				return scenario
			}

			it('counts the budget down from when the segment started', () => {
				const scenario = makeBudgetScenario()

				const states = calculatePlaylistTimingStates(
					30000,
					scenario.playlist,
					scenario.partInstances,
					scenario.segmentsMap,
					DEFAULT_DURATION,
					{}
				)

				// 10s into a 25s budget, and it keeps going negative once overrun
				expect(evalDuration(states.remainingBudgetOnCurrentSegment, 30000)).toBe(15000)
				expect(evalDuration(states.remainingBudgetOnCurrentSegment, 45000)).toBe(0)
				expect(evalDuration(states.remainingBudgetOnCurrentSegment, 50000)).toBe(-5000)

				expectMatchesCalculator(scenario, 30000, [0, 1000, 15000, 20000])
			})

			it('is omitted for a segment that does not use a budget', () => {
				const scenario = makeStandardScenario()
				putFirstPartOnAir(scenario, 20000)

				const states = calculatePlaylistTimingStates(
					25000,
					scenario.playlist,
					scenario.partInstances,
					scenario.segmentsMap,
					DEFAULT_DURATION,
					{}
				)

				expect(states.remainingBudgetOnCurrentSegment).toBeUndefined()
			})

			/**
			 * Preserved behaviour, not desired behaviour. The calculator only assigns the budget
			 * countdown when it iterates OUT of the live segment, so a live segment with nothing
			 * after it never gets one and the "Seg. Budg." display disappears. Pinned here so that
			 * fixing it later is a visible, deliberate change.
			 */
			it('is omitted when the on-air segment is the last one (known bug, preserved)', () => {
				const rundownId = 'rundown1'
				const scenario = makeStandardScenario()
				// collapse the playlist to a single budgeted segment
				scenario.segmentsMap = new Map([
					[
						protectString<SegmentId>('segment1'),
						makeMockSegment('segment1', 0, rundownId, {
							budgetDuration: 25000,
							countdownType: CountdownType.SEGMENT_BUDGET_DURATION,
						}),
					],
				])
				scenario.partInstances = scenario.partInstances.filter(
					(instance) => instance.segmentId === protectString<SegmentId>('segment1')
				)
				putFirstPartOnAir(scenario, 20000)
				scenario.playlist.segmentsStartedPlayback = {
					[scenario.partInstances[0].segmentPlayoutId as unknown as string]: 20000,
				}

				const states = calculatePlaylistTimingStates(
					30000,
					scenario.playlist,
					scenario.partInstances,
					scenario.segmentsMap,
					DEFAULT_DURATION,
					{}
				)

				expect(states.remainingBudgetOnCurrentSegment).toBeUndefined()
			})
		})
	})

	describe('Autonext', () => {
		function makeAutonextScenario(): MockScenario {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedEnd: 60000,
			}
			putFirstPartOnAir(scenario, 20000)
			// an autonext has scheduled the next part to start at 30000, which is still in the future
			scenario.partInstances[0].part.autoNext = true
			scenario.partInstances[1].timings = { take: 30000, plannedStartedPlayback: 30000 }
			return scenario
		}

		it('matches the reference up until the scheduled start', () => {
			assertEquivalence(makeAutonextScenario(), 25000, [0, 1000, 4999])
		})

		/**
		 * Known limitation. The calculator treats a part whose plannedStartedPlayback has passed as
		 * started, so at the scheduled start the next part stops counting towards the remaining
		 * pool. That is a second transition, and a TimerState carries only one - which
		 * remainingDuration has already spent on the on-air part's overrun.
		 *
		 * In practice the autonext firing also writes to the database, so the publication
		 * recomputes at that moment and the stale window is one round-trip. This test pins the
		 * size of that staleness so the boundary is visible rather than silently assumed.
		 */
		it('goes stale by the next part duration if the scheduled start passes without a republish', () => {
			const scenario = makeAutonextScenario()
			const { playlist, partInstances, segmentsMap } = scenario
			const scheduledStart = 30000

			const publishedAtStale = calculatePlaylistTimingStates(
				25000,
				playlist,
				partInstances,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			const publishedAfterRepublish = calculatePlaylistTimingStates(
				scheduledStart,
				playlist,
				partInstances,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)

			const stale = evalDuration(publishedAtStale.remainingDuration, scheduledStart)
			const fresh = evalDuration(publishedAfterRepublish.remainingDuration, scheduledStart)

			// the stale value still counts the next part's 10s; recomputing drops it
			expect(stale).toBe(30000)
			expect(fresh).toBe(20000)
		})
	})

	describe('QuickLoop', () => {
		it('matches the reference with a running loop', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedEnd: 60000,
			}
			putFirstPartOnAir(scenario, 20000)
			scenario.playlist.quickLoop = {
				start: { type: QuickLoopMarkerType.PART, id: scenario.partInstances[1].part._id },
				end: { type: QuickLoopMarkerType.PART, id: scenario.partInstances[2].part._id },
				running: true,
				forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
				locked: false,
			}
			const partsInQuickLoop = findPartInstancesInQuickLoop(scenario.playlist, scenario.partInstances)

			assertEquivalence(scenario, 25000, [0, 1000, 5000, 10000], partsInQuickLoop)
		})
	})

	/**
	 * The publication only republishes when playout or ingest state changes, so the states must be
	 * a *time-independent* description of each value: recomputing at a later time from the same
	 * inputs has to produce an identical document, or the publication would churn every tick.
	 */
	describe('is stable as time passes with unchanged inputs', () => {
		function expectStableAcross(scenario: MockScenario, times: number[]): void {
			const { playlist, partInstances, segmentsMap } = scenario
			const reference = calculatePlaylistTimingStates(
				times[0],
				playlist,
				partInstances,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)

			for (const time of times.slice(1)) {
				const later = calculatePlaylistTimingStates(
					time,
					playlist,
					partInstances,
					segmentsMap,
					DEFAULT_DURATION,
					{}
				)
				expect({ time, states: later }).toEqual({ time, states: reference })
			}
		}

		it('before playback', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedDuration: 40000,
			}

			// all before the planned start, so nothing has changed state
			expectStableAcross(scenario, [10000, 11000, 15000, 19999])
		})

		it('while on air and on schedule', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedEnd: 60000,
			}
			putFirstPartOnAir(scenario, 20000)

			// all within the on-air part's expected duration (which ends at 30000)
			expectStableAcross(scenario, [20000, 21000, 25000, 29999])
		})

		it('while the on-air part is overrunning', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedEnd: 60000,
			}
			putFirstPartOnAir(scenario, 20000)

			// the part overran at 30000 and nothing has happened since
			expectStableAcross(scenario, [31000, 35000, 60000, 120000])
		})

		it('for a BackTime playlist that has not started', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.BackTime,
				expectedEnd: 60000,
			}

			expectStableAcross(scenario, [10000, 11000, 30000])
		})

		it('once played out and deactivated', () => {
			const scenario = makeStandardScenario()
			scenario.playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 20000,
				expectedEnd: 60000,
			}
			for (const partInstance of scenario.partInstances) {
				partInstance.timings = { take: 0, plannedStartedPlayback: 0, duration: 11000 }
			}
			scenario.playlist.activationId = undefined
			scenario.playlist.startedPlayback = 20000

			expectStableAcross(scenario, [70000, 80000, 200000])
		})
	})
})
