import type { TimelinePersistentState } from '@sofie-automation/blueprints-integration'
import type { BlueprintPlayoutPersistentStore } from '@sofie-automation/blueprints-integration/dist/context/playoutStore'
import { clone } from '@sofie-automation/corelib/dist/lib'
import type { PlayoutModel } from '../../../playout/model/PlayoutModel.js'

export class PersistentPlayoutStateStore implements BlueprintPlayoutPersistentStore {
	#privateState: TimelinePersistentState | undefined
	#hasPrivateChanges = false
	#publicState: TimelinePersistentState | undefined
	#hasPublicChanges = false

	constructor(privateState: TimelinePersistentState | undefined, publicState: TimelinePersistentState | undefined) {
		this.#privateState = clone(privateState)
		this.#publicState = clone(publicState)
	}

	saveToModel(model: PlayoutModel): void {
		if (this.#hasPrivateChanges) model.setBlueprintPrivatePersistentState(this.#privateState)
		if (this.#hasPublicChanges) model.setBlueprintPublicPersistentState(this.#publicState)
	}

	getAll(): Partial<unknown> {
		return this.#privateState || {}
	}
	getKey<K extends never>(k: K): unknown {
		return this.#privateState?.[k]
	}
	setKey<K extends never>(k: K, v: unknown): void {
		if (!this.#privateState) this.#privateState = {}
		;(this.#privateState as any)[k] = v
		this.#hasPrivateChanges = true
	}
	setAll(obj: unknown): void {
		this.#privateState = obj
		this.#hasPrivateChanges = true
	}

	getAllPublic(): Partial<unknown> {
		return this.#publicState || {}
	}
	getKeyPublic<K extends never>(k: K): unknown {
		return this.#publicState?.[k]
	}
	setKeyPublic<K extends never>(k: K, v: unknown): void {
		if (!this.#publicState) this.#publicState = {}
		;(this.#publicState as any)[k] = v
		this.#hasPublicChanges = true
	}
	setAllPublic(obj: unknown): void {
		this.#publicState = obj
		this.#hasPublicChanges = true
	}
}
