import type { MongoQuery, MongoModifier } from '@sofie-automation/corelib/src/mongo'
import type { ProtectedString } from '@sofie-automation/corelib/src/protectedString'
import type { FindOptions, FindOneOptions, UpdateOptions, UpsertOptions } from './lib'

export interface MongoReadOnlyCollection<DBInterface extends { _id: ProtectedString<any> }> {
	/**
	 * Find the documents in a collection that match the selector.
	 * @param selector A query describing the documents to find
	 */
	find(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): MongoCursor<DBInterface>

	/**
	 * Finds the first document that matches the selector, as ordered by sort and skip options. Returns `undefined` if no matching document is found.
	 * @param selector A query describing the documents to find
	 */
	findOne(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOneOptions<DBInterface>
	): DBInterface | undefined
}
/**
 * A minimal MongoCollection type based on the Meteor Mongo.Collection type, but with our improved _id type safety.
 * Note: when updating method signatures, make sure to update the implementions as new properties may not be fed through without additional work
 */
export interface MongoCollection<
	DBInterface extends { _id: ProtectedString<any> },
> extends MongoReadOnlyCollection<DBInterface> {
	/**
	 * Insert a document in the collection.  Returns its unique _id.
	 * @param doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
	 */
	insert(doc: DBInterface): DBInterface['_id']

	/**
	 * Remove documents from the collection
	 * @param selector Specifies which documents to remove
	 */
	remove(selector: MongoQuery<DBInterface> | DBInterface['_id']): number

	/**
	 * Modify one or more documents in the collection. Returns the number of matched documents.
	 * @param selector Specifies which documents to modify
	 * @param modifier Specifies how to modify the documents
	 */
	update(
		selector: DBInterface['_id'] | { _id: DBInterface['_id'] },
		modifier: MongoModifier<DBInterface>,
		options?: UpdateOptions
	): number
	update(
		selector: MongoQuery<DBInterface>,
		modifier: MongoModifier<DBInterface>,
		// Require { multi } to be set when selecting multiple documents to be updated, otherwise only the first found document will be updated
		options: UpdateOptions & Required<Pick<UpdateOptions, 'multi'>>
	): number

	/**
	 * Modify one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified) and
	 * `insertedId` (the unique _id of the document that was inserted, if any).
	 * @param selector Specifies which documents to modify
	 * @param modifier Specifies how to modify the documents
	 */
	upsert(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		modifier: MongoModifier<DBInterface>,
		options?: UpsertOptions
	): {
		numberAffected?: number
		insertedId?: DBInterface['_id']
	}
}

// Note: This is a subset of the Meteor Mongo.Cursor type
export interface MongoCursor<DBInterface extends { _id: ProtectedString<any> }> {
	/**
	 * Returns the number of documents that match a query.
	 * @param applySkipLimit If set to `false`, the value returned will reflect the total number of matching documents, ignoring any value supplied for limit. (Default: true)
	 */
	count(applySkipLimit?: boolean): number

	/**
	 * Return all matching documents as an Array.
	 */
	fetch(): Array<DBInterface>

	/**
	 * Call `callback` once for each matching document, sequentially and
	 *          synchronously.
	 * @param callback Function to call. It will be called with three arguments: the document, a 0-based index, and <em>cursor</em> itself.
	 * @param thisArg An object which will be the value of `this` inside `callback`.
	 */
	forEach(callback: (doc: DBInterface, index: number, cursor: MongoCursor<DBInterface>) => void, thisArg?: any): void

	/**
	 * Map callback over all matching documents. Returns an Array.
	 * @param callback Function to call. It will be called with three arguments: the document, a 0-based index, and <em>cursor</em> itself.
	 * @param thisArg An object which will be the value of `this` inside `callback`.
	 */
	map<M>(callback: (doc: DBInterface, index: number, cursor: MongoCursor<DBInterface>) => M, thisArg?: any): Array<M>

	[Symbol.iterator](): Iterator<DBInterface, never, never>
}
