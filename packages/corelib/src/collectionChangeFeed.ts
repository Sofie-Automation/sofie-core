import type { ChangeStreamDocument, Db, MongoClient } from 'mongodb'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

export const CHANGE_FEED_RESTART_BACKOFF_MS = 5000

/** Minimal logger the feed needs. Inject a real logger (winston etc.); omit for none (e.g. in tests). */
export interface ChangeFeedLogger {
	warn: (message: string) => void
}

/**
 * The minimal subset of mongodb's `ChangeStream` that the feed needs.
 * Declared as an interface so unit tests can inject a fake stream.
 */
export interface ChangeStreamLike {
	on(event: 'change', listener: (change: ChangeStreamDocument<any>) => void): unknown
	on(event: 'error', listener: (error: Error) => void): unknown
	on(event: 'end', listener: () => void): unknown
	close(): Promise<void>
}
/** May be sync (test fakes) or async (production, which captures a resume point first) */
export type ChangeStreamFactory = () => ChangeStreamLike | Promise<ChangeStreamLike>

/**
 * Open a change stream for a collection, started from the current cluster operation time. Capturing the
 * resume point BEFORE the cursor is established closes the cold-start gap: any document written between
 * `watch()` being called and the server-side cursor actually existing is still replayed to us, so the
 * initial snapshot + stream is gap-free.
 */
export async function createCollectionChangeStream(
	client: MongoClient,
	db: Db,
	collectionName: string
): Promise<ChangeStreamLike> {
	const session = client.startSession()
	try {
		// A no-op command populates the session's operationTime with the current cluster time
		await db.command({ ping: 1 }, { session })
		const startAtOperationTime = session.operationTime
		return db.collection(collectionName).watch([], {
			fullDocument: 'updateLookup',
			batchSize: 1,
			startAtOperationTime,
		})
	} finally {
		await session.endSession()
	}
}

export interface CollectionFeedHandle {
	stop(): void
}

interface Subscriber {
	onChange: (change: ChangeStreamDocument<any>) => void
	/**
	 * Called whenever the stream is (re)established — on the FIRST attach as well as after a reconnect.
	 * The subscriber must (re-)snapshot and diff: on first attach this guarantees the snapshot is read
	 * AFTER the stream's resume point has been captured (closing the cold-start gap); on reconnect it
	 * additionally recovers events that were lost while the stream was down.
	 */
	onResync: () => void
}

/**
 * A single MongoDB change stream watching a whole collection, shared (ref-counted) by all observers of
 * that collection. Raw change events are fanned out to every subscriber, which each filter/diff in JS.
 *
 * The whole collection is watched (no per-selector `$match`): when a document updates so that it *leaves*
 * an observer's selector, its new `fullDocument` wouldn't match a `$match`, so the event would be dropped
 * and the "removed" transition missed. Seeing all changes is required for correct leave-detection (this is
 * also how Meteor's oplog observe driver works).
 *
 * This is connection- and framework-agnostic: the change stream is supplied via `createStream` (see
 * {@link createCollectionChangeStream}) and logging via an optional injected {@link ChangeFeedLogger}.
 */
export class CollectionChangeFeed {
	readonly #collectionName: string
	readonly #createStream: ChangeStreamFactory
	readonly #onEmpty: () => void
	readonly #logger: ChangeFeedLogger | undefined
	readonly #subscribers = new Set<Subscriber>()

	#stream: ChangeStreamLike | undefined
	#pendingStart = false
	#stopped = false
	#restartTimeout: ReturnType<typeof setTimeout> | undefined

	constructor(
		collectionName: string,
		createStream: ChangeStreamFactory,
		onEmpty: () => void,
		logger?: ChangeFeedLogger
	) {
		this.#collectionName = collectionName
		this.#createStream = createStream
		this.#onEmpty = onEmpty
		this.#logger = logger
	}

