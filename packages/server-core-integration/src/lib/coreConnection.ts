import { EventEmitter } from 'events'
import _ from 'underscore'
import {
	PeripheralDeviceCategory,
	PERIPHERAL_SUBTYPE_PROCESS,
	PeripheralDeviceStatusObject,
	PeripheralDeviceInitOptions,
	PeripheralDeviceType,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { PeripheralDeviceAPIMethods } from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'

import { DDPConnector } from './ddpConnector.js'
import { DDPConnectorOptions, Observer } from './ddpClient.js'

import { TimeSync } from './timeSync.js'
import { WatchDog } from './watchDog.js'
import { DeviceConfigManifest } from './configManifest.js'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { ConnectionMethodsQueue, ExternalPeripheralDeviceAPI, makeMethods, makeMethodsLowPrio } from './methods.js'
import { PeripheralDeviceForDevice } from '@sofie-automation/shared-lib/dist/core/model/peripheralDevice'
import { ProtectedString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { ChildCoreOptions, CoreConnectionChild } from './CoreConnectionChild.js'
import { CorePinger } from './ping.js'
import { ParametersOfFunctionOrNever, SubscriptionId, SubscriptionsHelper } from './subscriptions.js'
import {
	PeripheralDevicePubSubCollections,
	PeripheralDevicePubSubTypes,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'

const PkgInfo = require('../../package.json')

export interface CoreCredentials {
	deviceId: PeripheralDeviceId
	deviceToken: string
}

export interface CoreOptions extends CoreCredentials {
	/**
	 * Category of the Device
	 */
	deviceCategory: PeripheralDeviceCategory
	/**
	 * Type of the Device
	 */
	deviceType: PeripheralDeviceType

	/**
	 * Name of the device
	 * eg 'MOS Gateway'
	 */
	deviceName: string

	/**
	 * URL of documentation for this Device
	 */
	documentationUrl: string

	versions: {
		[libraryName: string]: string
	}
	watchDog?: boolean

	configManifest: DeviceConfigManifest
}

export type CollectionDocCheck<Doc> = Doc extends { _id: ProtectedString<any> | string } ? Doc : never

export interface Collection<DBObj extends { _id: ProtectedString<any> | string }> {
	find: (selector?: any) => Array<DBObj>
	findOne: (docId: DBObj['_id']) => DBObj | undefined
}

export type CoreConnectionEvents = {
	connected: []
	connectionChanged: [connected: boolean]
	disconnected: []
	failed: [err: Error]
	error: [err: Error | string]
}
export class CoreConnection<
	PubSubTypes = PeripheralDevicePubSubTypes,
	PubSubCollections = PeripheralDevicePubSubCollections,
> extends EventEmitter<CoreConnectionEvents> {
	private _ddp: DDPConnector | undefined
	private _methodQueue: ConnectionMethodsQueue | undefined
	private _subscriptions: SubscriptionsHelper<PubSubTypes> | undefined
	private _children: Array<CoreConnectionChild<PubSubTypes, PubSubCollections>> = []
	private _coreOptions: CoreOptions
	private _timeSync: TimeSync | null = null
	private _watchDog?: WatchDog
	private _watchDogPingResponse = ''
	private _connected = false
	private _sentConnectionId = ''
	private _pinger: CorePinger
	private _destroyed = false

	private _peripheralDeviceApi: ExternalPeripheralDeviceAPI
	private _peripheralDeviceApiLowPriority: ExternalPeripheralDeviceAPI

	constructor(coreOptions: CoreOptions) {
		super()

		this._coreOptions = coreOptions

		/** We continuously ping Core to let Core know that we're alive */
		this._pinger = new CorePinger(
			(err) => this._emitError(err),
			async () => this.coreMethods.ping()
		)

		if (this._coreOptions.watchDog) {
			this._watchDog = new WatchDog()
			this._watchDog.on('message', (msg) => this._emitError('msg ' + msg))
			this._watchDog.startWatching()
		}

		this._peripheralDeviceApi = makeMethods(this, PeripheralDeviceAPIMethods)
		this._peripheralDeviceApiLowPriority = makeMethodsLowPrio(this, PeripheralDeviceAPIMethods)
	}
	async init(ddpOptions0?: DDPConnectorOptions): Promise<PeripheralDeviceId> {
		this._destroyed = false
		this.on('connected', () => {
			if (this._subscriptions) {
				this._subscriptions.renewAutoSubscriptions()
			}
		})

		const ddpOptions: DDPConnectorOptions = ddpOptions0 || {
			host: '127.0.0.1',
			port: 3000,
		}
		// TODO: The following line is ignored - autoReconnect ends up as false - which is what the tests want. Why?
		if (!_.has(ddpOptions, 'autoReconnect')) ddpOptions.autoReconnect = true
		if (!_.has(ddpOptions, 'autoReconnectTimer')) ddpOptions.autoReconnectTimer = 1000
		this._ddp = new DDPConnector(ddpOptions)
		this._methodQueue = new ConnectionMethodsQueue(this._ddp, this._coreOptions)
		this._subscriptions = new SubscriptionsHelper(
			this._emitError.bind(this),
			this._ddp,
			this._coreOptions.deviceToken
		)

		this._ddp.on('error', (err) => {
			this._emitError('ddpError: ' + (_.isObject(err) && err.message) || err.toString())
		})
		this._ddp.on('failed', (err) => {
			this.emit('failed', err)
		})
		this._ddp.on('connected', () => {
			// this.emit('connected')
			if (this._watchDog) this._watchDog.addCheck(async () => this._watchDogCheck())
		})
		this._ddp.on('disconnected', () => {
			// this.emit('disconnected')
			if (this._watchDog) this._watchDog.removeCheck(async () => this._watchDogCheck())
		})
		this._ddp.on('message', () => {
			if (this._watchDog) this._watchDog.receivedData()
		})
		await this._ddp.createClient()
		await this._ddp.connect()
		this._setConnected(this._ddp.connected) // ensure that connection status is synced

		// set up the connectionChanged event handler after we've connected, so that it doesn't trigger on the await this._ddp.connect()
		this._ddp.on('connectionChanged', (connected: boolean) => {
			this._setConnected(connected)

			this._maybeSendInit().catch((err) => {
				this._emitError('_maybesendInit ' + JSON.stringify(err))
			})
		})

		const deviceId = await this._sendInit()
		this._timeSync = new TimeSync(
			{
				serverDelayTime: 0,
			},
			async () => {
				const stat = await this.coreMethods.getTimeDiff()
				return stat.currentTime
			}
		)

		await this._timeSync.init()
		this._pinger.triggerPing()
		return deviceId
	}
	async destroy(): Promise<void> {
		this._destroyed = true

		if (this._ddp) {
			this._ddp.close()
			this._ddp.removeAllListeners()
		}
		this.removeAllListeners()

		if (this._watchDog) this._watchDog.stopWatching()

		this._pinger.destroy()

		if (this._timeSync) {
			this._timeSync.stop()
			this._timeSync = null
		}

		await Promise.all(this._children.map(async (child) => child.destroy()))

		this._children = []
	}

	async createChild(coreOptions: ChildCoreOptions): Promise<CoreConnectionChild<PubSubTypes, PubSubCollections>> {
		const child = new CoreConnectionChild<PubSubTypes, PubSubCollections>(coreOptions)

		await child.init(this, this._coreOptions)

		return child
	}

	removeChild(childToRemove: CoreConnectionChild<any, any>): void {
		let removeIndex = -1
		this._children.forEach((c, i) => {
			if (c === childToRemove) removeIndex = i
		})
		if (removeIndex !== -1) {
			this._children.splice(removeIndex, 1)
		}
	}
	onConnectionChanged(cb: (connected: boolean) => void): void {
		this.on('connectionChanged', cb)
	}
	onConnected(cb: () => void): void {
		this.on('connected', cb)
	}
	onDisconnected(cb: () => void): void {
		this.on('disconnected', cb)
	}
	onError(cb: (err: Error | string) => void): void {
		this.on('error', cb)
	}
	onFailed(cb: (err: Error) => void): void {
		this.on('failed', cb)
	}
	get ddp(): DDPConnector {
		if (!this._ddp) {
			throw new Error('Not connected to Core')
		} else {
			return this._ddp
		}
	}
	get connected(): boolean {
		return this._connected
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

		if (!this._methodQueue) throw new Error('Connection is not ready to call methods')

		return this._methodQueue.callMethodRaw(methodName, attrs)
	}
	async callMethodLowPrioRaw(methodName: PeripheralDeviceAPIMethods | string, attrs: Array<any>): Promise<any> {
		if (!this._methodQueue) throw new Error('Connection is not ready to call methods')

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
		type Doc = CollectionDocCheck<PubSubCollections[K]>
		if (!this.ddp.ddpClient) {
			throw new Error('getCollection: DDP client not initialized')
		}
		const collections = this.ddp.ddpClient.collections

		const c: Collection<Doc> = {
			find(selector?: any): Array<Doc> {
				const collection = (collections[String(collectionName)] || {}) as any as Record<string, Doc>
				if (_.isUndefined(selector)) {
					return _.values(collection)
				} else if (_.isFunction(selector)) {
					return _.filter(_.values(collection), selector)
				} else if (_.isObject(selector)) {
					return _.where(_.values(collection), selector)
				} else {
					return [collection[selector]]
				}
			},
			findOne(docId: Doc['_id']): Doc | undefined {
				const collection = (collections[String(collectionName)] || {}) as any as Record<string, Doc>
				return collection[docId as string]
			},
		}
		return c
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
	 * Unsubscribe from subscroption to a DDP publication
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
		if (!this.ddp.ddpClient) {
			throw new Error('observe: DDP client not initialised')
		}
		return this.ddp.ddpClient.observe(String(collectionName))
	}
	getCurrentTime(): number {
		return this._timeSync?.currentTime() || 0
	}
	hasSyncedTime(): boolean {
		return this._timeSync?.isGood() || false
	}
	syncTimeQuality(): number | null {
		return this._timeSync?.quality || null
	}
	setPingResponse(message: string): void {
		this._watchDogPingResponse = message
	}

	private _emitError(e: Error | string) {
		if (!this._destroyed) {
			this.emit('error', e)
		} else {
			console.log('destroyed error', e)
		}
	}
	private _setConnected(connected: boolean) {
		const prevConnected = this._connected
		this._connected = connected
		if (prevConnected !== connected) {
			if (connected) this.emit('connected')
			else this.emit('disconnected')
			this.emit('connectionChanged', connected)
		}
		this._pinger.setConnectedAndTriggerPing(connected)
	}
	private async _maybeSendInit(): Promise<any> {
		// If the connectionId has changed, we should report that to Core:
		if (this.ddp && this.ddp.connectionId !== this._sentConnectionId) {
			return this._sendInit()
		} else {
			return Promise.resolve()
		}
	}
	private async _sendInit(): Promise<PeripheralDeviceId> {
		if (!this.ddp || !this.ddp.connectionId) throw Error('Not connected to Core')

		const options: PeripheralDeviceInitOptions = {
			category: this._coreOptions.deviceCategory,
			type: this._coreOptions.deviceType,
			subType: PERIPHERAL_SUBTYPE_PROCESS,

			name: this._coreOptions.deviceName,
			connectionId: this.ddp.connectionId,
			parentDeviceId: undefined,
			versions: this._coreOptions.versions,

			configManifest: this._coreOptions.configManifest,

			documentationUrl: this._coreOptions.documentationUrl,
		}

		if (!options.versions) options.versions = {}
		options.versions['@sofie-automation/server-core-integration'] = PkgInfo.version

		this._sentConnectionId = options.connectionId
		return this.coreMethods.initialize(options)
	}

	private async _watchDogCheck() {
		/*
			Randomize a message and send it to Core.
			Core should then reply with triggering executeFunction with the "pingResponse" method.
		*/
		const message = 'watchdogPing_' + Math.round(Math.random() * 100000)
		this.coreMethods.pingWithCommand(message).catch((e) => this._emitError('watchdogPing' + e))

		return new Promise<void>((resolve, reject) => {
			let i = 0
			const checkPingReply = () => {
				if (this._watchDogPingResponse === message) {
					// if we've got a good watchdog response, we can delay the pinging:
					this._pinger.triggerDelayPing()

					resolve()
				} else {
					i++
					if (i > 50) {
						reject(new Error('Watchdog ping timeout'))
					} else {
						setTimeout(checkPingReply, 300)
					}
				}
			}
			checkPingReply()
		}).then(() => {
			return
		})
	}
}
