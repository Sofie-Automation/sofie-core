import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { AnyBulkWriteOperation } from 'mongodb'
import { LazyInitialise } from '../../../lib/lazy.js'
import { DocumentChanges, getDocumentChanges } from './utils.js'

export async function generateWriteOpsForLazyDocuments<TDoc extends { _id: ProtectedString<any> }>(
	currentDocs: LazyInitialise<TDoc[]>,
	changedIds: ReadonlySet<TDoc['_id']>
): Promise<AnyBulkWriteOperation<TDoc>[]> {
	const changeTracker = new DocumentChangeTracker<TDoc>()

	if (changedIds.size > 0 || currentDocs.isLoaded()) {
		const loadedDocs = await currentDocs.get()
		changeTracker.addChanges(getDocumentChanges(changedIds, loadedDocs), false)
	}

	return changeTracker.generateWriteOps()
}

/**
 * A helper to calculate the mongodb BulkWrite operations for a collection.
 * It is intended to be used to combine 'fragments' of a collection which have been distributed amongst their 'parent' documents,
 * and to safely handle cases such as a document being deleted from one 'parent' and re-created under another 'parent'
 */
export class DocumentChangeTracker<TDoc extends { _id: ProtectedString<any> }> {
	#currentIds = new Set<TDoc['_id']>()
	#deletedIds = new Set<TDoc['_id']>()
	#documentsToSave = new Map<TDoc['_id'], TDoc>()

	#addDocumentId(id: TDoc['_id']): void {
		// if (this.#currentIds.has(id)) {
		// Future: report duplicate?
		// }
		this.#currentIds.add(id)

		if (this.#deletedIds.has(id)) {
			// It was marked for deletion elsewhere, but exists so skip deletion
			this.#deletedIds.delete(id)

			// if (!this.#documentsToSave.has(id)){
			// This is suspicious, as it already has changes, but is also marked for deletion
			// }
		}
	}

	/**
	 * Add a document as existing
	 * @param doc Document which exists in the Model
	 * @param hasChanges Whether this document has any changes
	 */
	addDocument(doc: TDoc, hasChanges: boolean): void {
		this.#addDocumentId(doc._id)

		if (hasChanges) {
			this.#documentsToSave.set(doc._id, doc)
		}
	}

	/**
	 * Mark a document as deleted
	 * @param id Id of document to be deleted
	 */
	deleteDocument(id: TDoc['_id']): void {
		// If not reused elswehere, add for deletion
		if (!this.#currentIds.has(id) && !this.#documentsToSave.has(id)) {
			this.#deletedIds.add(id)
		}
	}

	/**
	 * Add a batch of changes
	 * @param changes Description of documents and whether they have changes
	 * @param parentIsDeleted Whether the parent document is deleted, indicating all of documents should be deleted
	 */
	addChanges(changes: DocumentChanges<TDoc>, parentIsDeleted: boolean): void {
		for (const id of changes.deletedIds) {
			this.deleteDocument(id)
		}

		if (!parentIsDeleted) {
			for (const doc of changes.changedDocuments) {
				this.#addDocumentId(doc._id)

				this.#documentsToSave.set(doc._id, doc)
			}
		}

		for (const id of changes.currentIds) {
			if (parentIsDeleted) {
				this.deleteDocument(id)
			} else {
				this.#addDocumentId(id)
			}
		}
	}

	getDeletedIds(): TDoc['_id'][] {
		return Array.from(this.#deletedIds.values())
	}

	/**
	 * Generate the mongodb BulkWrite operations for the documents known to this tracker
	 * @returns mongodb BulkWrite operations
	 */
	generateWriteOps(): AnyBulkWriteOperation<TDoc>[] {
		const ops: AnyBulkWriteOperation<TDoc>[] = []

		for (const doc of this.#documentsToSave) {
			ops.push({
				replaceOne: {
					filter: { _id: doc[0] },
					replacement: doc[1],
					upsert: true,
				},
			})
		}

		if (this.#deletedIds.size > 0) {
			ops.push({
				deleteMany: {
					filter: { _id: { $in: Array.from(this.#deletedIds) as any } },
				},
			})
		}

		return ops
	}
}
