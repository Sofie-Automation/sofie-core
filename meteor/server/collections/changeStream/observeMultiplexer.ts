import type { ChangeStreamDocument } from 'mongodb'
import clone from 'fast-clone'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import {
	MongoQuery,
	MongoFieldSpecifier,
	ObserveCallbacks,
	ObserveChangesCallbacks,
} from '@sofie-automation/corelib/dist/mongo'
import { PromisifyCallbacks } from '@sofie-automation/shared-lib/dist/lib/types'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { EJSON } from 'meteor/ejson'
import { logger } from '../../logging'
import { ObserveView, fieldsFor } from '@sofie-automation/corelib/dist/memoryCollection/observeView'
import { CollectionFeedHandle } from './collectionChangeFeed'

type Doc = { _id: ProtectedString<any> }

/** What the multiplexer needs from the outside world — injectable so the logic is testable without mongo */
export interface ObserveMultiplexerDeps<TDoc extends Doc> {
	/** Fetch the full set of documents currently matching the selector (NO projection - we project in JS) */
	snapshot: () => Promise<TDoc[]>
	/**
	 * Subscribe to the collection's change feed. `onResync` is invoked once the stream is established
	 * (on first attach AND after any reconnect); the multiplexer responds by (re-)running its snapshot,
	 * which is what makes the initial snapshot run after the stream's resume point is captured.
	 */
	subscribeFeed: (onChange: (change: ChangeStreamDocument<any>) => void, onResync: () => void) => CollectionFeedHandle
}

interface ChangesSubscriber<TDoc extends Doc> {
	type: 'changes'
	callbacks: PromisifyCallbacks<ObserveChangesCallbacks<TDoc>>
	nonMutating: boolean
	live: boolean
}
interface ObserveSubscriber<TDoc extends Doc> {
	type: 'observe'
	callbacks: PromisifyCallbacks<ObserveCallbacks<TDoc>>
	nonMutating: boolean
	live: boolean
}
type Subscriber<TDoc extends Doc> = ChangesSubscriber<TDoc> | ObserveSubscriber<TDoc>

/** A transition computed by the {@link ObserveView}, buffered until the multiplexer fans it out to subscribers. */
type ViewTransition<TDoc extends Doc> =
	| { kind: 'added'; id: TDoc['_id']; doc: any }
	| { kind: 'changed'; id: TDoc['_id']; newDoc: any; oldDoc: any; fields: any }
	| { kind: 'removed'; id: TDoc['_id']; oldDoc: any }

/**
 * Maintains the set of documents matching one (collection, selector, options) query, driven by the
 * collection's shared change feed, and fans transitions out to all of its subscribers. Multiple
 * subscribers with identical args share ONE multiplexer (one snapshot, one match/diff pass).
 *
 * All state mutation flows through a single serial task queue (#enqueue), which gives us, for free:
 *  - buffering during the initial snapshot (events queue behind it),
 *  - strict ordering of added/changed/removed,
 *  - a uniform path for initial-sync and reconnect-resync (both reconcile the snapshot via the view),
 *  - consistent new-subscriber replay (sees a settled published set).
 */
export class ObserveMultiplexer<TDoc extends Doc> {
	readonly #deps: ObserveMultiplexerDeps<TDoc>
	readonly #onEmpty: () => void

	readonly #subscribers = new Set<Subscriber<TDoc>>()
	/** The shared transition engine. Its sink buffers transitions into {@link #pending} for fan-out. */
	readonly #view: ObserveView<TDoc>
	#pending: Array<ViewTransition<TDoc>> = []
	#feedHandle: CollectionFeedHandle | undefined
	#queue: Promise<void> = Promise.resolve()
	#stopped = false
	/**
	 * If the eager initial snapshot fails, the error is stashed here (instead of being logged-and-ignored
	 * like ongoing live events) so it can be surfaced to the observe caller via {@link #addSubscriber} -
	 * otherwise the observer would resolve "ready" against an empty/stale set.
	 */
	#startupError: unknown | undefined = undefined

