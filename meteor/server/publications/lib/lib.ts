import { Meteor, Subscription } from 'meteor/meteor'
import { AllPubSubCollections, AllPubSubTypes } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { extractFunctionSignature } from '../../lib'
import { protectStringObject, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { MetricsGauge } from '@sofie-automation/corelib/dist/prometheus'
import { MinimalMongoCursor } from '../../collections/collection'
import { ChangeStreamCursor } from '../../collections/changeStream/changeStreamCursor'

export const MeteorPublicationSignatures: { [key: string]: string[] } = {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const MeteorPublications: { [key: string]: Function } = {}

const MeteorPublicationsGauge = new MetricsGauge({
	name: `sofie_meteor_publication_subscribers_total`,
	help: 'Number of subscribers on a Meteor publication (ignoring arguments)',
	labelNames: ['publication'],
})

export type SubscriptionContext = Omit<Subscription, 'userId'>

/**
 * Unsafe wrapper around Meteor.publish
 * @param name
 * @param callback
 */
export function meteorPublishUnsafe(
	name: string,
	callback: (this: SubscriptionContext, ...args: any) => Promise<any>
): void {
	const signature = extractFunctionSignature(callback)
	if (signature) MeteorPublicationSignatures[name] = signature

	MeteorPublications[name] = callback

	const publicationGauge = MeteorPublicationsGauge.labels({ publication: name })

	Meteor.publish(name, async function (...args: any[]): Promise<any> {
		publicationGauge.inc()
		this.onStop(() => publicationGauge.dec())

		const callbackRes = await callback.apply(protectStringObject<Subscription, 'userId'>(this), args)
		// If no value is returned, return an empty array so that meteor marks the subscription as ready
		return callbackRes || []
	})
}

export type PublishDocType<K extends keyof AllPubSubTypes> =
	ReturnType<AllPubSubTypes[K]> extends keyof AllPubSubCollections
		? AllPubSubCollections[ReturnType<AllPubSubTypes[K]>]
		: never

/**
 * Drive a subscription from our mongo cursors: observe the cursor and pipe added/changed/removed into the
 * subscription, stopping the observe when the subscription stops. Resolves only after the initial `added`s
 * have fired (so the caller can mark the subscription ready immediately afterwards).
 *
 * This replaces Meteor's internal `cursor._publishCursor(sub)` hook.
 */
async function driveSubscriptionFromCursor(sub: SubscriptionContext, cursor: ChangeStreamCursor<any>): Promise<void> {
	const collectionName = cursor.collectionName
	if (!collectionName) throw new Error('Cursor has no collection name, cannot publish')

	// Register a stop marker BEFORE awaiting the observe setup: if the subscription is stopped while the
	// initial snapshot is still in flight, we must still tear the observer down once it resolves. Otherwise
	// the observe would resolve after onStop had already fired and leak for the lifetime of the process.
	// Future: this would be a lot simpler with an AbortSignal
	let stopped = false
	sub.onStop(() => {
		stopped = true
	})

	const handle = await cursor.observeChangesAsync(
		{
			added: (id, fields) => sub.added(collectionName, unprotectString(id), fields as Record<string, any>),
			changed: (id, fields) => sub.changed(collectionName, unprotectString(id), fields as Record<string, any>),
			removed: (id) => sub.removed(collectionName, unprotectString(id)),
		},
		{ nonMutatingCallbacks: true }
	)

	// The subscription may have stopped while we were awaiting the setup above; tear down immediately if so.
	// Otherwise wire up the normal stop handler (no `await` between the check and the registration, so a stop
	// firing in this window can't be missed).
	if (stopped) handle.stop()
	else sub.onStop(() => handle.stop())
}

export function meteorPublish<K extends keyof AllPubSubTypes>(
	name: K,
	callback: (
		this: SubscriptionContext,
		...args: Parameters<AllPubSubTypes[K]>
	) => Promise<MinimalMongoCursor<PublishDocType<K>> | null>
): void {
	meteorPublishUnsafe(name, async function (this: SubscriptionContext, ...args: any[]): Promise<any> {
		const cursor = await callback.apply(this, args as Parameters<AllPubSubTypes[K]>)
		if (!cursor) return [] // nothing to publish; Meteor will mark the subscription ready

		// Verify we actually got a publishable cursor, then drive the subscription ourselves.
		// The subscription gets marked as ready *after* the initial documents have been sent.
		if (!(cursor instanceof ChangeStreamCursor)) {
			throw new Meteor.Error(500, `Publication "${String(name)}" must return a cursor from findWithCursor()`)
		}
		await driveSubscriptionFromCursor(this, cursor)
		return undefined
	})
}

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
