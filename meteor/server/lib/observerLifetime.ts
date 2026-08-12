import { logger } from '../logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

/**
 * Utilities for AbortSignal based observer lifetimes.
 *
 * An observer's lifetime is expressed by the AbortSignal passed to it when it is started: when the
 * signal aborts, the observer stops. This makes cleanup compositional - aborting a parent signal
 * tears down every observer started under it, including ones started before a setup error was thrown.
 */

/**
 * A lifetime nested inside a longer one: it ends when its parent does, or when it is aborted
 * directly - whichever happens first. Use this for a scope shorter than its parent, such as a
 * restartable "generation" of observers inside a subscription.
 *
 * Structurally an AbortController, but not one: its signal is composed from two sources.
 */
export interface AbortScope {
	readonly signal: AbortSignal
	abort(reason?: unknown): void
}

/**
 * Create a lifetime nested inside `parent`.
 *
 * `AbortSignal.any` composes the two sources, rather than a hand-rolled `addEventListener` on the
 * parent, because the platform holds dependent signals weakly: a scope that is dropped without ever
 * being aborted can still be collected, instead of being pinned by a listener on a long-lived parent
 * until that parent aborts. Scopes are still expected to be aborted explicitly - that is how a scope
 * ends - this just means forgetting to is not a leak.
 */
export function createChildAbort(parent: AbortSignal): AbortScope {
	const self = new AbortController()

	return {
		signal: AbortSignal.any([parent, self.signal]),
		abort: (reason?: unknown) => self.abort(reason),
	}
}

/**
 * Run an observer setup bound to `signal`, with the standard lifetime semantics:
 *
 * - If the signal is already aborted, nothing is started and this resolves quietly.
 * - If the signal aborts while the setup is in flight, whatever was started is torn down and this
 *   resolves quietly - a subscription stopping mid-setup is a normal lifecycle event, not an error.
 * - If the setup genuinely fails, everything it started is torn down and the error is rethrown, so a
 *   rejection always means nothing was left running.
 *
 * The setup runs on a child signal, so cleanup after a failure cannot abort the caller's signal.
 */
export async function startObserveOnSignal(
	signal: AbortSignal,
	setup: (signal: AbortSignal) => Promise<void>
): Promise<void> {
	if (signal.aborted) return

	const child = createChildAbort(signal)
	try {
		await setup(child.signal)
	} catch (e) {
		child.abort() // Ensure everything started under the signal gets terminated
		// A failure caused by the lifetime ending is not an error worth propagating
		if (signal.aborted) return
		throw e
	}
}

/**
 * Run a cleanup function when `signal` aborts, or immediately if it already has - the signal may have
 * aborted while the caller was awaiting whatever the cleanup releases.
 *
 * Errors thrown by the cleanup are logged rather than propagated, so one failure cannot prevent the
 * rest of a teardown from running.
 */
export function runOnAbort(signal: AbortSignal, cleanup: () => void | Promise<void>): void {
	if (signal.aborted) {
		runIgnoringErrors(cleanup)
	} else {
		signal.addEventListener('abort', () => runIgnoringErrors(cleanup), { once: true })
	}
}

function runIgnoringErrors(cleanup: () => void | Promise<void>): void {
	try {
		const res = cleanup()
		if (res && typeof res.catch === 'function') {
			res.catch((e) => logger.error(`Error during observer cleanup: ${stringifyError(e)}`))
		}
	} catch (e) {
		logger.error(`Error during observer cleanup: ${stringifyError(e)}`)
	}
}
