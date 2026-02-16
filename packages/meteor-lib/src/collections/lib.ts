import type { Collection as RawCollection, Db as RawDb } from 'mongodb'
import { MongoFieldSpecifier, MongoModifier, MongoQuery, SortSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'

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
	 * Returns the [`Collection`](http://mongodb.github.io/node-mongodb-native/3.0/api/Collection.html) object corresponding to this collection from the
	 * [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
	 */
	rawCollection(): RawCollection<DBInterface>

	/**
	 * Returns the [`Db`](http://mongodb.github.io/node-mongodb-native/3.0/api/Db.html) object corresponding to this collection's database connection from the
	 * [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
	 */
	rawDatabase(): RawDb

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

export interface UpdateOptions {
	/** True to modify all matching documents; false to only modify one of the matching documents (the default). */
	multi?: boolean
	/** True to insert a document if no matching documents are found. */
	upsert?: boolean
	/**
	 * Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to
	 * modify in an array field.
	 */
	arrayFilters?: { [identifier: string]: any }[]
}
export interface UpsertOptions {
	/** True to modify all matching documents; false to only modify one of the matching documents (the default). */
	multi?: boolean
}

export type IndexSpecifier<T> = {
	[P in keyof T]?: -1 | 1 | string
}

export interface MongoLiveQueryHandle {
	stop(): void
}

// Note: This is a subset of the Meteor Mongo.Cursor type
export interface MongoCursor<DBInterface extends { _id: ProtectedString<any> }> {
	/**
	 * Returns the number of documents that match a query.
	 * @param applySkipLimit If set to `false`, the value returned will reflect the total number of matching documents, ignoring any value supplied for limit. (Default: true)
	 */
	count(applySkipLimit?: boolean): number
	/**
	 * Returns the number of documents that match a query.
	 * @param applySkipLimit If set to `false`, the value returned will reflect the total number of matching documents, ignoring any value supplied for limit. (Default: true)
	 */
	countAsync(applySkipLimit?: boolean): Promise<number>
	/**
	 * Return all matching documents as an Array.
	 */
	fetch(): Array<DBInterface>
	/**
	 * Return all matching documents as an Array.
	 */
	fetchAsync(): Promise<Array<DBInterface>>
	/**
	 * Call `callback` once for each matching document, sequentially and
	 *          synchronously.
	 * @param callback Function to call. It will be called with three arguments: the document, a 0-based index, and <em>cursor</em> itself.
	 * @param thisArg An object which will be the value of `this` inside `callback`.
	 */
	forEach(callback: (doc: DBInterface, index: number, cursor: MongoCursor<DBInterface>) => void, thisArg?: any): void
	/**
	 * Call `callback` once for each matching document, sequentially and
	 *          synchronously.
	 * @param callback Function to call. It will be called with three arguments: the document, a 0-based index, and <em>cursor</em> itself.
	 * @param thisArg An object which will be the value of `this` inside `callback`.
	 */
	forEachAsync(
		callback: (doc: DBInterface, index: number, cursor: MongoCursor<DBInterface>) => void,
		thisArg?: any
	): Promise<void>
	/**
	 * Map callback over all matching documents. Returns an Array.
	 * @param callback Function to call. It will be called with three arguments: the document, a 0-based index, and <em>cursor</em> itself.
	 * @param thisArg An object which will be the value of `this` inside `callback`.
	 */
	map<M>(callback: (doc: DBInterface, index: number, cursor: MongoCursor<DBInterface>) => M, thisArg?: any): Array<M>
	/**
	 * Map callback over all matching documents. Returns an Array.
	 * @param callback Function to call. It will be called with three arguments: the document, a 0-based index, and <em>cursor</em> itself.
	 * @param thisArg An object which will be the value of `this` inside `callback`.
	 */
	mapAsync<M>(
		callback: (doc: DBInterface, index: number, cursor: MongoCursor<DBInterface>) => M,
		thisArg?: any
	): Promise<Array<M>>

	[Symbol.iterator](): Iterator<DBInterface, never, never>
	[Symbol.asyncIterator](): AsyncIterator<DBInterface, never, never>

	/**
	 * Watch a query. Receive callbacks as the result set changes.
	 * @param callbacks Functions to call to deliver the result set as it changes
	 */
	observe(callbacks: ObserveCallbacks<DBInterface>): MongoLiveQueryHandle
	/**
	 * Watch a query. Receive callbacks as the result set changes.
	 * @param callbacks Functions to call to deliver the result set as it changes
	 */
	observeAsync(callbacks: ObserveCallbacks<DBInterface>): Promise<MongoLiveQueryHandle>
	/**
	 * Watch a query. Receive callbacks as the result set changes. Only the differences between the old and new documents are passed to the callbacks.
	 * @param callbacks Functions to call to deliver the result set as it changes
	 */
	observeChanges(callbacks: ObserveChangesCallbacks<DBInterface>): MongoLiveQueryHandle
	/**
	 * Watch a query. Receive callbacks as the result set changes. Only the differences between the old and new documents are passed to the callbacks.
	 * @param callbacks Functions to call to deliver the result set as it changes
	 * @param options { nonMutatingCallbacks: boolean }
	 */
	observeChangesAsync(
		callbacks: ObserveChangesCallbacks<DBInterface>,
		options?: { nonMutatingCallbacks?: boolean | undefined }
	): Promise<MongoLiveQueryHandle>
}
export interface ObserveCallbacks<DBInterface> {
	added?(document: DBInterface): void
	addedAt?(document: DBInterface, atIndex: number, before: DBInterface): void
	changed?(newDocument: DBInterface, oldDocument: DBInterface): void
	changedAt?(newDocument: DBInterface, oldDocument: DBInterface, indexAt: number): void
	removed?(oldDocument: DBInterface): void
	removedAt?(oldDocument: DBInterface, atIndex: number): void
	movedTo?(document: DBInterface, fromIndex: number, toIndex: number, before: object): void
}
export interface ObserveChangesCallbacks<DBInterface extends { _id: ProtectedString<any> }> {
	added?(id: DBInterface['_id'], fields: object): void
	addedBefore?(id: DBInterface['_id'], fields: object, before: object): void
	changed?(id: DBInterface['_id'], fields: object): void
	movedBefore?(id: DBInterface['_id'], before: object): void
	removed?(id: DBInterface['_id']): void
}

export interface FindOneOptions<TRawDoc> {
	/** Sort order (default: natural order) */
	sort?: SortSpecifier<TRawDoc>
	/** Number of results to skip at the beginning */
	skip?: number
	/** @deprecated Dictionary of fields to return or exclude. */
	fields?: MongoFieldSpecifier<TRawDoc>
	/** Dictionary of fields to return or exclude. */
	projection?: MongoFieldSpecifier<TRawDoc>
	/** (Client only) Default `true`; pass `false` to disable reactivity */
	reactive?: boolean
	/** Overrides `transform` on the  [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation. */
	//  transform?: Transform<TRawDoc, TDoc>;
	/** (Server only) Specifies a custom MongoDB readPreference for this particular cursor. Possible values are primary, primaryPreferred, secondary, secondaryPreferred and nearest. */
	readPreference?: string
}
export interface FindOptions<DBInterface> extends FindOneOptions<DBInterface> {
	/** Maximum number of results to return */
	limit?: number
	/** (Server only) Pass true to disable oplog-tailing on this query. This affects the way server processes calls to observe on this query. Disabling the oplog can be useful when working with data that updates in large batches. */
	disableOplog?: boolean
	/** (Server only) When oplog is disabled (through the use of disableOplog or when otherwise not available), the frequency (in milliseconds) of how often to poll this query when observing on the server. Defaults to 10000ms (10 seconds). */
	pollingIntervalMs?: number
	/** (Server only) When oplog is disabled (through the use of disableOplog or when otherwise not available), the minimum time (in milliseconds) to allow between re-polling when observing on the server. Increasing this will save CPU and mongo load at the expense of slower updates to users. Decreasing this is not recommended. Defaults to 50ms. */
	pollingThrottleMs?: number
	/** (Server only) If set, instructs MongoDB to set a time limit for this cursor's operations. If the operation reaches the specified time limit (in milliseconds) without the having been completed, an exception will be thrown. Useful to prevent an (accidental or malicious) unoptimized query from causing a full collection scan that would disrupt other database users, at the expense of needing to handle the resulting error. */
	maxTimeMs?: number
	/** (Server only) Overrides MongoDB's default index selection and query optimization process. Specify an index to force its use, either by its name or index specification. You can also specify { $natural : 1 } to force a forwards collection scan, or { $natural : -1 } for a reverse collection scan. Setting this is only recommended for advanced users. */
	hint?: string | object
}

export type FieldNames<DBInterface> = (keyof DBInterface)[]
