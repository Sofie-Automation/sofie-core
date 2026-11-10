/**
 * The signals of the tests currently running in this file. Aborted in `afterEach` rather than when the test
 * body settles, as jest leaves a timed-out body running: this way the signal is aborted whether the test
 * passed, failed or timed out.
 */
const activeTestAborts = new Set<AbortController>()

afterEach(() => {
	for (const controller of activeTestAborts) controller.abort(new Error('Test has finished'))
	activeTestAborts.clear()
})

export interface TestWithAbortContext {
	/** Aborted once the test has finished, whether it passed, failed or timed out */
	signal: AbortSignal
}

/**
 * A `test` whose body is given an AbortSignal for its own lifetime, so that anything started on it (observers,
 * publications, debounces) is released when the test ends rather than leaking into the next one.
 *
 * This mirrors vitest's test context (`test(name, async ({ signal }) => ...)`), so moving to that is a rename.
 */
export function testWithAbort(
	name: string,
	fn: (context: TestWithAbortContext) => void | Promise<void>,
	timeout?: number
): void {
	test(
		name,
		async () => {
			const controller = new AbortController()
			activeTestAborts.add(controller)

			await fn({ signal: controller.signal })
		},
		timeout
	)
}
