import { FindOptions, MongoModifier, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { NpmModuleMongodb } from 'meteor/npm-mongo'
import { PromisifyCallbacks } from '@sofie-automation/shared-lib/dist/lib/types'
import type { AnyBulkWriteOperation, Collection as RawCollection } from 'mongodb'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { registerCollection } from './lib'
import { WrappedMockCollection } from './implementations/mock'
import { WrappedAsyncMongoCollection } from './implementations/asyncCollection'
import { WrappedReadOnlyMongoCollection } from './implementations/readonlyWrapper'
import {
	FieldNames,
	IndexSpecifier,
	ObserveCallbacks,
	ObserveChangesCallbacks,
	UpdateOptions,
	UpsertOptions,
} from '@sofie-automation/meteor-lib/dist/collections/lib'
import { MinimalMongoCursor } from './implementations/asyncCollection'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'

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
 * Map of current collection objects.
 * Future: Could this weakly hold the collections?
 */
export const collectionsCache = new Map<string, Mongo.Collection<any>>()
export function getOrCreateMongoCollection(name: string): Mongo.Collection<any> {
	const collection = collectionsCache.get(name)
	if (collection) {
		return collection
	}

	const newCollection = new Mongo.Collection(name)
	collectionsCache.set(name, newCollection)
	return newCollection
}

/**
 * Create a fully featured MongoCollection
 * @param name Name of the collection in mongodb
 * @param allowRules The 'allow' rules for publications. Set to `false` to make readonly
 */
export function createAsyncOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: CollectionName,
	allowRules: CustomMongoAllowRules<DBInterface> | false
): AsyncOnlyMongoCollection<DBInterface> {
	const collection = getOrCreateMongoCollection(name)

	if (allowRules) {
		if (allowRules.requiredPermissions.length === 0)
			throw new Meteor.Error(403, `No permissions specified for collection "${name}"`)

		collectionsAllowDenyCache.set(name, allowRules as CustomMongoAllowRules<any>)
	}

	const wrappedCollection = wrapMeteorCollectionIntoAsyncCollection<DBInterface>(collection, name)

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
	const collection = getOrCreateMongoCollection(name)

	const mutableCollection = wrapMeteorCollectionIntoAsyncCollection<DBInterface>(collection, name)
	const readonlyCollection = new WrappedReadOnlyMongoCollection<DBInterface>(mutableCollection)

	registerCollection(name, readonlyCollection)

	return readonlyCollection
}

function wrapMeteorCollectionIntoAsyncCollection<DBInterface extends { _id: ProtectedString<any> }>(
	collection: Mongo.Collection<DBInterface>,
	name: CollectionName
) {
	if ((collection as any)._isMock) {
		// We use a special one in tests, to add some async which naturally doesn't happen in the collection
		return new WrappedMockCollection<DBInterface>(collection, name)
	} else {
		// Override the default mongodb methods, because the errors thrown by them doesn't contain the proper call stack
		return new WrappedAsyncMongoCollection<DBInterface>(collection, name)
	}
}

/**
 * A minimal Async only wrapping around the base Mongo.Collection type
 */
export interface AsyncOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends AsyncOnlyReadOnlyMongoCollection<DBInterface> {
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
	 * Perform an update/insert of a document
	 * @param selector A query describing the documents to update. Typically this will be an id
	 * @param modifier The operation to apply to each matching document
	 * @param options Options for the operation
	 */
	upsertAsync(
		selector: DBInterface['_id'] | { _id: DBInterface['_id'] },
		modifier: MongoModifier<DBInterface>,
		options?: UpsertOptions
	): Promise<{ numberAffected?: number; insertedId?: DBInterface['_id'] }>
	upsertAsync(
		selector: MongoQuery<DBInterface>,
		modifier: MongoModifier<DBInterface>,
		// Require { multi } to be set when selecting multiple documents to be updated, otherwise only the first found document will be updated
		options: UpdateOptions & Required<Pick<UpdateOptions, 'multi'>>
	): Promise<{ numberAffected?: number; insertedId?: DBInterface['_id'] }>

	/**
	 * Perform an upsert for multiple documents, based on the `_id` of each document
	 * @param documents Documents to upsert
	 */
	upsertManyAsync(doc: DBInterface[]): Promise<{ numberAffected: number; insertedIds: DBInterface['_id'][] }>

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
	bulkWriteAsync(ops: Array<AnyBulkWriteOperation<DBInterface>>): Promise<void>
}

/**
 * A minimal Async only wrapping around the base Mongo.Collection type
 */
export interface AsyncOnlyReadOnlyMongoCollection<DBInterface extends { _id: ProtectedString<any> }> {
	name: string | null

	/**
	 * Get a mutable handle to the collection
	 * Warning: This can be unsafe to use if the job-worker is processing a job
	 */
	mutableCollection: AsyncOnlyMongoCollection<DBInterface>

	/**
	 * Returns the [`Collection`](http://mongodb.github.io/node-mongodb-native/3.0/api/Collection.html) object corresponding to this collection from the
	 * [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
	 */
	rawCollection(): RawCollection<DBInterface>

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
		findOptions?: Omit<FindOptions<DBInterface>, 'fields'>,
		callbackOptions?: { nonMutatingCallbacks?: boolean | undefined }
	): Promise<Meteor.LiveQueryHandle>

	/**
	 * Observe changes on this collection
	 * @param selector A query describing the documents to find
	 */
	observe(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveCallbacks<DBInterface>>,
		options?: Omit<FindOptions<DBInterface>, 'fields'>
	): Promise<Meteor.LiveQueryHandle>

	/**
	 * Count the number of docuyments in a collection that match the selector.
	 * @param selector A query describing the documents to find
	 */
	countDocuments(selector?: MongoQuery<DBInterface>, options?: FindOptions<DBInterface>): Promise<number>

	createIndex(indexSpec: IndexSpecifier<DBInterface>, options?: NpmModuleMongodb.CreateIndexesOptions): void
}
