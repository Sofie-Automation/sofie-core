import { PublicationContext } from '../publications/lib/lib'
import { MeteorPublicationsGauge } from '../publicationRegistry'
import type { DDPClientConnection } from './types'

/** The slice of the session a publication context needs, to route its data through the merge box. */
export interface SessionPublicationApi {
	readonly connection: DDPClientConnection | null
	mergeAdded(subscriptionHandle: string, collection: string, id: string, fields: Record<string, unknown>): void
	mergeChanged(subscriptionHandle: string, collection: string, id: string, fields: Record<string, unknown>): void
	mergeRemoved(subscriptionHandle: string, collection: string, id: string): void
	sendReady(subscriptionId: string): void
}

/**
 * The `this`-free `PublicationContext` handed to a publication callback on the standalone DDP server.
 *
 * `added/changed/removed` route into the session's merge box under this subscription's handle; `ready()`
 * sends a `ready` message; `onStop()` collects teardown callbacks. The context tracks which documents it
 * added so they can be removed from the merge box when the subscription stops.
 */
export class DdpPublicationContext implements PublicationContext {
	readonly connection: DDPClientConnection | null

	private readonly abort = new AbortController()
	private readonly stopCallbacks: Array<() => void> = []
	/** collection -> set of ids this subscription has added (for removal on stop). */
	private readonly documents = new Map<string, Set<string>>()
	private isReadyInternal = false

	constructor(
		private readonly session: SessionPublicationApi,
		private readonly subscriptionId: string,
		/** The merge-box key for this subscription (distinct from the client-facing subscriptionId). */
		private readonly subscriptionHandle: string,
		publicationName: string
	) {
		this.connection = session.connection

		// Track subscriber count under a distinct `server` label from the Meteor DDP path. Tied to the
		// context's stop lifecycle (idempotent) so it decs exactly once however the subscription ends.
		const publicationGauge = MeteorPublicationsGauge.labels({ publication: publicationName, server: 'ddp' })
		publicationGauge.inc()
		this.signal.addEventListener('abort', () => publicationGauge.dec(), { once: true })
	}

	get isReady(): boolean {
		return this.isReadyInternal
	}

	get signal(): AbortSignal {
		return this.abort.signal
	}

	private get stopped(): boolean {
		return this.abort.signal.aborted
	}

	added(collection: string, id: string, fields: Record<string, unknown>): void {
		if (this.stopped) return
		let ids = this.documents.get(collection)
		if (!ids) {
			ids = new Set()
			this.documents.set(collection, ids)
		}
		ids.add(id)
		this.session.mergeAdded(this.subscriptionHandle, collection, id, fields)
	}

	changed(collection: string, id: string, fields: Record<string, unknown>): void {
		if (this.stopped) return
		this.session.mergeChanged(this.subscriptionHandle, collection, id, fields)
	}

	removed(collection: string, id: string): void {
		if (this.stopped) return
		this.documents.get(collection)?.delete(id)
		this.session.mergeRemoved(this.subscriptionHandle, collection, id)
	}

	ready(): void {
		if (this.stopped || this.isReadyInternal) return
		this.isReadyInternal = true
		this.session.sendReady(this.subscriptionId)
	}

	onStop(callback: () => void): void {
		if (this.stopped) {
			queueMicrotask(callback)
			return
		}
		this.stopCallbacks.push(callback)
	}

	/**
	 * Tear down this subscription: stop accepting further data, remove its documents from the merge box,
	 * then run the registered stop callbacks (e.g. observer teardown). Idempotent.
	 */
	stop(): void {
		if (this.stopped) return
		this.abort.abort()

		for (const [collection, ids] of this.documents) {
			for (const id of ids) {
				this.session.mergeRemoved(this.subscriptionHandle, collection, id)
			}
		}
		this.documents.clear()

		for (const callback of this.stopCallbacks) {
			try {
				callback()
			} catch {
				// a failing stop callback must not prevent the others from running
			}
		}
		this.stopCallbacks.length = 0
	}
}
