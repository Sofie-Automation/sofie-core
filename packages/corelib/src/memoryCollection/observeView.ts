import type { ChangeStreamDocument } from 'mongodb'
import { ProtectedString } from '../protectedString.js'
import { clone } from '../lib.js'
import {
	MongoQuery,
	MongoFieldSpecifier,
	mongoWhere,
	mongoProjectDocument,
	ObserveCallbacks,
	ObserveChangesCallbacks,
} from '../mongo.js'
import { diffObject } from '../diffObject.js'

/** A handle to a running observe; call `stop()` to tear it down. */
export interface MongoLiveQueryHandle {
	stop(): void
}

type Doc = { _id: ProtectedString<any> }

/**
 * The destination for the transitions an {@link ObserveView} computes. The view decides which transitions
 * to fire and which fields changed; the sink maps them to callbacks.
 */
export interface ObserveViewSink<TDoc extends Doc> {
	added(id: TDoc['_id'], projectedDoc: TDoc): void
	changed(id: TDoc['_id'], newProjectedDoc: TDoc, oldProjectedDoc: TDoc, fields: Partial<TDoc>): void
	removed(id: TDoc['_id'], oldProjectedDoc: TDoc): void
}

/**
 * The shared, synchronous observe kernel. Given a query's (selector, projection) and a stream of snapshots
 * and change events, it maintains the set of currently-published (projected) documents and emits the
 * add/change/remove transitions to a sink. Driven by both the production change-stream multiplexer and the
 * in-memory collection.
 */
export class ObserveView<TDoc extends Doc> {
	readonly #selector: MongoQuery<TDoc>
	readonly #projection: MongoFieldSpecifier<TDoc> | undefined
	readonly #sink: ObserveViewSink<TDoc>
	#published = new Map<TDoc['_id'], TDoc>()

	constructor(
		selector: MongoQuery<TDoc>,
		projection: MongoFieldSpecifier<TDoc> | undefined,
		sink: ObserveViewSink<TDoc>
	) {
		this.#selector = selector
		this.#projection = projection
		this.#sink = sink
	}

	/** Number of currently-published documents (test helper / metrics). */
	get publishedCount(): number {
		return this.#published.size
	}

