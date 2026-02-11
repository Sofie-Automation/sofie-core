/**
 * A store for persisting playout state between bluerpint method calls
 * This belongs to the Playlist and will be discarded when the Playlist is reset
 * This wraps both the 'privateData' and 'publicData' variants, the private variant only accessible to Blueprints, and the public variant available in APIs such as the LSG
 */
export interface BlueprintPlayoutPersistentStore<T = unknown> {
	/**
	 * Get all the private data in the store
	 */
	getAll(): Partial<T>
	/**
	 * Retrieve a key of private data from the store
	 * @param k The key to retrieve
	 */
	getKey<K extends keyof T>(k: K): T[K] | undefined
	/**
	 * Update a key of private data in the store
	 * @param k The key to update
	 * @param v The value to set
	 */
	setKey<K extends keyof T>(k: K, v: T[K]): void
	/**
	 * Replace all the private data in the store
	 * @param obj The new data
	 */
	setAll(obj: T): void

	/**
	 * Get all the public data in the store
	 */
	getAllPublic(): Partial<T>
	/**
	 * Retrieve a key of public data from the store
	 * @param k The key to retrieve
	 */
	getKeyPublic<K extends keyof T>(k: K): T[K] | undefined
	/**
	 * Update a key of public data in the store
	 * @param k The key to update
	 * @param v The value to set
	 */
	setKeyPublic<K extends keyof T>(k: K, v: T[K]): void
	/**
	 * Replace all the public data in the store
	 * @param obj The new data
	 */
	setAllPublic(obj: T): void
}
