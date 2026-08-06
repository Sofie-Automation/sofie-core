import { getRandomId, deleteAllUndefinedProperties, clone } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString, isProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { profiler } from '../../api/profiler'
import { diffObject } from '@sofie-automation/corelib/dist/diffObject'
import { CustomPublishChanges } from './publish'

type SelectorFunction<TDoc extends { _id: ProtectedString<any> }> = (doc: TDoc) => boolean
type CustomPublishCollectionDocument<TDoc> = {
	changed?: boolean // Whether the document has been potentially changed since last time

	document: TDoc
} | null // removed

/**
 * Caches data for a publication
 * Inspired by our CacheCollection used for mongodb, but simplified
 */
export class CustomPublishCollection<TDoc extends { _id: ProtectedString<any> }> {
	readonly #name: string

	readonly #documents = new Map<TDoc['_id'], CustomPublishCollectionDocument<TDoc>>()
	readonly #lastDocuments = new Map<TDoc['_id'], TDoc>()

	constructor(name: string) {
		this.#name = name
	}

	/**
	 * Find documents matching a criteria
	 * @param selector selector function to match documents, or null to fetch all documents
	 * @returns The matched documents
	 */
	findAll(selector: SelectorFunction<TDoc> | null): TDoc[] {
		const span = profiler.startSpan(`DBCache.findAll.${this.#name}`)

		const results: TDoc[] = []
		this.#documents.forEach((doc, _id) => {
			if (doc === null) return
			if (selector === null || selector(doc.document)) {
				if (doc.document['_id'] !== _id) {
					throw new Error(`Error: document._id "${doc.document['_id']}" is not equal to the key "${_id}"`)
				}
				results.push(doc.document)
			}
		})

		if (span) span.end()
		return results
	}

	/**
	 * Find a single document
	 * @param selector Id or selector function
	 * @returns The first matched document, if any
	 */
	findOne(selector: TDoc['_id'] | SelectorFunction<TDoc>): TDoc | undefined {
		if (isProtectedString(selector)) {
			const span = profiler.startSpan(`DBCache.findOne.${this.#name}`)
			const doc = this.#documents.get(selector)
			if (doc) {
				if (span) span.end()
				return doc.document
			} else {
				return undefined
			}
		} else {
			return this.findAll(selector)[0]
		}
	}

	/**
	 * Insert a single document
	 * @param doc The document to insert
	 * @returns The id of the inserted document
	 */
	insert(doc: TDoc): TDoc['_id'] {
		const span = profiler.startSpan(`DBCache.insert.${this.#name}`)

		const existing = doc._id && this.#documents.get(doc._id)
		if (existing) {
			throw new Error(`Error in cache insert to "${this.#name}": _id "${doc._id}" already exists`)
		}
		if (!doc._id) doc._id = getRandomId()
		const newDoc = clone(doc)

		// ensure no properties are 'undefined'
		deleteAllUndefinedProperties(newDoc)

		this.#documents.set(doc._id, {
			changed: true,
			document: newDoc,
		})
		if (span) span.end()
		return doc._id
	}

	/**
	 * Remove one or more documents
	 * @param selector Id of the document to update, a function to check each document, or null to remove all
	 * @returns The ids of the removed documents
	 */
	remove(selector: TDoc['_id'] | SelectorFunction<TDoc> | null): Array<TDoc['_id']> {
		const span = profiler.startSpan(`DBCache.remove.${this.#name}`)

		const removedIds: TDoc['_id'][] = []
		if (isProtectedString(selector)) {
			if (this.#documents.get(selector)) {
				this.#documents.set(selector, null)
				removedIds.push(selector)
			}
		} else {
			const docsToRemove = this.findAll(selector)
			for (const doc of docsToRemove) {
				removedIds.push(doc._id)
				this.#documents.set(doc._id, null)
			}
		}

		if (span) span.end()
		return removedIds
	}

	/**
	 * Update a single document
	 * @param selector Id of the document to update
	 * @param modifier The modifier to apply to the document. Return false to report the document as unchanged
	 * @returns The id of the updated document, if it was updated
	 */
	updateOne(selector: TDoc['_id'], modifier: (doc: TDoc) => TDoc | false): TDoc['_id'] | undefined {
		const span = profiler.startSpan(`DBCache.update.${this.#name}`)

		if (!isProtectedString(selector)) throw new Error('DBCacheCollection.update expects an id as the selector')

		const doc = this.#documents.get(selector)

		let result: TDoc['_id'] | undefined
		if (doc) {
			const _id = doc.document._id

			const newDoc = modifier(clone(doc.document))
			if (newDoc) {
				if (newDoc._id !== _id) {
					throw new Error(
						`Error: The (immutable) field '_id' was found to have been altered to _id: "${newDoc._id}"`
					)
				}

				// ensure no properties are 'undefined'
				deleteAllUndefinedProperties(newDoc)

				const docEntry = this.#documents.get(_id)
				if (!docEntry) {
					throw new Error(
						`Error: Trying to update a document "${newDoc._id}", that went missing half-way through!`
					)
				}

				docEntry.document = newDoc
				docEntry.changed = true

				result = _id
			}
		}

		if (span) span.end()
		return result
	}

	/**
	 * Update multiple documents
	 * @param modifier The modifier to apply to all the documents. Return false to report a document as unchanged
	 * @returns All the ids that were changed
	 */
	updateAll(modifier: (doc: TDoc) => TDoc | false): Array<TDoc['_id']> {
		const span = profiler.startSpan(`DBCache.updateAll.${this.#name}`)

		const changedIds: Array<TDoc['_id']> = []
		this.#documents.forEach((doc, _id) => {
			if (doc === null) return
			const newDoc: TDoc | false = modifier(clone(doc.document))
			if (newDoc === false) {
				// Function reports no change
				return
			}

			if (newDoc._id !== _id) {
				throw new Error(
					`Error: The (immutable) field '_id' was found to have been altered to _id: "${newDoc._id}"`
				)
			}

			// ensure no properties are 'undefined'
			deleteAllUndefinedProperties(newDoc)

			const docEntry = this.#documents.get(_id)
			if (!docEntry) {
				throw new Error(
					`Error: Trying to update a document "${newDoc._id}", that went missing half-way through!`
				)
			}

			docEntry.document = newDoc
			docEntry.changed = true

			changedIds.push(_id)
		})

		if (span) span.end()
		return changedIds
	}

	/**
	 * Replace a single document
	 * @param doc The document to insert
	 * @returns True if the document was replaced, false if it was inserted
	 */
	replace(doc: TDoc | ReadonlyDeep<TDoc>): boolean {
		const span = profiler.startSpan(`DBCache.replace.${this.#name}`)
		span?.addLabels({ id: unprotectString(doc._id) })

		if (!doc._id) throw new Error(`Error: The (immutable) field '_id' must be defined: "${doc._id}"`)
		const _id = doc._id

		const newDoc = clone(doc)

		// ensure no properties are 'undefined'
		deleteAllUndefinedProperties(newDoc)

		const oldDoc = this.#documents.get(_id)
		if (oldDoc) {
			oldDoc.changed = true
			oldDoc.document = newDoc
		} else {
			this.#documents.set(_id, {
				changed: true,
				document: newDoc,
			})
		}

		if (span) span.end()
		return !!oldDoc
	}

	/** Commit the changes, by computing and returning the changes that need to be sent to subscribers */
	commitChanges(): [TDoc[], CustomPublishChanges<TDoc>] {
		const span = profiler.startSpan(`DBCache.updateDatabaseWithData.${this.#name}`)
		const changes: CustomPublishChanges<TDoc> = {
			added: [],
			changed: [],
			removed: [],
		}
		const allDocs: TDoc[] = []

		const removedDocs: TDoc['_id'][] = []
		this.#documents.forEach((doc, id) => {
			if (doc === null) {
				removedDocs.push(id)
				changes.removed.push(id)
				this.#lastDocuments.delete(id)
			} else {
				allDocs.push(doc.document)

				const oldDoc = this.#lastDocuments.get(id)
				this.#lastDocuments.set(id, doc.document)

				if (!oldDoc) {
					changes.added.push(doc.document)
				} else if (doc.changed) {
					const diff = diffObject(oldDoc, doc.document)
					if (diff) {
						changes.changed.push({
							...diff,
							_id: id,
						})
					}
				}

				delete doc.changed
			}
		})

		for (const id of removedDocs) {
			this.#documents.delete(id)
		}

		if (span) span.end()
		return [allDocs, changes]
	}
}
