import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { PartId, RundownPlaylistActivationId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { wrapPartToTemporaryInstance } from '@sofie-automation/corelib/dist/playout/stateCacheResolver'
import {
	offsetTimerState,
	timerStateToDuration,
	type TimerState,
} from '@sofie-automation/corelib/dist/dataModel/TimerState'
import { RundownTimingCalculator, getPartInstanceTimingId, type RundownTimingContext } from '../index'
import { calculatePartTimingStates, type PartTimingStateValues } from '../partTimingState'

const DEFAULT_DURATION = 0
const RUNDOWN_ID = 'rundown1'
const PART_DURATION = 10000

const SEGMENT_0 = protectString<SegmentId>('segment0')
const SEGMENT_1 = protectString<SegmentId>('segment1')

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
		timing: { type: PlaylistTimingType.None },
		rundownIdsInOrder: [protectString(RUNDOWN_ID)],
		tTimers: [
			{ index: 1, label: '', mode: null, state: null },
			{ index: 2, label: '', mode: null, state: null },
			{ index: 3, label: '', mode: null, state: null },
		],
	})
}

function makeMockPart(id: string, rank: number, segmentId: SegmentId, props?: Partial<DBPart>): DBPart {
	return literal<DBPart>({
		_id: protectString(id),
		externalId: id,
		title: id,
		segmentId,
		_rank: rank,
		rundownId: protectString(RUNDOWN_ID),
		expectedDuration: PART_DURATION,
		expectedDurationWithTransition: PART_DURATION,
		...props,
	})
}

function makeMockSegment(id: SegmentId, rank: number): DBSegment {
	return literal<DBSegment>({
		_id: id,
		name: 'mock-segment',
		externalId: id as unknown as string,
		_rank: rank,
		rundownId: protectString(RUNDOWN_ID),
	})
}

interface MockScenario {
	playlist: DBRundownPlaylist
	partInstances: PartInstance[]
	segmentsMap: Map<SegmentId, DBSegment>
}

/** Two segments of two 10s parts each */
function makeScenario(partOverrides: Partial<DBPart>[] = []): MockScenario {
	const playlist = makeMockPlaylist()

	const segmentsMap = new Map<SegmentId, DBSegment>()
	segmentsMap.set(SEGMENT_0, makeMockSegment(SEGMENT_0, 0))
	segmentsMap.set(SEGMENT_1, makeMockSegment(SEGMENT_1, 1))

	const parts = [
		makeMockPart('part0', 0, SEGMENT_0, partOverrides[0]),
		makeMockPart('part1', 1, SEGMENT_0, partOverrides[1]),
		makeMockPart('part2', 0, SEGMENT_1, partOverrides[2]),
		makeMockPart('part3', 1, SEGMENT_1, partOverrides[3]),
	]
	const partInstances = parts.map((part) => wrapPartToTemporaryInstance(protectString(''), part))

	return { playlist, partInstances, segmentsMap }
}

/** Puts `index` on air, with the part before it (if any) already played out */
function putOnAir(scenario: MockScenario, index: number, startedPlayback: number): void {
	for (let i = 0; i < index; i++) {
		scenario.partInstances[i].timings = {
			take: startedPlayback - (index - i) * PART_DURATION,
			plannedStartedPlayback: startedPlayback - (index - i) * PART_DURATION,
			duration: PART_DURATION,
		}
	}

	const livePartInstance = scenario.partInstances[index]
	livePartInstance.timings = { take: startedPlayback, plannedStartedPlayback: startedPlayback }
	scenario.playlist.activationId = protectString<RundownPlaylistActivationId>('active')
	scenario.playlist.startedPlayback = startedPlayback
	scenario.playlist.currentPartInfo = {
		partInstanceId: livePartInstance._id,
		rundownId: livePartInstance.rundownId,
		manuallySelected: false,
		consumesQueuedSegmentId: false,
	}

	const nextPartInstance = scenario.partInstances[index + 1]
	if (nextPartInstance) {
		scenario.playlist.nextPartInfo = {
			partInstanceId: nextPartInstance._id,
			rundownId: nextPartInstance.rundownId,
			manuallySelected: false,
			consumesQueuedSegmentId: false,
		}
	}
}

function contextAt(scenario: MockScenario, now: number): RundownTimingContext {
	return new RundownTimingCalculator().updateDurations(
		now,
		false,
		scenario.playlist,
		scenario.partInstances,
		scenario.segmentsMap,
		DEFAULT_DURATION,
		{}
	)
}

function statesAt(scenario: MockScenario, now: number): Map<PartId, PartTimingStateValues> {
	return calculatePartTimingStates(contextAt(scenario, now), scenario.partInstances)
}

function evalDuration(state: TimerState | undefined, now: number): number | undefined {
	return state ? timerStateToDuration(state, now) : undefined
}

/**
 * Evaluate a whole set of part states at `t`, reduced to the plain numbers the calculator reports,
 * so that they can be compared directly against a calculator run at `t`.
 *
 * @param partCountdownBase The playlist's base for the part countdowns, from the same calculation
 */
