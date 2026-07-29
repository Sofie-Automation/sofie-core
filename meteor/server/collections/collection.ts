import {
	FindOptions,
	MongoBulkWriteOperation,
	MongoModifier,
	MongoQuery,
	ObserveCallbacks,
	ObserveChangesCallbacks,
	FindObserveChangesOptions,
} from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { PromisifyCallbacks } from '@sofie-automation/shared-lib/dist/lib/types'
import type { CreateIndexesOptions, IndexDescriptionInfo } from 'mongodb'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { registerCollection } from './lib'
import { createMockCollection } from './implementations/mock'
import { WrappedAsyncMongoCollection } from './implementations/asyncCollection'
import { WrappedReadOnlyMongoCollection } from './implementations/readonlyWrapper'
import {
	FieldNames,
	IndexSpecifier,
	MongoLiveQueryHandle,
	UpdateOptions,
} from '@sofie-automation/meteor-lib/dist/collections/lib'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { isInTestMode } from '../lib'

export interface CustomMongoAllowRules<DBInterface> {
	// insert?: (userId: UserId | null, doc: DBInterface) => Promise<boolean> | boolean
	requiredPermissions: Array<keyof UserPermissions>
	update: (
		permissions: UserPermissions,
		doc: DBInterface,
		fieldNames: FieldNames<DBInterface>,
		modifier: MongoModifier<DBInterface>
	) => Promise<boolean> | boolean
	// remove?: (userId: UserId | null, doc: DBInterface) => Promise<boolean> | boolean
}

export const collectionsAllowDenyCache = new Map<string, CustomMongoAllowRules<any>>()

/**
 * Create a fully featured MongoCollection
 * @param name Name of the collection in mongodb
 * @param allowRules The 'allow' rules for publications. Set to `false` to make readonly
 */
export function createAsyncOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: CollectionName,
	allowRules: CustomMongoAllowRules<DBInterface> | false
): AsyncOnlyMongoCollection<DBInterface> {
	if (allowRules) {
		if (allowRules.requiredPermissions.length === 0)
			throw new Meteor.Error(403, `No permissions specified for collection "${name}"`)

		collectionsAllowDenyCache.set(name, allowRules as CustomMongoAllowRules<any>)
	}

	const wrappedCollection = createWrappedCollection<DBInterface>(name)

	registerCollection(name, wrappedCollection)

	return wrappedCollection
}

/**
 * Create a fully featured MongoCollection
 * Note: this will automatically make this collection readonly to any publications
 * @param name Name of the collection in mongodb
 */
export function createAsyncOnlyReadOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: CollectionName
): AsyncOnlyReadOnlyMongoCollection<DBInterface> {
	const mutableCollection = createWrappedCollection<DBInterface>(name)
	const readonlyCollection = new WrappedReadOnlyMongoCollection<DBInterface>(mutableCollection)

	registerCollection(name, readonlyCollection)

	return readonlyCollection
}

function createWrappedCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: CollectionName
): AsyncOnlyMongoCollection<DBInterface> {
	if (isInTestMode()) {
		// In unit tests there is no real database, so back the collection with the in-memory mock
		return createMockCollection<DBInterface>(name)
	} else {
		// Backed by the native mongodb driver (CRUD) and the change-stream observe engine
		return new WrappedAsyncMongoCollection<DBInterface>(name)
	}
}

/**
 * A minimal mongo cursor, with only the async methods used by the codebase.
 * This is intentionally only the observe methods, kept for publication usage to avoid a larger refactor
 */
export interface MinimalMongoCursor<T extends { _id: ProtectedString<any> }> {
	readonly collectionName: string | null

	/**
	 * Watch a query. Receive callbacks as the result set changes.
	 * @param callbacks Functions to call to deliver the result set as it changes
	 */
	observeAsync(callbacks: ObserveCallbacks<T>): Promise<MongoLiveQueryHandle>
	/**
	 * Watch a query. Receive callbacks as the result set changes. Only the differences between the old and new documents are passed to the callbacks.
	 * @param callbacks Functions to call to deliver the result set as it changes
	 * @param options { nonMutatingCallbacks: boolean }
	 */
	observeChangesAsync(
		callbacks: ObserveChangesCallbacks<T>,
		options?: { nonMutatingCallbacks?: boolean | undefined }
	): Promise<MongoLiveQueryHandle>
}

/**
 * A minimal Async only wrapping around the base Mongo.Collection type
 */
export interface AsyncOnlyMongoCollection<
	DBInterface extends { _id: ProtectedString<any> },
