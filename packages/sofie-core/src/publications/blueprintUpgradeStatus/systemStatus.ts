import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { UIBlueprintUpgradeStatus } from '@sofie-automation/meteor-lib/dist/api/upgradeStatus'
import { CustomPublish, CustomPublishChanges } from '../../lib/customPublication'
import { createBlueprintUpgradeStatusSubscriptionHandle } from './publication'
import { isInTestMode } from '../../lib'
import { SofieError } from '@sofie-automation/corelib/dist/error'

class CustomPublishToMap<DBObj extends { _id: ProtectedString<any> }> implements CustomPublish<DBObj> {
	#isReady = false
	#documents = new Map<DBObj['_id'], DBObj>()
	#readyPromise = Promise.withResolvers<void>()
	readonly #neverStops = new AbortController()

	get isReady(): boolean {
		return this.#isReady
	}

	get documents(): DBObj[] {
		return Array.from(this.#documents.values())
	}

	async waitForReady(): Promise<void> {
		return this.#readyPromise.promise
	}

	/** This publication never stops, so its lifetime signal is never aborted */
	get signal(): AbortSignal {
		return this.#neverStops.signal
	}

	/**
	 * Send the intial documents to the subscriber
	 */
	init(docs: DBObj[]): void {
		if (this.#isReady) throw new SofieError(500, 'CustomPublishToMap has already been initialised')

		for (const doc of docs) {
			this.#documents.set(doc._id, doc)
		}

		this.#isReady = true

		setImmediate(() => this.#readyPromise.resolve())
	}

	/**
	 * Send a batch of changes to the subscriber
	 */
	changed(changes: CustomPublishChanges<DBObj>): void {
		if (!this.#isReady) throw new SofieError(500, 'CustomPublish has not been initialised')

		for (const doc of changes.added.values()) {
			this.#documents.set(doc._id, doc)
		}

		for (const doc of changes.changed.values()) {
			const existingDoc = this.#documents.get(doc._id)
			if (!existingDoc) continue // TODO - throw?
			this.#documents.set(doc._id, {
				...existingDoc,
				...doc,
			})
		}

		for (const id of changes.removed.values()) {
			this.#documents.delete(id)
		}
	}
}

const cachedPublisher = new CustomPublishToMap<UIBlueprintUpgradeStatus>()
let existingPublicationSubscription: Promise<void> | undefined

export async function getServerBlueprintUpgradeStatuses(): Promise<UIBlueprintUpgradeStatus[]> {
	if (isInTestMode()) throw new SofieError(500, 'getServerBlueprintUpgradeStatuses is not allowed during tests')

	if (!existingPublicationSubscription) {
		existingPublicationSubscription = createBlueprintUpgradeStatusSubscriptionHandle(cachedPublisher)
	}
	await existingPublicationSubscription

	await cachedPublisher.waitForReady()

	return cachedPublisher.documents
}
