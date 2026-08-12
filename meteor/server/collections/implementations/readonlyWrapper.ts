import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import type { IndexDescriptionInfo } from 'mongodb'
import type { AsyncOnlyMongoCollection, AsyncOnlyReadOnlyMongoCollection, MinimalMongoCursor } from '../collection'

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
		...args: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observeChanges']>
	): Promise<void> {
		return this.#mutableCollection.observeChanges(...args)
	}

	async observe(...args: Parameters<AsyncOnlyReadOnlyMongoCollection<DBInterface>['observe']>): Promise<void> {
		return this.#mutableCollection.observe(...args)
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
