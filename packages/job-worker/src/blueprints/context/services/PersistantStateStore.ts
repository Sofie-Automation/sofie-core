import type { TimelinePersistentState } from '@sofie-automation/blueprints-integration'
import type { BlueprintPlayoutPersistentStore } from '@sofie-automation/blueprints-integration/dist/context/playoutStore'
import { clone } from '@sofie-automation/corelib/dist/lib'

export class PersistentPlayoutStateStore implements BlueprintPlayoutPersistentStore {
	#state: TimelinePersistentState | undefined
	#hasChanges = false

	get hasChanges(): boolean {
		return this.#hasChanges
	}

	constructor(state: TimelinePersistentState | undefined) {
		this.#state = clone(state)
	}

	getAll(): Partial<unknown> {
		return this.#state || {}
	}
	getKey<K extends never>(k: K): unknown {
		return this.#state?.[k]
	}
	setKey<K extends never>(k: K, v: unknown): void {
		if (!this.#state) this.#state = {}
		;(this.#state as any)[k] = v
		this.#hasChanges = true
	}
	setAll(obj: unknown): void {
		this.#state = obj
		this.#hasChanges = true
	}
}
