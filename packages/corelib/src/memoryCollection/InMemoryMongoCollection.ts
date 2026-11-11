import type { ChangeStreamDocument } from 'mongodb'
import { isProtectedString, ProtectedString } from '../protectedString.js'
import { clone, getRandomId, omit } from '../lib.js'
import {
	FindOptions,
	FindOneOptions,
	MongoQuery,
	MongoModifier,
	MongoBulkWriteOperation,
	MongoFieldSpecifier,
	ObserveCallbacks,
	ObserveChangesCallbacks,
	mongoWhere,
	mongoFindOptions,
	mongoModify,
	FindObserveChangesOptions,
} from '../mongo.js'
import {
	ObserveView,
	ObserveViewShape,
	ObserverDeliveryScheduler,
	makeObserveSink,
	makeObserveChangesSink,
} from './observeView.js'

type Doc = { _id: ProtectedString<any> }

/** A synthetic change-stream event, shaped like the subset of `ChangeStreamDocument` the observe kernel reads. */
export type InMemoryChangeEvent<TDoc extends Doc> =
	| { operationType: 'insert' | 'update' | 'replace'; documentKey: { _id: TDoc['_id'] }; fullDocument: TDoc }
	| { operationType: 'delete'; documentKey: { _id: TDoc['_id'] } }

/**
 * An entry in {@link InMemoryMongoCollection.observers}. Exposes the user's raw callbacks (and the query)
 * for tests that poke observers directly, mirroring the shape of the legacy `MongoMock.Collection` observer.
 */
export interface InMemoryObserverEntry<TDoc extends Doc> {
	id: TDoc['_id']
	query: MongoQuery<TDoc>
	callbacksObserve?: ObserveCallbacks<TDoc>
	callbacksChanges?: ObserveChangesCallbacks<TDoc>
}

export interface InMemoryMongoCollectionOptions<TDoc extends Doc> {
	/** Id generator for documents inserted without an `_id` (default: `getRandomString`). */
	idGenerator?: () => TDoc['_id']
	/**
	 * Optional scheduler for observe callback delivery. When set (e.g. wired to `Meteor.defer` by the unit-test
	 * mock), feed-driven observe callbacks fire on a later tick instead of synchronously during the write.
	 */
	observerDeliveryScheduler?: ObserverDeliveryScheduler
	/** Convenience for registering an {@link InMemoryMongoCollection.onChange} listener at construction. */
	onChange?: () => void
}

/**
 * A standalone, in-memory, fully-synchronous MongoDB-like collection. Stores documents in a private
 * per-instance Map (no shared global state, so no cross-test bleed), reuses corelib's pure mongo helpers
 * (`mongoWhere`/`mongoFindOptions`/`mongoModify`) for query/modify semantics, and drives the shared
 * {@link ObserveView} kernel for correct, native, synchronous `observe`/`observeChanges`.
 *
 * Reads return deep clones and writes clone their inputs, so callers cannot mutate the store by reference.
 */
export class InMemoryMongoCollection<TDoc extends Doc> {
	readonly name: string
	readonly #idGenerator: () => TDoc['_id']
	readonly #deliveryScheduler: ObserverDeliveryScheduler | undefined
	readonly #documents = new Map<TDoc['_id'], TDoc>()
	readonly #listeners = new Set<(event: InMemoryChangeEvent<TDoc>) => void>()
	readonly #changeListeners = new Set<() => void>()

	/**
	 * Live observers, exposing raw callbacks + query for direct-poke test introspection. Typed loosely
	 * (`any`) so that `TDoc` stays out of the public surface as a data field — this keeps the collection
	 * covariant in `TDoc`, so a collection of wider docs is assignable where a narrower one is expected.
	 */
	readonly observers: InMemoryObserverEntry<any>[] = []

	constructor(name: string, options?: InMemoryMongoCollectionOptions<TDoc>) {
		this.name = name
		this.#idGenerator = options?.idGenerator ?? getRandomId
		this.#deliveryScheduler = options?.observerDeliveryScheduler
		if (options?.onChange) this.#changeListeners.add(options.onChange)
	}