	constructor(
		selector: MongoQuery<TDoc>,
		projection: MongoFieldSpecifier<TDoc> | undefined,
		deps: ObserveMultiplexerDeps<TDoc>,
		onEmpty: () => void
	) {
		this.#deps = deps
		this.#onEmpty = onEmpty
		this.#view = new ObserveView<TDoc>(selector, projection, {
			added: (id, doc) => this.#pending.push({ kind: 'added', id, doc }),
			changed: (id, newDoc, oldDoc, fields) =>
				this.#pending.push({ kind: 'changed', id, newDoc, oldDoc, fields }),
			removed: (id, oldDoc) => this.#pending.push({ kind: 'removed', id, oldDoc }),
		})

		// Eager initial snapshot for fast initial data. The feed then drives a second snapshot on its first
		// attach (the onResync below) which is read AFTER the stream's resume point has been captured -
		// that second sync is what closes the cold-start snapshot↔stream race; the eager one just gets data
		// flowing sooner. Both reconcile against the view's published set, so the redundant pass is a no-op
		// when there's no gap. Enqueuing #sync before subscribing keeps stream events strictly behind the snapshot.
		// This one is enqueued as the STARTUP task: a failure here is remembered (not swallowed) so the observe
		// caller sees it, rather than going live against an empty set.
		this.#enqueueStartup(() => this.#sync())
		this.#feedHandle = this.#deps.subscribeFeed(
			(change) => void this.#enqueue(() => this.#processEvent(change)),
			() => void this.#enqueue(() => this.#sync())
		)
	}

	get subscriberCount(): number {
		return this.#subscribers.size
	}
	/** test helper */
	get publishedCount(): number {
		return this.#view.publishedCount
	}
	/** test helper: resolve once all currently-queued tasks (snapshot/events/replays) have processed */
	async _flushForTests(): Promise<void> {
		await this.#enqueue(async () => {
			// no-op; awaiting this awaits everything queued before it
		})
	}

	#enqueue(task: () => Promise<void>): Promise<void> {
		this.#queue = this.#queue.then(async () => {
			if (this.#stopped) return
			try {
				await task()
			} catch (e) {
				logger.error(`ObserveMultiplexer task failed: ${stringifyError(e)}`)
			}
		})
		return this.#queue
	}

	/**
	 * Like {@link #enqueue}, but for the initial snapshot: a failure is stashed in {@link #startupError}
	 * (and NOT rethrown, so the serial queue is not poisoned) to be surfaced later by {@link #addSubscriber}.
	 */
	#enqueueStartup(task: () => Promise<void>): void {
		this.#queue = this.#queue.then(async () => {
			if (this.#stopped) return
			try {
				await task()
			} catch (e) {
				this.#startupError = e
			}
		})
	}

	// --- subscriber management -------------------------------------------------------------------

	async addObserveChangesSubscriber(
		callbacks: PromisifyCallbacks<ObserveChangesCallbacks<TDoc>>,
		signal: AbortSignal,
		nonMutating: boolean
	): Promise<void> {
		const sub: ChangesSubscriber<TDoc> = { type: 'changes', callbacks, nonMutating, live: false }
		return this.#addSubscriber(sub, signal)
	}

	async addObserveSubscriber(
		callbacks: PromisifyCallbacks<ObserveCallbacks<TDoc>>,
		signal: AbortSignal,
		nonMutating: boolean
	): Promise<void> {
		const sub: ObserveSubscriber<TDoc> = { type: 'observe', callbacks, nonMutating, live: false }
		return this.#addSubscriber(sub, signal)
	}

	async #addSubscriber(sub: Subscriber<TDoc>, signal: AbortSignal): Promise<void> {
		// If the caller has already aborted (e.g. the observe was cancelled before its initial snapshot
		// completed) there is nothing to set up.
		if (signal.aborted) return

		// Join the subscriber set synchronously, BEFORE awaiting the queue, so this subscriber holds a
		// ref-count immediately. Otherwise a concurrent removeSubscriber (another subscriber leaving and
		// dropping the count to zero) could #stop() and deregister the multiplexer in the window before our
		// replay task runs - leaving this subscriber silently orphaned on a dead, deregistered multiplexer.
		this.#subscribers.add(sub)
		// removeSubscriber is idempotent (guarded by the Set delete), so a stray abort after teardown is safe.
		signal.addEventListener('abort', () => this.#removeSubscriber(sub), { once: true })

		// Replay current state to the new subscriber, then mark it live - as one queued task, so it sees a
		// settled published set and any concurrent events are delivered exactly once (replayed OR live).
		await this.#enqueue(async () => {
			for (const [id, doc] of this.#view.publishedEntries()) {
				// Aborted part-way through (the abort listener has already removed sub) - stop replaying.
				if (signal.aborted) return
				await this.#emitAddedTo(sub, id, doc)
			}
			// Aborted while waiting in the queue or during replay - don't go live.
			if (signal.aborted) return
			sub.live = true
		})

		// If the eager initial snapshot failed, this subscriber has just replayed an empty/stale set. Surface
		// that failure to the observe caller (who will abort, tearing us down) instead of resolving "ready".
		if (this.#startupError !== undefined && !signal.aborted) {
			// eslint-disable-next-line @typescript-eslint/only-throw-error -- re-throw the original snapshot rejection value
			throw this.#startupError
		}
	}

	#removeSubscriber(sub: Subscriber<TDoc>): void {
		if (!this.#subscribers.delete(sub)) return
		if (this.#subscribers.size === 0) this.#stop()
	}

	#stop(): void {
		if (this.#stopped) return
		this.#stopped = true
		this.#feedHandle?.stop()
		this.#feedHandle = undefined
		this.#onEmpty()
	}

	// --- core: snapshot/resync and per-event transitions -----------------------------------------

	async #sync(): Promise<void> {
		this.#view.applySnapshot(await this.#deps.snapshot())
		await this.#flushPending()
	}

	async #processEvent(change: ChangeStreamDocument<any>): Promise<void> {
		this.#view.applyChange(change)
		await this.#flushPending()
	}

	/** Fan the transitions the view just buffered out to all live subscribers, in order. */
	async #flushPending(): Promise<void> {
		const transitions = this.#pending
		this.#pending = []
		for (const t of transitions) {
			if (t.kind === 'added') await this.#emitAdded(t.id, t.doc)
			else if (t.kind === 'changed') await this.#emitChanged(t.id, t.newDoc, t.oldDoc, t.fields)
			else await this.#emitRemoved(t.id, t.oldDoc)
		}
	}

	// --- fan-out (with per-subscriber clone unless nonMutating) ----------------------------------

	async #emitAdded(id: TDoc['_id'], projectedDoc: any): Promise<void> {
		await Promise.all(
			[...this.#subscribers].filter((s) => s.live).map((s) => this.#emitAddedTo(s, id, projectedDoc))
		)
	}

	async #emitAddedTo(sub: Subscriber<TDoc>, id: TDoc['_id'], projectedDoc: any): Promise<void> {
		try {
			if (sub.type === 'changes') {
				const fields = fieldsFor(projectedDoc)
				await sub.callbacks.added?.(id, sub.nonMutating ? fields : clone(fields))
			} else {
				await sub.callbacks.added?.(sub.nonMutating ? projectedDoc : clone(projectedDoc))
			}
		} catch (e) {
			logger.error(`observe added callback failed: ${stringifyError(e)}`)
		}
	}

	async #emitChanged(id: TDoc['_id'], newDoc: any, oldDoc: any, fields: any): Promise<void> {
		await Promise.all(
			[...this.#subscribers]
				.filter((s) => s.live)
				.map(async (sub) => {
					try {
						if (sub.type === 'changes') {
							await sub.callbacks.changed?.(id, sub.nonMutating ? fields : clone(fields))
						} else {
							await sub.callbacks.changed?.(
								sub.nonMutating ? newDoc : clone(newDoc),
								sub.nonMutating ? oldDoc : clone(oldDoc)
							)
						}
					} catch (e) {
						logger.error(`observe changed callback failed: ${stringifyError(e)}`)
					}
				})
		)
	}

	async #emitRemoved(id: TDoc['_id'], oldDoc: any): Promise<void> {
		await Promise.all(
			[...this.#subscribers]
				.filter((s) => s.live)
				.map(async (sub) => {
					try {
						if (sub.type === 'changes') {
							await sub.callbacks.removed?.(id)
						} else {
							await sub.callbacks.removed?.(sub.nonMutating ? oldDoc : clone(oldDoc))
						}
					} catch (e) {
						logger.error(`observe removed callback failed: ${stringifyError(e)}`)
					}
				})
		)
	}
}

