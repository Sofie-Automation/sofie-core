import { normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import _ from 'underscore'

/**
 * Perform a diff of a pair of arrays of documents
 * @param changedIds Set of changed document ids to update in place
 * @param oldObjects Old documents to compare
 * @param newObjects New documents to compare
 * @param mergeFn Optional merge to perform before diffing, this change will be present in the returned values. Note: The parameters must not be modified, you should clone them first if you need to do this
 * @returns Array of the documents. Contains unchanged items from oldObjects, and changed items from newObjects
 */
export function diffAndReturnLatestObjects<T extends { _id: ProtectedString<any> }>(
	changedIds: Set<T['_id']>,
	oldObjects: readonly T[],
	newObjects: readonly T[],
	mergeFn?: (oldValue: T, newValue: T) => T
): T[] {
	const oldObjectMap = normalizeArrayToMap(oldObjects, '_id')

	const result: T[] = []

	// Compare each newObject
	for (const newObject of newObjects) {
		const oldObject = oldObjectMap.get(newObject._id)
		oldObjectMap.delete(newObject._id)

		const mergedObject = mergeFn && oldObject ? mergeFn(oldObject, newObject) : newObject

		if (!oldObject || changedIds.has(mergedObject._id) || !_.isEqual(oldObject, mergedObject)) {
			result.push(mergedObject)
			changedIds.add(mergedObject._id)
		} else {
			result.push(oldObject)
		}
	}

	// Anything left in the map is missing in the newObjects array
	for (const oldObjectId of oldObjectMap.keys()) {
		changedIds.add(oldObjectId)
	}

	return result
}

export function setValuesAndTrackChanges<T extends { _id: ProtectedString<any> }>(
	changedIds: Set<T['_id']>,
	objects: readonly T[],
	newFragment: Partial<T>
): void {
	const fragmentEntries = Object.entries<any>(newFragment)

	for (const obj of objects) {
		// If the doc is already changed, we can skip further comparisons
		let changed = changedIds.has(obj._id)

		for (const [key0, value] of fragmentEntries) {
			const key = key0 as keyof T
			if (changed || obj[key] !== value) {
				obj[key] = value
				changed = true
			}
		}

		// The doc changed, track it as such
		if (changed) changedIds.add(obj._id)
	}
}

export function addManyToSet<T>(set: Set<T>, iter: Iterable<T>): void {
	for (const val of iter) {
		set.add(val)
	}
}

export interface DocumentChanges<T extends { _id: ProtectedString<any> }> {
	currentIds: T['_id'][]
	deletedIds: T['_id'][]
	changedDocuments: T[]
}

export function getDocumentChanges<T extends { _id: ProtectedString<any> }>(
	changedIds: ReadonlySet<T['_id']>,
	documents: readonly T[]
): DocumentChanges<T> {
	const result: DocumentChanges<T> = {
		currentIds: [],
		deletedIds: [],
		changedDocuments: [],
	}

	// calculate changes
	for (const doc of documents) {
		result.currentIds.push(doc._id)
		if (changedIds.has(doc._id)) {
			result.changedDocuments.push(doc)
		}
	}

	// Find deletions
	const currentIdsSet = new Set(result.currentIds)
	for (const id of changedIds) {
		if (!currentIdsSet.has(id)) {
			result.deletedIds.push(id)
		}
	}

	return result
}
