import { createDebounce } from '../debounce'

describe('createDebounce', () => {
	beforeEach(() => {
		jest.useFakeTimers()
	})

	test('invokes once the wait has elapsed, with the latest arguments', async () => {
		const abort = new AbortController()
		const fn = jest.fn()
		const debounced = createDebounce(fn, 10, abort.signal)

		debounced('a')
		debounced('b')
		expect(fn).toHaveBeenCalledTimes(0)

		await jest.advanceTimersByTimeAsync(20)
		expect(fn).toHaveBeenCalledTimes(1)
		expect(fn).toHaveBeenCalledWith('b')
	})

	test('aborting the signal discards a pending invocation', async () => {
		const abort = new AbortController()
		const fn = jest.fn()
		const debounced = createDebounce(fn, 10, abort.signal)

		debounced()
		abort.abort()

		await jest.advanceTimersByTimeAsync(50)
		expect(fn).toHaveBeenCalledTimes(0)
	})

	test('calling after the signal has aborted does nothing', async () => {
		const abort = new AbortController()
		abort.abort()

		const fn = jest.fn()
		const debounced = createDebounce(fn, 10, abort.signal)

		debounced()

		await jest.advanceTimersByTimeAsync(50)
		expect(fn).toHaveBeenCalledTimes(0)
	})
})
