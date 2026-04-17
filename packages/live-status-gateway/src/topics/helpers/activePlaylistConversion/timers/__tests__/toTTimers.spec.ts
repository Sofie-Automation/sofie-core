import { toTTimers } from '../toTTimers.js'

type TimerInput = {
	index: 1 | 2 | 3
	label: string
	mode: any
	state: any
	projectedState?: any
	anchorPartId?: any
}

function makeTimer(index: 1 | 2 | 3, overrides: Partial<TimerInput> = {}): TimerInput {
	return {
		index,
		label: `Timer ${index}`,
		mode: null,
		state: null,
		...overrides,
	}
}

describe('toTTimers', () => {
	it('returns 3 empty timers for nullish/empty input', () => {
		expect(toTTimers(undefined)).toMatchObject([{ index: 1 }, { index: 2 }, { index: 3 }])
		expect(toTTimers(null)).toMatchObject([{ index: 1 }, { index: 2 }, { index: 3 }])
		expect(toTTimers([])).toMatchObject([{ index: 1 }, { index: 2 }, { index: 3 }])
	})

	it('does not throw for length 1 or 2 and places by index', () => {
		expect(() => toTTimers([makeTimer(2)] as any)).not.toThrow()
		expect(toTTimers([makeTimer(2)] as any).map((t) => t.index)).toEqual([1, 2, 3])

		expect(() => toTTimers([makeTimer(1), makeTimer(3)] as any)).not.toThrow()
		expect(toTTimers([makeTimer(1), makeTimer(3)] as any).map((t) => t.label)).toEqual(['Timer 1', '', 'Timer 3'])
	})

	it('is index-aware (out-of-order input lands in correct slots)', () => {
		const result = toTTimers([makeTimer(3), makeTimer(1)] as any)
		expect(result.map((t) => t.label)).toEqual(['Timer 1', '', 'Timer 3'])
	})

	it('uses first timer when duplicate indices occur', () => {
		const result = toTTimers([makeTimer(2, { label: 'First' }), makeTimer(2, { label: 'Second' })] as any)
		expect(result[1].label).toBe('First')
	})

	it('ignores invalid indices', () => {
		const result = toTTimers([{ ...makeTimer(1), index: 4 } as any, makeTimer(1)] as any)
		expect(result.map((t) => t.label)).toEqual(['Timer 1', '', ''])
	})
})