function evaluateStates(states: Map<PartId, PartTimingStateValues>, partCountdownBase: TimerState, t: number) {
	return Object.fromEntries(
		Array.from(states.entries()).map(([partId, state]) => [
			unprotectString(partId),
			{
				expectedDuration: evalDuration(state.expectedDuration, t),
				displayDurationNoPlayback: evalDuration(state.displayDuration, t),
				// the count-ups are published negated, per the convention on PartTimingStateDoc.played
				displayDuration: negate(evalDuration(state.liveDisplayDuration, t)),
				duration: negate(evalDuration(state.duration, t)),
				played: negate(evalDuration(state.played, t)),
				// as a consumer composes it
				countdown:
					state.countdownOffset === undefined
						? null
						: timerStateToDuration(offsetTimerState(partCountdownBase, state.countdownOffset), t),
				countsTowardsTiming: state.countsTowardsTiming,
				isInQuickLoop: state.isInQuickLoop,
			},
		])
	)
}

/** The same numbers, taken straight from a calculator run at `t` */
function calculatorValues(scenario: MockScenario, t: number) {
	const timingContext = contextAt(scenario, t)

	return Object.fromEntries(
		scenario.partInstances.map((partInstance) => {
			const timingId = getPartInstanceTimingId(partInstance)
			const partId = unprotectString(partInstance.part._id)

			return [
				partId,
				{
					expectedDuration: timingContext.partExpectedDurations?.[timingId],
					displayDurationNoPlayback: timingContext.partDisplayDurationsNoPlayback?.[timingId],
					displayDuration: timingContext.partDisplayDurations?.[timingId],
					duration: timingContext.partDurations?.[timingId],
					played: timingContext.partPlayed?.[timingId],
					countdown: timingContext.partCountdown?.[partId] ?? null,
					countsTowardsTiming: timingContext.partCountsTowardsTiming?.[timingId] ?? false,
					isInQuickLoop: timingContext.partsInQuickLoop?.[timingId] ?? false,
				},
			]
		})
	)
}

function negate(value: number | undefined): number | undefined {
	return value === undefined ? undefined : 0 - value
}

/**
 * The property the whole publication rests on: states published at `now` still report exactly what
 * the calculator would say, at every later instant, without being republished.
 */
function expectMatchesCalculator(scenario: MockScenario, now: number, offsets: number[]): void {
	const timingContext = contextAt(scenario, now)
	const states = calculatePartTimingStates(timingContext, scenario.partInstances)

	for (const offset of offsets) {
		const t = now + offset
		expect({ offset, values: evaluateStates(states, timingContext.partCountdownBase, t) }).toEqual({
			offset,
			values: calculatorValues(scenario, t),
		})
	}
}

