import { render, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { PartId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	getPartTimingStateDocId,
	type PartTimingStateDoc,
	type TimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import type { PartUi } from '../../../SegmentTimeline/SegmentTimelineContainer.js'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const PART_ID = protectString<PartId>('part0')

/** The part started 70 ms after a full second of the clock */
const PART_START = 100070
/** The part's expected duration: 10 s */
const PART_EXPECTED_DURATION = 10000

/** What the mocked system clock reads */
let currentTime = PART_START

/** The documents the mocked collection holds, by id */
const publishedDocs = new Map<unknown, TimingStateDoc>()

jest.mock('../../../Collections.js', () => ({
	PlaylistTimingStates: {
		findOne: (id: unknown) => publishedDocs.get(id),
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../../lib/systemTime.js', () => ({
	getCurrentTime: () => currentTime,
}))

import { PartDisplayDuration } from '../PartDuration.js'
import { RundownTiming } from '../RundownTiming.js'

const ON_AIR_PART_DOC: PartTimingStateDoc = {
	_id: getPartTimingStateDocId(PART_ID),
	type: 'part',
	playlistId: PLAYLIST_ID,
	segmentId: protectString<SegmentId>('segment0'),
	partId: PART_ID,
	rank: 0,
	isInQuickLoop: false,
	countsTowardsTiming: true,
	untimed: false,
	orphaned: false,
	expectedDuration: { paused: true, duration: PART_EXPECTED_DURATION },
	// on air since PART_START, counting up as a negative value
	played: { paused: false, zeroTime: PART_START },
}

/** Move the clock on, and send the high-resolution tick that RundownTimingProvider sends on each frame */
function advanceClockTo(time: number): void {
	currentTime = time
	act(() => {
		window.dispatchEvent(
			new CustomEvent(RundownTiming.Events.timeupdateHighResolution, { detail: { currentTime: time } })
		)
	})
}

function renderPartDuration(countUp?: boolean): HTMLElement | null {
	const part = { instance: { part: { _id: PART_ID, untimed: false }, orphaned: undefined } } as unknown as PartUi
	const { container } = render(<PartDisplayDuration part={part} countUp={countUp} />)
	return container.querySelector<HTMLElement>('[role="timer"]')
}

describe('PartDisplayDuration', () => {
	beforeEach(() => {
		currentTime = PART_START
		publishedDocs.clear()
		publishedDocs.set(ON_AIR_PART_DOC._id, ON_AIR_PART_DOC)
	})

	it('rounds the time left up, and the overrun down, so it shows 00:00 for the first second past zero', () => {
		const timer = renderPartDuration()

		// 0.5 s left
		advanceClockTo(PART_START + PART_EXPECTED_DURATION - 500)
		expect(timer?.textContent).toBe('00:01')

		// 0.5 s past the end
		advanceClockTo(PART_START + PART_EXPECTED_DURATION + 500)
		expect(timer?.textContent).toBe('00:00')

		// 1.5 s past the end
		advanceClockTo(PART_START + PART_EXPECTED_DURATION + 1500)
		expect(timer?.textContent).toBe('+00:01')
	})

	it('rounds the played time down when it counts up, as a stopwatch does', () => {
		const timer = renderPartDuration(true)
		expect(timer?.textContent).toBe('00:00')

		advanceClockTo(PART_START + 1500)
		expect(timer?.textContent).toBe('00:01')
	})

	it('with a length that is not a whole number of seconds, changes at the moment its own second changes', () => {
		publishedDocs.set(ON_AIR_PART_DOC._id, { ...ON_AIR_PART_DOC, expectedDuration: { paused: true, duration: 10500 } })
		const timer = renderPartDuration()
		expect(timer?.textContent).toBe('00:11')

		// 8.9 s left: the shown second changed at 1.5 s played, not at the next whole second of the played time
		advanceClockTo(PART_START + 1100)
		expect(timer?.textContent).toBe('00:10')
		advanceClockTo(PART_START + 1600)
		expect(timer?.textContent).toBe('00:09')
	})
})