	/** Snapshot of the currently-published (projected) documents, for replaying state to a new consumer. */
	publishedEntries(): Array<[TDoc['_id'], TDoc]> {
		return [...this.#published]
	}

	/**
	 * Reconcile the published set against a full snapshot of the documents currently matching the selector.
	 * Used for initial sync and reconnect-resync.
	 */
	applySnapshot(docs: TDoc[]): void {
		const next = new Map<TDoc['_id'], TDoc>()
		for (const doc of docs) {
			next.set(doc._id, mongoProjectDocument(doc, this.#projection))
		}

		// Removed: in old, not in new
		for (const [id, oldDoc] of this.#published) {
			if (!next.has(id)) this.#sink.removed(id, oldDoc)
		}
		// Added / changed
		for (const [id, newDoc] of next) {
			const oldDoc = this.#published.get(id)
			if (oldDoc === undefined) {
				this.#sink.added(id, newDoc)
			} else {
				const fields = diffObject(oldDoc, newDoc)
				if (fields) this.#sink.changed(id, newDoc, oldDoc, fields)
			}
		}
		this.#published = next
	}

	/** Apply a single change-stream event, emitting the resulting transition (if any). */
	applyChange(change: ChangeStreamDocument<any>): void {
		switch (change.operationType) {
			case 'insert':
			case 'update':
			case 'replace': {
				const fullDocument = change.fullDocument as TDoc | null | undefined
				const id = change.documentKey?._id as any as TDoc['_id']
				// fullDocument can be null if the doc was deleted between the event and the updateLookup
				if (!fullDocument) {
					this.#handleGone(id)
					return
				}
				const matches = mongoWhere(fullDocument, this.#selector)
				const docId = fullDocument._id
				if (matches) {
					const projected = mongoProjectDocument(fullDocument, this.#projection)
					const oldDoc = this.#published.get(docId)
					if (oldDoc === undefined) {
						this.#published.set(docId, projected)
						this.#sink.added(docId, projected)
					} else {
						const fields = diffObject(oldDoc, projected)
						if (fields) {
							this.#published.set(docId, projected)
							this.#sink.changed(docId, projected, oldDoc, fields)
						}
					}
				} else {
					this.#handleGone(docId)
				}
				return
			}
			case 'delete': {
				const id = change.documentKey?._id as any as TDoc['_id']
				this.#handleGone(id)
				return
			}
			// drop / rename / invalidate end the stream → the feed reconnects → resync via applySnapshot
			default:
				return
		}
	}

	#handleGone(id: TDoc['_id'] | undefined): void {
		if (id === undefined) return
		const oldDoc = this.#published.get(id)
		if (oldDoc === undefined) return
		this.#published.delete(id)
		this.#sink.removed(id, oldDoc)
	}
}

/** Extract the published-doc fields minus `_id`, as the `observeChanges` `added` callback expects. */
export function fieldsFor<TDoc extends Doc>(projectedDoc: TDoc): Partial<Omit<TDoc, '_id'>> {
	const { _id, ...fields } = projectedDoc
	return fields
}

/**
 * Schedules a callback for delivery. When provided, delivery happens via the scheduler (e.g. `Meteor.defer`)
 * rather than synchronously. Arguments are cloned before scheduling, so a deferred callback sees a stable snapshot.
 */
export type ObserverDeliveryScheduler = (fn: () => void) => void

function deliver(scheduler: ObserverDeliveryScheduler | undefined, fn: () => void): void {
	if (scheduler) scheduler(fn)
	else fn()
}

/**
 * Build a sink that delivers transitions to a single set of full-document {@link ObserveCallbacks}.
 * Clones the documents per callback unless `nonMutating`.
 */
export function makeObserveSink<TDoc extends Doc>(
	callbacks: ObserveCallbacks<TDoc>,
	nonMutating: boolean,
	scheduler?: ObserverDeliveryScheduler
): ObserveViewSink<TDoc> {
	return {
		added: (_id, projectedDoc) => {
			const doc = nonMutating ? projectedDoc : clone(projectedDoc)
			deliver(scheduler, () => callbacks.added?.(doc))
		},
		changed: (_id, newProjectedDoc, oldProjectedDoc) => {
			const newDoc = nonMutating ? newProjectedDoc : clone(newProjectedDoc)
			const oldDoc = nonMutating ? oldProjectedDoc : clone(oldProjectedDoc)
			deliver(scheduler, () => callbacks.changed?.(newDoc, oldDoc))
		},
		removed: (_id, oldProjectedDoc) => {
			const oldDoc = nonMutating ? oldProjectedDoc : clone(oldProjectedDoc)
			deliver(scheduler, () => callbacks.removed?.(oldDoc))
		},
	}
}

/**
 * Build a sink that delivers transitions to a single set of {@link ObserveChangesCallbacks}
 * (id + changed-fields). Clones the fields per callback unless `nonMutating`.
 */
export function makeObserveChangesSink<TDoc extends Doc>(
	callbacks: ObserveChangesCallbacks<TDoc>,
	nonMutating: boolean,
	scheduler?: ObserverDeliveryScheduler
): ObserveViewSink<TDoc> {
	return {
		added: (id, projectedDoc) => {
			const fields = fieldsFor(projectedDoc) as Partial<TDoc>
			const out = nonMutating ? fields : clone<Partial<TDoc>>(fields)
			deliver(scheduler, () => callbacks.added?.(id, out))
		},
		changed: (id, _newProjectedDoc, _oldProjectedDoc, fields) => {
			const out = nonMutating ? fields : clone<Partial<TDoc>>(fields)
			deliver(scheduler, () => callbacks.changed?.(id, out))
		},
		removed: (id) => {
			deliver(scheduler, () => callbacks.removed?.(id))
		},
	}
}
