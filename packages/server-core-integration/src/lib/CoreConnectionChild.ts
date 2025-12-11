import { EventEmitter } from 'events'
import {
	PeripheralDeviceStatusObject,
	PeripheralDeviceInitOptions,
	PeripheralDeviceSubType,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { PeripheralDeviceAPIMethods } from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'
import { DDPConnector } from './ddpConnector.js'
import { Observer } from './ddpClient.js'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { ConnectionMethodsQueue, ExternalPeripheralDeviceAPI, makeMethods, makeMethodsLowPrio } from './methods.js'
import { PeripheralDeviceForDevice } from '@sofie-automation/shared-lib/dist/core/model/peripheralDevice'
import { CoreConnection, Collection, CoreOptions, CollectionDocCheck } from './coreConnection.js'
import { CorePinger } from './ping.js'
import { ParametersOfFunctionOrNever, SubscriptionId, SubscriptionsHelper } from './subscriptions.js'
import {
	PeripheralDevicePubSubCollections,
	PeripheralDevicePubSubTypes,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'

export interface ChildCoreOptions {
	deviceId: PeripheralDeviceId

	/**
	 * SubType of the connection
	 */
	deviceSubType: PeripheralDeviceSubType

	/**
	 * Name of the device
	 * eg 'MOS Gateway'
	 */
	deviceName: string
}

export type ChildCoreConnectionEvents = {
	error: [err: Error | string]
}

export class CoreConnectionChild<
	PubSubTypes = PeripheralDevicePubSubTypes,
	PubSubCollections = PeripheralDevicePubSubCollections,
> extends EventEmitter<ChildCoreConnectionEvents> {
	private _parent: CoreConnection<PubSubTypes, PubSubCollections> | undefined
	private _parentOptions!: CoreOptions
	private _coreOptions: ChildCoreOptions
	private _methodQueue!: ConnectionMethodsQueue
	private _subscriptions!: SubscriptionsHelper<PubSubTypes>

	private _pinger: CorePinger
	private _destroyed = false

	private _peripheralDeviceApi: ExternalPeripheralDeviceAPI
	private _peripheralDeviceApiLowPriority: ExternalPeripheralDeviceAPI

	constructor(coreOptions: ChildCoreOptions) {
		super()

		this._coreOptions = coreOptions

		this._peripheralDeviceApi = makeMethods(this, PeripheralDeviceAPIMethods)
		this._peripheralDeviceApiLowPriority = makeMethodsLowPrio(this, PeripheralDeviceAPIMethods)

		this._pinger = new CorePinger(
			(err) => this._emitError(err),
			async () => this.coreMethods.ping()
		)
	}

	private doTriggerPing = (connected: boolean) => {
		this._pinger.setConnectedAndTriggerPing(connected)
	}

	async init(
		parent: CoreConnection<PubSubTypes, PubSubCollections>,
		parentOptions: CoreOptions
	): Promise<PeripheralDeviceId> {
		this._destroyed = false

		parent.on('connected', () => this._subscriptions.renewAutoSubscriptions())
		parent.on('connectionChanged', this.doTriggerPing)

		this._parent = parent
		this._parentOptions = parentOptions

		this._methodQueue = new ConnectionMethodsQueue(this._parent.ddp, {
			deviceId: this._coreOptions.deviceId,
			deviceToken: parentOptions.deviceToken,
		})
		this._subscriptions = new SubscriptionsHelper(
			this._emitError.bind(this),
			this._parent.ddp,
			parentOptions.deviceToken
		)

		this._pinger.setConnectedAndTriggerPing(parent.connected)

		return this._sendInit()
	}
	async destroy(): Promise<void> {
		this._destroyed = true

		this._subscriptions.unsubscribeAll()

		if (this._parent) {
			this._parent.off('connected', () => this._subscriptions.renewAutoSubscriptions())
			this._parent.off('connectionChanged', this.doTriggerPing)

			this._parent.removeChild(this)
			this._parent = undefined
		}

		this.removeAllListeners()

		this._pinger.destroy()
	}

	public get parent(): CoreConnection<PubSubTypes, PubSubCollections> {
		if (!this._parent) throw new Error('Connection has been destroyed')
		return this._parent
	}
	get ddp(): DDPConnector {
		if (!this._parent) throw new Error('Connection has been destroyed')
		return this._parent.ddp
	}
	get connected(): boolean {
		return this._parent?.connected ?? false
	}
	get deviceId(): PeripheralDeviceId {
		return this._coreOptions.deviceId
	}
	get coreMethods(): ExternalPeripheralDeviceAPI {
		return this._peripheralDeviceApi
	}
	get coreMethodsLowPriority(): ExternalPeripheralDeviceAPI {
		return this._peripheralDeviceApiLowPriority
	}
	async setStatus(status: PeripheralDeviceStatusObject): Promise<PeripheralDeviceStatusObject> {
		return this.coreMethods.setStatus(status)
	}
	/**
	 * This should not be used directly, use the `coreMethods` wrapper instead.
	 * Call a meteor method
	 * @param methodName The name of the method to call
	 * @param attrs Parameters to the method
	 * @returns Resopnse, if any
	 */
	async callMethodRaw(methodName: string, attrs: Array<any>): Promise<any> {
		if (this._destroyed) {
			throw new Error('callMethod: CoreConnection has been destroyed')
		}

		return this._methodQueue.callMethodRaw(methodName, attrs)
	}
	async callMethodLowPrioRaw(methodName: PeripheralDeviceAPIMethods | string, attrs: Array<any>): Promise<any> {
		return this._methodQueue.callMethodLowPrioRaw(methodName, attrs)
	}
	async unInitialize(): Promise<PeripheralDeviceId> {
		return this.coreMethods.unInitialize()
	}
	async getPeripheralDevice(): Promise<PeripheralDeviceForDevice> {
		return this.coreMethods.getPeripheralDevice()
	}
	getCollection<K extends keyof PubSubCollections>(
		collectionName: K
	): Collection<CollectionDocCheck<PubSubCollections[K]>> {
		if (!this._parent) throw new Error('Connection has been destroyed')

		return this._parent.getCollection(collectionName)
	}
	// /**
	//  * Subscribe to a DDP publication
	//  * Upon reconnecting to Sofie, this publication will be terminated
	//  */
	// async subscribeOnce(publicationName: string, ...params: Array<any>): Promise<SubscriptionId> {
	// 	if (!this._subscriptions) throw new Error('Connection is not ready to handle subscriptions')

	// 	return this._subscriptions.subscribeOnce(publicationName, ...params)
	// }
	/**
	 * Subscribe to a DDP publication
	 * Upon reconnecting to Sofie, this publication will be restarted
	 */
	async autoSubscribe<Key extends keyof PubSubTypes>(
		publicationName: Key,
		...params: ParametersOfFunctionOrNever<PubSubTypes[Key]>
	): Promise<SubscriptionId> {
		if (!this._subscriptions) throw new Error('Connection is not ready to handle subscriptions')

		return this._subscriptions.autoSubscribe(publicationName, ...params)
	}
	/**
	 * Unsubscribe from subscription to a DDP publication
	 */
	unsubscribe(subscriptionId: SubscriptionId): void {
		if (!this._subscriptions) throw new Error('Connection is not ready to handle subscriptions')

		this._subscriptions.unsubscribe(subscriptionId)
	}
	/**
	 * Unsubscribe from all subscriptions to DDP publications
	 */
	unsubscribeAll(): void {
		if (!this._subscriptions) throw new Error('Connection is not ready to handle subscriptions')

		this._subscriptions.unsubscribeAll()
	}
	observe<K extends keyof PubSubCollections>(collectionName: K): Observer<CollectionDocCheck<PubSubCollections[K]>> {
		if (!this._parent) throw new Error('Connection has been destroyed')

		return this._parent.observe(collectionName)
	}
	// getCurrentTime(): number {
	// 	return this._timeSync?.currentTime() || 0
	// }
	// hasSyncedTime(): boolean {
	// 	return this._timeSync?.isGood() || false
	// }
	// syncTimeQuality(): number | null {
	// 	return this._timeSync?.quality || null
	// }

	private _emitError(e: Error | string) {
		if (!this._destroyed) {
			this.emit('error', e)
		} else {
			console.log('destroyed error', e)
		}
	}

	private async _sendInit(): Promise<PeripheralDeviceId> {
		if (!this.ddp || !this.ddp.connectionId || !this._parent) throw Error('Not connected to Core')

		const options: PeripheralDeviceInitOptions = {
			category: this._parentOptions.deviceCategory,
			type: this._parentOptions.deviceType,
			subType: this._coreOptions.deviceSubType,

			name: this._coreOptions.deviceName,
			connectionId: this.ddp.connectionId,
			parentDeviceId: this._parent.deviceId,

			documentationUrl: this._parentOptions.documentationUrl,
		}

		return this.coreMethods.initialize(options)
	}
}
