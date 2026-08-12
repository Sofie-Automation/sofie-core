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

const processLifetimeAbort = new AbortController()

/**
 * A signal for observers that are intended to live for the whole process.
 * Never aborted today; a graceful-shutdown hook may abort it in the future.
 */
export const processLifetimeSignal: AbortSignal = processLifetimeAbort.signal

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

/**
 * Bind already-created legacy observer handles to a signal: each handle is stopped when the signal
 * aborts, or immediately if it already has.
 *
 * @deprecated Temporary migration interop - removed in the final cleanup step, once nothing returns
 * a `LiveQueryHandle` any more. For a plain cleanup function use {@link runOnAbort}.
 */
export function stopOnAbort(signal: AbortSignal, ...handles: Array<LiveQueryHandleSync | LiveQueryHandle>): void {
	for (const handle of handles) {
		runOnAbort(signal, () => handle.stop())
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
			runIgnoringErrors(() => handle.value.stop())
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
