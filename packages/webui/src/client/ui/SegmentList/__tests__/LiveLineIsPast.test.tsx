import { render, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { PartId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import { getPartTimingStateDocId, type PartTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const SEGMENT_ID = protectString<SegmentId>('segment0')
const ON_AIR_PART_ID = protectString<PartId>('onAirPart')
const PLAYED_PART_ID = protectString<PartId>('playedPart')
const UPCOMING_PART_ID = protectString<PartId>('upcomingPart')
const NOW = 100000
/** The time into each part that is asked about */
const TIME_IN_PART = 7000
/** The on-air part has played for 6.5s, so its live line passes 7s half a second from now */
const ON_AIR_STARTED_AT = NOW - 6500

/** The part documents the mocked collection will return */
let publishedDocs: PartTimingStateDoc[] = []

jest.mock('../../Collections.js', () => ({
	PlaylistTimingStates: {
		findOne: (id: unknown) => publishedDocs.find((doc) => doc._id === id),
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../lib/systemTime.js', () => ({
	getCurrentTime: () => NOW,
}))

import { LiveLineIsPast } from '../utils/LiveLineIsPast.js'
import { RundownTiming } from '../../RundownView/RundownTiming/RundownTiming.js'

/** A value that holds at `staticValue` and grows from `growsFrom`, published negated as the part documents are */
function countUp(staticValue: number, growsFrom: number | null): TimerState {
	return { paused: true, duration: 0 - staticValue, resumesAt: growsFrom }
}

function makeDoc(partId: PartId, rank: number, played: TimerState): PartTimingStateDoc {
	return {
		_id: getPartTimingStateDocId(partId),
		type: 'part',
		playlistId: PLAYLIST_ID,
		segmentId: SEGMENT_ID,
		partId,
		rank,
		isInQuickLoop: false,
		countsTowardsTiming: true,
		untimed: false,
		orphaned: false,
		played,
	}
}

/** Dispatch high-resolution ticks a frame apart, as RundownTimingProvider does */
function dispatchHighResolutionTicks(count: number, startingAt: number): void {
	for (let i = 0; i < count; i++) {
		act(() => {
			window.dispatchEvent(
				new CustomEvent(RundownTiming.Events.timeupdateHighResolution, {
					detail: { currentTime: startingAt + i * 16 },
				})
			)
		})
	}
}

describe('LiveLineIsPast', () => {
	/** How many times each part has been drawn, and whether its live line was past the time when it last was */
	let draws: Map<PartId, number>
	let lastDrawnIsPast: Map<PartId, boolean>

	function renderLiveLineIsPast(partId: PartId): JSX.Element {
		return (
			<LiveLineIsPast key={String(partId)} partId={partId} time={TIME_IN_PART}>
				{(isPast) => {
					draws.set(partId, (draws.get(partId) ?? 0) + 1)
					lastDrawnIsPast.set(partId, isPast)
					return null
				}}
			</LiveLineIsPast>
		)
	}

	beforeEach(() => {
		publishedDocs = [
			makeDoc(PLAYED_PART_ID, 0, countUp(9000, null)),
			makeDoc(ON_AIR_PART_ID, 1, countUp(0, ON_AIR_STARTED_AT)),
			makeDoc(UPCOMING_PART_ID, 2, countUp(0, null)),
		]
		draws = new Map()
		lastDrawnIsPast = new Map()
	})

	it('redraws the on-air part on every high-resolution tick, and a played or upcoming part on none of them', () => {
		render(
			<>
				{renderLiveLineIsPast(PLAYED_PART_ID)}
				{renderLiveLineIsPast(ON_AIR_PART_ID)}
				{renderLiveLineIsPast(UPCOMING_PART_ID)}
			</>
		)
		const drawsBeforeTicks = new Map(draws)

		dispatchHighResolutionTicks(60, NOW + 16)

		expect((draws.get(ON_AIR_PART_ID) ?? 0) - (drawsBeforeTicks.get(ON_AIR_PART_ID) ?? 0)).toBe(60)
		expect((draws.get(PLAYED_PART_ID) ?? 0) - (drawsBeforeTicks.get(PLAYED_PART_ID) ?? 0)).toBe(0)
		expect((draws.get(UPCOMING_PART_ID) ?? 0) - (drawsBeforeTicks.get(UPCOMING_PART_ID) ?? 0)).toBe(0)
	})

	it('tells each part whether its live line is past the time, the on-air part as of the last tick', () => {
		render(
			<>
				{renderLiveLineIsPast(PLAYED_PART_ID)}
				{renderLiveLineIsPast(ON_AIR_PART_ID)}
				{renderLiveLineIsPast(UPCOMING_PART_ID)}
			</>
		)
		expect(lastDrawnIsPast.get(ON_AIR_PART_ID)).toBe(false)

		dispatchHighResolutionTicks(60, NOW + 16)

		expect(lastDrawnIsPast.get(PLAYED_PART_ID)).toBe(true)
		// by the last tick, 100960, it had played 7460ms
		expect(lastDrawnIsPast.get(ON_AIR_PART_ID)).toBe(true)
		expect(lastDrawnIsPast.get(UPCOMING_PART_ID)).toBe(false)
	})
})
