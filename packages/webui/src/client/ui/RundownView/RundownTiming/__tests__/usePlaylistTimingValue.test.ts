import { renderHook, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	getPlaylistTimingStateDocId,
	type PlaylistTimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const NOW = 100000

/** The document the mocked collection will return */
let publishedDoc: PlaylistTimingStateDoc | undefined
/** What the mocked system clock reads */
let currentTime = NOW

jest.mock('../../../Collections.js', () => ({
	PlaylistTimingStates: {
		findOne: (id: unknown) => (publishedDoc && publishedDoc._id === id ? publishedDoc : undefined),
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../../lib/systemTime.js', () => ({
	getCurrentTime: () => currentTime,
}))

import { TimerValueMode, usePlaylistTimingValue } from '../usePlaylistTimingValue.js'
import { RundownTiming, TimingTickResolution } from '../RundownTiming.js'

function makeDoc(fields: Partial<PlaylistTimingStateDoc>): PlaylistTimingStateDoc {
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

describe('usePlaylistTimingValue', () => {
	beforeEach(() => {
		publishedDoc = undefined
		currentTime = NOW
	})

	it('returns null when nothing is published for the playlist', () => {
		const { result } = renderHook(() => usePlaylistTimingValue(PLAYLIST_ID, 'plannedEnd', TimerValueMode.Timestamp))

		expect(result.current).toBeNull()
	})

	it('returns null when the document omits the requested timer', () => {
		publishedDoc = makeDoc({ plannedStart: { paused: false, zeroTime: 120000 } })

		const { result } = renderHook(() => usePlaylistTimingValue(PLAYLIST_ID, 'plannedEnd', TimerValueMode.Timestamp))

		expect(result.current).toBeNull()
	})

	it('reads a timer as a timestamp', () => {
		publishedDoc = makeDoc({ plannedEnd: { paused: false, zeroTime: 160000 } })

		const { result } = renderHook(() => usePlaylistTimingValue(PLAYLIST_ID, 'plannedEnd', TimerValueMode.Timestamp))

		expect(result.current).toBe(160000)
	})

	it('reads the same timer as a duration', () => {
		publishedDoc = makeDoc({ plannedEnd: { paused: false, zeroTime: 160000 } })

		const { result } = renderHook(() => usePlaylistTimingValue(PLAYLIST_ID, 'plannedEnd', TimerValueMode.Duration))

		// 60s from NOW until it reaches zero
		expect(result.current).toBe(60000)
	})

	it('recomputes as the clock moves, so a countdown advances without a new document', () => {
		publishedDoc = makeDoc({ remainingDuration: { paused: false, zeroTime: 160000 } })

		const { result } = renderHook(() =>
			usePlaylistTimingValue(PLAYLIST_ID, 'remainingDuration', TimerValueMode.Duration)
		)
		expect(result.current).toBe(60000)

		advanceClockTo(NOW + 10000)
		expect(result.current).toBe(50000)

		advanceClockTo(NOW + 25000)
		expect(result.current).toBe(35000)
	})

	it("is drawn again at the moment the value's own whole second changes, not at the full second of the clock", () => {
		// a part started 70 ms after a full second, so its countdown reaches each whole second 70 ms after one too
		publishedDoc = makeDoc({ remainingOnCurrentPart: { paused: false, zeroTime: 120070 } })

		let renders = 0
		const { result } = renderHook(() => {
			renders++
			return usePlaylistTimingValue(PLAYLIST_ID, 'remainingOnCurrentPart', TimerValueMode.Duration)
		})
		expect(result.current).toBe(20070)
		const rendersAtStart = renders

		// the full second of the clock: the value is still in the same whole second, so nothing is drawn
		dispatchTick(RundownTiming.Events.timeupdateSynced, NOW + 1000)
		advanceClockTo(NOW + 50)
		expect(renders).toBe(rendersAtStart)

		// 70 ms past the full second, the value reaches 20 s, and it is drawn again at once
		advanceClockTo(NOW + 71)
		expect(renders).toBe(rendersAtStart + 1)
		expect(result.current).toBe(19999)

		// the rest of that second leaves it as it is
		advanceClockTo(NOW + 1050)
		expect(renders).toBe(rendersAtStart + 1)

		advanceClockTo(NOW + 1071)
		expect(renders).toBe(rendersAtStart + 2)
		expect(result.current).toBe(18999)
	})

	it('is drawn again when a moving value stops exactly on a whole second', () => {
		// a countdown that stops at 20 s when the on-air part ends at 100570, as the time until a later segment does
		publishedDoc = makeDoc({
			remainingDuration: { paused: false, zeroTime: 120570, pauseTime: 100570 },
		})

		const { result } = renderHook(() =>
			usePlaylistTimingValue(PLAYLIST_ID, 'remainingDuration', TimerValueMode.Duration)
		)
		// 20.57 s: a display that rounds up shows 00:21
		expect(result.current).toBe(20570)

		// the value stops at exactly 20 s, so a display that rounds up must now show 00:20
		advanceClockTo(100600)
		expect(result.current).toBe(20000)

		// and it holds there
		advanceClockTo(105000)
		expect(result.current).toBe(20000)
	})

	it('reads a state that arrives between two ticks at the time it arrives, not at the time of an earlier tick', () => {
		// right after a take, the part waits to start, so its countdown holds at its planned length of 40 s
		publishedDoc = makeDoc({ remainingOnCurrentPart: { paused: true, duration: 40000 } })

		const { result, rerender } = renderHook(() =>
			usePlaylistTimingValue(PLAYLIST_ID, 'remainingOnCurrentPart', TimerValueMode.Duration)
		)
		expect(result.current).toBe(40000)

		// the part started 70 ms after the take, and the server publishes the running countdown 200 ms later
		currentTime = NOW + 270
		publishedDoc = makeDoc({ remainingOnCurrentPart: { paused: false, zeroTime: NOW + 70 + 40000 } })
		rerender()

		// 39.8 s are left, so it never shows more than the part's length
		expect(result.current).toBe(39800)
	})

	it('is not drawn again by the clock while the value holds', () => {
		publishedDoc = makeDoc({ remainingOnCurrentPart: { paused: true, duration: 40000 } })

		let renders = 0
		renderHook(() => {
			renders++
			return usePlaylistTimingValue(PLAYLIST_ID, 'remainingOnCurrentPart', TimerValueMode.Duration)
		})
		const rendersAtStart = renders

		advanceClockTo(NOW + 5000)
		dispatchTick(RundownTiming.Events.timeupdateSynced, NOW + 5000)
		advanceClockTo(NOW + 10000)

		expect(renders).toBe(rendersAtStart)
	})

	it('freezes at the breakpoint of a state that pauses', () => {
		// counts down to 160000, but freezes when the on-air part ends at 130000
		publishedDoc = makeDoc({
			remainingDuration: { paused: false, zeroTime: 160000, pauseTime: 130000 },
		})

		const { result } = renderHook(() =>
			usePlaylistTimingValue(PLAYLIST_ID, 'remainingDuration', TimerValueMode.Duration)
		)
		expect(result.current).toBe(60000)

		advanceClockTo(129000)
		expect(result.current).toBe(31000)

		// past the breakpoint it holds, however much time passes
		advanceClockTo(131000)
		expect(result.current).toBe(30000)
		advanceClockTo(200000)
		expect(result.current).toBe(30000)
	})

	it('subscribes to the requested tick resolution only', () => {
		publishedDoc = makeDoc({ remainingDuration: { paused: false, zeroTime: 160000 } })

		const { result } = renderHook(() =>
			usePlaylistTimingValue(PLAYLIST_ID, 'remainingDuration', TimerValueMode.Duration, {
				tickResolution: TimingTickResolution.High,
			})
		)

		// the synced tick is not the one it listens to
		dispatchTick(RundownTiming.Events.timeupdateSynced, NOW + 10000)
		expect(result.current).toBe(60000)

		dispatchTick(RundownTiming.Events.timeupdateHighResolution, NOW + 10000)
		expect(result.current).toBe(50000)
	})

	it('ignores a document for a different area of the union', () => {
		// a hypothetical future per-segment document sharing the collection
		publishedDoc = {
			...makeDoc({ plannedEnd: { paused: false, zeroTime: 160000 } }),
			type: 'segment' as unknown as 'playlist',
		}

		const { result } = renderHook(() => usePlaylistTimingValue(PLAYLIST_ID, 'plannedEnd', TimerValueMode.Timestamp))

		expect(result.current).toBeNull()
	})

	it('stops listening once unmounted', () => {
		publishedDoc = makeDoc({ remainingDuration: { paused: false, zeroTime: 160000 } })
		const removeSpy = jest.spyOn(window, 'removeEventListener')

		const { unmount } = renderHook(() =>
			usePlaylistTimingValue(PLAYLIST_ID, 'remainingDuration', TimerValueMode.Duration)
		)
		unmount()

		expect(removeSpy).toHaveBeenCalledWith(RundownTiming.Events.timeupdateHighResolution, expect.any(Function))
		removeSpy.mockRestore()
	})
})
