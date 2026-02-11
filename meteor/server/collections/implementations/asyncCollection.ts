import { MongoModifier, MongoQuery, ObserveChangesOptions } from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString, protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import {
	UpdateOptions,
	UpsertOptions,
	IndexSpecifier,
	MongoCursor,
	FindOptions,
	ObserveChangesCallbacks,
	ObserveCallbacks,
} from '@sofie-automation/meteor-lib/dist/collections/lib'
import type { AnyBulkWriteOperation, Collection as RawCollection, Db as RawDb } from 'mongodb'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { NpmModuleMongodb } from 'meteor/npm-mongo'
import { profiler } from '../../api/profiler'
import { PromisifyCallbacks } from '@sofie-automation/shared-lib/dist/lib/types'
import { AsyncOnlyMongoCollection } from '../collection'

/**
 * A stripped down version of Meteor's Mongo.Cursor, with only the async methods
 */
export type MinimalMongoCursor<T extends { _id: ProtectedString<any> }> = Pick<
	MongoCursor<T>,
	'fetchAsync' | 'observeChangesAsync' | 'observeAsync' | 'countAsync'
	// | 'forEach' | 'map' |
>
/**
 * A stripped down version of Meteor's Mongo.Collection, with only the async methods
 */
export type MinimalMeteorMongoCollection<T extends { _id: ProtectedString<any> }> = Pick<
	Mongo.Collection<T>,
	'insertAsync' | 'removeAsync' | 'updateAsync' | 'upsertAsync' | 'rawCollection' | 'rawDatabase' | 'createIndex'
> & {
	find: (...args: Parameters<Mongo.Collection<T>['find']>) => MinimalMongoCursor<T>
}

export class WrappedAsyncMongoCollection<
	DBInterface extends { _id: ProtectedString<any> },
