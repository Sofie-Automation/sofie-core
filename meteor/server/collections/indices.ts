import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { IndexSpecifier } from '@sofie-automation/meteor-lib/dist/collections/lib'
import { AsyncOnlyReadOnlyMongoCollection } from './collection'

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
	if (!Meteor.isServer) return // only used server-side

	const collectionName = collection.rawCollection().collectionName
	// const collectionName = collection['name']
	if (!collectionName) throw new Meteor.Error(500, `Error: collection.rawCollection.collectionName not set`)
	if (!registeredIndexes[collectionName]) registeredIndexes[collectionName] = { collection: collection, indexes: [] }

	registeredIndexes[collectionName].indexes.push(index)
}
export function getTargetRegisteredIndexes(): CollectionsIndexes {
	return registeredIndexes
}