	get collectionName(): string {
		return this.#collectionName
	}
	get subscriberCount(): number {
		return this.#subscribers.size
	}
	/** For tests/metrics: whether the underlying change stream is currently open */
	get isStreaming(): boolean {
		return !!this.#stream
	}

	subscribe(onChange: Subscriber['onChange'], onResync: Subscriber['onResync']): CollectionFeedHandle {
		const subscriber: Subscriber = { onChange, onResync }
		this.#subscribers.add(subscriber)

		// Start the stream when the first subscriber arrives
		if (!this.#stream && !this.#pendingStart && !this.#restartTimeout && !this.#stopped) this.#startStream()

		let stopped = false
		return {
			stop: () => {
				if (stopped) return
				stopped = true
				this.#subscribers.delete(subscriber)
				if (this.#subscribers.size === 0) {
					this.#stopStream()
					this.#onEmpty()
				}
			},
		}
	}

	#startStream(): void {
		let created: ChangeStreamLike | Promise<ChangeStreamLike>
		try {
			created = this.#createStream()
		} catch (e) {
			this.#scheduleRestart(e)
			return
		}
		if (created instanceof Promise) {
			this.#pendingStart = true
			created.then(
				(stream) => {
					this.#pendingStart = false
					this.#attachStream(stream)
				},
				(e) => {
					this.#pendingStart = false
					this.#scheduleRestart(e)
				}
			)
		} else {
			// Sync factory (test fakes). Guard the attach so a throw triggers a restart, mirroring the
			// async branch above.
			try {
				this.#attachStream(created)
			} catch (e) {
				this.#scheduleRestart(e)
			}
		}
	}

	#attachStream(stream: ChangeStreamLike): void {
		// We may have been stopped (or lost all subscribers) while the stream was being opened
		if (this.#stopped || this.#subscribers.size === 0) {
			void stream.close().catch(() => {
				/* ignore */
			})
			return
		}
		this.#stream = stream

		stream.on('change', (change) => {
			// Copy the set so a subscriber stopping during fan-out doesn't disrupt iteration
			for (const s of [...this.#subscribers]) s.onChange(change)
		})
		stream.on('error', (e) => this.#scheduleRestart(e))
		stream.on('end', () => this.#scheduleRestart(undefined))

		// Tell subscribers to (re)sync against this freshly-opened stream. This fires on the FIRST attach
		// too, not only on reconnects: it guarantees each subscriber reads its snapshot AFTER the stream's
		// resume point (startAtOperationTime) has been captured, closing the cold-start snapshot↔stream race
		// (an eager snapshot could otherwise read state from before the resume point and miss a write in
		// between). On a reconnect it additionally recovers events lost while the stream was down. The
		// callback is idempotent (subscribers diff against their published state), so the extra sync is cheap.
		for (const s of [...this.#subscribers]) s.onResync()
	}

	#scheduleRestart(e: unknown): void {
		if (e) this.#logger?.warn(`Change feed for "${this.#collectionName}" errored: ${stringifyError(e)}`)
		// Drop the (now dead) stream and try again after a backoff, as long as we still have subscribers
		const oldStream = this.#stream
		this.#stream = undefined
		if (oldStream)
			void oldStream.close().catch(() => {
				/* already dead */
			})

		if (this.#stopped || this.#subscribers.size === 0 || this.#restartTimeout) return
		this.#restartTimeout = setTimeout(() => {
			this.#restartTimeout = undefined
			if (!this.#stopped && this.#subscribers.size > 0 && !this.#stream) this.#startStream()
		}, CHANGE_FEED_RESTART_BACKOFF_MS)
	}

	#stopStream(): void {
		this.#stopped = true
		if (this.#restartTimeout) {
			clearTimeout(this.#restartTimeout)
			this.#restartTimeout = undefined
		}
		const stream = this.#stream
		this.#stream = undefined
		if (stream)
			void stream.close().catch(() => {
				/* ignore */
			})
	}
}
