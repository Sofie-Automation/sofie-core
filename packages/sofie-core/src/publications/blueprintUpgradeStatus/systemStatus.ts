import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { UIBlueprintUpgradeStatus } from '@sofie-automation/meteor-lib/dist/api/upgradeStatus'
import { CustomPublish, CustomPublishChanges } from '../../lib/customPublication'
import { createBlueprintUpgradeStatusSubscriptionHandle } from './publication'
import { isInTestMode } from '../../lib'
import { SofieError } from '@sofie-automation/corelib/dist/error'
import { logger } from '../../logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

class CustomPublishToMap<DBObj extends { _id: ProtectedString<any> }> implements CustomPublish<DBObj> {
	#isReady = false
	#documents = new Map<DBObj['_id'], DBObj>()
	#readyPromise = Promise.withResolvers<void>()
	readonly #signal: AbortSignal

	constructor(signal: AbortSignal) {
		this.#signal = signal
	}

	get isReady(): boolean {
		return this.#isReady
	}

	get documents(): DBObj[] {
		return Array.from(this.#documents.values())
	}

	async waitForReady(): Promise<void> {
		return this.#readyPromise.promise
	}

	get signal(): AbortSignal {
		return this.#signal
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

let serverPublication:
	| {
			publisher: CustomPublishToMap<UIBlueprintUpgradeStatus>
			subscription: Promise<void>
	  }
	| undefined

/**
 * Start observing the blueprint upgrade statuses for use by the server itself (the system status), for the
 * lifetime of `signal`
 */
export function startServerBlueprintUpgradeStatuses(signal: AbortSignal): void {
	if (serverPublication) throw new SofieError(500, 'Server blueprint upgrade statuses have already been started')

	const publisher = new CustomPublishToMap<UIBlueprintUpgradeStatus>(signal)
	const subscription = createBlueprintUpgradeStatusSubscriptionHandle(publisher)
	// Log a failure now, as nothing awaits this until the system status is first requested
	subscription.catch((e) => {
		logger.error(`Failed to start the server blueprint upgrade statuses: ${stringifyError(e)}`)
	})

	serverPublication = { publisher, subscription }
}

export async function getServerBlueprintUpgradeStatuses(): Promise<UIBlueprintUpgradeStatus[]> {
	if (isInTestMode()) throw new SofieError(500, 'getServerBlueprintUpgradeStatuses is not allowed during tests')
	if (!serverPublication) throw new SofieError(500, 'Server blueprint upgrade statuses have not been started')

	await serverPublication.subscription
	await serverPublication.publisher.waitForReady()

	return serverPublication.publisher.documents
}