describe('calculatePartTimingStates', () => {
	it('produces a state for every part, ranked in playout order', () => {
		const states = statesAt(makeScenario(), 10000)

		expect(Array.from(states.keys()).map(unprotectString)).toEqual(['part0', 'part1', 'part2', 'part3'])
		expect(Array.from(states.values()).map((state) => state.rank)).toEqual([0, 1, 2, 3])
	})

	it('says which parts are untimed, while still giving an untimed part its own expected duration', () => {
		const states = statesAt(makeScenario([{}, { untimed: true }]), 10000)
		const timedPart = states.get(protectString('part0'))
		const untimedPart = states.get(protectString('part1'))

		// the expected duration is the Part's own either way, so a consumer that adds them up has to
		// leave the untimed ones out itself
		expect(evalDuration(untimedPart?.expectedDuration, 10000)).toBe(PART_DURATION)
		expect(timedPart?.untimed).toBe(false)
		expect(untimedPart?.untimed).toBe(true)
	})

	it('says which parts are orphaned, while still giving an orphaned part its own expected duration', () => {
		const scenario = makeScenario()
		scenario.partInstances[1].orphaned = 'adlib-part'
		scenario.partInstances[2].orphaned = 'deleted'
		const states = statesAt(scenario, 10000)
		const plannedPart = states.get(protectString('part0'))
		const adlibbedPart = states.get(protectString('part1'))
		const deletedPart = states.get(protectString('part2'))

		// the expected duration is the Part's own either way, so a consumer that adds up a Segment has
		// to leave the orphaned ones out itself
		expect(evalDuration(adlibbedPart?.expectedDuration, 10000)).toBe(PART_DURATION)
		expect(evalDuration(deletedPart?.expectedDuration, 10000)).toBe(PART_DURATION)
		expect(plannedPart?.orphaned).toBe(false)
		expect(adlibbedPart?.orphaned).toBe(true)
		expect(deletedPart?.orphaned).toBe(true)
	})

	describe('matches the calculator', () => {
		// deliberately spans the on-air part's planned end at +10s, where every count-up changes slope
		const OFFSETS = [0, 1, 999, 1000, 5000, 9999, 10000, 10001, 15000, 60000]

		it('for an inactive playlist', () => {
			expectMatchesCalculator(makeScenario(), 10000, OFFSETS)
		})

		it('with the first part on air', () => {
			const scenario = makeScenario()
			putOnAir(scenario, 0, 10000)
			expectMatchesCalculator(scenario, 10000, OFFSETS)
		})

		it('with a later part on air, after earlier parts have played', () => {
			const scenario = makeScenario()
			putOnAir(scenario, 2, 10000)
			expectMatchesCalculator(scenario, 10000, OFFSETS)
		})

		it('while the on-air part is already overrunning', () => {
			const scenario = makeScenario()
			putOnAir(scenario, 1, 10000)
			// start observing well past the part's planned end, so the states are built on the far side
			// of the breakpoint rather than before it
			expectMatchesCalculator(scenario, 45000, OFFSETS)
		})

		it('with an on-air part that has a play offset', () => {
			const scenario = makeScenario()
			putOnAir(scenario, 1, 10000)
			scenario.partInstances[1].timings = {
				...scenario.partInstances[1].timings,
				playOffset: 2000,
			}
			expectMatchesCalculator(scenario, 10000, OFFSETS)
		})

		it('with untimed and floated parts', () => {
			const scenario = makeScenario([{}, { untimed: true }, { floated: true }])
			putOnAir(scenario, 0, 10000)
			expectMatchesCalculator(scenario, 10000, OFFSETS)
		})

		it('with an invalid part, which is pinned to the default duration', () => {
			const scenario = makeScenario([{}, { invalid: true }])
			putOnAir(scenario, 1, 10000)
			expectMatchesCalculator(scenario, 10000, OFFSETS)
		})

		it('with a part whose planned start is still in the future', () => {
			const scenario = makeScenario()
			putOnAir(scenario, 1, 10000)
			// A take in a multi-gateway studio writes a start slightly ahead of now. The countdown
			// states spend their one breakpoint on that start, so they cannot also hold at zero once
			// the part overruns at 20000 - the offsets stop short of it. That is sound because a take
			// always changes playout state and so always republishes, long before the second
			// breakpoint would be reached; see the note on TimerState.
			expectMatchesCalculator(scenario, 9800, [0, 1, 199, 200, 201, 1000, 5000, 10000])
		})
	})

	describe('document stability', () => {
		/**
		 * The publication only republishes when playout or ingest state changes, so recomputing later
		 * from unchanged inputs has to produce an identical document - otherwise the values a consumer
		 * holds would silently differ from what a fresh subscriber gets.
		 */
		function expectStable(scenario: MockScenario, now: number, laterOffsets: number[]): void {
			const initial = statesAt(scenario, now)

			for (const offset of laterOffsets) {
				expect({ offset, states: statesAt(scenario, now + offset) }).toEqual({ offset, states: initial })
			}
		}

		it('is stable for an inactive playlist', () => {
			expectStable(makeScenario(), 10000, [1, 5000, 10000, 60000])
		})

		it('is stable with a part on air, across its planned end', () => {
			const scenario = makeScenario()
			putOnAir(scenario, 1, 10000)
			expectStable(scenario, 10000, [1, 5000, 9999, 10000, 10001, 60000])
		})

		it('is stable with a part on air that has already overrun', () => {
			const scenario = makeScenario()
			putOnAir(scenario, 1, 10000)
			expectStable(scenario, 45000, [1, 5000, 60000])
		})
	})

	describe('display duration groups', () => {
		/**
		 * Known limitation, carried over from the calculator: the group's pool is drained by the on-air
		 * part's *live* display duration, so once that part overruns, the later members of its group
		 * shrink continuously. Their resolved durations are therefore not static, and a document
		 * published before the overrun does not describe them afterwards.
		 *
		 * This is asserted rather than fixed so that the behaviour is pinned and the divergence is
		 * visible; changing it is a behaviour change that needs its own review.
		 */
		function makeGroupScenario(): MockScenario {
			return makeScenario([
				{ displayDurationGroup: 'group', expectedDuration: 10000, expectedDurationWithTransition: 10000 },
				{ displayDurationGroup: 'group', expectedDuration: 5000, expectedDurationWithTransition: 5000 },
			])
		}

		it('matches the calculator at the instant it is published', () => {
			const scenario = makeGroupScenario()
			putOnAir(scenario, 0, 10000)
			expectMatchesCalculator(scenario, 10000, [0])
			expectMatchesCalculator(scenario, 25000, [0])
		})

		it('the second group member shrinks as the on-air member overruns', () => {
			const scenario = makeGroupScenario()
			putOnAir(scenario, 0, 10000)

			// part0 is planned for 10s from 10000, so it overruns by 2s at 22000, and that 2s comes
			// straight out of what is left in the pool for part1
			expect(contextAt(scenario, 15000).partDisplayDurationsNoPlayback?.['part1']).toBe(5000)
			expect(contextAt(scenario, 22000).partDisplayDurationsNoPlayback?.['part1']).toBe(3000)
		})
	})
})
