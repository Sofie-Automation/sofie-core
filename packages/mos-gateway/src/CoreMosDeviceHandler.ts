import {
	ExternalPeripheralDeviceAPI,
	StatusCode,
	protectString,
	Observer,
	PeripheralDevicePubSub,
	stringifyError,
} from '@sofie-automation/server-core-integration'
import {
	IMOSConnectionStatus,
	IMOSDevice,
	IMOSListMachInfo,
	IMOSRunningOrder,
	IMOSRunningOrderBase,
	IMOSRunningOrderStatus,
	IMOSStoryStatus,
	IMOSItemStatus,
	IMOSStoryAction,
	IMOSROStory,
	IMOSROAction,
	IMOSItemAction,
	IMOSItem,
	IMOSROReadyToAir,
	IMOSROFullStory,
	IMOSROAck,
	getMosTypes,
	MosTypes,
	IMOSString128,
	stringifyMosObject,
	stringifyMosType,
} from '@mos-connection/connector'
import _ from 'underscore'
import { MosHandler } from './mosHandler.js'
import { PartialDeep } from 'type-fest'
import type { CoreHandler } from './coreHandler.js'
import { CoreConnectionChild } from '@sofie-automation/server-core-integration/dist/lib/CoreConnectionChild'
import { Queue } from '@sofie-automation/server-core-integration/dist/lib/queue'

function deepMatch(object: any, attrs: any, deep: boolean): boolean {
	const keys = Object.keys(attrs)
	const length = keys.length
	if (object === null || object === undefined) return !length
	const obj = Object(object)
	for (let i = 0; i < length; i++) {
		const key = keys[i]
		if (deep && typeof attrs[key] === 'object') {
			if (!deepMatch(obj[key], attrs[key], true)) return false
		} else if (attrs[key] !== obj[key]) return false
	}
	return true
}

interface IStoryItemChange {
	roID: string
	storyID: string
	itemID: string
	timestamp: number

	resolve: (value?: IMOSROAck | PromiseLike<IMOSROAck>) => void
	reject: (error: Error) => void

	itemDiff: PartialDeep<IMOSItem>
}

export interface CoreMosDeviceHandlerOptions {
	openMediaHotStandby?: boolean
}

/**
 * Represents a connection between a mos-device and Core
 */

export class CoreMosDeviceHandler {
	core!: CoreConnectionChild
	public _observers: Array<Observer<any>> = []
	public _mosDevice: IMOSDevice
	private _coreParentHandler: CoreHandler
	private _mosHandler: MosHandler

	private _pendingStoryItemChanges: Array<IStoryItemChange> = []
	private _pendingChangeTimeout: number = 60 * 1000
	private mosTypes: MosTypes
	private _options: CoreMosDeviceHandlerOptions

	private _messageQueue: Queue

