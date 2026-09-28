/**
 * Captured at module load, which is always before a test body can install `jest.useFakeTimers()`.
 */
const realSetTimeout = setTimeout

/** Wait for time to pass ( unaffected by jest.useFakeTimers() ) */
export async function sleepNoFakeTimers(time: number): Promise<void> {
	return new Promise<void>((resolve) => realSetTimeout(resolve, time))
}
