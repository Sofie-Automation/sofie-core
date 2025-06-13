import PLazy from 'p-lazy'

export interface LazyInitialiseReadonly<T> {
	/** Return the value, loading it if required */
	get(): Promise<T>

	/** Get the value if it is already loaded */
	getIfLoaded(): T | undefined

	/** Check if the value has been loaded */
	isLoaded(): boolean
}

/** Lazy initialise a value. */
export class LazyInitialise<T> implements LazyInitialiseReadonly<T> {
	#value!: T
	#valueIsReplaced = false
	#loading: PLazy<void> | undefined

	/** Create the lazy wrapper, and provide the init function to be called when first fetched */
	public constructor(init: () => Promise<T>) {
		this.#loading = new PLazy<void>((resolve, reject) => {
			try {
				init()
					.then((v) => {
						if (!this.#valueIsReplaced) {
							this.#value = v
						}
						this.#loading = undefined
						resolve()
					})
					.catch((e) => reject(e))
			} catch (e) {
				// Catch edge-case if init() throws synchronously:
				reject(e)
			}
		})
	}

	/** Return the value, loading it if required */
	public async get(): Promise<T> {
		if (!this.isLoaded()) {
			await this.#loading
		}

		return this.#value
	}

	/** Get the value if it is already loaded */
	public getIfLoaded(): T | undefined {
		if (this.isLoaded()) {
			return this.#value
		} else {
			return undefined
		}
	}

	/** Check if the value has been loaded */
	public isLoaded(): boolean {
		return !this.#loading
	}

	/** Replace the contained value with something in memory */
	public setValue(value: T): void {
		this.#valueIsReplaced = true
		this.#value = value
		this.#loading = undefined
	}
}
