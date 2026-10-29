import { renderHook, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type {
	PartId,
	PartInstanceId,
	RundownPlaylistId,
	SegmentId,
	SegmentPlayoutId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import {
	getPartTimingStateDocId,
	getPlaylistTimingStateDocId,
	type PartTimingStateDoc,
	type PlaylistTimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { mongoWhere, type MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { CountdownType, PlaylistTimingType } from '@sofie-automation/blueprints-integration'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const NOW = 100000
/** What the mocked system clock reads */
let currentTime = NOW

const SEGMENT_A = protectString<SegmentId>('segmentA')
const SEGMENT_B = protectString<SegmentId>('segmentB')
const SEGMENT_C = protectString<SegmentId>('segmentC')
const PLAY_OF_SEGMENT_A = protectString<SegmentPlayoutId>('playOfSegmentA')
const PLAY_OF_SEGMENT_B = protectString<SegmentPlayoutId>('playOfSegmentB')

const PREVIOUS_PART = protectString<PartInstanceId>('previousPartInstance')
const TAKEN_PART = protectString<PartInstanceId>('takenPartInstance')
const NEXT_PART = protectString<PartInstanceId>('nextPartInstance')

/** The taken part's expected duration */
const TAKEN_PART_EXPECTED_DURATION = 12_000
/** How much of the taken part's start the previous part still plays over */
const TAKEN_PART_TRANSITION = 2_000
/** The taken part's planned length: its expected duration with its transition */
const TAKEN_PART_PLANNED_LENGTH = 10_000

/** The previous part's countdown as published, 2s to go */
const PREVIOUS_PART_REMAINING = { paused: false, zeroTime: NOW + 2_000 } as const
/** The previous segment's budget as published, 30s to go */
const PREVIOUS_SEGMENT_BUDGET = { paused: false, zeroTime: NOW + 30_000 } as const

/** The published playlist document */
let publishedPlaylistTiming: PlaylistTimingStateDoc | undefined
/** The published part documents */
let publishedPartTimings: PartTimingStateDoc[]
/** What the page has of the playlist, its part instances and its segments */
let pagePlaylist: Pick<DBRundownPlaylist, '_id' | 'currentPartInfo' | 'segmentsStartedPlayback'> | undefined
let pagePartInstances: DBPartInstance[]
let pageSegments: Array<Pick<DBSegment, '_id' | 'segmentTiming'>>

/** Find a document by id or by a selector, as the collections do */
function findIn<TDoc extends { _id: unknown }>(docs: TDoc[], selector: unknown): TDoc | undefined {
	if (typeof selector === 'string') return docs.find((doc) => doc._id === selector)
	return docs.find((doc) => mongoWhere(doc, selector as MongoQuery<TDoc>))
}

jest.mock('../../../Collections.js', () => ({
	PlaylistTimingStates: {
		findOne: (selector: unknown) =>
			findIn<PlaylistTimingStateDoc | PartTimingStateDoc>(
				[...(publishedPlaylistTiming ? [publishedPlaylistTiming] : []), ...publishedPartTimings],
				selector
			),
	},
	UIPartInstances: {
		findOne: (selector: unknown) => findIn(pagePartInstances, selector),
	},
}))
jest.mock('../../../../collections/index.js', () => ({
	RundownPlaylists: {
		findOne: (selector: unknown) => findIn(pagePlaylist ? [pagePlaylist] : [], selector),
	},
	Segments: {
		findOne: (selector: unknown) => findIn(pageSegments, selector),
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../../lib/systemTime.js', () => ({
	getCurrentTime: () => currentTime,
}))

import { TimerValueMode, usePlaylistTimingValue, type PlaylistTimerKey } from '../usePlaylistTimingValue.js'
import { RundownTiming, TimingTickResolution } from '../RundownTiming.js'

function makePlaylistTiming(fields: Partial<PlaylistTimingStateDoc>): PlaylistTimingStateDoc {
	return {
		_id: getPlaylistTimingStateDocId(PLAYLIST_ID),
		type: 'playlist',
		playlistId: PLAYLIST_ID,
		timingType: PlaylistTimingType.ForwardTime,
		currentPartWillAutoNext: false,
		partCountdownBase: { paused: true, duration: 0 },
		...fields,
	}
}

function makePartTiming(partId: PartId, segmentId: SegmentId, rank: number): PartTimingStateDoc {
	return {
		_id: getPartTimingStateDocId(partId),
		type: 'part',
		playlistId: PLAYLIST_ID,
		segmentId,
		partId,
		rank,
		isInQuickLoop: false,
		countsTowardsTiming: true,
		untimed: false,
		orphaned: false,
	}
}

function makePartInstance(fields: {
	_id: PartInstanceId
	segmentId: SegmentId
	segmentPlayoutId: SegmentPlayoutId
	takeCount: number
	part?: Partial<DBPartInstance['part']>
	plannedStartedPlayback?: number
}): DBPartInstance {
	const partId = protectString<PartId>(`partOf_${fields._id}`)
	return {
		_id: fields._id,
		segmentId: fields.segmentId,
		segmentPlayoutId: fields.segmentPlayoutId,
		takeCount: fields.takeCount,
		part: { _id: partId, segmentId: fields.segmentId, ...fields.part },
		timings:
			fields.plannedStartedPlayback === undefined
				? undefined
				: { plannedStartedPlayback: fields.plannedStartedPlayback },
	} as DBPartInstance
}

/** The previous part, on air before the take, in the play of segment A */
function makePreviousPartInstance(): DBPartInstance {
	return makePartInstance({
		_id: PREVIOUS_PART,
		segmentId: SEGMENT_A,
		segmentPlayoutId: PLAY_OF_SEGMENT_A,
		takeCount: 1,
		part: { expectedDuration: 20_000 },
	})
}

/** The part just taken, of TAKEN_PART_PLANNED_LENGTH, in segment A or in segment B */
function makeTakenPartInstance(
	segment: 'same segment' | 'next segment',
	fields?: { part?: Partial<DBPartInstance['part']>; plannedStartedPlayback?: number }
): DBPartInstance {
	const isSameSegment = segment === 'same segment'
	return makePartInstance({
		_id: TAKEN_PART,
		segmentId: isSameSegment ? SEGMENT_A : SEGMENT_B,
		segmentPlayoutId: isSameSegment ? PLAY_OF_SEGMENT_A : PLAY_OF_SEGMENT_B,
		takeCount: 2,
		part: {
			expectedDuration: TAKEN_PART_EXPECTED_DURATION,
			...fields?.part,
		},
		plannedStartedPlayback: fields?.plannedStartedPlayback,
	})
}

/** The taken part's own playout timings: the previous part plays over its first TAKEN_PART_TRANSITION */
const TAKEN_PART_PLAYOUT_TIMINGS: DBPartInstance['partPlayoutTimings'] = {
	inTransitionStart: 0,
	toPartDelay: 0,
	toPartPostroll: 0,
	fromPartRemaining: TAKEN_PART_TRANSITION,
	fromPartPostroll: 0,
	fromPartKeepalive: 0,
}

/**
 * The page right after a take of `takenPartInstance`: the playlist has it on air, while the published
 * timing still describes the previous part
 */
function setUpRightAfterTake(takenPartInstance: DBPartInstance): void {
	takenPartInstance.partPlayoutTimings = TAKEN_PART_PLAYOUT_TIMINGS
	pagePartInstances = [makePreviousPartInstance(), takenPartInstance]
	pagePlaylist = {
		_id: PLAYLIST_ID,
		currentPartInfo: { partInstanceId: takenPartInstance._id } as DBRundownPlaylist['currentPartInfo'],
		segmentsStartedPlayback: { [PLAY_OF_SEGMENT_A as unknown as string]: NOW - 60_000 },
	}
	publishedPlaylistTiming = makePlaylistTiming({
		currentPartInstanceId: PREVIOUS_PART,
		currentSegmentId: SEGMENT_A,
		remainingOnCurrentPart: PREVIOUS_PART_REMAINING,
		remainingBudgetOnCurrentSegment: PREVIOUS_SEGMENT_BUDGET,
	})
	// In playout order: the previous part, the taken part, and a part of segment C after them
	publishedPartTimings = [
		makePartTiming(pagePartInstances[0].part._id, SEGMENT_A, 0),
		makePartTiming(takenPartInstance.part._id, takenPartInstance.segmentId, 1),
		makePartTiming(protectString<PartId>('laterPart'), SEGMENT_C, 2),
	]
}

/** The published timing once the server has calculated it for the taken part */
function publishTimingForTakenPart(fields: Partial<PlaylistTimingStateDoc>, segmentId: SegmentId): void {
	publishedPlaylistTiming = makePlaylistTiming({
		currentPartInstanceId: TAKEN_PART,
		currentSegmentId: segmentId,
		...fields,
	})
}

function renderOnAirTimer(
	timer: PlaylistTimerKey,
	forPartInstanceId: PartInstanceId | null = TAKEN_PART,
	tickResolutionWhileHolding?: TimingTickResolution
) {
	const renders = { count: 0 }
	const hook = renderHook(() => {
		renders.count++
		return usePlaylistTimingValue(PLAYLIST_ID, timer, TimerValueMode.Duration, {
			forPartInstanceId,
			tickResolutionWhileHolding,
		})
	})
	return { ...hook, renders }
}

/** Dispatch a timing tick, as RundownTimingProvider does */
/** Move the clock on, and send the high-resolution tick that RundownTimingProvider sends on each frame */
function advanceClockTo(time: number): void {
	currentTime = time
	act(() => {
		window.dispatchEvent(
			new CustomEvent(RundownTiming.Events.timeupdateHighResolution, { detail: { currentTime: time } })
		)
	})
}

describe('usePlaylistTimingValue for one part, right after a take', () => {
	beforeEach(() => {
		currentTime = NOW
		publishedPlaylistTiming = undefined
		publishedPartTimings = []
		pagePlaylist = undefined
		pagePartInstances = []
		pageSegments = [
			{ _id: SEGMENT_A, segmentTiming: undefined },
			{ _id: SEGMENT_B, segmentTiming: undefined },
		]
	})

	it("returns the published countdown while it describes the caller's part", () => {
		setUpRightAfterTake(makeTakenPartInstance('same segment'))
		publishTimingForTakenPart({ remainingOnCurrentPart: { paused: false, zeroTime: NOW + 8_000 } }, SEGMENT_A)

		const { result } = renderOnAirTimer('remainingOnCurrentPart')

		expect(result.current).toBe(8_000)
	})

	describe("the on-air part's remaining time", () => {
		it("is the taken part's planned length, with its transition, rather than the previous part's countdown", () => {
			setUpRightAfterTake(makeTakenPartInstance('same segment'))

			const { result } = renderOnAirTimer('remainingOnCurrentPart')

			expect(result.current).toBe(TAKEN_PART_PLANNED_LENGTH)
		})

		it('holds while the part has no planned start, as with one playout gateway until it reports the start', () => {
			setUpRightAfterTake(makeTakenPartInstance('same segment'))

			const { result } = renderOnAirTimer('remainingOnCurrentPart')
			advanceClockTo(NOW + 300)

			expect(result.current).toBe(TAKEN_PART_PLANNED_LENGTH)
		})

		it("does not jump when the server's countdown arrives, with one playout gateway", () => {
			setUpRightAfterTake(makeTakenPartInstance('same segment'))
			const { result, rerender } = renderOnAirTimer('remainingOnCurrentPart')
			advanceClockTo(NOW + 300)
			const shownBeforeTimingArrives = result.current

			// The server holds the part at its full length until the gateway reports its start
			publishTimingForTakenPart(
				{ remainingOnCurrentPart: { paused: true, duration: TAKEN_PART_PLANNED_LENGTH } },
				SEGMENT_A
			)
			rerender()

			expect(shownBeforeTimingArrives).toBe(TAKEN_PART_PLANNED_LENGTH)
			expect(result.current).toBe(shownBeforeTimingArrives)
		})

		it("does not jump when the gateway reports the start before the server's countdown arrives", () => {
			const reportedStart = NOW + 40
			setUpRightAfterTake(makeTakenPartInstance('same segment', { plannedStartedPlayback: reportedStart }))
			const { result, rerender } = renderOnAirTimer('remainingOnCurrentPart')
			advanceClockTo(NOW + 300)
			const shownBeforeTimingArrives = result.current

			publishTimingForTakenPart(
				{
					remainingOnCurrentPart: {
						paused: true,
						duration: TAKEN_PART_PLANNED_LENGTH,
						resumesAt: reportedStart,
					},
				},
				SEGMENT_A
			)
			rerender()

			// counting down from the reported start, as the server's countdown does
			expect(shownBeforeTimingArrives).toBe(TAKEN_PART_PLANNED_LENGTH - 260)
			expect(result.current).toBe(shownBeforeTimingArrives)
		})

		it("holds until the planned start in a multi-gateway studio, and does not jump when the server's countdown arrives", () => {
			// The take plans the part's start a moment ahead
			const plannedStart = NOW + 30
			setUpRightAfterTake(makeTakenPartInstance('same segment', { plannedStartedPlayback: plannedStart }))
			const { result, rerender } = renderOnAirTimer('remainingOnCurrentPart')
			const shownAtTheTake = result.current
			advanceClockTo(NOW + 300)
			const shownBeforeTimingArrives = result.current

			publishTimingForTakenPart(
				{
					remainingOnCurrentPart: {
						paused: true,
						duration: TAKEN_PART_PLANNED_LENGTH,
						resumesAt: plannedStart,
					},
				},
				SEGMENT_A
			)
			rerender()

			expect(shownAtTheTake).toBe(TAKEN_PART_PLANNED_LENGTH)
			expect(shownBeforeTimingArrives).toBe(TAKEN_PART_PLANNED_LENGTH - 270)
			expect(result.current).toBe(shownBeforeTimingArrives)
		})

		it('is the planned length at the first take, when the timing was published with nothing on air', () => {
			setUpRightAfterTake(makeTakenPartInstance('same segment'))
			publishedPlaylistTiming = makePlaylistTiming({})

			const { result } = renderOnAirTimer('remainingOnCurrentPart')

			expect(result.current).toBe(TAKEN_PART_PLANNED_LENGTH)
		})

		it('is not redrawn by the clock while it holds, as a published countdown that holds is not', () => {
			setUpRightAfterTake(makeTakenPartInstance('same segment'))

			const { result, renders } = renderOnAirTimer(
				'remainingOnCurrentPart',
				TAKEN_PART,
				TimingTickResolution.None
			)
			const rendersBeforeTicks = renders.count
			for (let i = 1; i <= 10; i++) advanceClockTo(NOW + i * 1000)

			expect(renders.count - rendersBeforeTicks).toBe(0)
			expect(result.current).toBe(TAKEN_PART_PLANNED_LENGTH)
		})

		it('is null for a part of a display-duration group with no length of its own, which only the server works out', () => {
			setUpRightAfterTake(
				makeTakenPartInstance('same segment', {
					part: { expectedDuration: undefined, displayDurationGroup: 'group0' },
				})
			)

			const { result } = renderOnAirTimer('remainingOnCurrentPart')

			expect(result.current).toBeNull()
		})

		it('is null for a part the page does not have on air', () => {
			setUpRightAfterTake(makeTakenPartInstance('same segment'))
			pagePartInstances.push(
				makePartInstance({
					_id: NEXT_PART,
					segmentId: SEGMENT_A,
					segmentPlayoutId: PLAY_OF_SEGMENT_A,
					takeCount: 3,
				})
			)

			const { result } = renderOnAirTimer('remainingOnCurrentPart', NEXT_PART)

			expect(result.current).toBeNull()
		})

		it("is null when the published timing already describes a part taken after the caller's", () => {
			// The server has the taken part on air, the page still has the previous one
			setUpRightAfterTake(makeTakenPartInstance('same segment'))
			pagePlaylist = {
				_id: PLAYLIST_ID,
				currentPartInfo: { partInstanceId: PREVIOUS_PART } as DBRundownPlaylist['currentPartInfo'],
			}
			publishTimingForTakenPart(
				{ remainingOnCurrentPart: { paused: true, duration: TAKEN_PART_PLANNED_LENGTH } },
				SEGMENT_A
			)

			const { result } = renderOnAirTimer('remainingOnCurrentPart', PREVIOUS_PART)

			expect(result.current).toBeNull()
		})

		it('is null while nothing is published at all, since the part may have been on air for a while', () => {
			setUpRightAfterTake(makeTakenPartInstance('same segment'))
			publishedPlaylistTiming = undefined

			const { result } = renderOnAirTimer('remainingOnCurrentPart')

			expect(result.current).toBeNull()
		})
	})

	describe("the on-air segment's remaining budget", () => {
		const SEGMENT_B_BUDGET = 60_000

		function giveSegmentBABudget(): void {
			pageSegments = [
				{ _id: SEGMENT_A, segmentTiming: undefined },
				{
					_id: SEGMENT_B,
					segmentTiming: {
						budgetDuration: SEGMENT_B_BUDGET,
						countdownType: CountdownType.SEGMENT_BUDGET_DURATION,
					},
				},
			]
		}

		it('is the published budget after a take within the segment, which leaves the budget as it was', () => {
			setUpRightAfterTake(makeTakenPartInstance('same segment'))

			const { result } = renderOnAirTimer('remainingBudgetOnCurrentSegment')

			expect(result.current).toBe(30_000)
		})

		it("is the next segment's budget, holding, rather than the previous segment's", () => {
			giveSegmentBABudget()
			setUpRightAfterTake(makeTakenPartInstance('next segment'))

			const { result } = renderOnAirTimer('remainingBudgetOnCurrentSegment')
			advanceClockTo(NOW + 300)

			expect(result.current).toBe(SEGMENT_B_BUDGET)
		})

		it("does not jump when the server's budget arrives", () => {
			giveSegmentBABudget()
			setUpRightAfterTake(makeTakenPartInstance('next segment'))
			const { result, rerender } = renderOnAirTimer('remainingBudgetOnCurrentSegment')
			advanceClockTo(NOW + 300)
			const shownBeforeTimingArrives = result.current

			// The server holds the budget until the segment's start is reported
			publishTimingForTakenPart(
				{ remainingBudgetOnCurrentSegment: { paused: true, duration: SEGMENT_B_BUDGET } },
				SEGMENT_B
			)
			rerender()

			expect(shownBeforeTimingArrives).toBe(SEGMENT_B_BUDGET)
			expect(result.current).toBe(shownBeforeTimingArrives)
		})

		it("counts down from the segment's start once it is reported, as the server's budget does", () => {
			giveSegmentBABudget()
			setUpRightAfterTake(makeTakenPartInstance('next segment'))
			const reportedStart = NOW + 40
			pagePlaylist = {
				...pagePlaylist!,
				segmentsStartedPlayback: { [PLAY_OF_SEGMENT_B as unknown as string]: reportedStart },
			}
			const { result, rerender } = renderOnAirTimer('remainingBudgetOnCurrentSegment')
			advanceClockTo(NOW + 300)
			const shownBeforeTimingArrives = result.current

			publishTimingForTakenPart(
				{ remainingBudgetOnCurrentSegment: { paused: false, zeroTime: reportedStart + SEGMENT_B_BUDGET } },
				SEGMENT_B
			)
			rerender()

			expect(shownBeforeTimingArrives).toBe(SEGMENT_B_BUDGET - 260)
			expect(result.current).toBe(shownBeforeTimingArrives)
		})

		it("is null for a next segment with no budget, rather than the previous segment's budget", () => {
			setUpRightAfterTake(makeTakenPartInstance('next segment'))

			const { result } = renderOnAirTimer('remainingBudgetOnCurrentSegment')

			expect(result.current).toBeNull()
		})

		it('is null for the last segment of the playlist, for which the server publishes no budget', () => {
			giveSegmentBABudget()
			setUpRightAfterTake(makeTakenPartInstance('next segment'))
			publishedPartTimings = publishedPartTimings.filter((partTiming) => partTiming.segmentId !== SEGMENT_C)

			const { result } = renderOnAirTimer('remainingBudgetOnCurrentSegment')

			expect(result.current).toBeNull()
		})
	})
})
