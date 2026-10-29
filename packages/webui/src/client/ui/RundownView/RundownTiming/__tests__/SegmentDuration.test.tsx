import { render, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import {
	getSegmentTimingStateDocId,
	type SegmentTimingStateDoc,
	type TimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { CountdownType } from '@sofie-automation/blueprints-integration'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const SEGMENT_ID = protectString<SegmentId>('segment0')

/** What the mocked system clock reads */
let currentTime = 129000

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

import { SegmentDuration } from '../SegmentDuration.js'
import { RundownTiming } from '../RundownTiming.js'

/** The moment the on-air segment's remaining time reaches zero: 60 ms past a whole second */
const SEGMENT_ZERO_TIME = 130060

const ON_AIR_SEGMENT_DOC: SegmentTimingStateDoc = {
	_id: getSegmentTimingStateDocId(SEGMENT_ID),
	type: 'segment',
	playlistId: PLAYLIST_ID,
	segmentId: SEGMENT_ID,
	countdownType: CountdownType.PART_EXPECTED_DURATION,
	plannedDuration: { paused: true, duration: 30000 },
	// on air since 30 s before its zero, counting up as a negative value
	playedOut: { paused: false, zeroTime: SEGMENT_ZERO_TIME - 30000 },
	remaining: { paused: false, zeroTime: SEGMENT_ZERO_TIME },
}

/** Dispatch a timing tick, as RundownTimingProvider does */
function dispatchTick(event: RundownTiming.Events, tickTime: number): void {
	act(() => {
		window.dispatchEvent(new CustomEvent(event, { detail: { currentTime: tickTime } }))
	})
}

/** Move the clock on, and send the high-resolution tick that RundownTimingProvider sends on each frame */
function advanceClockTo(time: number): void {
	currentTime = time
	dispatchTick(RundownTiming.Events.timeupdateHighResolution, time)
}

function renderSegmentDuration(countUp?: boolean): HTMLElement | null {
	const segment = { _id: SEGMENT_ID } as DBSegment
	const { container } = render(<SegmentDuration segment={segment} parts={[]} countUp={countUp} />)
	return container.querySelector<HTMLElement>('[role="timer"]')
}

describe('SegmentDuration', () => {
	beforeEach(() => {
		currentTime = 129000
		publishedDocs.clear()
		publishedDocs.set(ON_AIR_SEGMENT_DOC._id, ON_AIR_SEGMENT_DOC)
	})

	it('changes at the moment its own whole second changes, and shows 00:00 for the first second past zero', () => {
		// 1.06 s left
		const timer = renderSegmentDuration()
		expect(timer?.textContent).toBe('00:02')

		// still more than 1 s left
		advanceClockTo(129050)
		expect(timer?.textContent).toBe('00:02')

		// 1 s before the zero, which is 60 ms past the full second of the clock
		advanceClockTo(129061)
		expect(timer?.textContent).toBe('00:01')

		// the full second of the clock does not change it
		dispatchTick(RundownTiming.Events.timeupdateSynced, 130000)
		advanceClockTo(130003)
		expect(timer?.textContent).toBe('00:01')

		// past the zero: the overrun rounds down, so it shows 00:00 for the first second, not +00:01
		advanceClockTo(130061)
		expect(timer?.textContent).toBe('00:00')
		advanceClockTo(130983)
		expect(timer?.textContent).toBe('00:00')

		// one second past the zero
		advanceClockTo(131061)
		expect(timer?.textContent).toBe('+00:01')
	})

	it('rounds the played time down when it counts up, as a stopwatch does', () => {
		// on air since 30 s before its zero: 28.94 s played
		const timer = renderSegmentDuration(true)
		expect(timer?.textContent).toBe('00:28')

		// 29.5 s played
		advanceClockTo(SEGMENT_ZERO_TIME - 30000 + 29500)
		expect(timer?.textContent).toBe('00:29')
	})
})
