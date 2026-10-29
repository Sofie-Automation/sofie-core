import type { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import type { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { SofieError } from '@sofie-automation/corelib/dist/error'
import type { CustomPublish, CustomPublishChanges } from './publish'
import type { LiveQueryHandleSync } from '../lib'

/**
 * A {@link CustomPublish} which applies what it receives to an in-memory collection, rather than
 * sending it to a DDP subscriber.
 *
 * This lets one publication consume another in-process: the consumer becomes an ordinary subscriber
 * of the upstream publication, so it shares the same optimized observer as any DDP subscribers
 * (nothing is computed twice) and sees exactly the documents they see.
 */
export class CustomPublishToCollection<TDoc extends { _id: ProtectedString<any> }> implements CustomPublish<TDoc> {
	readonly #collection: InMemoryMongoCollection<TDoc>
	readonly #applyChange: ReturnType<InMemoryMongoCollection<TDoc>['link']>
	readonly #onChanged: (() => void) | undefined

	#onStop: (() => void) | undefined
	#isReady = false
	#isStopped = false

	readonly #whenReady = Promise.withResolvers<void>()

	/**
	 * @param collection The collection to maintain. It is owned by this receiver: it is cleared on
	 * init, and must not be written to from anywhere else.
	 * @param onChanged Called once after each batch is applied (not once per document)
	 */
	constructor(collection: InMemoryMongoCollection<TDoc>, onChanged?: () => void) {
		this.#collection = collection
		// `link` already implements the DDP field semantics these changes use, including unsetting
		// fields whose value is `undefined`
		this.#applyChange = collection.link()
		this.#onChanged = onChanged
	}

	get isReady(): boolean {
		return this.#isReady
	}

	/**
	 * Resolves once the initial documents have been received, or the receiver is stopped.
	 *
	 * A subscriber joining an observer that is already running is given its documents on the next
	 * update run rather than synchronously, so a consumer that did not wait would compute once from
	 * an empty collection before the real data arrived.
	 */
	get whenReady(): Promise<void> {
		return this.#whenReady.promise
	}

	onStop(callback: () => void): void {
		this.#onStop = callback
	}

	init(docs: TDoc[]): void {
		if (this.#isReady) throw new SofieError(500, 'CustomPublishToCollection has already been initialised')

		this.#collection.remove({})
		for (const doc of docs) {
			this.#applyChange.added(doc._id, doc)
		}

		this.#isReady = true
		this.#whenReady.resolve()
		this.#onChanged?.()
	}

	changed(changes: CustomPublishChanges<TDoc>): void {
		if (!this.#isReady) throw new SofieError(500, 'CustomPublishToCollection has not been initialised')

		// Same order as the DDP receiver, so that both see the same intermediate states
		for (const id of changes.removed) {
			this.#applyChange.removed(id)
		}
		for (const doc of changes.added) {
			this.#applyChange.added(doc._id, doc)
		}
		for (const doc of changes.changed) {
			this.#applyChange.changed(doc._id, doc)
		}

		this.#onChanged?.()
	}

	/** Unsubscribe from the upstream publication */
	stop(): void {
		if (this.#isStopped) return
		this.#isStopped = true

		// Nothing more is coming, so anything waiting on the initial documents must not hang
		this.#whenReady.resolve()

		this.#onStop?.()
	}
}

/**
 * Subscribe to a custom publication in-process, maintaining its documents in the given collection.
 *
 * This is the custom-publication counterpart to `SomeCollection.observeChanges(..., cache.X.link())`,
 * and returns the same kind of handle, so it can be torn down alongside Mongo observers.
 *
 * @param collection The collection to maintain. Owned by this observer - see {@link CustomPublishToCollection}
 * @param setUpObserver Subscribes the given receiver to the upstream publication. Typically calls
 * `setUpCollectionOptimizedObserver`/`setUpOptimizedObserverArray` with the same identifier the
 * publication itself uses, so the observer is shared with its DDP subscribers.
 * @param onChanged Called once after each batch of changes is applied
 */
export async function observeCustomPublication<TDoc extends { _id: ProtectedString<any> }>(
	collection: InMemoryMongoCollection<TDoc>,
	setUpObserver: (receiver: CustomPublish<TDoc>) => Promise<void>,
	onChanged?: () => void
): Promise<LiveQueryHandleSync> {
	const receiver = new CustomPublishToCollection(collection, onChanged)

	try {
		await setUpObserver(receiver)

		// Like a Mongo observer, this resolves with the collection already populated
		await receiver.whenReady
	} catch (e) {
		// Make sure a partially set up subscription cannot leak
		receiver.stop()
		throw e
	}

	return {
		stop: () => receiver.stop(),
	}
}
