import { Meteor } from 'meteor/meteor'
import { AllPubSubCollections, AllPubSubTypes } from '@sofie-automation/meteor-lib/dist/api/pubsub'

/**
 * The context handed to a publication callback.
 */
export interface PublicationContext {
	/** The client connection that opened this subscription. Used by the auth layer for permission checks. */
	readonly connection: Meteor.Connection | null

	/** Register a function to be called when the subscriber unsubscribes. */
	onStop(callback: () => void): void

	/** Mark the subscription as ready (i.e. the initial set of documents has been sent). */
	ready(): void

	/** Send an added document to the subscriber. */
	added(collection: string, id: string, fields: Record<string, unknown>): void
	/** Send a changed document (changed fields only) to the subscriber. */
	changed(collection: string, id: string, fields: Record<string, unknown>): void
	/** Send a removed document to the subscriber. */
	removed(collection: string, id: string): void
}

export type PublishDocType<K extends keyof AllPubSubTypes> =
	ReturnType<AllPubSubTypes[K]> extends keyof AllPubSubCollections
		? AllPubSubCollections[ReturnType<AllPubSubTypes[K]>]
		: never

/**
 * Await each observer, and return the handles
 * If an observer throws, this will make sure to stop all the ones that were successfully started, to avoid leaking memory
 */
export async function waitForAllObserversReady(
	observers: Array<Promise<Meteor.LiveQueryHandle> | Meteor.LiveQueryHandle>
): Promise<Meteor.LiveQueryHandle[]> {
	// Wait for all the promises to complete
	// Future: could this fail faster by aborting the rest once the first fails?
	const results = await Promise.allSettled(observers as Array<Promise<Meteor.LiveQueryHandle>>)
	const allSuccessfull = results.filter(
		(r): r is PromiseFulfilledResult<Meteor.LiveQueryHandle> => r.status === 'fulfilled'
	)

	const firstFailure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')
	if (firstFailure || allSuccessfull.length !== observers.length) {
		// There was a failure, or not enough success so we should stop all the observers
		for (const handle of allSuccessfull) {
			handle.value.stop()
		}
		if (firstFailure) {
			throw firstFailure.reason
		} else {
			throw new Meteor.Error(500, 'Not all observers were started')
		}
	}

	return allSuccessfull.map((r) => r.value)
}
