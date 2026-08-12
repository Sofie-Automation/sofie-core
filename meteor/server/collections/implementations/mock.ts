import {
	FindOptions,
	MongoBulkWriteOperation,
	MongoModifier,
	MongoQuery,
	ObserveCallbacks,
	ObserveChangesCallbacks,
	FindObserveChangesOptions,
	ObserveChangesOptions,
} from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import type { CreateIndexesOptions, IndexDescriptionInfo } from 'mongodb'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { PromisifyCallbacks } from '@sofie-automation/shared-lib/dist/lib/types'
import { UpdateOptions, IndexSpecifier } from '@sofie-automation/meteor-lib/dist/collections/lib'
import { AsyncOnlyMongoCollection, MinimalMongoCursor, WithSignal } from '../collection'
import { startObserveOnSignal } from '../../lib/observerLifetime'

/**
 * Captured at module load, which is always before a test body can install `jest.useFakeTimers()`.
 * {@link WrappedMockCollection} must yield on a *real* timer, so that its methods still resolve in tests
 * that have taken control of the fake clock.
 */
const realSetTimeout = setTimeout

/**
 * The collection used in unit tests: an async veneer over the in-memory {@link InMemoryMongoCollection}.
 * Each method forces a real-timer tick before delegating to the synchronous core, so callers cannot
 * accidentally rely on writes resolving synchronously. Observe callbacks, by contrast, are delivered via
 * `setImmediate`, which jest *does* fake, so `jest.useFakeTimers()` + `runAllTimers()` tests see them on a
 * later tick.
 */
export class WrappedMockCollection<
	DBInterface extends { _id: ProtectedString<any> },
> implements AsyncOnlyMongoCollection<DBInterface> {
	readonly #core: InMemoryMongoCollection<DBInterface>

	/**
	 * Delay (ms) before a bulkWrite begins, simulating the async nature of writes to mongo and aiming to
	 * surface race conditions in our code.
	 */
	asyncBulkWriteDelay = 100

	constructor(name: string) {
		this.#core = new InMemoryMongoCollection<DBInterface>(name, {
			observerDeliveryScheduler: (fn) => setImmediate(fn),
		})
	}

	protected get _isMock(): boolean {
		return true
	}

	/** Force a real-timer tick so callers can't rely on the synchronous core resolving synchronously. */
	async #sleep(time: number): Promise<void> {
		await new Promise<void>((resolve) => realSetTimeout(resolve, time))
	}

	get name(): string {
		return this.#core.name
	}

	get mutableCollection(): AsyncOnlyMongoCollection<DBInterface> {
		return this
	}

	/** The backing in-memory collection (exposes `observers` for tests, `mockSetData`/`clear` for helpers). */
	get mockCollection(): InMemoryMongoCollection<DBInterface> {
		return this.#core
	}

	async findFetchAsync(
		selector: MongoQuery<DBInterface>,
		options?: Omit<FindOptions<DBInterface>, 'fields'>
	): Promise<Array<DBInterface>> {
		await this.#sleep(0)
		return this.#core.findFetch(selector, options)
	}

	async findOneAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: Omit<FindOptions<DBInterface>, 'fields'>
	): Promise<DBInterface | undefined> {
		await this.#sleep(0)
		return this.#core.findOne(selector, options)
	}

	async findWithCursor(
		selector?: MongoQuery<DBInterface> | DBInterface['_id'],
		options?: Omit<FindOptions<DBInterface>, 'fields'>
	): Promise<MinimalMongoCursor<DBInterface>> {
		await this.#sleep(0)
		return {
			collectionName: this.#core.name,
			observeAsync: async (callbacks: ObserveCallbacks<DBInterface>, cursorOptions: WithSignal) =>
				startObserveOnSignal(cursorOptions.signal, async (signal) => {
					await this.#sleep(0)
					this.#core.observe(callbacks, selector, { ...options, signal })
				}),
			observeChangesAsync: async (
				callbacks: ObserveChangesCallbacks<DBInterface>,
				callbackOptions: ObserveChangesOptions & WithSignal
			) =>
				startObserveOnSignal(callbackOptions.signal, async (signal) => {
					await this.#sleep(0)
					this.#core.observeChanges(callbacks, selector, { ...options, ...callbackOptions, signal })
				}),
		} as MinimalMongoCursor<DBInterface>
	}

	async observe(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveCallbacks<DBInterface>>,
		options: FindObserveChangesOptions<DBInterface> & WithSignal
	): Promise<void> {
		return startObserveOnSignal(options.signal, async (signal) => {
			await this.#sleep(0)
			this.#core.observe(callbacks, selector, { ...options, signal })
		})
	}

	async observeChanges(
		selector: MongoQuery<DBInterface> | DBInterface['_id'],
		callbacks: PromisifyCallbacks<ObserveChangesCallbacks<DBInterface>>,
		options: FindObserveChangesOptions<DBInterface> & WithSignal
	): Promise<void> {
		return startObserveOnSignal(options.signal, async (signal) => {
			await this.#sleep(0)
			this.#core.observeChanges(callbacks, selector, { ...options, signal })
		})
	}

	async countDocuments(selector?: MongoQuery<DBInterface>, options?: FindOptions<DBInterface>): Promise<number> {
		await this.#sleep(0)
		return this.#core.count(selector, options)
	}

	createIndex(_indexSpec: IndexSpecifier<DBInterface>, _options?: CreateIndexesOptions): void {
		// No indexes in the in-memory mock
	}

	async getIndexes(): Promise<IndexDescriptionInfo[]> {
		return []
	}

	async dropIndex(_indexName: string): Promise<void> {
		// No indexes in the in-memory mock
	}

	async insertAsync(doc: DBInterface): Promise<DBInterface['_id']> {
		await this.#sleep(0)
		return this.#core.insert(doc)
	}

	async insertManyAsync(docs: DBInterface[]): Promise<Array<DBInterface['_id']>> {
		return Promise.all(docs.map(async (doc) => this.insertAsync(doc)))
	}

	async updateAsync(
		selector: MongoQuery<DBInterface> | DBInterface['_id'] | { _id: DBInterface['_id'] },
		modifier: MongoModifier<DBInterface>,
		options?: UpdateOptions
	): Promise<number> {
		await this.#sleep(0)
		return this.#core.update(selector as MongoQuery<DBInterface> | DBInterface['_id'], modifier, options)
	}

	async replaceAsync(doc: DBInterface): Promise<boolean> {
		await this.#sleep(0)
		return this.#core.replace(doc)
	}

	async removeAsync(selector: MongoQuery<DBInterface> | DBInterface['_id']): Promise<number> {
		await this.#sleep(0)
		return this.#core.remove(selector)
	}

	async bulkWriteAsync(ops: Array<MongoBulkWriteOperation<DBInterface>>): Promise<void> {
		await this.#sleep(this.asyncBulkWriteDelay)
		this.#core.bulkWrite(ops)
	}
}

/** Create a mock-backed collection. The one place that constructs the in-memory test collection. */
export function createMockCollection<DBInterface extends { _id: ProtectedString<any> }>(
	name: string
): WrappedMockCollection<DBInterface> {
	return new WrappedMockCollection<DBInterface>(name)
}
