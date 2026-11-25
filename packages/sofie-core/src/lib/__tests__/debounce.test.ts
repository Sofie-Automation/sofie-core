import { createDebounce } from '../debounce'
import { testWithAbort } from '../../__mocks__/helpers/testWithAbort'
import { createChildAbort } from '../observerLifetime'

describe('createDebounce', () => {
	beforeEach(() => {
		jest.useFakeTimers()
	})

	testWithAbort('invokes once the wait has elapsed, with the latest arguments', async ({ signal }) => {
		const abort = createChildAbort(signal)
		const fn = jest.fn()
		const debounced = createDebounce(fn, 10, abort.signal)

		debounced('a')
		debounced('b')
		expect(fn).toHaveBeenCalledTimes(0)

		await jest.advanceTimersByTimeAsync(20)
		expect(fn).toHaveBeenCalledTimes(1)
		expect(fn).toHaveBeenCalledWith('b')
	})

	testWithAbort('aborting the signal discards a pending invocation', async ({ signal }) => {
		const abort = createChildAbort(signal)
		const fn = jest.fn()
		const debounced = createDebounce(fn, 10, abort.signal)

		debounced()
		abort.abort()

		await jest.advanceTimersByTimeAsync(50)
		expect(fn).toHaveBeenCalledTimes(0)
	})

	testWithAbort('calling after the signal has aborted does nothing', async ({ signal }) => {
		const abort = createChildAbort(signal)
		abort.abort()

		const fn = jest.fn()
		const debounced = createDebounce(fn, 10, abort.signal)

		debounced()

		await jest.advanceTimersByTimeAsync(50)
		expect(fn).toHaveBeenCalledTimes(0)
	})
})
