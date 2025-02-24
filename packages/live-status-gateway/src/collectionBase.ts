import { CorelibPubSubCollections, CorelibPubSubTypes } from '@sofie-automation/corelib/dist/pubsub'
import {
	StudioId,
	CoreConnection,
	ProtectedString,
	Collection as CoreCollection,
	CollectionDocCheck,
} from '@sofie-automation/server-core-integration'
import throttleToNextTick from '@sofie-automation/shared-lib/dist/lib/throttleToNextTick'
import * as _ from 'underscore'
import { Logger } from 'winston'
import { CoreHandler } from './coreHandler'
import { arePropertiesShallowEqual } from './helpers/equality'
import { CollectionHandlers } from './liveStatusServer'

export type ObserverCallback<T, K extends keyof T> = (data: Pick<T, K> | undefined) => void

export const DEFAULT_THROTTLE_PERIOD_MS = 20

export abstract class CollectionBase<T, TCollection extends keyof CorelibPubSubCollections> {
	protected _name: string
	protected _collectionName: TCollection
	protected _logger: Logger
	protected _coreHandler: CoreHandler
	protected _studioId!: StudioId
	protected _observers: Map<
		ObserverCallback<T, keyof T>,
		{ keysToPick: readonly (keyof T)[] | undefined; lastData: T | undefined }
	> = new Map()
	protected _collectionData: T | undefined

	protected get _core(): CoreConnection<CorelibPubSubTypes, CorelibPubSubCollections> {
		return this._coreHandler.core
	}
	protected throttledChanged: () => void

	constructor(
		collection: TCollection,
		logger: Logger,
		coreHandler: CoreHandler,
		throttlePeriodMs = DEFAULT_THROTTLE_PERIOD_MS
	) {
		this._name = this.constructor.name
		this._collectionName = collection
		this._logger = logger
		this._coreHandler = coreHandler

		this.throttledChanged = throttleToNextTick(
			throttlePeriodMs > 0
				? _.throttle(() => this.changed(), throttlePeriodMs, { leading: true, trailing: true })
				: () => this.changed()
		)

		this._logger.info(`Starting ${this._name} handler`)
	}

	init(_handlers: CollectionHandlers): void {
		if (!this._coreHandler.studioId) throw new Error('StudioId is not defined')
		this._studioId = this._coreHandler.studioId
	}

	close(): void {
		this._logger.info(`Closing ${this._name} handler`)
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

	notify(data: T | undefined): void {
		for (const [observer, o] of this._observers) {
			if (
				!o.lastData ||
				!o.keysToPick ||
				!data ||
				!arePropertiesShallowEqual(o.lastData, data, undefined, o.keysToPick)
			) {
				observer(data)
				o.lastData = this.shallowClone(data)
			}
		}
	}

	protected shallowClone(data: T | undefined): T | undefined {
		if (data === undefined) return undefined
		if (Array.isArray(data)) return [...data] as T
		if (typeof data === 'object') return { ...data }
		return data
	}

	protected logDocumentChange(documentId: string | ProtectedString<any>, changeType: string): void {
		this._logger.silly(`${this._name} ${changeType} ${documentId}`)
	}

	protected logUpdateReceived(collectionName: string, updateCount: number | undefined): void
	protected logUpdateReceived(collectionName: string, extraInfo?: string): void
	protected logUpdateReceived(
		collectionName: string,
		extraInfoOrUpdateCount: string | number | undefined | null = null
	): void {
		let message = `${this._name} received ${collectionName} update`
		if (typeof extraInfoOrUpdateCount === 'string') {
			message += `, ${extraInfoOrUpdateCount}`
		} else if (extraInfoOrUpdateCount !== null) {
			message += `(${extraInfoOrUpdateCount})`
		}
		this._logger.debug(message)
	}

	protected logNotifyingUpdate(updateCount: number | undefined): void {
		this._logger.debug(`${this._name} notifying update with ${updateCount} ${this._collectionName}`)
	}

	protected getCollectionOrFail(): CoreCollection<CollectionDocCheck<CorelibPubSubCollections[TCollection]>> {
		const collection = this._core.getCollection<TCollection>(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		return collection
	}
}
