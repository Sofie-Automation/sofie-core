import { SessionDocumentView } from './SessionDocumentView'

export interface SessionCallbacks {
	added: (collectionName: string, id: string, fields: Record<string, any>) => void
	changed: (collectionName: string, id: string, fields: Record<string, any>) => void
	removed: (collectionName: string, id: string) => void
}

/**
 * A client's merged view of a single collection, ported from Meteor's `ddp-server`
 * `session_collection_view.ts`. Tracks which subscriptions contribute each document and only emits an
 * `added`/`changed`/`removed` to the client when the merged view actually changes — so overlapping
 * subscriptions never send the client a duplicate `added` (which its minimongo would reject).
 */
export class SessionCollectionView {
	private readonly documents = new Map<string, SessionDocumentView>()

	constructor(
		private readonly collectionName: string,
		private readonly callbacks: SessionCallbacks
	) {}

	isEmpty(): boolean {
		return this.documents.size === 0
	}

	get size(): number {
		return this.documents.size
	}

	added(subscriptionHandle: string, id: string, fields: Record<string, any>): void {
		let docView = this.documents.get(id)
		let added = false

		if (!docView) {
			added = true
			docView = new SessionDocumentView()
			this.documents.set(id, docView)
		}

		docView.existsIn.add(subscriptionHandle)
		const changeCollector: Record<string, any> = {}

		for (const [key, value] of Object.entries<any>(fields)) {
			docView.changeField(subscriptionHandle, key, value, changeCollector, true)
		}

		if (added) {
			this.callbacks.added(this.collectionName, id, changeCollector)
		} else {
			this.callbacks.changed(this.collectionName, id, changeCollector)
		}
	}

	changed(subscriptionHandle: string, id: string, changed: Record<string, any>): void {
		const changedResult: Record<string, any> = {}
		const docView = this.documents.get(id)

		if (!docView) {
			throw new Error(`Could not find element with id ${id} to change`)
		}

		for (const [key, value] of Object.entries<any>(changed)) {
			if (value === undefined) {
				docView.clearField(subscriptionHandle, key, changedResult)
			} else {
				docView.changeField(subscriptionHandle, key, value, changedResult)
			}
		}

		this.callbacks.changed(this.collectionName, id, changedResult)
	}

	removed(subscriptionHandle: string, id: string): void {
		const docView = this.documents.get(id)

		if (!docView) {
			// Already gone (e.g. cleared by another path); nothing to do.
			return
		}

		docView.existsIn.delete(subscriptionHandle)

		if (docView.existsIn.size === 0) {
			// it is gone from everyone
			this.callbacks.removed(this.collectionName, id)
			this.documents.delete(id)
		} else {
			const changed: Record<string, any> = {}
			// remove this subscription from every precedence list and record the changes
			for (const key of docView.dataByKey.keys()) {
				docView.clearField(subscriptionHandle, key, changed)
			}
			this.callbacks.changed(this.collectionName, id, changed)
		}
	}
}
