import { logger } from '../logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

/**
 * Utilities for AbortSignal based observer lifetimes.
 *
 * An observer's lifetime is expressed by the AbortSignal passed to it when it is started: when the
 * signal aborts, the observer stops. This makes cleanup compositional - aborting a parent signal
 * tears down every observer started under it, including ones started before a setup error was thrown.
 */

export { createChildAbort, type AbortScope } from '@sofie-automation/corelib/dist/abortScope'

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

/**
 * `setInterval` for the lifetime of `signal`: the interval is cleared when the signal aborts, and is never
 * started if it already has.
 */
export function setIntervalForSignal(fn: () => void, intervalMs: number, signal: AbortSignal): void {
	if (signal.aborted) return
	const interval = setInterval(fn, intervalMs)
	signal.addEventListener('abort', () => clearInterval(interval), { once: true })
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
