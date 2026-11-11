import { testWithAbort } from '../testWithAbort'

describe('testWithAbort', () => {
	let previousSignal: AbortSignal | undefined

	testWithAbort('provides a signal which is live during the test', ({ signal }) => {
		expect(signal.aborted).toBe(false)
		previousSignal = signal
	})

	test('the signal of the previous test has been aborted', () => {
		expect(previousSignal?.aborted).toBe(true)
	})

	testWithAbort('each test gets its own signal', async ({ signal }) => {
		expect(signal).not.toBe(previousSignal)
		await Promise.resolve()
		expect(signal.aborted).toBe(false)
	})
})
