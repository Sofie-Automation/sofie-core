import { ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PublicationContext } from '../../publications/lib/lib'
import { runOnAbort } from '../observerLifetime'
import { SofieError } from '@sofie-automation/corelib/dist/error'

export interface CustomPublishChanges<T extends { _id: ProtectedString<any> }> {
	added: Array<T>
	changed: Array<Pick<T, '_id'> & Partial<T>>
	removed: T['_id'][]
}

export interface CustomPublish<DBObj extends { _id: ProtectedString<any> }> {
	get isReady(): boolean

	/**
	 * An AbortSignal that is aborted when the subscriber unsubscribes.
	 *
	 * Note: `addEventListener('abort', ...)` is a no-op if the signal is *already* aborted (the
	 * subscription may have stopped while you were awaiting setup). Always guard teardown with an
	 * explicit `aborted` check, e.g. via `runOnAbort`.
	 */
	get signal(): AbortSignal

	/**
	 * Register a function to be called when the subscriber unsubscribes
	 * @deprecated Use `signal` instead
	 */
	onStop(callback: () => void): void

	/**
	 * Send the intial documents to the subscriber
	 */
	init(docs: DBObj[]): void

	/**
	 * Send a batch of changes to the subscriber
	 */
	changed(changes: CustomPublishChanges<DBObj>): void
}

export class CustomPublishMeteor<DBObj extends { _id: ProtectedString<any> }> {
	#isReady = false

	constructor(
		private _meteorSubscription: PublicationContext,
		private _collectionName: string
	) {}

	get isReady(): boolean {
		return this.#isReady
	}

	get signal(): AbortSignal {
		return this._meteorSubscription.signal
	}

	/**
	 * Register a function to be called when the subscriber unsubscribes
	 * @deprecated Use `signal` instead
	 */
	onStop(callback: () => void): void {
		// Unlike the single-slot callback this replaced, any number of listeners can be registered
		runOnAbort(this.signal, callback)
	}

	/**
	 * Send the intial documents to the subscriber
	 */
	init(docs: DBObj[]): void {
		if (this.#isReady) throw new SofieError(500, 'CustomPublish has already been initialised')

		for (const doc of docs) {
			this._meteorSubscription.added(this._collectionName, unprotectString(doc._id), doc)
		}

		this._meteorSubscription.ready()
		this.#isReady = true
	}

	/**
	 * Send a batch of changes to the subscriber
	 */
	changed(changes: CustomPublishChanges<DBObj>): void {
		if (!this.#isReady) throw new SofieError(500, 'CustomPublish has not been initialised')

		for (const id of changes.removed.values()) {
			this._meteorSubscription.removed(this._collectionName, unprotectString(id))
		}

		for (const doc of changes.added.values()) {
			this._meteorSubscription.added(this._collectionName, unprotectString(doc._id), doc)
		}

		for (const doc of changes.changed.values()) {
			this._meteorSubscription.changed(this._collectionName, unprotectString(doc._id), doc)
		}
	}
}

export type PublishIfDocument<Doc> = Doc extends { _id: ProtectedString<any> } ? CustomPublish<Doc> : never
