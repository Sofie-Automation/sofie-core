import { runOnAbort } from './observerLifetime'

export interface Debounced<TArgs extends unknown[]> {
	(...args: TArgs): void
	/** Discard a pending invocation without running it */
	cancel(): void
}

/**
 * Trailing-edge debounce of `fn`, for the lifetime of `signal`: the call is made `wait` ms after the
 * last invocation, with that last invocation's arguments. Once the signal aborts, a pending call is
 * discarded and further invocations are ignored.
 *
 * Prefer this to a bare `_.debounce` for anything with a lifetime - it removes the need to both guard
 * the body against a stopped observer and remember to cancel the timer on teardown. It is also driven
 * purely by `setTimeout`, unlike underscore's debounce, which compares against a `Date.now` captured
 * at module load and so never fires under jest's fake timers.
 */
export function createDebounce<TArgs extends unknown[]>(
	fn: (...args: TArgs) => void,
	wait: number,
	signal: AbortSignal
): Debounced<TArgs> {
	let timeout: NodeJS.Timeout | undefined
	let latestArgs: TArgs | undefined

	const cancel = () => {
		if (timeout) {
			clearTimeout(timeout)
			timeout = undefined
		}
		latestArgs = undefined
	}

	const debounced = (...args: TArgs): void => {
		if (signal.aborted) return

		latestArgs = args

		if (timeout) clearTimeout(timeout)
		timeout = setTimeout(() => {
			timeout = undefined

			const args = latestArgs
			latestArgs = undefined

			// The signal may have aborted while this invocation was waiting out the debounce
			if (signal.aborted || !args) return
			fn(...args)
		}, wait)
	}
	debounced.cancel = cancel

	runOnAbort(signal, cancel)

	return debounced
}
