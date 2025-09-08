import { CorelibPubSubTypes, CorelibPubSubCollections } from '@sofie-automation/corelib/dist/pubsub'
import {
	SubscriptionId,
	Observer,
	CollectionDocCheck,
	PeripheralDevicePubSubCollections,
	ProtectedString,
} from '@sofie-automation/server-core-integration'
import { ParametersOfFunctionOrNever } from '@sofie-automation/server-core-integration/dist/lib/subscriptions'
import { Logger } from 'winston'
import { CollectionBase, DEFAULT_THROTTLE_PERIOD_MS } from './collectionBase.js'
import { CoreHandler } from './coreHandler.js'
import { ObserverCallback } from './collectionBase.js'

export abstract class PublicationCollection<
	T,
	TPubSub extends keyof CorelibPubSubTypes,
	TCollection extends keyof CorelibPubSubCollections,
> extends CollectionBase<T, TCollection> {
	protected _publicationName: TPubSub
	protected _subscriptionId: SubscriptionId | undefined
	protected _subscriptionPending = false
	protected _dbObserver:
		| Observer<CollectionDocCheck<(CorelibPubSubCollections & PeripheralDevicePubSubCollections)[TCollection]>>
		| undefined

	constructor(
		collection: TCollection,
		publication: TPubSub,
		logger: Logger,
		coreHandler: CoreHandler,
		throttlePeriodMs = DEFAULT_THROTTLE_PERIOD_MS
	) {
		super(collection, logger, coreHandler, throttlePeriodMs)
		this._publicationName = publication
	}

	close(): void {
		super.close()
		if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
		this._dbObserver?.stop()
	}

	subscribe<K extends keyof T>(callback: ObserverCallback<T, K>, keysToPick?: readonly K[]): void {
		//this._logger.info(`${name}' added observer for '${this._name}'`)
		if (this._collectionData) callback(this._collectionData)
		this._observers.set(callback, { keysToPick, lastData: this.shallowClone(this._collectionData) })
	}

	/**
	 * Called after a batch of updates to documents in the collection
	 */
	protected changed(): void {
		// override me
	}

	private onDocumentEvent(id: ProtectedString<any> | string, changeType: string): void {
		this.logDocumentChange(id, changeType)
		if (!this._subscriptionId) {
			this._logger.silly(`${this._name} ${changeType} ${id} skipping (lack of subscription)`)
			return
		}
		if (this._subscriptionPending) {
			this._logger.silly(`${this._name} ${changeType} ${id} skipping (subscription pending)`)
			return
		}
		this.throttledChanged()
	}

	private setupObserver(): void {
		this._dbObserver = this._coreHandler.setupObserver(this._collectionName)
		this._dbObserver.added = (id) => {
			this.onDocumentEvent(id, 'added')
		}
		this._dbObserver.changed = (id) => {
			this.onDocumentEvent(id, 'changed')
		}
		this._dbObserver.removed = (id) => {
			this.onDocumentEvent(id, 'removed')
		}
	}

	protected stopSubscription(): void {
		if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
		this._subscriptionId = undefined
		this._dbObserver?.stop()
		this._dbObserver = undefined
	}

	protected setupSubscription(...args: ParametersOfFunctionOrNever<CorelibPubSubTypes[TPubSub]>): void {
		if (!this._publicationName) throw new Error(`Publication name not set for '${this._name}'`)
		this.stopSubscription()
		this._subscriptionPending = true
		this._coreHandler
			.setupSubscription(this._publicationName, ...args)
			.then((subscriptionId) => {
				this._subscriptionId = subscriptionId
				this.setupObserver()
			})
			.catch((e) => this._logger.error(e))
			.finally(() => {
				this._subscriptionPending = false
				this.changed()
			})
	}
}
