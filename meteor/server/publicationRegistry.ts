import { Meteor, Subscription } from 'meteor/meteor'
import { AllPubSubNames, AllPubSubTypes } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { MetricsGauge } from '@sofie-automation/corelib/dist/prometheus'
import { extractFunctionSignature } from './lib'
import { logger } from './logging'
import { MinimalMongoCursor } from './collections/implementations/asyncCollection'
import { PublicationContext, PublishDocType } from './publications/lib/lib'
import { CustomPublishMeteor, PublishIfDocument } from './lib/customPublication/publish'

// The Prometheus gauge is registered globally by name, so it must live at module scope rather than on
// the registry instance, otherwise constructing a second registry (e.g. in tests) would throw.
const MeteorPublicationsGauge = new MetricsGauge({
	name: `sofie_meteor_publication_subscribers_total`,
	help: 'Number of subscribers on a publication (ignoring arguments)',
	labelNames: ['publication', 'server'],
})

/**
 * A publication callback, as stored on the registry. The context is passed as the first argument (not
 * via `this`), keeping the callbacks free of Meteor semantics so the same registry can be served by a
 * non-Meteor transport. The return value is transport-agnostic (a cursor, `null`, or `void`).
 */
type PublicationCallback = (context: PublicationContext, ...args: any[]) => Promise<unknown>

interface RegisteredPublication {
	/** The publication callback, invoked with a transport-supplied `PublicationContext`. */
	callback: PublicationCallback
	/** Param-name signature of the callback, if it could be extracted. Used by the legacy REST API. */
	signature: string[] | undefined
	/**
	 * Whether this is a custom publication (registered via `customPublish`). Custom publications push
	 * documents through the `PublicationContext` and rely on `onStop` to tear down their observers, so
	 * they cannot be served by the fire-once legacy REST path (which has no working `onStop`).
	 */
	isCustom: boolean
}

/**
 * Drop the first `count` parameter names from an extracted signature. Registered callbacks carry
 * registry-internal leading parameters (`context`, and for custom publications also `publication`) that
 * are not part of the public API and must not leak into REST routes or introspection.
 */
function dropLeadingParams(signature: string[] | undefined, count: number): string[] | undefined {
	if (!signature) return undefined
	return signature.slice(count)
}

/** The Meteor implementation of `PublicationContext`, adapting a Meteor `Subscription`. */
class MeteorPublicationContext implements PublicationContext {
	constructor(private readonly subscription: Subscription) {}

	get connection(): Meteor.Connection | null {
		return this.subscription.connection
	}
	onStop(callback: () => void): void {
		this.subscription.onStop(callback)
	}
	ready(): void {
		this.subscription.ready()
	}
	added(collection: string, id: string, fields: Record<string, unknown>): void {
		this.subscription.added(collection, id, fields)
	}
	changed(collection: string, id: string, fields: Record<string, unknown>): void {
		this.subscription.changed(collection, id, fields)
	}
	removed(collection: string, id: string): void {
		this.subscription.removed(collection, id)
	}
}

/**
 * Holds all registered publications on an instance instead of mutating global state at import time.
 * The same instance is handed to the Meteor path (`applyToMeteor()`) and, later, any standalone DDP
 * server, so publications live on every transport off a single source of truth.
 *
 * Note: unlike the method registry there is no compile-time `satisfies` completeness check, because
 * publication registrations are imperative calls scattered across many files rather than a single
 * keyed literal. Completeness is instead asserted at runtime via `verifyAllPublicationsRegistered()`
 * (and the publicationRegistry drift-guard test).
 */
export class PublicationRegistry {
	private readonly publications = new Map<string, RegisteredPublication>()
	private applied = false

	/**
	 * Unsafe registration of a publication.
	 * Prefer the typed `publish`/`customPublish` wrappers below.
	 */
	publishUnsafe(name: string, callback: PublicationCallback, signature?: string[], isCustom = false): void {
		if (this.applied) {
			throw new Meteor.Error(
				500,
				`PublicationRegistry: Cannot register publication "${name}" after the registry has been applied.`
			)
		}
		if (this.publications.has(name)) {
			throw new Meteor.Error(500, `PublicationRegistry: A publication called "${name}" is already registered.`)
		}

		// The first parameter of every registered callback is the synthetic `context`, which is not part
		// of the public API. Strip it (unless the caller supplied an already-normalized signature) so that
		// introspection/REST sees only the real user arguments in the correct order.
		const resolvedSignature = signature ?? dropLeadingParams(extractFunctionSignature(callback), 1)
		this.publications.set(name, { callback, signature: resolvedSignature, isCustom })
	}

