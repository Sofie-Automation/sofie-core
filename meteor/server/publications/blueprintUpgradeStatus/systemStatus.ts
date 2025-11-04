import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { UIBlueprintUpgradeStatus } from '@sofie-automation/meteor-lib/dist/api/upgradeStatus'
import { CustomPublish, CustomPublishChanges } from '../../lib/customPublication'
import { createBlueprintUpgradeStatusSubscriptionHandle } from './publication'

class CustomPublishToMap<DBObj extends { _id: ProtectedString<any> }> implements CustomPublish<DBObj> {
	#isReady = false
	#documents = new Map<DBObj['_id'], DBObj>()
	#readyPromise = Promise.withResolvers<void>()

	get isReady(): boolean {
		return this.#isReady
	}

	get documents(): DBObj[] {
		return Array.from(this.#documents.values())
	}

	async waitForReady(): Promise<void> {
		return this.#readyPromise.promise
	}

	/**
	 * Register a function to be called when the subscriber unsubscribes
	 */
	onStop(_callback: () => void): void {
		// Ignore, this publication never stops
	}

	/**
	 * Send the intial documents to the subscriber
	 */
	init(docs: DBObj[]): void {
		if (this.#isReady) throw new Meteor.Error(500, 'CustomPublishToMap has already been initialised')

		for (const doc of docs) {
			this.#documents.set(doc._id, doc)
		}

		this.#isReady = true

		Meteor.defer(() => this.#readyPromise.resolve())
	}

	/**
	 * Send a batch of changes to the subscriber
	 */
	changed(changes: CustomPublishChanges<DBObj>): void {
		if (!this.#isReady) throw new Meteor.Error(500, 'CustomPublish has not been initialised')

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
	if (Meteor.isTest) throw new Meteor.Error(500, 'getServerBlueprintUpgradeStatuses is not allowed during tests')

	if (!existingPublicationSubscription) {
		existingPublicationSubscription = createBlueprintUpgradeStatusSubscriptionHandle(cachedPublisher)
	}
	await existingPublicationSubscription

	await cachedPublisher.waitForReady()

	return cachedPublisher.documents
}