	/**
	 * Subscribe to mutations: `listener` is called (with no arguments) after each write that emits a change
	 * (insert/update/replace/remove), but not for `mockSetData`/`clear`. A coarse "something changed" hook
	 * for cache-invalidation; for document-level transitions use `find().observe(Changes)` instead.
	 */
	onChange(listener: () => void, signal: AbortSignal): void {
		if (signal.aborted) return

		this.#changeListeners.add(listener)
		signal.addEventListener('abort', () => void this.#changeListeners.delete(listener), { once: true })
	}

	// --- internals --------------------------------------------------------------------------------

	#normalizeSelector(selector: MongoQuery<TDoc> | TDoc['_id'] | undefined): MongoQuery<TDoc> {
		if (selector === undefined || selector === null) return {} as MongoQuery<TDoc>
		if (typeof selector === 'string') return { _id: selector } as MongoQuery<TDoc>
		return selector
	}

	/** Documents matching the selector (selector-only, no find-options), as live store references. */
	#findMatching(selector: MongoQuery<TDoc>): TDoc[] {
		const idVal = (selector as any)._id
		if (isProtectedString(idVal)) {
			// Fast path via the Map, but still run the full selector for any extra conditions.
			const doc = this.#documents.get(idVal)
			return doc && mongoWhere(doc, selector) ? [doc] : []
		}
		const results: TDoc[] = []
		for (const doc of this.#documents.values()) {
			if (mongoWhere(doc, selector)) results.push(doc)
		}
		return results
	}

	/** Documents matching the selector with find-options (sort/skip/limit/projection) applied, as live references. */
	#findRaw(selector: MongoQuery<TDoc>, options?: FindOptions<TDoc>): TDoc[] {
		return mongoFindOptions(this.#findMatching(selector), options)
	}

	#emit(event: InMemoryChangeEvent<TDoc>): void {
		// Iterate a copy so a listener stopping mid-emit doesn't disturb iteration.
		for (const listener of [...this.#listeners]) listener(event)
		for (const listener of [...this.#changeListeners]) listener()
	}

	// --- reads ------------------------------------------------------------------------------------

	findFetch(selector?: MongoQuery<TDoc> | TDoc['_id'], options?: FindOptions<TDoc>): TDoc[] {
		return this.#findRaw(this.#normalizeSelector(selector), options).map((doc) => clone(doc))
	}

	findOne(selector?: MongoQuery<TDoc> | TDoc['_id'], options?: FindOneOptions<TDoc>): TDoc | undefined {
		const docs = this.#findRaw(this.#normalizeSelector(selector), { ...options, limit: 1 })
		return docs.length ? clone(docs[0]) : undefined
	}

	count(selector?: MongoQuery<TDoc> | TDoc['_id'], options?: FindOptions<TDoc>): number {
		return this.#findRaw(this.#normalizeSelector(selector), options).length
	}

	// --- writes -----------------------------------------------------------------------------------

	insert(doc: TDoc): TDoc['_id'] {
		const stored = clone(doc)
		if (!stored._id) stored._id = this.#idGenerator()
		if (this.#documents.has(stored._id)) throw new Error(`Duplicate key '${stored._id}'`)
		this.#documents.set(stored._id, stored)
		this.#emit({ operationType: 'insert', documentKey: { _id: stored._id }, fullDocument: clone(stored) })
		return stored._id
	}

	update(
		selector: MongoQuery<TDoc> | TDoc['_id'],
		modifier: MongoModifier<TDoc>,
		options?: { multi?: boolean }
	): number {
		const sel = this.#normalizeSelector(selector)
		let docs = this.#findMatching(sel)
		if (!options?.multi) docs = docs.slice(0, 1)

		for (const doc of docs) {
			const modified = mongoModify(sel, clone(doc), modifier)
			// `_id` is immutable: an update must never change it or re-key the document, since re-keying
			// under a modified `_id` could silently overwrite a different entry. Force the original `_id`
			// and always store back under the original key.
			modified._id = doc._id
			this.#documents.set(doc._id, modified)
			this.#emit({ operationType: 'update', documentKey: { _id: modified._id }, fullDocument: clone(modified) })
		}
		return docs.length
	}

	/**
	 * Replace a single document (matched by `_id`) with a full document.
	 * Returns `true` if an existing document was replaced, `false` otherwise.
	 */
	replace(doc: TDoc): boolean {
		const existing = this.#documents.get(doc._id)
		if (existing) {
			const newDoc = { ...clone(doc), _id: existing._id }
			this.#documents.set(doc._id, newDoc)
			this.#emit({ operationType: 'replace', documentKey: { _id: newDoc._id }, fullDocument: clone(newDoc) })
			return true
		} else {
			this.insert(doc)
			return false
		}
	}

	remove(selector: MongoQuery<TDoc> | TDoc['_id']): number {
		const docs = this.#findMatching(this.#normalizeSelector(selector))
		for (const doc of docs) {
			this.#documents.delete(doc._id)
			this.#emit({ operationType: 'delete', documentKey: { _id: doc._id } })
		}
		return docs.length
	}

	bulkWrite(ops: Array<MongoBulkWriteOperation<TDoc>>): void {
		for (const op of ops) {
			if ('insertOne' in op) {
				this.insert(op.insertOne.document as TDoc)
			} else if ('updateOne' in op) {
				this.update(op.updateOne.filter as any, op.updateOne.update, { multi: false })
			} else if ('updateMany' in op) {
				this.update(op.updateMany.filter as any, op.updateMany.update, { multi: true })
			} else if ('deleteOne' in op) {
				const docs = this.#findMatching(this.#normalizeSelector(op.deleteOne.filter as any))
				if (docs.length) this.remove(docs[0]._id)
			} else if ('deleteMany' in op) {
				this.remove(op.deleteMany.filter as any)
			} else if ('replaceOne' in op) {
				const filter = op.replaceOne.filter as any
				const replacement = op.replaceOne.replacement as any as TDoc
				// Match the FULL filter (not just `_id`), mirroring MongoDB: replaceOne replaces the first
				// document that satisfies the whole filter, preserving that document's `_id`.
				const matching = this.#findMatching(this.#normalizeSelector(filter))
				if (matching.length > 0) {
					this.replace({ ...replacement, _id: matching[0]._id } as TDoc)
				} else if (op.replaceOne.upsert) {
					// Without `upsert`, replaceOne is a no-op when nothing matches. With upsert, insert the
					// replacement (with an `_id` taken from the replacement or the filter).
					const newId = (replacement._id ?? filter?._id) as TDoc['_id']
					this.replace({ ...replacement, _id: newId } as TDoc)
				}
			}
		}
	}

	// --- test setup (fire no events) --------------------------------------------------------------

	/** Bulk-replace all stored documents. Fires no observe events (for test setup). */
	mockSetData(data: TDoc[] | Record<string, TDoc> | null): void {
		this.#documents.clear()
		if (!data) return
		const docs = Array.isArray(data) ? data : Object.values<TDoc>(data)
		for (const doc of docs) {
			if (!doc._id) throw new Error(`mockSetData "${this.name}": doc._id missing`)
			this.#documents.set(doc._id, clone(doc))
		}
	}

	/** Empty the collection. Fires no observe events (for test teardown). */
	clear(): void {
		this.#documents.clear()
	}

	// --- observe (used by the cursor) -------------------------------------------------------------

	/**
	 * Observe the full documents matching a query for the lifetime of `options.signal`.
	 * The observer stops when the signal aborts; nothing is started if it is already aborted.
	 */
	observe(
		callbacks: ObserveCallbacks<TDoc>,
		selector: MongoQuery<TDoc> | TDoc['_id'] | undefined,
		options: FindObserveChangesOptions<TDoc>
	): void {
		this.#startObserve(
			'observe',
			this.#normalizeSelector(selector),
			projectionOf(options),
			shapeOf(options),
			callbacks,
			!!options.nonMutatingCallbacks,
			options.signal
		)
	}

	/**
	 * Observe the changes to documents matching a query for the lifetime of `options.signal`.
	 * The observer stops when the signal aborts; nothing is started if it is already aborted.
	 */
	observeChanges(
		callbacks: ObserveChangesCallbacks<TDoc>,
		selector: MongoQuery<TDoc> | TDoc['_id'] | undefined,
		options: FindObserveChangesOptions<TDoc>
	): void {
		this.#startObserve(
			'changes',
			this.#normalizeSelector(selector),
			projectionOf(options),
			shapeOf(options),
			callbacks,
			!!options.nonMutatingCallbacks,
			options.signal
		)
	}

	/** @internal Drive an observe/observeChanges from the change feed via the shared {@link ObserveView}. */
	#startObserve(
		kind: 'observe' | 'changes',
		selector: MongoQuery<TDoc>,
		projection: MongoFieldSpecifier<TDoc> | undefined,
		shape: ObserveViewShape<TDoc> | undefined,
		callbacks: ObserveCallbacks<TDoc> | ObserveChangesCallbacks<TDoc>,
		nonMutating: boolean,
		signal: AbortSignal
	): void {
		// Nothing to start if the lifetime has already ended
		if (signal.aborted) return
		const sink =
			kind === 'observe'
				? makeObserveSink<TDoc>(callbacks as ObserveCallbacks<TDoc>, nonMutating, this.#deliveryScheduler)
				: makeObserveChangesSink<TDoc>(
						callbacks as ObserveChangesCallbacks<TDoc>,
						nonMutating,
						this.#deliveryScheduler
					)

		const view = new ObserveView<TDoc>(selector, projection, shape, sink)

		const entry: InMemoryObserverEntry<TDoc> =
			kind === 'observe'
				? { id: this.#idGenerator(), query: selector, callbacksObserve: callbacks as ObserveCallbacks<TDoc> }
				: {
						id: this.#idGenerator(),
						query: selector,
						callbacksChanges: callbacks as ObserveChangesCallbacks<TDoc>,
					}
		this.observers.push(entry)

		// Seed the current matching set as `added` (selector-only; the kernel projects).
		view.applySnapshot(this.#findMatching(selector))

		const listener = (event: InMemoryChangeEvent<TDoc>) =>
			view.applyChange(event as unknown as ChangeStreamDocument<any>)
		this.#listeners.add(listener)

		signal.addEventListener(
			'abort',
			() => {
				this.#listeners.delete(listener)
				const index = this.observers.indexOf(entry)
				if (index !== -1) this.observers.splice(index, 1)
			},
			{ once: true }
		)
	}

	/**
	 * Bridge an upstream `observeChanges` into an in-memory cache collection: `added` writes the full document,
	 * `changed` merges the field delta (clearing fields whose value became `undefined`), `removed` deletes.
	 * `cb`, if given, runs after each write.
	 */
	link(cb?: () => void): ObserveChangesCallbacks<TDoc> {
		return {
			added: (id, fields) => {
				this.replace({ ...fields, _id: id } as TDoc)
				cb?.()
			},
			changed: (id, fields) => {
				const unset: Partial<Record<keyof TDoc, 1>> = {}
				for (const [key, value] of Object.entries<unknown>(fields as Record<string, unknown>)) {
					if (value !== undefined) continue
					unset[key as keyof TDoc] = 1
				}
				this.update(id, { $set: omit(fields, '_id') as any, $unset: unset as any })
				cb?.()
			},
			removed: (id) => {
				this.remove(id)
				cb?.()
			},
		}
	}
}

function projectionOf<TDoc>(options: FindOptions<TDoc> | undefined): MongoFieldSpecifier<TDoc> | undefined {
	return (options?.projection ?? options?.fields) as MongoFieldSpecifier<TDoc> | undefined
}

/**
 * Extract the observe window shaping (sort/skip/limit). Returns `undefined` when none is set, so the
 * {@link ObserveView} keeps its fast (non-windowed) path.
 */
function shapeOf<TDoc extends Doc>(
	options: FindObserveChangesOptions<TDoc> | undefined
): ObserveViewShape<TDoc> | undefined {
	if (!options) return undefined
	if (options.sort === undefined && options.skip === undefined && options.limit === undefined) return undefined
	return { sort: options.sort, skip: options.skip, limit: options.limit }
}
