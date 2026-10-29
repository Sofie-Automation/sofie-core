import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { RundownPlaylistActivationId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { CountdownType, PlaylistTimingType, type SegmentTimingInfo } from '@sofie-automation/blueprints-integration'
import { wrapPartToTemporaryInstance } from '@sofie-automation/corelib/dist/playout/stateCacheResolver'
import { calculatePartInstanceExpectedDurationWithTransition } from '@sofie-automation/corelib/dist/playout/timings'
import { timerStateToDuration, type TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import { RundownTimingCalculator, getPartInstanceTimingId, type RundownTimingContext } from '../index'
import { calculateSegmentTimingStates, type SegmentTimingStateValues } from '../segmentTimingState'

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

function makeMockPart(id: string, rank: number, segmentId: SegmentId): DBPart {
	return literal<DBPart>({
		_id: protectString(id),
		externalId: id,
		title: id,
		segmentId,
		_rank: rank,
		rundownId: protectString(RUNDOWN_ID),
		expectedDuration: PART_DURATION,
		expectedDurationWithTransition: PART_DURATION,
	})
}

function makeMockSegment(id: SegmentId, rank: number, timing?: SegmentTimingInfo): DBSegment {
	return literal<DBSegment>({
		_id: id,
		name: 'mock-segment',
		externalId: id as unknown as string,
		_rank: rank,
		rundownId: protectString(RUNDOWN_ID),
		segmentTiming: timing,
	})
}

interface MockScenario {
	playlist: DBRundownPlaylist
	partInstances: PartInstance[]
	segmentsMap: Map<SegmentId, DBSegment>
}

/** Two segments of two 10s parts each */
function makeScenario(segment0Timing?: SegmentTimingInfo): MockScenario {
	const playlist = makeMockPlaylist()

	const segmentsMap = new Map<SegmentId, DBSegment>()
	segmentsMap.set(SEGMENT_0, makeMockSegment(SEGMENT_0, 0, segment0Timing))
	segmentsMap.set(SEGMENT_1, makeMockSegment(SEGMENT_1, 1))

	const parts = [
		makeMockPart('part0', 0, SEGMENT_0),
		makeMockPart('part1', 1, SEGMENT_0),
		makeMockPart('part2', 0, SEGMENT_1),
		makeMockPart('part3', 1, SEGMENT_1),
	]
	const partInstances = parts.map((part) => wrapPartToTemporaryInstance(protectString(''), part))

	return { playlist, partInstances, segmentsMap }
}

function putFirstPartOnAir(scenario: MockScenario, startedPlayback: number): void {
	const livePartInstance = scenario.partInstances[0]
	livePartInstance.timings = { take: startedPlayback, plannedStartedPlayback: startedPlayback }
	scenario.playlist.activationId = protectString<RundownPlaylistActivationId>('active')
	scenario.playlist.startedPlayback = startedPlayback
	scenario.playlist.currentPartInfo = {
		partInstanceId: livePartInstance._id,
		rundownId: livePartInstance.rundownId,
		manuallySelected: false,
		consumesQueuedSegmentId: false,
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

function statesAt(scenario: MockScenario, now: number): Map<SegmentId, SegmentTimingStateValues> {
	return calculateSegmentTimingStates(now, contextAt(scenario, now), scenario.partInstances, scenario.segmentsMap)
}

function evalDuration(state: TimerState | undefined, now: number): number {
	if (!state) throw new Error('Expected a timer state')
	return timerStateToDuration(state, now)
}

/**
 * What the segment duration display computed from the timing context before this was published,
 * reproduced so the states can be checked against it. Mirrors SegmentDuration.tsx.
 */
function referenceValues(
	scenario: MockScenario,
	segmentId: SegmentId,
	now: number
): { budget: number; playedOut: number; duration: number } {
	const timingContext = contextAt(scenario, now)
	const segment = scenario.segmentsMap.get(segmentId)
	const segmentBudgetDuration = segment?.segmentTiming?.budgetDuration
	const countdownType = segment?.segmentTiming?.countdownType ?? CountdownType.PART_EXPECTED_DURATION

	let budget = segmentBudgetDuration ?? 0
	let playedOut = 0

	if (countdownType === CountdownType.SEGMENT_BUDGET_DURATION) {
		const duration =
			timingContext.currentSegmentId === segmentId
				? (timingContext.remainingBudgetOnCurrentSegment ?? segmentBudgetDuration ?? 0)
				: (segmentBudgetDuration ?? 0)
		return { budget, playedOut, duration }
	}

	for (const partInstance of scenario.partInstances) {
		if (partInstance.segmentId !== segmentId) continue

		playedOut +=
			(!partInstance.part.untimed ? timingContext.partPlayed?.[getPartInstanceTimingId(partInstance)] : 0) || 0

		if (segmentBudgetDuration === undefined) {
			budget +=
				partInstance.orphaned || partInstance.part.untimed
					? 0
					: calculatePartInstanceExpectedDurationWithTransition(partInstance) || 0
		}
	}

	return { budget, playedOut, duration: budget - playedOut }
}

function expectMatchesReference(scenario: MockScenario, now: number, offsets: number[]): void {
	const states = statesAt(scenario, now)

	for (const offset of offsets) {
		const t = now + offset
		for (const segmentId of scenario.segmentsMap.keys()) {
			const state = states.get(segmentId)
			const reference = referenceValues(scenario, segmentId, t)

			expect({ segmentId, offset, value: evalDuration(state?.plannedDuration, t) }).toEqual({
				segmentId,
				offset,
				value: reference.budget,
			})
			// the published played-out counts up by going negative
			expect({ segmentId, offset, value: 0 - evalDuration(state?.playedOut, t) }).toEqual({
				segmentId,
				offset,
				value: reference.playedOut,
			})
			expect({ segmentId, offset, value: evalDuration(state?.remaining, t) }).toEqual({
				segmentId,
				offset,
				value: reference.duration,
			})
		}
	}
}

describe('calculateSegmentTimingStates', () => {
	it('produces a state for every segment', () => {
		const states = statesAt(makeScenario(), 10000)

		expect([...states.keys()]).toEqual([SEGMENT_0, SEGMENT_1])
	})

	describe('segments timed by their parts', () => {
		it('matches the reference before playback', () => {
			expectMatchesReference(makeScenario(), 10000, [0, 1000, 30000])
		})

		it('matches the reference while a part in the segment is on air, through the overrun', () => {
			const scenario = makeScenario()
			putFirstPartOnAir(scenario, 20000)

			// a 10s part started at 20000, so it overruns at 30000
			expectMatchesReference(scenario, 25000, [0, 1000, 4999, 5000, 5001, 20000])
		})

		it('counts the on-air segment up and down, leaving the others alone', () => {
			const scenario = makeScenario()
			putFirstPartOnAir(scenario, 20000)
			const states = statesAt(scenario, 25000)

			const live = states.get(SEGMENT_0)
			// 5s into the segment, of 20s planned
			expect(evalDuration(live?.plannedDuration, 25000)).toBe(2 * PART_DURATION)
			expect(evalDuration(live?.playedOut, 25000)).toBe(-5000)
			expect(evalDuration(live?.remaining, 25000)).toBe(15000)
			// and it keeps moving without a new document
			expect(evalDuration(live?.playedOut, 30000)).toBe(-10000)
			expect(evalDuration(live?.remaining, 30000)).toBe(10000)

			const other = states.get(SEGMENT_1)
			expect(evalDuration(other?.playedOut, 25000)).toBe(0)
			expect(evalDuration(other?.remaining, 25000)).toBe(2 * PART_DURATION)
			expect(evalDuration(other?.remaining, 60000)).toBe(2 * PART_DURATION)
		})

		it('ignores untimed parts', () => {
			const scenario = makeScenario()
			scenario.partInstances[1].part.untimed = true

			const states = statesAt(scenario, 10000)

			expect(evalDuration(states.get(SEGMENT_0)?.plannedDuration, 10000)).toBe(PART_DURATION)
		})
	})

	describe('segments with a budget', () => {
		const budgetDuration = 25000

		function makeBudgetScenario(): MockScenario {
			const scenario = makeScenario({
				budgetDuration,
				countdownType: CountdownType.SEGMENT_BUDGET_DURATION,
			})
			putFirstPartOnAir(scenario, 20000)
			scenario.playlist.segmentsStartedPlayback = {
				[scenario.partInstances[0].segmentPlayoutId as unknown as string]: 20000,
			}
			return scenario
		}

		it('counts the budget down for the on-air segment', () => {
			const states = statesAt(makeBudgetScenario(), 30000)
			const live = states.get(SEGMENT_0)

			expect(evalDuration(live?.plannedDuration, 30000)).toBe(budgetDuration)
			// 10s into a 25s budget, continuing into overtime
			expect(evalDuration(live?.remaining, 30000)).toBe(15000)
			expect(evalDuration(live?.remaining, 45000)).toBe(0)
			expect(evalDuration(live?.remaining, 50000)).toBe(-5000)
		})

		it('matches the reference', () => {
			expectMatchesReference(makeBudgetScenario(), 30000, [0, 1000, 15000])
		})

		/**
		 * Preserved behaviour: the segment duration display has never counted up for a budgeted
		 * segment, because the value it uses is only accumulated in the non-budget branch.
		 */
		it('reports no played-out time (known quirk, preserved)', () => {
			const states = statesAt(makeBudgetScenario(), 30000)

			expect(evalDuration(states.get(SEGMENT_0)?.playedOut, 30000)).toBe(0)
		})
	})

	/**
	 * The publication only recomputes on state changes, so a document computed at one moment must
	 * describe the same thing when recomputed later from unchanged inputs.
	 */
	describe('is stable as time passes with unchanged inputs', () => {
		function expectStableAcross(scenario: MockScenario, times: number[]): void {
			const reference = statesAt(scenario, times[0])

			for (const time of times.slice(1)) {
				expect({ time, states: statesAt(scenario, time) }).toEqual({ time, states: reference })
			}
		}

		it('before playback', () => {
			expectStableAcross(makeScenario(), [10000, 12000, 19000])
		})

		it('while a part in the segment is on air', () => {
			const scenario = makeScenario()
			putFirstPartOnAir(scenario, 20000)

			expectStableAcross(scenario, [20000, 21000, 25000, 29999])
		})

		it('while the on-air part is overrunning', () => {
			const scenario = makeScenario()
			putFirstPartOnAir(scenario, 20000)

			expectStableAcross(scenario, [31000, 45000, 120000])
		})
	})
})
