import { AllPubSubCollections, AllPubSubTypes } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { MinimalMongoCursor } from '../../collections/collection'
import type { DDPClientConnection } from '../../ddp-server/types'
import { SofieError } from '@sofie-automation/corelib/dist/error'

/**
 * The context handed to a publication callback.
 */
export interface PublicationContext {
	/** The client connection that opened this subscription. Used by the auth layer for permission checks. */
	readonly connection: DDPClientConnection | null

	/**
	 * An AbortSignal that is aborted when the subscription is stopped. This is the lifetime to give to
	 * anything started for this subscription, such as observers.
	 *
	 * Note: `addEventListener('abort', ...)` is a no-op if the signal is *already* aborted (the
	 * subscription may have stopped while you were awaiting setup), so use `runOnAbort` to register
	 * teardown rather than adding a listener directly.
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
 * Observe a Mongo cursor and forward its changes into a publication context, for the lifetime of the
 * subscription. The cursor's `collectionName` names the published collection.
 */
export async function driveSubscriptionFromCursor(
	context: PublicationContext,
	cursor: MinimalMongoCursor<any>
): Promise<void> {
	const collectionName = cursor.collectionName
	if (!collectionName) throw new SofieError(500, 'Cursor has no collection name, cannot publish')

	await cursor.observeChangesAsync(
		{
			added: (id, fields) =>
				context.added(collectionName, unprotectString(id), fields as Record<string, unknown>),
			changed: (id, fields) =>
				context.changed(collectionName, unprotectString(id), fields as Record<string, unknown>),
			removed: (id) => context.removed(collectionName, unprotectString(id)),
		},
		{
			signal: context.signal,
			nonMutatingCallbacks: true,
		}
	)
}

export type PublishDocType<K extends keyof AllPubSubTypes> =
	ReturnType<AllPubSubTypes[K]> extends keyof AllPubSubCollections
		? AllPubSubCollections[ReturnType<AllPubSubTypes[K]>]
		: never
