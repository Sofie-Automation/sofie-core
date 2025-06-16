/**
 * A store for persisting playout state between bluerpint method calls
 * This belongs to the Playlist and will be discarded when the Playlist is reset
 */
export interface BlueprintPlayoutPersistentStore<T = unknown> {
	/**
	 * Get all the data in the store
	 */
	getAll(): Partial<T>
	/**
	 * Retrieve a key of data from the store
	 * @param k The key to retrieve
	 */
	getKey<K extends keyof T>(k: K): T[K] | undefined
	/**
	 * Update a key of data in the store
	 * @param k The key to update
	 * @param v The value to set
	 */
	setKey<K extends keyof T>(k: K, v: T[K]): void
	/**
	 * Replace all the data in the store
	 * @param obj The new data
	 */
	setAll(obj: T): void
}
