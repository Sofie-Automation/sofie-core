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
