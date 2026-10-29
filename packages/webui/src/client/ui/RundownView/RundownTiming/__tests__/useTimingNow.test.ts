import { useLayoutEffect } from 'react'
import { renderHook, act } from '@testing-library/react'

/** What the mocked system clock reads */
let currentTime = 100000

jest.mock('../../../../lib/systemTime.js', () => ({
	getCurrentTime: () => currentTime,
}))

import { useTimingNow } from '../usePlaylistTimingValue.js'
import { RundownTiming, TimingTickResolution } from '../RundownTiming.js'

/** Dispatch one tick of every resolution, as RundownTimingProvider does on a full second */
function dispatchEveryTick(tickTime: number): void {
	act(() => {
		for (const event of Object.values<RundownTiming.Events>(RundownTiming.Events)) {
			window.dispatchEvent(new CustomEvent(event, { detail: { currentTime: tickTime } }))
		}
	})
}

describe('useTimingNow', () => {
	beforeEach(() => {
		currentTime = 100000
	})

	it('moves to the time of each tick', () => {
		const { result } = renderHook(() => useTimingNow(TimingTickResolution.High))
		expect(result.current).toBe(100000)

		dispatchEveryTick(101000)

		expect(result.current).toBe(101000)
	})

	it('is not re-rendered by any tick when it is not to tick at all', () => {
		let renders = 0
		const { result } = renderHook(() => {
			renders++
			return useTimingNow(TimingTickResolution.None)
		})
		const rendersBeforeTicks = renders

		dispatchEveryTick(101000)
		dispatchEveryTick(102000)

		expect(renders - rendersBeforeTicks).toBe(0)
		expect(result.current).toBe(100000)
	})

	it('takes the current time straight away when it starts ticking, rather than the time it last had', () => {
		/** The time the caller was drawn with, each time it was drawn */
		const drawnTimes: number[] = []
		const { rerender } = renderHook(
			({ tickResolution }: { tickResolution: TimingTickResolution }) => {
				const now = useTimingNow(tickResolution)
				useLayoutEffect(() => {
					drawnTimes.push(now)
				})
				return now
			},
			{ initialProps: { tickResolution: TimingTickResolution.None } }
		)
		expect(drawnTimes).toEqual([100000])

		// a minute later, before any tick has arrived for the new rate
		currentTime = 160000
		rerender({ tickResolution: TimingTickResolution.High })

		expect(drawnTimes).toEqual([100000, 160000])
	})
})
