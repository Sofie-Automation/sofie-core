import {
	getMosTypes,
	type IMOSItemStatus,
	IMOSObjectStatus,
	type IMOSStoryStatus,
	type MosTypes,
	type IMOSDevice,
} from '@mos-connection/connector'
import type { MosDeviceStatusesConfig } from '@sofie-automation/shared-lib/dist/generated/MosGatewayDevicesTypes'
import type { CoreMosDeviceHandler } from '../CoreMosDeviceHandler.js'
import {
	assertNever,
	type Observer,
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
	stringifyError,
	SubscriptionId,
} from '@sofie-automation/server-core-integration'
import type { IngestRundownStatus } from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'
import type { RundownId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import type * as winston from 'winston'
import { Queue } from '@sofie-automation/server-core-integration/dist/lib/queue'
import { diffStatuses } from './diff.js'

export class MosStatusHandler {
	readonly #logger: winston.Logger
	readonly #mosDevice: IMOSDevice
	readonly #coreMosHandler: CoreMosDeviceHandler
	readonly #config: MosDeviceStatusesConfig
	readonly #mosTypes: MosTypes

	readonly #messageQueue = new Queue()

	#subId: SubscriptionId | undefined
	#observer: Observer<IngestRundownStatus> | undefined

	#destroyed = false

	readonly #lastStatuses = new Map<RundownId, IngestRundownStatus>()

	constructor(
		logger: winston.Logger,
		mosDevice: IMOSDevice,
		coreMosHandler: CoreMosDeviceHandler,
		config: MosDeviceStatusesConfig,
		strictMosTypes: boolean
	) {
		if (!config.enabled) throw new Error('MosStatusHandler is not enabled')

		this.#logger = logger
		this.#mosDevice = mosDevice
		this.#coreMosHandler = coreMosHandler
		this.#config = config
		this.#mosTypes = getMosTypes(strictMosTypes)

		coreMosHandler.core
			.autoSubscribe(PeripheralDevicePubSub.ingestDeviceRundownStatus, coreMosHandler.core.deviceId)
			.then((subId) => {
				this.#subId = subId

				if (this.#destroyed) coreMosHandler.core.unsubscribe(subId)
			})
			.catch((e) => {
				this.#logger.error(`Error subscribing to ingestDeviceRundownStatus: ${stringifyError(e)}`)
			})

		// Setup the observer immediately, which will trigger a resync upon the documents being added
		this.#observer = coreMosHandler.core.observe(PeripheralDevicePubSubCollectionsNames.ingestRundownStatus)
		this.#observer.added = (id) => this.#rundownChanged(id)
		this.#observer.changed = (id) => this.#rundownChanged(id)
		this.#observer.removed = (id) => this.#rundownChanged(id)

		this.#logger.info(`MosStatusHandler initialized for ${coreMosHandler.core.deviceId}`)
	}

	#rundownChanged(id: RundownId): void {
		const collection = this.#coreMosHandler.core.getCollection(
			PeripheralDevicePubSubCollectionsNames.ingestRundownStatus
		)

		const newStatuses = collection.findOne(id)
		const previousStatuses = this.#lastStatuses.get(id)

		// Update the last statuses store
		if (newStatuses) {
			this.#lastStatuses.set(id, newStatuses)
		} else {
			this.#lastStatuses.delete(id)
		}

		const statusDiff = diffStatuses(this.#config, previousStatuses, newStatuses)
		if (statusDiff.length === 0) return

		const diffTime = this.#mosTypes.mosTime.create(Date.now())

		// Future: should this be done with some concurrency?
		for (const status of statusDiff) {
			// New implementation 2022 only sends PLAY, never stop, after getting advice from AP
			// Reason 1: NRK ENPS "sendt tid" (elapsed time) stopped working in ENPS 8/9 when doing STOP prior to PLAY
			// Reason 2: there's a delay between the STOP (yellow line disappears) and PLAY (yellow line re-appears), which annoys the users
			if (this.#config.onlySendPlay && status.mosStatus !== IMOSObjectStatus.PLAY) continue

			this.#messageQueue
				.putOnQueue(async () => {
					if (this.#isDeviceConnected()) {
						if (status.type === 'item') {
							const newStatus: IMOSItemStatus = {
								RunningOrderId: this.#mosTypes.mosString128.create(status.rundownExternalId),
								StoryId: this.#mosTypes.mosString128.create(status.storyId),
								ID: this.#mosTypes.mosString128.create(status.itemId),
								Status: status.mosStatus,
								Time: diffTime,
							}
							this.#logger.info(`Sending Story status: ${JSON.stringify(newStatus)}`)

							// Send status
							await this.#mosDevice.sendItemStatus(newStatus)
						} else if (status.type === 'story') {
							const newStatus: IMOSStoryStatus = {
								RunningOrderId: this.#mosTypes.mosString128.create(status.rundownExternalId),
								ID: this.#mosTypes.mosString128.create(status.storyId),
								Status: status.mosStatus,
								Time: diffTime,
							}
							this.#logger.info(`Sending Story status: ${JSON.stringify(newStatus)}`)

							// Send status
							await this.#mosDevice.sendStoryStatus(newStatus)
						} else {
							this.#logger.debug(`Discarding unknown queued status: ${JSON.stringify(status)}`)
							assertNever(status)
						}
					} else if (this.#config.onlySendPlay) {
						// No need to do anything.
						this.#logger.info(`Not connected, skipping play status: ${JSON.stringify(status)}`)
					} else {
						this.#logger.info(`Not connected, discarding status: ${JSON.stringify(status)}`)
					}
				})
				.catch((e) => {
					this.#logger.error(
						`Error sending of "${status.rundownExternalId}"-"${
							status.storyId
						}" status to MOS device: ${stringifyError(e)}`
					)
				})
		}
	}

	#isDeviceConnected(): boolean {
		return (
			this.#mosDevice.getConnectionStatus().PrimaryConnected ||
			this.#mosDevice.getConnectionStatus().SecondaryConnected
		)
	}

	dispose(): void {
		this.#destroyed = true

		this.#observer?.stop()
		if (this.#subId) this.#coreMosHandler.core.unsubscribe(this.#subId)
	}
}
