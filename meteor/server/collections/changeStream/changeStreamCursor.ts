import type { Meteor } from 'meteor/meteor'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import {
	MongoQuery,
	MongoFieldSpecifier,
	ObserveChangesOptions,
	ObserveCallbacks,
	ObserveChangesCallbacks,
} from '@sofie-automation/corelib/dist/mongo'
import { PromisifyCallbacks } from '@sofie-automation/shared-lib/dist/lib/types'
import { observeChangesViaChangeStream, observeViaChangeStream, ObserveMultiplexerDeps } from './observeMultiplexer'
import type { MinimalMongoCursor } from '../implementations/asyncCollection'

export interface ChangeStreamCursorConfig<TDoc extends { _id: ProtectedString<any> }> {
	collectionName: string
	selector: MongoQuery<TDoc>
	projection: MongoFieldSpecifier<TDoc> | undefined
	/** Fetch the matching documents (native find, with projection applied) */
	fetch: () => Promise<TDoc[]>
	/** Count the matching documents. When `applySkipLimit` is false, ignore any skip/limit in the options. */
	count: (applySkipLimit: boolean) => Promise<number>
	/** Build the deps for an observe multiplexer over this cursor's query */
	makeDeps: () => ObserveMultiplexerDeps<TDoc>
}

/**
 * A lazy "watcher" returned by `findWithCursor`. It exposes the async cursor methods the codebase uses
 * (`fetchAsync`/`countAsync`/`observeChangesAsync`/`observeAsync`) plus a plain `collectionName`.
 *
 * Unlike a Meteor cursor it has NO `_publishCursor`: publications are wired up by `meteorPublish`
 * (`driveSubscriptionFromCursor`).
 * Observing goes through the shared change-stream multiplexer, so identical queries are de-duplicated.
 */
export class ChangeStreamCursor<TDoc extends { _id: ProtectedString<any> }> implements MinimalMongoCursor<TDoc> {
	readonly collectionName: string
	readonly #config: ChangeStreamCursorConfig<TDoc>

	constructor(config: ChangeStreamCursorConfig<TDoc>) {
		this.#config = config
		this.collectionName = config.collectionName
	}

	async fetchAsync(): Promise<TDoc[]> {
		return this.#config.fetch()
	}

	async countAsync(applySkipLimit = true): Promise<number> {
		return this.#config.count(applySkipLimit)
	}

	async observeChangesAsync(
		callbacks: PromisifyCallbacks<ObserveChangesCallbacks<TDoc>>,
		options?: ObserveChangesOptions
	): Promise<Meteor.LiveQueryHandle> {
		const abort = new AbortController()

		try {
			await observeChangesViaChangeStream(
				this.#config.collectionName,
				this.#config.selector,
				this.#config.projection,
				callbacks,
				abort.signal,
				!!options?.nonMutatingCallbacks,
				this.#config.makeDeps
			)
		} catch (e) {
			abort.abort() // Ensure everything on the signal gets terminated
			throw e
		}

		return {
			stop: () => {
				abort.abort()
			},
		}
	}

	async observeAsync(callbacks: PromisifyCallbacks<ObserveCallbacks<TDoc>>): Promise<Meteor.LiveQueryHandle> {
		const abort = new AbortController()

		try {
			await observeViaChangeStream(
				this.#config.collectionName,
				this.#config.selector,
				this.#config.projection,
				callbacks,
				abort.signal,
				false,
				this.#config.makeDeps
			)
		} catch (e) {
			abort.abort() // Ensure everything on the signal gets terminated
			throw e
		}

		return {
			stop: () => {
				abort.abort()
			},
		}
	}
}
