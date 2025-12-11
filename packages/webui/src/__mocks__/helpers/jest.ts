const orgSetTimeout = setTimeout
const DateOrg = Date
export async function runAllTimers(): Promise<void> {
	// Run all timers, and wait, multiple times.
	// This is to allow timers AND internal promises to resolve in inner functions
	for (let i = 0; i < 10; i++) {
		jest.runOnlyPendingTimers()
		await new Promise((resolve) => orgSetTimeout(resolve, 0))
	}
}

export async function runTimersUntilNow(): Promise<void> {
	// Run all timers, and wait, multiple times.
	// This is to allow timers AND internal promises to resolve in inner functions
	for (let i = 0; i < 50; i++) {
		jest.advanceTimersByTime(0)
		await new Promise((resolve) => orgSetTimeout(resolve, 0))
	}
}

/** Returns a Promise that resolves after a specified number of milliseconds */
export async function waitTime(ms: number): Promise<void> {
	return new Promise((resolve) => orgSetTimeout(resolve, ms))
}

/**
 * Executes {expectFcn} intermittently until it doesn't throw anymore.
 * Waits up to {maxWaitTime} ms, then throws the latest error.
 * Useful in unit-tests as a way to wait until a predicate is fulfilled.
 * Example usage:
 * ```
 * const myArray = []
 * asynchoronouslyPopulateArray(myArray)
 * await waitUntil(() => {
 *   expect(myArray).toHaveLength(42)
 * }, 500)
 * ```
 */
export async function waitUntil(expectFcn: () => void | Promise<void>, maxWaitTime: number): Promise<void> {
	/** How often to check expectFcn() */
	const iterateInterval = maxWaitTime < 100 ? 10 : 100

	const startTime = Date.now()
	while (true) {
		await waitTime(iterateInterval)
		try {
			await expectFcn()
			return
		} catch (err) {
			const waitedTime = DateOrg.now() - startTime
			if (waitedTime > maxWaitTime) throw err
			// else ignore error and try again later
		}
	}
}
