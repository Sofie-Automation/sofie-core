import type { ChangeStreamDocument } from 'mongodb'
import { ProtectedString } from '../protectedString.js'
import { clone } from '../lib.js'
import {
	MongoQuery,
	MongoFieldSpecifier,
	SortSpecifier,
	mongoWhere,
	mongoProjectDocument,
	makeMongoSortComparator,
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

/** Cursor shaping the view applies to derive the published window from the full matching set. */
export interface ObserveViewShape<TDoc extends Doc> {
	sort?: SortSpecifier<TDoc>
	skip?: number
	limit?: number
}

/**
 * The shared, synchronous observe kernel. Given a query's (selector, projection[, sort/skip/limit]) and a
 * stream of snapshots and change events, it maintains the set of currently-published (projected) documents
 * and emits the add/change/remove transitions to a sink. Driven by both the production change-stream
 * multiplexer and the in-memory collection.
 *
 * When `skip`/`limit` are set, the view holds the *full* matching set internally and publishes only the
 * ordered window `[skip, skip+limit)`. Because a write to one document can move another in/out of that
 * window, the windowed path diffs the whole window set on each change (not per-document). The set is
 * ordered by the cursor's `sort` (if any) with `_id` as a stable final tie-breaker, so the window is
 * reproducible across resyncs. When neither `skip` nor `limit` is set (the common case), the window is
 * the entire matching set and the fast per-document incremental path is used.
 */
export class ObserveView<TDoc extends Doc> {
	readonly #selector: MongoQuery<TDoc>
	readonly #projection: MongoFieldSpecifier<TDoc> | undefined
	readonly #sink: ObserveViewSink<TDoc>

	/** Whether a skip/limit window is in effect (and so the windowed path must be used). */
	readonly #windowed: boolean
	readonly #skip: number
	readonly #limit: number | undefined
	readonly #comparator: (a: TDoc, b: TDoc) => number

	/**
	 * The set of documents published to the sink. When not windowed this is the full matching set; when
	 * windowed this is only the current window slice. Used for new-subscriber replay.
	 */
	#published = new Map<TDoc['_id'], TDoc>()
	/**
	 * The full matching set, holding *unprojected* documents so that ordering in `#reconcileWindow` can see
	 * sort fields the projection might drop. Only maintained in the windowed path; `#published` is the window.
	 */
	#matching = new Map<TDoc['_id'], TDoc>()

	constructor(
		selector: MongoQuery<TDoc>,
		projection: MongoFieldSpecifier<TDoc> | undefined,
		shape: ObserveViewShape<TDoc> | undefined,
		sink: ObserveViewSink<TDoc>
	) {
		this.#selector = selector
		this.#projection = projection
		this.#sink = sink
		this.#skip = shape?.skip ?? 0
		this.#limit = shape?.limit
		this.#windowed = this.#skip > 0 || this.#limit !== undefined
		this.#comparator = makeMongoSortComparator<TDoc>(shape?.sort)
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
		if (this.#windowed) {
			// Windowed: keep full docs so `#reconcileWindow` can sort on fields the projection might drop;
			// projection is applied later, only to the published window.
			const next = new Map<TDoc['_id'], TDoc>()
			for (const doc of docs) next.set(doc._id, doc)
			this.#matching = next
			this.#reconcileWindow()
			return
		}

		// Not windowed: `#published` is the full matching set, reconciled directly (projected here).
		const next = new Map<TDoc['_id'], TDoc>()
		for (const doc of docs) next.set(doc._id, mongoProjectDocument(doc, this.#projection))
		this.#reconcilePublished(next)
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
					this.#applyDelta(id, undefined)
					return
				}
				const matches = mongoWhere(fullDocument, this.#selector)
				const docId = fullDocument._id
				if (matches) {
					// Pass the full (unprojected) doc: the windowed path needs all fields for ordering, and the
					// fast path projects internally.
					this.#applyDelta(docId, fullDocument)
				} else {
					this.#applyDelta(docId, undefined)
				}
				return
			}
			case 'delete': {
				const id = change.documentKey?._id as any as TDoc['_id']
				this.#applyDelta(id, undefined)
				return
			}
			// drop / rename / invalidate end the stream → the feed reconnects → resync via applySnapshot
			default:
				return
		}
	}

	/**
	 * Apply a single-document delta: `doc === undefined` means the document no longer matches (or is gone),
	 * otherwise it is the new full (unprojected) document. Routes to the windowed or fast path.
	 */
	#applyDelta(id: TDoc['_id'] | undefined, doc: TDoc | undefined): void {
		if (id === undefined) return

		if (this.#windowed) {
			// Keep the full doc so ordering in `#reconcileWindow` sees all sort fields; project on publish.
			if (doc === undefined) this.#matching.delete(id)
			else this.#matching.set(id, doc)
			this.#reconcileWindow()
			return
		}

		// Fast path: `#published` is the full matching set, updated incrementally in O(1). Project here.
		const projected = doc === undefined ? undefined : mongoProjectDocument(doc, this.#projection)
		const oldDoc = this.#published.get(id)
		if (projected === undefined) {
			if (oldDoc === undefined) return
			this.#published.delete(id)
			this.#sink.removed(id, oldDoc)
		} else if (oldDoc === undefined) {
			this.#published.set(id, projected)
			this.#sink.added(id, projected)
		} else {
			const fields = diffObject(oldDoc, projected)
			if (fields) {
				this.#published.set(id, projected)
				this.#sink.changed(id, projected, oldDoc, fields)
			}
		}
	}

	/** Recompute the window from `#matching` and reconcile `#published` against it. */
	#reconcileWindow(): void {
		const all = [...this.#matching.values()].sort(this.#comparator)
		const end = this.#limit === undefined ? all.length : this.#skip + this.#limit
		const next = new Map<TDoc['_id'], TDoc>()
		for (const doc of all.slice(this.#skip, end)) {
			// Sorting above used full docs; project only the docs that make it into the published window.
			next.set(doc._id, mongoProjectDocument(doc, this.#projection))
		}
		this.#reconcilePublished(next)
	}

	/** Diff `next` against `#published`, emit the transitions (removed first), and adopt `next`. */
	#reconcilePublished(next: Map<TDoc['_id'], TDoc>): void {
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
