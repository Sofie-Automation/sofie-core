import { Meteor, Subscription } from 'meteor/meteor'
import { AllPubSubCollections, AllPubSubTypes } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { extractFunctionSignature } from '../../lib'
import { protectStringObject } from '../../lib/tempLib'
import { MetricsGauge } from '@sofie-automation/corelib/dist/prometheus'
import { MinimalMongoCursor } from '../../collections/implementations/asyncCollection'

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
 * Wrapper around Meteor.publish with stricter typings
 * @param name
 * @param callback
 */
export function meteorPublish<K extends keyof AllPubSubTypes>(
	name: K,
	callback: (
		this: SubscriptionContext,
		...args: Parameters<AllPubSubTypes[K]>
	) => Promise<MinimalMongoCursor<PublishDocType<K>> | null>
): void {
	meteorPublishUnsafe(name, callback)
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
	const results = await Promise.allSettled(observers)
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
