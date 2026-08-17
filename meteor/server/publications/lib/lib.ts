import { Meteor } from 'meteor/meteor'
import { AllPubSubCollections, AllPubSubTypes } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { MinimalMongoCursor } from '../../collections/collection'

/**
 * The context handed to a publication callback.
 */
export interface PublicationContext {
	/** The client connection that opened this subscription. Used by the auth layer for permission checks. */
	readonly connection: Meteor.Connection | null

	/**
	 * Register a function to be called when the subscriber unsubscribes.
	 * @deprecated Use `signal` instead
	 */
	onStop(callback: () => void): void

	/**
	 * An AbortSignal that is aborted when the subscription is stopped.
	 *
	 * Note: `addEventListener('abort', ...)` is a no-op if the signal is *already* aborted (the
	 * subscription may have stopped while you were awaiting setup). Always guard teardown with an
	 * explicit `aborted` check, e.g. `if (signal.aborted) teardown(); else signal.addEventListener(...)`.
	 */
	signal: AbortSignal

	/** Mark the subscription as ready (i.e. the initial set of documents has been sent). */
	ready(): void

	/** Send an added document to the subscriber. */
	added(collection: string, id: string, fields: Record<string, unknown>): void
	/** Send a changed document (changed fields only) to the subscriber. */
	changed(collection: string, id: string, fields: Record<string, unknown>): void
	/** Send a removed document to the subscriber. */
	removed(collection: string, id: string): void
}

/**
 * Observe a Mongo cursor and forward its changes into a publication context, stopping the observe handle
 * when the subscription stops. The cursor's `collectionName` names the published collection.
 */
export async function driveSubscriptionFromCursor(
	context: PublicationContext,
	cursor: MinimalMongoCursor<any>
): Promise<void> {
	const collectionName = cursor.collectionName
	if (!collectionName) throw new Meteor.Error(500, 'Cursor has no collection name, cannot publish')

	const handle = await cursor.observeChangesAsync(
		{
			added: (id, fields) =>
				context.added(collectionName, unprotectString(id), fields as Record<string, unknown>),
			changed: (id, fields) =>
				context.changed(collectionName, unprotectString(id), fields as Record<string, unknown>),
			removed: (id) => context.removed(collectionName, unprotectString(id)),
		},
		{ nonMutatingCallbacks: true }
	)

	// The subscription may have stopped while we were awaiting the setup above; tear down immediately if so.
	// Otherwise wire up the normal stop handler
	if (context.signal.aborted) handle.stop()
	else
		context.signal.addEventListener(
			'abort',
			() => {
				try {
					handle.stop()
				} catch {
					/* ignore */
				}
			},
			{ once: true }
		)
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
