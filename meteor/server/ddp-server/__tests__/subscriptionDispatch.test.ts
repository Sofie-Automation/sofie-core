import { isCursorLike } from '../subscriptionDispatch'

describe('isCursorLike', () => {
	test('detects a cursor by observeChangesAsync', () => {
		expect(isCursorLike({ observeChangesAsync: () => undefined })).toBe(true)
	})

	test('is false for plain objects and non-objects', () => {
		expect(isCursorLike({})).toBe(false)
		expect(isCursorLike({ observeChangesAsync: 'not a function' })).toBe(false)
		expect(isCursorLike(null)).toBe(false)
		expect(isCursorLike(undefined)).toBe(false)
		expect(isCursorLike('string')).toBe(false)
		expect(isCursorLike(42)).toBe(false)
		expect(isCursorLike([])).toBe(false)
	})
})