// --- Registry: dedup multiplexers by (collection, selector, options) -------------------------------

const multiplexers = new Map<string, ObserveMultiplexer<any>>()

/**
 * Build the dedup key. We use EJSON's canonical stringify (sorted keys) rather than corelib's
 * `stringifyObjects`: the latter is lossy (it joins keys/values with `=`/`,`, so distinct selectors can
 * collide) which is fine for hashing but would incorrectly merge two different queries onto one
 * multiplexer here. EJSON canonical is injective and also serialises Date/RegExp/etc. faithfully.
 */
function multiplexerKey(collectionName: string, selector: unknown, projection: unknown): string {
	const canonical = (v: unknown) => EJSON.stringify(v as any, { canonical: true })
	return `${collectionName}::${canonical(selector)}::${canonical(projection ?? null)}`
}

function getOrCreateMultiplexer<TDoc extends Doc>(
	collectionName: string,
	selector: MongoQuery<TDoc>,
	projection: MongoFieldSpecifier<TDoc> | undefined,
	makeDeps: () => ObserveMultiplexerDeps<TDoc>
): ObserveMultiplexer<TDoc> {
	const key = multiplexerKey(collectionName, selector, projection)
	let m = multiplexers.get(key)
	if (!m) {
		m = new ObserveMultiplexer<TDoc>(selector, projection, makeDeps(), () => multiplexers.delete(key))
		multiplexers.set(key, m)
	}
	return m
}

