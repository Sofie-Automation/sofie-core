import { render, act } from '@testing-library/react'

const NOW = 100000
/** What the mocked system clock reads */
let currentTime = NOW

jest.mock('../../../lib/systemTime.js', () => ({
	getCurrentTime: () => currentTime,
}))
jest.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, options?: { time?: string }) => key.replace('{{time}}', options?.time ?? ''),
	}),
}))

import { MarkerCountdownText } from '../RundownDividerHeader.js'
import { RundownTiming } from '../RundownTiming/RundownTiming.js'

/** Move the clock on, and send the high-resolution tick that RundownTimingProvider sends on each frame */
function advanceClockTo(time: number): void {
	currentTime = time
	act(() => {
		window.dispatchEvent(
			new CustomEvent(RundownTiming.Events.timeupdateHighResolution, { detail: { currentTime: time } })
		)
	})
}

describe('MarkerCountdownText', () => {
	beforeEach(() => {
		currentTime = NOW
	})

	it('rounds the time until the marker up, and changes at its own second', () => {
		const { container } = render(<MarkerCountdownText markerTimestamp={NOW + 2500} />)
		expect(container.textContent).toBe('(in: 00:00:03)')

		// 1.9 s to go
		advanceClockTo(NOW + 600)
		expect(container.textContent).toBe('(in: 00:00:02)')
	})

	it('rounds the time since the marker down, as a stopwatch does', () => {
		// 1.5 s ago
		const { container } = render(<MarkerCountdownText markerTimestamp={NOW - 1500} />)
		expect(container.textContent).toBe('(–00:00:01 ago)')
	})
})
