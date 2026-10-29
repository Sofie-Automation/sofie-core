import { render, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { SourceLayerType } from '@sofie-automation/blueprints-integration'
import type { PartInstanceId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'

const NOW = 100000
/** What the mocked system clock reads */
let currentTime = NOW

// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
	useSubscription: () => true,
}))
jest.mock('../../../lib/systemTime.js', () => ({
	getCurrentTime: () => currentTime,
}))
// a clip of 12.5 s from the start of the part
jest.mock('../ClockViewPieceIcons/utils.js', () => ({
	findPieceInstanceToShow: () => ({
		pieceInstance: { piece: { content: { sourceDuration: 12500, seek: 0 }, enable: { start: 0 } } },
		sourceLayer: { type: SourceLayerType.VT },
	}),
}))

import { PieceFreezeContainer } from '../ClockViewPieceIcons/ClockViewFreezeCount.js'
import { RundownTiming } from '../../RundownView/RundownTiming/RundownTiming.js'

/** Move the clock on, and send the high-resolution tick that RundownTimingProvider sends on each frame */
function advanceClockTo(time: number): void {
	currentTime = time
	act(() => {
		window.dispatchEvent(
			new CustomEvent(RundownTiming.Events.timeupdateHighResolution, { detail: { currentTime: time } })
		)
	})
}

describe('PieceFreezeContainer', () => {
	beforeEach(() => {
		currentTime = NOW
	})

	it('counts down to the freeze as the clock moves, at its own second', () => {
		// the part started now and is planned for 10 s, so the 12.5 s clip freezes in 12.5 s
		const { container } = render(
			<PieceFreezeContainer
				partInstanceId={protectString<PartInstanceId>('partInstance0')}
				rundownIds={[]}
				showStyleBaseId={protectString<ShowStyleBaseId>('showStyleBase0')}
				playlistActivationId={undefined}
				partExpectedDuration={10000}
				partStartedPlayback={NOW}
				partAutoNext={false}
			/>
		)
		expect(container.textContent).toBe('00:13')

		// 11.9 s to the freeze
		advanceClockTo(NOW + 600)
		expect(container.textContent).toBe('00:12')
	})
})
