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
