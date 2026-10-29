import { render } from '@testing-library/react'

// The chip's stylesheet cannot load in Jest
jest.mock('../OverUnderChip.scss', () => ({}))

import { OverUnderChip } from '../OverUnderChip.js'

function chipText(valueMs: number): string | null {
	const { container } = render(<OverUnderChip valueMs={valueMs} format="playlistDiff" />)
	return container.textContent
}

describe('OverUnderChip', () => {
	it('rounds the time late down, as a time since does, so a moment late shows +00:00', () => {
		expect(chipText(300)).toBe('+00:00')
		expect(chipText(999)).toBe('+00:00')
		expect(chipText(1300)).toBe('+00:01')
		expect(chipText(65_400)).toBe('+01:05')
	})

	it('rounds the time early up, with 00:00 under 0.1 s', () => {
		expect(chipText(-50)).toBe('−00:00')
		expect(chipText(-300)).toBe('−00:01')
		expect(chipText(-1300)).toBe('−00:02')
	})
})