	/**
	 * Register a publication with stricter typings. The subscription context is the first argument.
	 */
	publish<K extends keyof AllPubSubTypes>(
		name: K,
		callback: (
			context: PublicationContext,
			...args: Parameters<AllPubSubTypes[K]>
		) => Promise<MinimalMongoCursor<PublishDocType<K>> | null>
	): void {
		this.publishUnsafe(name, callback as PublicationCallback)
	}

	/**
	 * Register a custom publication, providing types for the custom collection it pushes documents into.
	 * The subscription context is the first argument, followed by the custom-publication handle.
	 */
	customPublish<K extends keyof AllPubSubTypes, N extends ReturnType<AllPubSubTypes[K]>>(
		publicationName: K,
		customCollectionName: N,
		cb: (
			context: PublicationContext,
			publication: PublishIfDocument<PublishDocType<K>>,
			...args: Parameters<AllPubSubTypes[K]>
		) => Promise<void>
	): void {
		// The wrapper below has signature `(context, ...args)`, which would hide the real user arguments
		// from `extractFunctionSignature`. Extract the public signature from the typed `cb` instead,
		// dropping its `context` and `publication` parameters so REST/introspection sees only user args.
		const signature = dropLeadingParams(extractFunctionSignature(cb), 2)
		this.publishUnsafe(
			publicationName,
			async (context, ...args) => {
				return cb(
					context,
					new CustomPublishMeteor<any>(context, String(customCollectionName)) as any,
					...(args as any)
				)
			},
			signature,
			true
		)
	}

	/** Look up a publication callback by name (for any standalone DDP server). */
	get(name: string): PublicationCallback | undefined {
		return this.publications.get(name)?.callback
	}

	/**
	 * Look up a publication callback for the legacy REST path. Returns `undefined` for custom publications,
	 * which rely on a working `onStop` to release their observers and so cannot be served by the fire-once
	 * REST path (doing so would leak resources while only ever returning an empty result).
	 */
	getCursorPublication(name: string): PublicationCallback | undefined {
		const publication = this.publications.get(name)
		if (!publication || publication.isCustom) return undefined
		return publication.callback
	}

	getAllPublicationNames(): string[] {
		return Array.from(this.publications.keys())
	}

	/**
	 * Param-name signatures of all publications that one could be extracted from, keyed by name.
	 * Used by the legacy REST API to build its routes.
	 */
	getSignatures(): { [publicationName: string]: string[] } {
		const signatures: { [publicationName: string]: string[] } = {}
		for (const [name, publication] of this.publications) {
			if (publication.signature) signatures[name] = publication.signature
		}
		return signatures
	}

	/** Apply all registered publications to Meteor's DDP server. The only place that touches `Meteor.publish()`. */
	applyToMeteor(): void {
		if (this.applied) throw new Meteor.Error(500, 'PublicationRegistry.applyToMeteor() has already been called')
		this.applied = true

		for (const [name, publication] of this.publications) {
			const { callback } = publication
			const publicationGauge = MeteorPublicationsGauge.labels({ publication: name, server: 'meteor' }) // Future: custom ddp server should use a dynamic name instead of hardcoded

			Meteor.publish(name, async function (...args: any[]): Promise<any> {
				publicationGauge.inc()
				this.onStop(() => publicationGauge.dec())

				const callbackRes = await callback(new MeteorPublicationContext(this), ...args)
				// If no value is returned, return an empty array so that meteor marks the subscription as ready
				return callbackRes || []
			})
		}
	}

	/**
	 * Verify that every known publication name has a registration.
	 * Replaces the historical dev-mode check that lived in `_publications.ts`.
	 */
	verifyAllPublicationsRegistered(): void {
		for (const pubName of AllPubSubNames) {
			if (!this.publications.has(pubName)) {
				logger.error(`Publication "${pubName}" is not setup!`)
			}
		}
	}
}