> extends AsyncOnlyReadOnlyMongoCollection<DBInterface> {
	/**
	 * Insert a document
	 * @param document The document to insert
	 */
	insertAsync(doc: DBInterface): Promise<DBInterface['_id']>

	/**
	 * Insert multiple documents
	 * @param documents The documents to insert
	 */
	insertManyAsync(doc: DBInterface[]): Promise<Array<DBInterface['_id']>>

	/**
	 * Perform an update of a document
	 * @param selector A query describing the documents to update
	 * @param modifier The operation to apply to each matching document
	 * @param options Options for the operation
	 */
	updateAsync(
		selector: DBInterface['_id'] | ({ _id: DBInterface['_id'] } & MongoQuery<Omit<DBInterface, '_id'>>),
		modifier: MongoModifier<DBInterface>,
		options?: UpdateOptions
	): Promise<number>
	updateAsync(
		selector: MongoQuery<DBInterface>,
		modifier: MongoModifier<DBInterface>,
		// Require { multi } to be set when selecting multiple documents to be updated, otherwise only the first found document will be updated
		options: UpdateOptions & Required<Pick<UpdateOptions, 'multi'>>
	): Promise<number>

	/**
	 * Replace a single document with a full document, matched by its `_id` (upserting if not present).
	 * @param doc The full document to store
	 * @returns `true` if an existing document was replaced, `false` if a new one was inserted
	 */
	replaceAsync(doc: DBInterface): Promise<boolean>

	/**
	 * Remove one or more documents
	 * @param selector A query describing the documents to be deleted
	 */
	removeAsync(selector: MongoQuery<DBInterface> | DBInterface['_id']): Promise<number>

	/**
	 * Perform multiple operations on the collection in one operation
	 * This should be used instead of Promise.all(...) when doing multiple updates, as it is more performant
	 * @param ops Operations to perform
	 */
	bulkWriteAsync(ops: Array<MongoBulkWriteOperation<DBInterface>>): Promise<void>
}

/**
 * A minimal Async only wrapping around the base Mongo.Collection type
 */
export interface AsyncOnlyReadOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }> {
	readonly name: string

	/**
	 * Get a mutable handle to the collection
	 * Warning: This can be unsafe to use if the job-worker is processing a job
	 */
	readonly mutableCollection: AsyncOnlyMongoCollection<DBInterface>

	/**
	 * Find and return multiple documents
	 * @param selector A query describing the documents to find
	 * @param options Options for the operation
	 */
	findFetchAsync(
		selector: MongoQuery<DBInterface>,
		options?: Omit<FindOptions<DBInterface>, 'fields'>
	): Promise<Array<DBInterface>>

	/**
	 * Find and return a document
	 * @param selector A query describing the document to find
	 * @param options Options for the operation
	 */
	findOneAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: Omit<FindOptions<DBInterface>, 'fields'>
	): Promise<DBInterface | undefined>

	/**
	 * Retrieve a cursor for use in a publication
	 * @param selector A query describing the documents to find
	 */
	findWithCursor(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: Omit<FindOptions<DBInterface>, 'fields'>
	): Promise<MinimalMongoCursor<DBInterface>>

	/**
	 * Observe changes on this collection
	 * @param selector A query describing the documents to find
	 */
	observeChanges(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveChangesCallbacks<DBInterface>>,
		options?: FindObserveChangesOptions<DBInterface>
	): Promise<Meteor.LiveQueryHandle>

	/**
	 * Observe changes on this collection
	 * @param selector A query describing the documents to find
	 */
	observe(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveCallbacks<DBInterface>>,
		options?: FindObserveChangesOptions<DBInterface>
	): Promise<Meteor.LiveQueryHandle>

	/**
	 * Count the number of docuyments in a collection that match the selector.
	 * @param selector A query describing the documents to find
	 */
	countDocuments(selector?: MongoQuery<DBInterface>, options?: FindOptions<DBInterface>): Promise<number>

	/**
	 * Ensure an index exists on this collection.
	 * Note: this is fire-and-forget; the index is created in the background and failures are logged.
	 * @param indexSpec The fields to index, e.g. `{ rundownId: 1, _rank: 1 }`
	 * @param options Options for the index, e.g. `{ unique: true }`
	 */
	createIndex(indexSpec: IndexSpecifier<DBInterface>, options?: CreateIndexesOptions): void

	/**
	 * List the indexes that currently exist on this collection in the database
	 */
	getIndexes(): Promise<IndexDescriptionInfo[]>

	/**
	 * Drop an index from this collection
	 * @param indexName The name of the index to drop
	 */
	dropIndex(indexName: string): Promise<void>
}
