import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { IndexSpecifier } from '@sofie-automation/meteor-lib/dist/collections/lib'
import { AsyncOnlyReadOnlyMongoCollection } from './collection'
import { SofieError } from '@sofie-automation/corelib/dist/error'

interface CollectionsIndexes {
	[collectionName: string]: CollectionIndexes<any>
}
export interface CollectionIndexes<DBInterface extends { _id: ProtectedString<any> }> {
	collection: AsyncOnlyReadOnlyMongoCollection<DBInterface>
	indexes: IndexSpecifier<DBInterface>[]
}

const registeredIndexes: CollectionsIndexes = {}
/**
 * Register an index for a collection. This function should be called right after a collection has been created.
 * @param collection
 * @param index
 */
export function registerIndex<DBInterface extends { _id: ProtectedString<any> }>(
	collection: AsyncOnlyReadOnlyMongoCollection<DBInterface>,
	index: IndexSpecifier<DBInterface>
): void {
	const collectionName = collection.name
	if (!collectionName) throw new SofieError(500, `Error: collection.name not set`)
	if (!registeredIndexes[collectionName]) registeredIndexes[collectionName] = { collection: collection, indexes: [] }

	registeredIndexes[collectionName].indexes.push(index)
}
export function getTargetRegisteredIndexes(): CollectionsIndexes {
	return registeredIndexes
}
