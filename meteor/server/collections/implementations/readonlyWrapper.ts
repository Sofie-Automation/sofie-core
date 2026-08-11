import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import type { IndexDescriptionInfo } from 'mongodb'
import type { AsyncOnlyMongoCollection, AsyncOnlyReadOnlyMongoCollection, MinimalMongoCursor } from '../collection'
import type { WithSignal } from '../collection'
import type { FindObserveChangesOptions } from '@sofie-automation/corelib/dist/mongo'
import type { LiveQueryHandleSync } from '../../lib/lib'

export class WrappedReadOnlyMongoCollection<
	DBInterface extends { _id: ProtectedString<any> },
> implements AsyncOnlyReadOnlyMongoCollection<DBInterface> {
	readonly #mutableCollection: AsyncOnlyMongoCollection<DBInterface>

	constructor(collection: AsyncOnlyMongoCollection<DBInterface>) {
		this.#mutableCollection = collection
	}

	protected get _isMock(): boolean {
		// @ts-expect-error re-export private property
		return this.#mutableCollection._isMock
	}

	public get mockCollection(): any {
		// @ts-expect-error re-export private property
		return this.#mutableCollection.mockCollection
	}

	get mutableCollection(): AsyncOnlyMongoCollection<DBInterface> {
		return this.#mutableCollection
	}

	get name(): string {
		return this.#mutableCollection.name
	}

	async findFetchAsync(
		...args: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['findFetchAsync']>
	): Promise<DBInterface[]> {
		return this.#mutableCollection.findFetchAsync(...args)
	}

	async findOneAsync(
		...args: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['findOneAsync']>
	): Promise<DBInterface | undefined> {
		return this.#mutableCollection.findOneAsync(...args)
	}

	async findWithCursor(
		...args: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['findWithCursor']>
	): Promise<MinimalMongoCursor<DBInterface>> {
		return this.#mutableCollection.findWithCursor(...args)
	}

	async observeChanges(
		selector: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observeChanges']>[0],
		callbacks: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observeChanges']>[1],
		options: FindObserveChangesOptions<DBInterface> & WithSignal
	): Promise<void>
	async observeChanges(
		selector: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observeChanges']>[0],
		callbacks: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observeChanges']>[1],
		options?: FindObserveChangesOptions<DBInterface>
	): Promise<LiveQueryHandleSync>
	async observeChanges(
		selector: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observeChanges']>[0],
		callbacks: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observeChanges']>[1],
		options?: FindObserveChangesOptions<DBInterface>
	): Promise<LiveQueryHandleSync | void> {
		// Pass-through; the wrapped collection dispatches on the presence of a signal itself
		return this.#mutableCollection.observeChanges(selector, callbacks, options)
	}

	async observe(
		selector: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observe']>[0],
		callbacks: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observe']>[1],
		options: FindObserveChangesOptions<DBInterface> & WithSignal
	): Promise<void>
	async observe(
		selector: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observe']>[0],
		callbacks: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observe']>[1],
		options?: FindObserveChangesOptions<DBInterface>
	): Promise<LiveQueryHandleSync>
	async observe(
		selector: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observe']>[0],
		callbacks: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observe']>[1],
		options?: FindObserveChangesOptions<DBInterface>
	): Promise<LiveQueryHandleSync | void> {
		// Pass-through; the wrapped collection dispatches on the presence of a signal itself
		return this.#mutableCollection.observe(selector, callbacks, options)
	}

	async countDocuments(
		...args: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['countDocuments']>
	): Promise<number> {
		return this.#mutableCollection.countDocuments(...args)
	}

	createIndex(...args: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['createIndex']>): void {
		return this.#mutableCollection.createIndex(...args)
	}

	async getIndexes(): Promise<IndexDescriptionInfo[]> {
		return this.#mutableCollection.getIndexes()
	}

	async dropIndex(indexName: string): Promise<void> {
		return this.#mutableCollection.dropIndex(indexName)
	}
}
