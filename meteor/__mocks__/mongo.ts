import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { AsyncOnlyMongoCollection, AsyncOnlyReadOnlyMongoCollection } from '../server/collections/collection'
import { Collections } from '../server/collections/lib'

/**
 * Helpers for manipulating the in-memory collections during unit tests. The collections themselves are
 * `WrappedMockCollection`s backed by corelib's {@link InMemoryMongoCollection} (see
 * `server/collections/implementations/mock`); these helpers reach the backing store via `.mockCollection`.
 */
export namespace MongoMock {
	interface CollectionObject {
		_id: ProtectedString<any>
	}
	export interface MockCollection<T extends CollectionObject> {
		[id: string]: T
	}

	/** Replace all documents in a collection (fires no observe events). */
	export function mockSetData<T extends CollectionObject>(
		collection: AsyncOnlyMongoCollection<T>,
		data: MockCollection<T> | Array<T> | null
	): void {
		getInnerMockCollection(collection).mockSetData(data)
	}

	/** Empty every registered collection (fires no observe events). For test teardown. */
	export function deleteAllData(): void {
		for (const collection of Collections.values()) {
			;(collection.mutableCollection as any).mockCollection?.clear()
		}
	}

	/** The backing in-memory collection for a wrapped (mock) collection. */
	export function getInnerMockCollection<T extends { _id: ProtectedString<any> }>(
		collection: AsyncOnlyReadOnlyMongoCollection<T>
	): InMemoryMongoCollection<T> {
		return (collection as any).mockCollection
	}
}
