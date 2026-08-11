import type { LiveQueryHandle, LiveQueryHandleSync } from './lib'
import { logger } from '../logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { SofieError } from '@sofie-automation/corelib/dist/error'

/**
 * Utilities for AbortSignal based observer lifetimes.
 *
 * An observer's lifetime is expressed by the AbortSignal passed to it when it is started: when the
 * signal aborts, the observer stops. This makes cleanup compositional - aborting a parent signal
 * tears down every observer started under it, including ones started before a setup error was thrown.
 */

/**
 * Create an AbortController whose signal aborts when `parent` aborts, and which can also be aborted
 * directly. Use this for a scope with a shorter lifetime than its parent (e.g. a restartable
 * "generation" of observers inside a subscription).
 *
 * Contract: the returned controller MUST eventually be aborted (aborting it is how the scope ends).
 * Aborting it - from either side - removes the listener from the parent immediately, so repeated
 * generations do not accumulate listeners. Dropping the controller without aborting it keeps a
 * listener (and the controller) referenced by the parent until the parent aborts.
 */
export function createChildAbort(parent: AbortSignal): AbortController {
	const child = new AbortController()

	if (parent.aborted) {
		child.abort(parent.reason)
	} else {
		// `signal: child.signal` makes the listener self-remove once the child aborts for any reason,
		// so long-lived parent signals do not accumulate listeners from short-lived children.
		parent.addEventListener('abort', () => child.abort(parent.reason), { once: true, signal: child.signal })
	}

	return child
}

const processLifetimeAbort = new AbortController()

/**
 * A signal for observers that are intended to live for the whole process.
 * Never aborted today; a graceful-shutdown hook may abort it in the future.
 */
export const processLifetimeSignal: AbortSignal = processLifetimeAbort.signal

/**
 * Bind already-created legacy observer handles to a signal: each handle is stopped when the signal
 * aborts, or immediately if it already has (the signal may have aborted while the caller was awaiting
 * the handle's setup).
 *
 * @deprecated Temporary migration interop - removed in the final cleanup step, once nothing returns
 * a `LiveQueryHandle` any more.
 */
export function stopOnAbort(signal: AbortSignal, ...handles: Array<LiveQueryHandleSync | LiveQueryHandle>): void {
	for (const handle of handles) {
		if (signal.aborted) {
			stopIgnoringErrors(handle)
		} else {
			signal.addEventListener('abort', () => stopIgnoringErrors(handle), { once: true })
		}
	}
}

function stopIgnoringErrors(handle: LiveQueryHandleSync | LiveQueryHandle): void {
	try {
		const res = handle.stop()
		if (res && typeof res.catch === 'function') {
			res.catch((e) => logger.error(`Error stopping observer: ${stringifyError(e)}`))
		}
	} catch (e) {
		logger.error(`Error stopping observer: ${stringifyError(e)}`)
	}
}

/**
 * Await a mixed array of pending/ready legacy observer handles and bind them all to `signal`.
 * If any of them fails, every handle that did start is stopped and the first failure is rethrown -
 * guaranteeing that a rejection means nothing was left running.
 *
 * This is the signal-aware successor of `waitForAllObserversReady`.
 *
 * @deprecated Temporary migration interop - removed in the final cleanup step, once observers take
 * the signal directly at creation.
 */
export async function attachPendingHandles(
	signal: AbortSignal,
	handles: Array<Promise<LiveQueryHandle> | LiveQueryHandle>
): Promise<void> {
	const results = await Promise.allSettled(handles as Array<Promise<LiveQueryHandle>>)

	const allSuccessful = results.filter((r): r is PromiseFulfilledResult<LiveQueryHandle> => r.status === 'fulfilled')

	const firstFailure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
	if (firstFailure || allSuccessful.length !== handles.length) {
		// There was a failure, stop all the observers that did start
		for (const handle of allSuccessful) {
			stopIgnoringErrors(handle.value)
		}
		if (firstFailure) {
			throw firstFailure.reason
		} else {
			throw new SofieError(500, 'Not all observers were started')
		}
	}

	stopOnAbort(signal, ...allSuccessful.map((r) => r.value))
}

/**
 * Wrap a signal-based observer setup as a legacy stop-handle, for places where a migrated inner
 * piece is consumed by not-yet-migrated outer code.
 *
 * @deprecated Temporary migration interop - removed in the final cleanup step.
 */
export async function handleFromSignalSetup(
	setup: (signal: AbortSignal) => Promise<void>
): Promise<LiveQueryHandleSync> {
	const abort = new AbortController()
	try {
		await setup(abort.signal)
	} catch (e) {
		abort.abort() // Ensure everything started under the signal gets terminated
		throw e
	}
	return {
		stop: () => {
			abort.abort()
		},
	}
}
