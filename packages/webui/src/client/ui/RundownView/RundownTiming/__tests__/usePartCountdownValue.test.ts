import { renderHook, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { PartId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import {
	getPartTimingStateDocId,
	getPlaylistTimingStateDocId,
	type PartTimingStateDoc,
	type PlaylistTimingStateDoc,
	type TimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const SEGMENT_ID = protectString<SegmentId>('segment0')
const PART_ID = protectString<PartId>('part0')
const NOW = 100000

/** What the mocked system clock reads */
let currentTime = NOW

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

import { TimerValueMode, usePartCountdownValue } from '../usePlaylistTimingValue.js'
import { RundownTiming, TimingTickResolution } from '../RundownTiming.js'

/** Publish the playlist's document, with this base for the part countdowns */
function publishPlaylist(partCountdownBase: TimerState): void {
	const doc: PlaylistTimingStateDoc = {
		_id: getPlaylistTimingStateDocId(PLAYLIST_ID),
		type: 'playlist',
		playlistId: PLAYLIST_ID,
		timingType: PlaylistTimingType.ForwardTime,
		currentPartWillAutoNext: false,
		partCountdownBase,
	}
	publishedDocs.set(doc._id, doc)
}

/** Publish the part's document, with this countdown offset, or without one */
function publishPart(countdownOffset: number | undefined): void {
	const doc: PartTimingStateDoc = {
		_id: getPartTimingStateDocId(PART_ID),
		type: 'part',
		playlistId: PLAYLIST_ID,
		segmentId: SEGMENT_ID,
		partId: PART_ID,
		rank: 0,
		isInQuickLoop: false,
		countsTowardsTiming: true,
		untimed: false,
		orphaned: false,
		expectedDuration: { paused: true, duration: 10000 },
	}
	if (countdownOffset !== undefined) doc.countdownOffset = countdownOffset
	publishedDocs.set(doc._id, doc)
}

/** Move the clock on, and send the high-resolution tick that RundownTimingProvider sends on each frame */
function tick(time: number): void {
	currentTime = time
	act(() => {
		window.dispatchEvent(
			new CustomEvent(RundownTiming.Events.timeupdateHighResolution, { detail: { currentTime: time } })
		)
	})
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

/**
 * Read the countdown on every high-resolution tick while it moves and on no tick while it holds, counting how many
 * times the caller is rendered
 */
function renderHighResolutionOnlyWhileMoving(mode: TimerValueMode) {
	const renders = { count: 0 }
	const hook = renderHook(() => {
		renders.count++
		return usePartCountdownValue(PART_ID, mode, {
			tickResolution: TimingTickResolution.High,
			tickResolutionWhileHolding: TimingTickResolution.None,
		})
	})
	return { ...hook, renders }
}

describe('usePartCountdownValue', () => {
	beforeEach(() => {
		publishedDocs.clear()
		currentTime = NOW
	})

	it('returns null when nothing is published for the part', () => {
		publishPlaylist({ paused: true, duration: 60000 })

		const { result } = renderHook(() => usePartCountdownValue(PART_ID, TimerValueMode.Duration))

		expect(result.current).toBeNull()
	})

	it('returns null when the part has no countdown offset, meaning it will not be played in order', () => {
		publishPlaylist({ paused: true, duration: 60000 })
		publishPart(undefined)

		const { result } = renderHook(() => usePartCountdownValue(PART_ID, TimerValueMode.Duration))

		expect(result.current).toBeNull()
	})

	it('returns null when nothing is published for the playlist', () => {
		publishPart(-30000)

		const { result } = renderHook(() => usePartCountdownValue(PART_ID, TimerValueMode.Duration))

		expect(result.current).toBeNull()
	})

	it('counts down the base shifted by the offset, holding once the on-air part overruns', () => {
		// the end of the last part is 60s away, the part 30s before that, and the on-air part is due to end at 130000
		publishPlaylist({ paused: false, zeroTime: 160000, pauseTime: 130000 })
		publishPart(-30000)

		const { result } = renderHook(() => usePartCountdownValue(PART_ID, TimerValueMode.Duration))
		expect(result.current).toBe(30000)

		tick(120000)
		expect(result.current).toBe(10000)

		// once the on-air part is overrunning, the countdown cannot fall any further
		tick(140000)
		expect(result.current).toBe(0)
	})

	it('reads it as a timestamp', () => {
		publishPlaylist({ paused: false, zeroTime: 160000 })
		publishPart(-30000)

		const { result } = renderHook(() => usePartCountdownValue(PART_ID, TimerValueMode.Timestamp))

		expect(result.current).toBe(130000)
	})

	it('follows the base when only the playlist document changes', () => {
		publishPlaylist({ paused: true, duration: 60000 })
		publishPart(-30000)

		const { result, rerender } = renderHook(() => usePartCountdownValue(PART_ID, TimerValueMode.Duration))
		expect(result.current).toBe(30000)

		// a take: the base starts running, and the part's document is not sent again
		publishPlaylist({ paused: false, zeroTime: NOW + 50000 })
		rerender()
		expect(result.current).toBe(20000)
	})

	describe('with no ticks while the countdown holds', () => {
		it('is not re-rendered by any tick while the countdown holds its value', () => {
			publishPlaylist({ paused: true, duration: 60000 })
			publishPart(-30000)

			const { result, renders } = renderHighResolutionOnlyWhileMoving(TimerValueMode.Duration)
			const rendersBeforeTicks = renders.count

			dispatchHighResolutionTicks(60, NOW + 16)

			expect(renders.count - rendersBeforeTicks).toBe(0)
			expect(result.current).toBe(30000)
		})

		it('is re-rendered on every tick while the countdown moves', () => {
			publishPlaylist({ paused: false, zeroTime: NOW + 60000 })
			publishPart(-30000)

			const { result, renders } = renderHighResolutionOnlyWhileMoving(TimerValueMode.Duration)
			const rendersBeforeTicks = renders.count

			dispatchHighResolutionTicks(60, NOW + 16)

			expect(renders.count - rendersBeforeTicks).toBe(60)
			// the last tick was at 100960
			expect(result.current).toBe(30000 - 960)
		})

		it('keeps ticking for a timestamp, since the moment a countdown that holds would reach zero moves with the clock', () => {
			// holding at 30s to go, so it reaches zero 30s after whenever it is read
			publishPlaylist({ paused: true, duration: 60000 })
			publishPart(-30000)

			const { result, renders } = renderHighResolutionOnlyWhileMoving(TimerValueMode.Timestamp)
			const rendersBeforeTicks = renders.count

			dispatchHighResolutionTicks(60, NOW + 16)

			expect(renders.count - rendersBeforeTicks).toBe(60)
			// the last tick was at 100960
			expect(result.current).toBe(100960 + 30000)
		})
	})

	it('ignores a document of another type sharing the collection', () => {
		publishPlaylist({ paused: true, duration: 60000 })
		publishPart(-30000)
		const partDoc = publishedDocs.get(getPartTimingStateDocId(PART_ID))
		publishedDocs.set(getPartTimingStateDocId(PART_ID), { ...partDoc, type: 'segment' } as TimingStateDoc)

		const { result } = renderHook(() => usePartCountdownValue(PART_ID, TimerValueMode.Duration))

		expect(result.current).toBeNull()
	})
})
