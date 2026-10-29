import { renderHook, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { PartId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import { getPartTimingStateDocId, type PartTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const SEGMENT_ID = protectString<SegmentId>('segment0')
const FIRST_PART_ID = protectString<PartId>('part0')
const SECOND_PART_ID = protectString<PartId>('part1')
const NOW = 100000

/** The documents the mocked collection will return, in rank order, as the same array every time */
let publishedDocs: PartTimingStateDoc[] = []

jest.mock('../../../Collections.js', () => ({
	PlaylistTimingStates: {
		find: () => ({ fetch: () => publishedDocs }),
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../../lib/systemTime.js', () => ({
	getCurrentTime: () => NOW,
}))

import { useSegmentPartTimings } from '../usePlaylistTimingValue.js'
import { RundownTiming } from '../RundownTiming.js'

/** A value that holds at `staticValue` and grows from `growsFrom`, published negated as the part documents are */
function countUp(staticValue: number, growsFrom: number | null): TimerState {
	return { paused: true, duration: 0 - staticValue, resumesAt: growsFrom }
}

function makeDoc(partId: PartId, rank: number, displayDuration: TimerState): PartTimingStateDoc {
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
		liveDisplayDuration: displayDuration,
		duration: displayDuration,
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

/** Render the hook, counting how many times its caller is rendered */
function renderCountingRenders() {
	const renders = { count: 0 }
	const hook = renderHook(() => {
		renders.count++
		return useSegmentPartTimings(SEGMENT_ID)
	})
	return { ...hook, renders }
}

describe('useSegmentPartTimings', () => {
	beforeEach(() => {
		publishedDocs = []
	})

	it('lays the parts out one after the other', () => {
		publishedDocs = [
			makeDoc(FIRST_PART_ID, 0, countUp(5000, null)),
			makeDoc(SECOND_PART_ID, 1, countUp(3000, null)),
		]

		const { result } = renderCountingRenders()

		expect(result.current.get(FIRST_PART_ID)).toMatchObject({ displayStartsAt: 0, displayDuration: 5000 })
		expect(result.current.get(SECOND_PART_ID)).toMatchObject({ displayStartsAt: 5000, displayDuration: 3000 })
	})

	it('does not re-render a segment whose parts all hold their values, however many ticks pass', () => {
		publishedDocs = [
			makeDoc(FIRST_PART_ID, 0, countUp(5000, null)),
			makeDoc(SECOND_PART_ID, 1, countUp(3000, null)),
		]

		const { result, renders } = renderCountingRenders()
		const rendersBeforeTicks = renders.count

		dispatchHighResolutionTicks(60, NOW + 16)

		expect(renders.count - rendersBeforeTicks).toBe(0)
		expect(result.current.get(SECOND_PART_ID)).toMatchObject({ displayStartsAt: 5000, displayDuration: 3000 })
	})

	it('re-renders the segment holding the on-air part on every high-resolution tick, growing it as it overruns', () => {
		// the first part is on air and overruns its 5s from 99000 on, so it is already 1s over
		publishedDocs = [
			makeDoc(FIRST_PART_ID, 0, countUp(5000, 99000)),
			makeDoc(SECOND_PART_ID, 1, countUp(3000, null)),
		]

		const { result, renders } = renderCountingRenders()
		expect(result.current.get(FIRST_PART_ID)).toMatchObject({ displayDuration: 6000 })
		const rendersBeforeTicks = renders.count

		dispatchHighResolutionTicks(60, NOW + 16)

		expect(renders.count - rendersBeforeTicks).toBe(60)
		// the last tick was at 100960, so it has grown by as much, and pushed the next part along with it
		expect(result.current.get(FIRST_PART_ID)).toMatchObject({ displayDuration: 6960 })
		expect(result.current.get(SECOND_PART_ID)).toMatchObject({ displayStartsAt: 6960, displayDuration: 3000 })
	})

	it('hands out the same timings for as long as nothing in them has changed', () => {
		publishedDocs = [makeDoc(FIRST_PART_ID, 0, countUp(5000, null))]

		const { result, rerender } = renderCountingRenders()
		const firstTimings = result.current

		rerender()

		expect(result.current).toBe(firstTimings)
	})
})