/** For tests/metrics: number of active (deduplicated) multiplexers */
export function getActiveMultiplexerCount(): number {
	return multiplexers.size
}

/**
 * Start (or join) an observeChanges over the change-stream engine.
 */
export async function observeChangesViaChangeStream<TDoc extends Doc>(
	collectionName: string,
	selector: MongoQuery<TDoc>,
	projection: MongoFieldSpecifier<TDoc> | undefined,
	callbacks: PromisifyCallbacks<ObserveChangesCallbacks<TDoc>>,
	signal: AbortSignal,
	nonMutating: boolean,
	makeDeps: () => ObserveMultiplexerDeps<TDoc>
): Promise<void> {
	// If the caller has already aborted, do nothing - crucially, don't create a multiplexer (which would
	// open a change feed) that would never gain a subscriber and so never be torn down.
	if (signal.aborted) return
	const m = getOrCreateMultiplexer(collectionName, selector, projection, makeDeps)
	return m.addObserveChangesSubscriber(callbacks, signal, nonMutating)
}

/** Start (or join) an observe (full-document) over the change-stream engine. */
export async function observeViaChangeStream<TDoc extends Doc>(
	collectionName: string,
	selector: MongoQuery<TDoc>,
	projection: MongoFieldSpecifier<TDoc> | undefined,
	callbacks: PromisifyCallbacks<ObserveCallbacks<TDoc>>,
	signal: AbortSignal,
	nonMutating: boolean,
	makeDeps: () => ObserveMultiplexerDeps<TDoc>
): Promise<void> {
	// If the caller has already aborted, do nothing - crucially, don't create a multiplexer (which would
	// open a change feed) that would never gain a subscriber and so never be torn down.
	if (signal.aborted) return
	const m = getOrCreateMultiplexer(collectionName, selector, projection, makeDeps)
	return m.addObserveSubscriber(callbacks, signal, nonMutating)
}
