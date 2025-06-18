import type { SofieIngestPart, MutableIngestPart } from '@sofie-automation/blueprints-integration'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'

export class MutableIngestPartImpl<TPartPayload = unknown> implements MutableIngestPart<TPartPayload> {
	readonly #ingestPart: Omit<SofieIngestPart<TPartPayload>, 'rank'>
	#hasChanges = false

	constructor(ingestPart: Omit<SofieIngestPart<TPartPayload>, 'rank'>, hasChanges = false) {
		this.#ingestPart = ingestPart
		this.#hasChanges = hasChanges
	}

	get externalId(): string {
		return this.#ingestPart.externalId
	}

	get name(): string {
		return this.#ingestPart.name
	}

	get float(): boolean {
		return this.#ingestPart.float ?? false
	}

	get autoNext(): boolean {
		return this.#ingestPart.autoNext ?? false
	}

	get payload(): ReadonlyDeep<TPartPayload> | undefined {
		return this.#ingestPart.payload as ReadonlyDeep<TPartPayload>
	}

	get userEditStates(): Record<string, boolean> {
		return this.#ingestPart.userEditStates ?? {}
	}

	setName(name: string): void {
		if (this.#ingestPart.name !== name) {
			this.#ingestPart.name = name
			this.#hasChanges = true
		}
	}

	replacePayload(payload: ReadonlyDeep<TPartPayload> | TPartPayload): void {
		if (this.#hasChanges || !_.isEqual(this.#ingestPart.payload, payload)) {
			this.#ingestPart.payload = clone(payload)
			this.#hasChanges = true
		}
	}

	setPayloadProperty<TKey extends keyof TPartPayload>(
		key: TKey,
		value: ReadonlyDeep<TPartPayload[TKey]> | TPartPayload[TKey]
	): void {
		if (!this.#ingestPart.payload) {
			throw new Error('Part payload is not set')
		}

		if (this.#hasChanges || !_.isEqual(this.#ingestPart.payload[key], value)) {
			;(this.#ingestPart.payload as any)[key] = clone(value)
			this.#hasChanges = true
		}
	}

	setUserEditState(key: string, value: boolean): void {
		if (!this.#ingestPart.userEditStates) this.#ingestPart.userEditStates = {}
		if (this.#hasChanges || this.#ingestPart.userEditStates[key] !== value) {
			this.#ingestPart.userEditStates[key] = value
			this.#hasChanges = true
		}
	}

	/**
	 * Check if the part has changes and clear any changes flags
	 * Note: this is not visible to blueprints
	 */
	checkAndClearChangesFlags(): boolean {
		const hasChanges = this.#hasChanges

		this.#hasChanges = false

		return hasChanges
	}
}
