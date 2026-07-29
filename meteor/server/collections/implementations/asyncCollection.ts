import {
	MongoBulkWriteOperation,
	MongoModifier,
	MongoQuery,
	ObserveChangesCallbacks,
	ObserveCallbacks,
	FindObserveChangesOptions,
} from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { UpdateOptions, IndexSpecifier, FindOptions } from '@sofie-automation/meteor-lib/dist/collections/lib'
import type {
	Collection as RawCollection,
	CreateIndexesOptions,
	FindOptions as MongoFindOptions,
	IndexDescriptionInfo,
} from 'mongodb'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { MongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { profiler } from '../../api/profiler'
import { logger } from '../../logging'
import { PromisifyCallbacks } from '@sofie-automation/shared-lib/dist/lib/types'
import { AsyncOnlyMongoCollection, MinimalMongoCursor } from '../collection'
import { getMongoDb } from '../mongoConnection'
import {
	observeChangesViaChangeStream,
	observeViaChangeStream,
	ObserveMultiplexerDeps,
} from '../changeStream/observeMultiplexer'
import { ChangeStreamCursor } from '../changeStream/changeStreamCursor'
import { subscribeToCollectionChangeFeed } from '../changeStream/collectionChangeFeed'
import type { ObserveViewShape } from '@sofie-automation/corelib/dist/memoryCollection/observeView'
import type { LiveQueryHandleSync } from '../../lib/lib'

/**
 * Translate a meteor-lib {@link FindOptions} into the options the native `mongodb` driver accepts.
 * This is an explicit allow-list: only options known to be understood by the driver are forwarded.
 * The one translation needed is `fields` -> `projection` (the client minimongo still uses the
 * deprecated `fields` spelling). If more options need to be supported in future, add them here.
 */
export function convertFindOptionsToNative<T>(options: FindOptions<T> | undefined): MongoFindOptions | undefined {
	if (!options) return undefined

	const native: MongoFindOptions = {}
	if (options.sort !== undefined) native.sort = options.sort as any
	if (options.skip !== undefined) native.skip = options.skip
	if (options.limit !== undefined) native.limit = options.limit

	// Meteor's deprecated `fields` is the same as the driver's `projection`
	const projection = options.projection ?? options.fields
	if (projection !== undefined) native.projection = projection as any

	return native
}

export class WrappedAsyncMongoCollection<
	DBInterface extends { _id: ProtectedString<any> },
> implements AsyncOnlyMongoCollection<DBInterface> {
	public readonly name: string

	constructor(name: string) {
		this.name = name
	}

	protected get _isMock(): boolean {
		return false
	}

	get mutableCollection(): AsyncOnlyMongoCollection<DBInterface> {
		return this
	}

	/** Build the deps an observe-multiplexer needs for this collection + selector */
	private observeDeps(selector: MongoQuery<DBInterface>): ObserveMultiplexerDeps<DBInterface> {
		const collectionName = this.name
		return {
			// Note: fetch full documents (no projection) - the multiplexer projects in JS so the snapshot
			// and the change-event documents are projected identically.
			snapshot: async () =>
				this._rawCollection.find(selector as any).toArray() as unknown as Promise<DBInterface[]>,
			subscribeFeed: (onChange, onResync) => subscribeToCollectionChangeFeed(collectionName, onChange, onResync),
		}
	}

	protected wrapMongoError(e: unknown): never {
		const str = stringifyError(e) || 'Unknown MongoDB Error'
		throw new Meteor.Error(e instanceof Meteor.Error ? e.error : 500, `Collection "${this.name}": ${str}`)
	}

	/**
	 * The native `mongodb` driver collection, used for all data-access (CRUD).
	 * Resolved lazily so that it is safe to reference at module-load (e.g. from `registerIndex`),
	 * before the connection has been established.
	 * Future: Once we control the startup sequence, we could look at removing the lazy from this
	 */
	protected get _rawCollection(): RawCollection<DBInterface> {
		return getMongoDb().collection(this.name) as unknown as RawCollection<DBInterface>
	}

	private mongoSelector(selector: MongoQuery<DBInterface> | DBInterface['_id'] | undefined): MongoQuery<DBInterface> {
		if (selector === undefined || selector === null) return {} as MongoQuery<DBInterface>
		if (typeof selector === 'string') return { _id: selector } as MongoQuery<DBInterface>
		return selector
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
			const res = (await this._rawCollection
				.find(this.mongoSelector(selector) as any, convertFindOptionsToNative(options))
				.toArray()) as unknown as DBInterface[]
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
			const res = await this._rawCollection.findOne(
				this.mongoSelector(selector) as any,
				convertFindOptionsToNative(options)
			)
			if (span) span.end()
			return (res as unknown as DBInterface) ?? undefined
		} catch (e) {
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}

	private projectionOf(options: FindOptions<DBInterface> | undefined): MongoFieldSpecifier<DBInterface> | undefined {
		return (options?.projection ?? options?.fields) as MongoFieldSpecifier<DBInterface> | undefined
	}

	/**
	 * Extract the observe window shaping (sort/skip/limit) from find-options. Returns `undefined` when none
	 * is set, so the observe kernel keeps its fast (non-windowed) path and multiplexers de-dup correctly.
	 */
	private shapeOf(options: FindOptions<DBInterface> | undefined): ObserveViewShape<DBInterface> | undefined {
		if (!options) return undefined
		if (options.sort === undefined && options.skip === undefined && options.limit === undefined) return undefined
		return { sort: options.sort, skip: options.skip, limit: options.limit }
	}

	async findWithCursor(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: Omit<FindOptions<DBInterface>, 'fields'>
	): Promise<MinimalMongoCursor<DBInterface>> {
		const sel = this.mongoSelector(selector)
		return new ChangeStreamCursor<DBInterface>({
			collectionName: this.name,
			selector: sel,
			projection: this.projectionOf(options),
			shape: this.shapeOf(options),
			makeDeps: () => this.observeDeps(sel),
		})
	}

	async observeChanges(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveChangesCallbacks<DBInterface>>,
		options?: FindObserveChangesOptions<DBInterface>
	): Promise<LiveQueryHandleSync> {
		// Note: this span only covers the observer setup (initial snapshot + diff), not the lifetime of the observer
		const span = profiler.startSpan(`MongoCollection.${this.name}.observeChanges`)
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}
		const sel = this.mongoSelector(selector)
		const abort = new AbortController()
		try {
			await observeChangesViaChangeStream(
				this.name,
				sel,
				this.projectionOf(options),
				this.shapeOf(options),
				callbacks,
				abort.signal,
				!!options?.nonMutatingCallbacks,
				() => this.observeDeps(sel)
			)
			if (span) span.end()
			return {
				stop: () => {
					abort.abort()
				},
			}
		} catch (e) {
			abort.abort() // Ensure everything on the signal gets terminated
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}

	async observe(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveCallbacks<DBInterface>>,
		options?: FindObserveChangesOptions<DBInterface>
	): Promise<LiveQueryHandleSync> {
		// Note: this span only covers the observer setup (initial snapshot + diff), not the lifetime of the observer
		const span = profiler.startSpan(`MongoCollection.${this.name}.observe`)
		if (span) {
			span.addLabels({
				collection: this.name,
				query: JSON.stringify(selector),
			})
		}
		const sel = this.mongoSelector(selector)
		const abort = new AbortController()
		try {
			await observeViaChangeStream(
				this.name,
				sel,
				this.projectionOf(options),
				this.shapeOf(options),
				callbacks,
				abort.signal,
				!!options?.nonMutatingCallbacks,
				() => this.observeDeps(sel)
			)
			if (span) span.end()
			return {
				stop: () => {
					abort.abort()
				},
			}
		} catch (e) {
			abort.abort() // Ensure everything on the signal gets terminated
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
			const res = await this._rawCollection.countDocuments(
				this.mongoSelector(selector) as any,
				convertFindOptionsToNative(options) as any
			)
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
			const result = await this._rawCollection.insertOne(doc as any)
			if (span) span.end()
			return result.insertedId as unknown as DBInterface['_id']
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
			const result = await this._rawCollection.deleteMany(this.mongoSelector(selector) as any)
			if (span) span.end()
			return result.deletedCount
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
			const sel = this.mongoSelector(selector as any) as any
			const result = options?.multi
				? await this._rawCollection.updateMany(sel, modifier as any, options as any)
				: await this._rawCollection.updateOne(sel, modifier as any, options as any)
			if (span) span.end()
			return result.matchedCount
		} catch (e) {
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}

	public async replaceAsync(doc: DBInterface): Promise<boolean> {
		const span = profiler.startSpan(`MongoCollection.${this.name}.replace`)
		if (span) {
			span.addLabels({
				collection: this.name,
				id: unprotectString(doc._id),
			})
		}
		try {
			const result = await this._rawCollection.replaceOne({ _id: doc._id } as any, doc as any, {
				upsert: true,
			})
			if (span) span.end()
			// matchedCount > 0 means an existing document was replaced; otherwise a new one was inserted.
			return result.matchedCount > 0
		} catch (e) {
			if (span) span.end()
			this.wrapMongoError(e)
		}
	}

	async bulkWriteAsync(ops: Array<MongoBulkWriteOperation<DBInterface>>): Promise<void> {
		const span = profiler.startSpan(`MongoCollection.${this.name}.bulkWrite`)
		if (span) {
			span.addLabels({
				collection: this.name,
				opCount: ops.length,
			})
		}

		try {
			if (ops.length > 0) {
				const bulkWriteResult = await this._rawCollection.bulkWrite(ops, {
					ordered: false,
				})

				if (bulkWriteResult && bulkWriteResult.hasWriteErrors()) {
					throw new Meteor.Error(
						500,
						`Errors in rawCollection.bulkWrite: ${bulkWriteResult.getWriteErrors().join(',')}`
					)
				}
			}
		} catch (e) {
			this.wrapMongoError(e)
		} finally {
			if (span) span.end()
		}
	}

	createIndex(keys: IndexSpecifier<DBInterface> | string, options?: CreateIndexesOptions): void {
		const span = profiler.startSpan(`MongoCollection.${this.name}.createIndex`)
		if (span) {
			span.addLabels({
				collection: this.name,
				keys: JSON.stringify(keys),
			})
		}
		// The interface is synchronous (void); index creation is best-effort and happens at startup,
		// so fire-and-forget and log any failure rather than block.
		this._rawCollection.createIndex(keys as any, options).catch((e) => {
			logger.error(`Failed to create index on collection "${this.name}": ${stringifyError(e)}`)
		})
		if (span) span.end()
	}

	async getIndexes(): Promise<IndexDescriptionInfo[]> {
		try {
			return await this._rawCollection.indexes()
		} catch (e) {
			this.wrapMongoError(e)
		}
	}

	async dropIndex(indexName: string): Promise<void> {
		try {
			await this._rawCollection.dropIndex(indexName)
		} catch (e) {
			this.wrapMongoError(e)
		}
	}
}
