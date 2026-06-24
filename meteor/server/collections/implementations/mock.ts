import {
	MongoQuery,
	ObserveChangesOptions,
	ObserveCallbacks,
	ObserveChangesCallbacks,
} from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { FindOptions } from '@sofie-automation/meteor-lib/dist/collections/lib'
import type { Collection as RawCollection } from 'mongodb'
import { AsyncOnlyMongoCollection } from '../collection'
import { MinimalMeteorMongoCollection, MinimalMongoCursor, WrappedAsyncMongoCollection } from './asyncCollection'
import { Mongo } from 'meteor/mongo'
import { PromisifyCallbacks } from '@sofie-automation/shared-lib/dist/lib/types'

/**
 * The collection wrapper used in unit tests. There is no real MongoDB connection (and so no native driver
 * or change streams), so CRUD and observing are backed by the in-memory mock collection
 * (`MongoMock.Collection`), which fires its own observers on write.
 */
export class WrappedMockCollection<DBInterface extends { _id: ProtectedString<any> }>
	extends WrappedAsyncMongoCollection<DBInterface>
	implements AsyncOnlyMongoCollection<DBInterface>
{
	readonly #mockCollection: MinimalMeteorMongoCollection<DBInterface>

	constructor(collection: Mongo.Collection<DBInterface>, name: string) {
		super(name)
		this.#mockCollection = collection as any

		// @ts-expect-error private property of the mock
		if (!collection._isMock)
			throw new Meteor.Error(500, 'WrappedMockCollection is only valid for a mock collection')
	}

	protected override get _isMock(): boolean {
		return true
	}

	public get mockCollection(): MinimalMeteorMongoCollection<DBInterface> {
		return this.#mockCollection
	}

	get mutableCollection(): AsyncOnlyMongoCollection<DBInterface> {
		return this
	}

	/**
	 * CRUD methods are backed by the in-memory mock's `rawCollection()` (which delegates to the mock
	 * methods and fires observers), matching the native-driver shape used in production.
	 */
	protected override get _rawCollection(): RawCollection<DBInterface> {
		return this.#mockCollection.rawCollection() as unknown as RawCollection<DBInterface>
	}

	/**
	 * Retrieve a cursor for use in a publication
	 * @param selector A query describing the documents to find
	 */
	override async findWithCursor(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): Promise<MinimalMongoCursor<DBInterface>> {
		return this.#mockCollection.find((selector ?? {}) as any, options as any)
	}

	// Observing is served by the mock's own in-memory observe (not the change-stream engine, which needs
	// a real database). The mock cursor already fires added/changed/removed on writes.

	override async observeChanges(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveChangesCallbacks<DBInterface>>,
		findOptions?: FindOptions<DBInterface>,
		callbackOptions?: ObserveChangesOptions
	): Promise<Meteor.LiveQueryHandle> {
		return this.#mockCollection
			.find((selector ?? {}) as any, findOptions as any)
			.observeChangesAsync(callbacks, callbackOptions)
	}

	override async observe(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveCallbacks<DBInterface>>,
		options?: FindOptions<DBInterface>
	): Promise<Meteor.LiveQueryHandle> {
		return this.#mockCollection.find((selector ?? {}) as any, options as any).observeAsync(callbacks)
	}
}

/**
 * Create a mock-backed collection. This is the one place that constructs the in-memory mock collection
 * (`new Mongo.Collection(name)`, which resolves to `MongoMock.Collection` under jest).
 */
export function createMockCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: string
): WrappedMockCollection<DBInterface> {
	return new WrappedMockCollection<DBInterface>(new Mongo.Collection<DBInterface>(name), name)
}