> implements AsyncOnlyMongoCollection<DBInterface> {
	protected readonly _collection: MinimalMeteorMongoCollection<DBInterface>

	public readonly name: string | null

	constructor(collection: Mongo.Collection<DBInterface>, name: string | null) {
		this._collection = collection as any
		this.name = name
	}

	protected get _isMock(): boolean {
		// @ts-expect-error re-export private property
		return this._collection._isMock
	}

	public get mockCollection(): MinimalMeteorMongoCollection<DBInterface> {
		return this._collection
	}

	get mutableCollection(): AsyncOnlyMongoCollection<DBInterface> {
		return this
	}

	protected wrapMongoError(e: unknown): never {
		const str = stringifyError(e) || 'Unknown MongoDB Error'
		throw new Meteor.Error(e instanceof Meteor.Error ? e.error : 500, `Collection "${this.name}": ${str}`)
	}

	rawCollection(): RawCollection<DBInterface> {
		return this._collection.rawCollection() as any
	}
	protected rawDatabase(): RawDb {
		return this._collection.rawDatabase() as any
	}

	async findFetchAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): Promise<Array<DBInterface>> {
		const span = profiler.startSpan(`MongoCollection.${this.name}.findFetch`)
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}
		try {
			const res = await this._collection.find((selector ?? {}) as any, options as any).fetchAsync()
			if (span) span.end()
			return res
		} catch (e) {
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}

	async findOneAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): Promise<DBInterface | undefined> {
		const span = profiler.startSpan(`MongoCollection.${this.name}.findOne`)
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}
		try {
			const arr = await this._collection
				.find((selector ?? {}) as any, { ...(options as any), limit: 1 })
				.fetchAsync()
			if (span) span.end()
			return arr[0]
		} catch (e) {
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}

	async findWithCursor(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: FindOptions<DBInterface>
	): Promise<MinimalMongoCursor<DBInterface>> {
		const span = profiler.startSpan(`MongoCollection.${this.name}.findCursor`)
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}
		try {
			const res = this._collection.find((selector ?? {}) as any, options as any)
			if (span) span.end()
			return res
		} catch (e) {
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}

	async observeChanges(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveChangesCallbacks<DBInterface>>,
		findOptions?: FindOptions<DBInterface>,
		callbackOptions?: ObserveChangesOptions
	): Promise<Meteor.LiveQueryHandle> {
		const span = profiler.startSpan(`MongoCollection.${this.name}.observeChanges`)
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}
		try {
			const res = await this._collection
				.find((selector ?? {}) as any, findOptions as any)
				.observeChangesAsync(callbacks, callbackOptions)
			if (span) span.end()
			return res
		} catch (e) {
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}

	async observe(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveCallbacks<DBInterface>>,
		options?: FindOptions<DBInterface>
	): Promise<Meteor.LiveQueryHandle> {
		const span = profiler.startSpan(`MongoCollection.${this.name}.observe`)
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}
		try {
			const res = await this._collection.find((selector ?? {}) as any, options as any).observeAsync(callbacks)
			if (span) span.end()
			return res
		} catch (e) {
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}

	public async countDocuments(
		selector?: MongoQuery<DBInterface>,
		options?: FindOptions<DBInterface>
	): Promise<number> {
		const span = profiler.startSpan(`MongoCollection.${this.name}.countDocuments`)
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}
		try {
			const res = await this._collection.find((selector ?? {}) as any, options as any).countAsync()
			if (span) span.end()
			return res
		} catch (e) {
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}

	public async insertAsync(doc: DBInterface): Promise<DBInterface['_id']> {
		const span = profiler.startSpan(`MongoCollection.${this.name}.insert`)
		if (span) {
			span.addLabels({
				collection: this.name,
				id: unprotectString(doc._id),
			})
		}
		try {
			const resultId = await this._collection.insertAsync(doc as unknown as Mongo.OptionalId<DBInterface>)
			if (span) span.end()
			return protectString(resultId)
		} catch (e) {
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}

	async insertManyAsync(docs: DBInterface[]): Promise<Array<DBInterface['_id']>> {
		return Promise.all(docs.map(async (doc) => this.insertAsync(doc)))
	}

	public async removeAsync(selector: MongoQuery<DBInterface> | DBInterface['_id']): Promise<number> {
		const span = profiler.startSpan(`MongoCollection.${this.name}.remove`)
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}
		try {
			const res = await this._collection.removeAsync(selector as any)
			if (span) span.end()
			return res
		} catch (e) {
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}
	public async updateAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'] | { _id: DBInterface['_id'] },
		modifier: MongoModifier<DBInterface>,
		options?: UpdateOptions
	): Promise<number> {
		const span = profiler.startSpan(`MongoCollection.${this.name}.update`)
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}
		try {
			const res = await this._collection.updateAsync(selector as any, modifier as any, options)
			if (span) span.end()
			return res
		} catch (e) {
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}
	public async upsertAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'] | { _id: DBInterface['_id'] },
		modifier: MongoModifier<DBInterface>,
		options?: UpsertOptions
	): Promise<{
		numberAffected?: number
		insertedId?: DBInterface['_id']
	}> {
		const span = profiler.startSpan(`MongoCollection.${this.name}.upsert`)
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}
		try {
			const result = await this._collection.upsertAsync(selector as any, modifier as any, options)
			if (span) span.end()
			return {
				numberAffected: result.numberAffected,
				insertedId: protectString(result.insertedId),
			}
		} catch (e) {
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}

	async upsertManyAsync(docs: DBInterface[]): Promise<{ numberAffected: number; insertedIds: DBInterface['_id'][] }> {
		const result: {
			numberAffected: number
			insertedIds: DBInterface['_id'][]
		} = {
			numberAffected: 0,
			insertedIds: [],
		}
		await Promise.all(
			docs.map(async (doc) =>
				this.upsertAsync(doc._id, { $set: doc }).then((r) => {
					if (r.numberAffected) result.numberAffected += r.numberAffected
					if (r.insertedId) result.insertedIds.push(r.insertedId)
				})
			)
		)
		return result
	}

	async bulkWriteAsync(ops: Array<AnyBulkWriteOperation<DBInterface>>): Promise<void> {
		const span = profiler.startSpan(`MongoCollection.${this.name}.bulkWrite`)
		if (span) {
			span.addLabels({
				collection: this.name,
				opCount: ops.length,
			})
		}

		if (ops.length > 0) {
			const rawCollection = this.rawCollection()
			const bulkWriteResult = await rawCollection.bulkWrite(ops, {
				ordered: false,
			})

			const writeErrors = bulkWriteResult?.getWriteErrors() ?? []
			if (writeErrors.length) {
				throw new Meteor.Error(500, `Errors in rawCollection.bulkWrite: ${writeErrors.join(',')}`)
			}
		}

		if (span) span.end()
	}

	createIndex(keys: IndexSpecifier<DBInterface> | string, options?: NpmModuleMongodb.CreateIndexesOptions): void {
		const span = profiler.startSpan(`MongoCollection.${this.name}.createIndex`)
		if (span) {
			span.addLabels({
				collection: this.name,
				keys: JSON.stringify(keys),
			})
		}
		try {
			const res = this._collection.createIndex(keys as any, options)
			if (span) span.end()
			return res
		} catch (e) {
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}
}