	constructor(
		parent: CoreHandler,
		mosDevice: IMOSDevice,
		mosHandler: MosHandler,
		options: CoreMosDeviceHandlerOptions
	) {
		this._coreParentHandler = parent
		this._mosDevice = mosDevice
		this._mosHandler = mosHandler
		this._options = options

		this._messageQueue = new Queue()

		this._coreParentHandler.logger.info('new CoreMosDeviceHandler ' + mosDevice.idPrimary)

		this.mosTypes = getMosTypes(this._mosHandler.strict)
	}
	async init(): Promise<void> {
		if (!this._coreParentHandler.core) throw new Error('parent missing core')

		this.core = await this._coreParentHandler.core.createChild({
			deviceId: protectString(this._coreParentHandler.core.deviceId + this._mosDevice.idPrimary),

			deviceSubType: 'mos_connection',

			deviceName: this._mosDevice.idPrimary,
		})
		this.core.on('error', (err) => {
			this._coreParentHandler.logger.error(`Core Error: ${stringifyError(err)}`)
		})

		this.setupSubscriptionsAndObservers()
	}
	setupSubscriptionsAndObservers(): void {
		// console.log('setupObservers', this.core.deviceId)
		if (this._observers.length) {
			this._coreParentHandler.logger.info('CoreMos: Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		this._coreParentHandler.logger.info(
			'CoreMos: Setting up subscriptions for ' +
				this.core.deviceId +
				' for mosDevice ' +
				this._mosDevice.idPrimary +
				' ..'
		)
		Promise.all([
			this.core.autoSubscribe(PeripheralDevicePubSub.peripheralDeviceCommands, this.core.deviceId),
		]).catch((e) => {
			this._coreParentHandler.logger.error(stringifyError(e))
		})

		this._coreParentHandler.logger.info('CoreMos: Setting up observers..')

		// setup observers
		this._coreParentHandler.setupObserverForPeripheralDeviceCommands(this)
	}
	onMosConnectionChanged(connectionStatus: IMOSConnectionStatus): void {
		let statusCode: StatusCode
		const messages: Array<string> = []

		if (this._options.openMediaHotStandby) {
			// OpenMedia treats secondary server as hot-standby
			// And thus is not considered as a warning if it's not connected
			if (connectionStatus.PrimaryConnected) {
				statusCode = StatusCode.GOOD
			} else {
				// Primary not connected is only bad if there is no secondary:
				if (connectionStatus.SecondaryConnected) {
					statusCode = StatusCode.GOOD
					messages.push(connectionStatus.SecondaryStatus || 'Running NRCS on hot standby')
				} else {
					statusCode = StatusCode.BAD
					// Send messages for both connections
					messages.push(connectionStatus.PrimaryStatus || 'Primary and hot standby are not connected')
					messages.push(connectionStatus.SecondaryStatus || 'Primary and hot standby are not connected')
				}
			}
		} else {
			if (connectionStatus.PrimaryConnected) {
				// ENPS expect both Primary and Secondary to be connected if both of them are configured
				if (connectionStatus.SecondaryConnected || !this._mosDevice.idSecondary) {
					statusCode = StatusCode.GOOD
				} else {
					statusCode = StatusCode.WARNING_MINOR
				}
			} else {
				if (connectionStatus.SecondaryConnected) {
					// Primary not connected should give a warning if Secondary is used.
					statusCode = StatusCode.WARNING_MAJOR
				} else {
					// If neither Primary nor Secondary is connected, it's a bad state.
					statusCode = StatusCode.BAD
				}
			}

			if (!connectionStatus.PrimaryConnected) {
				messages.push(connectionStatus.PrimaryStatus || 'Primary not connected')
			}
			if (this._mosDevice.idSecondary && !connectionStatus.SecondaryConnected) {
				messages.push(connectionStatus.SecondaryStatus || 'Fallback not connected')
			}
		}

		this.core
			.setStatus({
				statusCode: statusCode,
				messages: messages,
			})
			.catch((e) => this._coreParentHandler.logger.warn('Error when setting status:' + e))
	}
	async getMachineInfo(): Promise<IMOSListMachInfo> {
		const info: IMOSListMachInfo = {
			manufacturer: this.mosTypes.mosString128.create('SuperFly.tv'),
			model: this.mosTypes.mosString128.create('Core'),
			hwRev: this.mosTypes.mosString128.create('0'),
			swRev: this.mosTypes.mosString128.create('0'),
			DOM: this.mosTypes.mosString128.create('2018-01-01'),
			SN: this.mosTypes.mosString128.create('0000'),
			ID: this.mosTypes.mosString128.create('0000'),
			time: this.mosTypes.mosTime.create(new Date()),
			mosRev: this.mosTypes.mosString128.create('0'),
			supportedProfiles: {
				deviceType: 'MOS',
				profile0: this._mosHandler?.mosOptions?.self.profiles['0'],
				profile1: this._mosHandler?.mosOptions?.self.profiles['1'],
				profile2: this._mosHandler?.mosOptions?.self.profiles['2'],
				profile3: this._mosHandler?.mosOptions?.self.profiles['3'],
				profile4: this._mosHandler?.mosOptions?.self.profiles['4'],
				profile5: this._mosHandler?.mosOptions?.self.profiles['5'],
				profile6: this._mosHandler?.mosOptions?.self.profiles['6'],
				profile7: this._mosHandler?.mosOptions?.self.profiles['7'],
			},
		}
		return Promise.resolve(info)
	}
	async mosRoCreate(ro: IMOSRunningOrder): Promise<void> {
		return this._coreMosManipulate('mosRoCreate', ro)
	}
	async mosRoReplace(ro: IMOSRunningOrder): Promise<void> {
		return this._coreMosManipulate('mosRoReplace', ro)
	}
	async mosRoDelete(runningOrderId: IMOSString128): Promise<void> {
		return this._coreMosManipulate('mosRoDelete', runningOrderId)
	}
	async mosRoMetadata(metadata: IMOSRunningOrderBase): Promise<void> {
		return this._coreMosManipulate('mosRoMetadata', metadata)
	}
	async mosRoStatus(status: IMOSRunningOrderStatus): Promise<void> {
		return this._coreMosManipulate('mosRoStatus', status)
	}
	async mosRoStoryStatus(status: IMOSStoryStatus): Promise<void> {
		return this._coreMosManipulate('mosRoStoryStatus', status)
	}
	async mosRoItemStatus(status: IMOSItemStatus): Promise<void> {
		return this._coreMosManipulate('mosRoItemStatus', status)
	}
	async mosRoStoryInsert(Action: IMOSStoryAction, Stories: Array<IMOSROStory>): Promise<void> {
		return this._coreMosManipulate('mosRoStoryInsert', Action, Stories)
	}
	async mosRoStoryReplace(Action: IMOSStoryAction, Stories: Array<IMOSROStory>): Promise<void> {
		const result = this._coreMosManipulate('mosRoStoryReplace', Action, Stories)

		if (this._pendingStoryItemChanges.length > 0) {
			Stories.forEach((story) => {
				const pendingChange = this._pendingStoryItemChanges.find(
					(change) => change.storyID === this.mosTypes.mosString128.stringify(story.ID)
				)
				if (pendingChange) {
					const pendingChangeItem = story.Items.find(
						(item) => pendingChange.itemID === this.mosTypes.mosString128.stringify(item.ID)
					)
					if (pendingChangeItem && deepMatch(pendingChangeItem, pendingChange.itemDiff, true)) {
						pendingChange.resolve()
					}
				}
			})
		}
		return result
	}
	async mosRoStoryMove(Action: IMOSStoryAction, Stories: Array<IMOSString128>): Promise<void> {
		return this._coreMosManipulate('mosRoStoryMove', Action, Stories)
	}
	async mosRoStoryDelete(Action: IMOSROAction, Stories: Array<IMOSString128>): Promise<void> {
		return this._coreMosManipulate('mosRoStoryDelete', Action, Stories)
	}
	async mosRoStorySwap(Action: IMOSROAction, StoryID0: IMOSString128, StoryID1: IMOSString128): Promise<void> {
		return this._coreMosManipulate('mosRoStorySwap', Action, StoryID0, StoryID1)
	}
	async mosRoItemInsert(Action: IMOSItemAction, Items: Array<IMOSItem>): Promise<void> {
		return this._coreMosManipulate('mosRoItemInsert', Action, Items)
	}
	async mosRoItemReplace(Action: IMOSItemAction, Items: Array<IMOSItem>): Promise<void> {
		const result = this._coreMosManipulate('mosRoItemReplace', Action, Items)

		if (this._pendingStoryItemChanges.length > 0) {
			Items.forEach((item) => {
				const pendingChange = this._pendingStoryItemChanges.find(
					(change) =>
						this.mosTypes.mosString128.stringify(Action.StoryID) === change.storyID &&
						change.itemID === this.mosTypes.mosString128.stringify(item.ID)
				)
				if (pendingChange && deepMatch(item, pendingChange.itemDiff, true)) {
					pendingChange.resolve()
				}
			})
		}

		return result
	}
	async mosRoItemMove(Action: IMOSItemAction, Items: Array<IMOSString128>): Promise<void> {
		return this._coreMosManipulate('mosRoItemMove', Action, Items)
	}
	async mosRoItemDelete(Action: IMOSStoryAction, Items: Array<IMOSString128>): Promise<void> {
		return this._coreMosManipulate('mosRoItemDelete', Action, Items)
	}
	async mosRoItemSwap(Action: IMOSStoryAction, ItemID0: IMOSString128, ItemID1: IMOSString128): Promise<void> {
		return this._coreMosManipulate('mosRoItemSwap', Action, ItemID0, ItemID1)
	}
	async mosRoReadyToAir(Action: IMOSROReadyToAir): Promise<void> {
		return this._coreMosManipulate('mosRoReadyToAir', Action)
	}
	async mosRoFullStory(story: IMOSROFullStory): Promise<void> {
		const result = this._coreMosManipulate('mosRoFullStory', story)

		if (this._pendingStoryItemChanges.length > 0) {
			const pendingChange = this._pendingStoryItemChanges.find(
				(change) => change.storyID === this.mosTypes.mosString128.stringify(story.ID)
			)
			if (pendingChange) {
				const pendingChangeItem = story.Body.find((item) => {
					const content = item.Content && Array.isArray(item.Content) ? item.Content[0] : item.Content
					const contentId =
						typeof content === 'object' && content.ID ? stringifyMosType(content.ID, this.mosTypes) : ''

					return item.Type === 'storyItem' && pendingChange.itemID === contentId
				})
				if (pendingChangeItem && deepMatch(pendingChangeItem.Content, pendingChange.itemDiff, true)) {
					pendingChange.resolve()
				}
			}
		}

		return result
	}

	async triggerGetAllRunningOrders(): Promise<any> {
		// console.log('triggerGetAllRunningOrders')
		const results = await this._mosDevice.sendRequestAllRunningOrders()

		// console.log('GOT REPLY', results)
		return this.fixMosData(results)
	}
	async triggerGetRunningOrder(roId: string): Promise<any> {
		// console.log('triggerGetRunningOrder ' + roId)
		const ro = await this._mosDevice.sendRequestRunningOrder(this.mosTypes.mosString128.create(roId))

		// console.log('GOT REPLY', results)
		return this.fixMosData(ro)
	}
	async replaceStoryItem(
		roID: string,
		storyID: string,
		item: IMOSItem,
		itemDiff?: PartialDeep<IMOSItem>
	): Promise<any> {
		// console.log(roID, storyID, item)
		const rawResult = await this._mosDevice.sendItemReplace({
			roID: this.mosTypes.mosString128.create(roID),
			storyID: this.mosTypes.mosString128.create(storyID),
			item,
		})

		const result = this.fixMosData(rawResult)

		if (!itemDiff) {
			return result
		} else {
			if (
				!result ||
				!result.mos ||
				!result.mos.roAck ||
				!result.mos.roAck.roStatus ||
				result.mos.roAck.roStatus.toString() !== 'OK'
			) {
				return Promise.reject(new Error(`Bad result: ${JSON.stringify(result)}`))
			} else {
				// When the result of the replaceStoryItem operation comes in,
				// it is not confirmed if the change actually was performed or not.
				// Therefore we put a "pendingChange" on watch, so that this operation does not resolve
				// until the change actually has been applied (using onStoryReplace, onItemReplace or onFullStory)
				const pendingChange: IStoryItemChange = {
					roID,
					storyID,
					itemID: this.mosTypes.mosString128.stringify(item.ID),
					timestamp: Date.now(),

					resolve: () => {
						return
					},
					reject: () => {
						return
					},

					itemDiff,
				}
				this._coreParentHandler.logger.debug(
					`creating pending change: ${pendingChange.storyID}:${pendingChange.itemID}`
				)
				const promise = new Promise<IMOSROAck>((promiseResolve, promiseReject) => {
					pendingChange.resolve = (value) => {
						this.removePendingChange(pendingChange)
						this._coreParentHandler.logger.debug(
							`pending change resolved: ${pendingChange.storyID}:${pendingChange.itemID}`
						)
						promiseResolve(value || result)
					}
					pendingChange.reject = (reason: Error) => {
						this.removePendingChange(pendingChange)
						this._coreParentHandler.logger.debug(
							`pending change rejected: ${pendingChange.storyID}:${pendingChange.itemID}`
						)
						promiseReject(reason)
					}
				})
				this.addPendingChange(pendingChange)
				setTimeout(() => {
					pendingChange.reject(new Error('Pending change timed out'))
				}, this._pendingChangeTimeout)
				return promise
			}
		}
	}
	async test(a: string): Promise<string> {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve('test' + a)
			}, 2000)
		})
	}
	async dispose(subdevice: 'keepSubDevice' | 'removeSubDevice' = 'keepSubDevice'): Promise<void> {
		this._observers.forEach((obs) => obs.stop())

		await this.core.setStatus({
			statusCode: StatusCode.BAD,
			messages: ['Uninitialized'],
		})

		if (subdevice === 'removeSubDevice') await this.core.unInitialize()
		await this.core.destroy()
	}
	killProcess(): void {
		this._coreParentHandler.killProcess()
	}
	/**
	 * Convert mos-objects to look better over the wire
	 * @param o the object to convert
	 */
	private fixMosData(o: any): any {
		return stringifyMosObject(o, this.mosTypes.strict)
	}
	private async _coreMosManipulate<K extends keyof ExternalPeripheralDeviceAPI>(
		methodName: K,
		...attrs: Parameters<ExternalPeripheralDeviceAPI[K]>
	): Promise<ReturnType<ExternalPeripheralDeviceAPI[K]>> {
		attrs = _.map(attrs, (attr) => {
			return this.fixMosData(attr)
		}) as any

		// Make the commands be sent sequantially:
		return this._messageQueue.putOnQueue(async () => {
			// Log info about the sent command:
			let msg = 'Command: ' + methodName
			const attr0 = attrs[0] as any | undefined
			if (attr0?.ID) msg = `${methodName}: ${attr0.ID}`
			else if (attr0 && this.mosTypes.mosString128.is(attr0))
				msg = `${methodName}: ${this.mosTypes.mosString128.stringify(attr0)}`
			else if (attr0?.ObjectId) msg = `${methodName}: ${attr0.ObjectId}`
			else if (attr0?.StoryId) msg = `${methodName}: ${attr0.StoryId}`
			else if (attr0?.StoryID) msg = `${methodName}: ${attr0.StoryID}`
			else if (attr0?.ItemID) msg = `${methodName}: ${attr0.ItemID}`
			else if (attr0?.RunningOrderID) msg = `${methodName}: ${attr0.RunningOrderID}`
			else if (attr0?.toString) msg = `${methodName}: ${attr0.toString()}`

			this._coreParentHandler.logger.info('Recieved MOS command: ' + msg)

			const res = (this.core.coreMethods[methodName] as any)(...attrs)
			return res.catch((e: any) => {
				this._coreParentHandler.logger.info('MOS command rejected: ' + ((e && JSON.stringify(e)) || e))
				throw e
			})
		})
	}
	private addPendingChange(change: IStoryItemChange) {
		this._pendingStoryItemChanges.push(change)
	}
	private removePendingChange(change: IStoryItemChange) {
		const idx = this._pendingStoryItemChanges.indexOf(change)
		if (idx >= 0) {
			this._pendingStoryItemChanges.splice(idx, 1)
		}
	}
}
