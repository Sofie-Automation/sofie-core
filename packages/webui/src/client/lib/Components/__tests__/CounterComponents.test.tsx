import { render } from '@testing-library/react'

// The countdown's stylesheet cannot load in Jest, so draw the countdown as its text
jest.mock('../../../ui/RundownView/RundownHeader/Countdown.js', () => ({
	Countdown: ({ children }: { children?: unknown }) =>
		jest.requireActual('react').createElement('span', null, children),
}))

import { TimeToFromPlannedEndComponent } from '../CounterComponents.js'

describe('TimeToFromPlannedEndComponent', () => {
	it('shows the time left in its last 0.1 s as 00:01, with no plus', () => {
		// the value is the time since the planned end: 50 ms before it
		const { container } = render(<TimeToFromPlannedEndComponent value={-50} />)
		expect(container.textContent).toBe('00:01')
	})

	it('shows +00:00 from the planned end on', () => {
		const { container } = render(<TimeToFromPlannedEndComponent value={500} />)
		expect(container.textContent).toBe('+00:00')
	})
})
