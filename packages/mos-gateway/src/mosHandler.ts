import {
	MosConnection,
	IMOSConnectionStatus,
	IMOSRunningOrder,
	IMOSROAck,
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
	IConnectionConfig,
	MosDevice,
	IMOSListMachInfo,
	IMOSString128,
	getMosTypes,
	MosTypes,
} from '@mos-connection/connector'

import * as Winston from 'winston'
import { CoreHandler } from './coreHandler.js'
import { CoreMosDeviceHandler } from './CoreMosDeviceHandler.js'
import {
	Observer,
	PeripheralDevicePubSubCollectionsNames,
	stringifyError,
} from '@sofie-automation/server-core-integration'
import {
	DEFAULT_MOS_TIMEOUT_TIME,
	DEFAULT_MOS_HEARTBEAT_INTERVAL,
} from '@sofie-automation/shared-lib/dist/core/constants'
import { MosGatewayConfig } from '@sofie-automation/shared-lib/dist/generated/MosGatewayOptionsTypes'
import { MosDeviceConfig } from '@sofie-automation/shared-lib/dist/generated/MosGatewayDevicesTypes'
import { PeripheralDeviceForDevice } from '@sofie-automation/server-core-integration'
import _ from 'underscore'
import { MosStatusHandler } from './mosStatus/handler.js'
import { isPromise } from 'util/types'

export interface MosConfig {
	self: IConnectionConfig
	// devices: Array<IMOSDeviceConnectionOptions>
}
type MosSubDeviceSettings = Record<
	string,
	{
		type: ''
		options: MosDeviceConfig
	}
>

/**
 * Represents a connection in mos-connection, paired with some additional data
 */
interface MosDeviceHandle {
	readonly deviceId: string
	readonly mosDevice: MosDevice
	readonly deviceOptions: Readonly<MosDeviceConfig>

	// Once connected, a core handler is setup
	coreMosHandler?: CoreMosDeviceHandler | Promise<CoreMosDeviceHandler>

	// If writing back story/item status is enabled, the setup handler
	statusHandler?: MosStatusHandler
}

export class MosHandler {
	public mos: MosConnection | undefined

	public mosOptions: MosConfig | undefined
	public debugLogging = false

	/** Map of mos devices that have been created */
	private readonly _allMosDevices = new Map<string, MosDeviceHandle>()

	private _logger: Winston.Logger
	private _disposed = false
	private _settings?: MosGatewayConfig
	private _coreHandler: CoreHandler | undefined
	private _observers: Array<Observer<any>> = []
	private _triggerupdateDevicesTimeout: any = null
	private mosTypes: MosTypes

	public static async create(
		logger: Winston.Logger,
		config: MosConfig,
		coreHandler: CoreHandler
	): Promise<MosHandler> {
		const handler = new MosHandler(logger)
		await handler.init(config, coreHandler)
		return handler
	}

	private constructor(logger: Winston.Logger) {
		this._logger = logger
		this.mosTypes = getMosTypes(this.strict) // temporary, another will be set upon init()
	}
	private async init(config: MosConfig, coreHandler: CoreHandler): Promise<void> {
		this.mosOptions = config
		this._coreHandler = coreHandler
		/*{
			mosID: 'seff-tv-automation',
			acceptsConnections: true, // default:true
			// accepsConnectionsFrom: ['127.0.0.1'],
			profiles: {
				'0': true,
				'1': true,
				'2': true,
				'3': false,
				'4': false,
				'5': false,
				'6': false,
				'7': false
			}
		}
		*/
		if (!coreHandler) {
			throw Error('coreHandler is undefined!')
		}

		if (!coreHandler.core) {
			throw Error('coreHandler.core is undefined!')
		}

		const peripheralDevice = await coreHandler.core.getPeripheralDevice()

		this._settings = peripheralDevice.deviceSettings as any

		this.mosTypes = getMosTypes(this.strict)

		await this._updateDevices()

		if (!this._coreHandler) throw Error('_coreHandler is undefined!')
		this._coreHandler.onConnected(() => {
			// This is called whenever a connection to Core has been (re-)established
			this.setupObservers()
			this.sendStatusOfAllMosDevices()
		})
		this.setupObservers()
	}
	async dispose(): Promise<void> {
		this._disposed = true
		if (this.mos) {
			return this.mos.dispose()
		} else {
			return Promise.resolve()
		}
	}
	private setupObservers(): void {
		if (this._observers.length) {
			this._observers.forEach((obs) => obs.stop())
			this._observers = []
		}
		this._logger.info('Renewing observers')

		if (!this._coreHandler) {
			throw Error('_coreHandler is undefined!')
		}

		if (!this._coreHandler.core) {
			throw Error('_coreHandler.core is undefined!')
		}

		const deviceObserver = this._coreHandler.core.observe(
			PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice
		)
		deviceObserver.added = () => this._deviceOptionsChanged()
		deviceObserver.changed = () => this._deviceOptionsChanged()
		deviceObserver.removed = () => this._deviceOptionsChanged()
		this._observers.push(deviceObserver)

		this._deviceOptionsChanged()
	}
	debugLog(msg: string, args?: Record<string, string>): void {
		if (this.debugLogging) {
			this._logger.debug(msg, args)
		}
	}
	get strict(): boolean {
		return this._settings?.strict ?? false
	}
	private _deviceOptionsChanged() {
		const peripheralDevice = this.getThisPeripheralDevice()
		if (peripheralDevice) {
			const settings: MosGatewayConfig = (peripheralDevice.deviceSettings || {}) as any
			if (this.debugLogging !== settings.debugLogging) {
				this._logger.info('Changing debugLogging to ' + settings.debugLogging)

				this.debugLogging = !!settings.debugLogging

				if (!this.mos) {
					throw Error('mos is undefined!')
				}
				this.mos.setDebug(this.debugLogging)

				if (settings.debugLogging) {
					this._logger.level = 'debug'
				} else {
					this._logger.level = 'info'
				}
				this._logger.info('log level ' + this._logger.level)
				this._logger.info('test log info')
				console.log('test console.log')
				this._logger.debug('test log debug')
			}
		}
		if (this._triggerupdateDevicesTimeout) {
			clearTimeout(this._triggerupdateDevicesTimeout)
		}
		this._triggerupdateDevicesTimeout = setTimeout(() => {
			this._updateDevices().catch((e) => {
				this._logger.error(stringifyError(e))
			})
		}, 20)
	}
	private async _initMosConnection(): Promise<void> {
		if (this._disposed) return Promise.resolve()
		if (!this._settings) throw Error('Mos-Settings are not set')

		this._logger.info('Initializing MosConnection...')

		if (!this.mosOptions) {
			throw Error('mosOptions is undefined!')
		}

		const connectionConfig: IConnectionConfig = this.mosOptions.self

		if (!this._settings.mosId) throw Error('mosId missing in settings!')
		connectionConfig.mosID = this._settings.mosId

		connectionConfig.strict = this.strict

		connectionConfig.ports = this._settings.ports

		this.mos = new MosConnection(connectionConfig)
		this.mos.on('rawMessage', (source, type, message) => {
			// Filter out heartbeat messages, to reduce log amount:
			if (`${message}`.indexOf('<heartbeat') >= 0) {
				return
			}
			this.debugLog(`rawMessage`, { source, type, rawMessage: message })
		})
		this.mos.on('info', (message, data) => {
			this._logger.info(message, data)
		})
		this.mos.on('error', (error) => {
			this._logger.error(stringifyError(error))
		})
		this.mos.on('warning', (warning) => {
			this._logger.error(stringifyError(warning))
		})

		this.mos.onConnection((mosDevice: MosDevice): void => {
			this.setupMosDevice(mosDevice).catch((e) => {
				this._logger.error(stringifyError(e))
			})
		})

		// Open mos-server for connections:
		await this.mos.init()
	}
	private async setupMosDevice(mosDevice: MosDevice): Promise<void> {
		// a new connection to a device has been made
		this._logger.info('new mosConnection established: ' + mosDevice.idPrimary + ', ' + mosDevice.idSecondary)
		try {
			const deviceEntry = Array.from(this._allMosDevices.values()).find(
				(d) =>
					d.mosDevice.idPrimary === mosDevice.idPrimary && d.mosDevice.idSecondary === mosDevice.idSecondary
			)

			if (!deviceEntry) {
				// We got a connection for a connection which shouldn't exist..
				this._logger.error(`Got connection for mosDevice "${mosDevice.idPrimary}" which doesn't exist!`)
				return
			}

			if (deviceEntry.mosDevice !== mosDevice) {
				// Our state doesn't match, don't try to use the connection it could be from a previous connection attempt
				this._logger.error(
					`Got connection for mosDevice "${mosDevice.idPrimary}" which differs to the one setup!`
				)
				return
			}

			// This is either a promise, if a handler is currently being setup, or the handler itself
			if (deviceEntry.coreMosHandler) {
				this._logger.error(`Got connection for mosDevice "${mosDevice.idPrimary}" which is already setup!`)
				return
			}

			if (!this._coreHandler) throw Error('_coreHandler is undefined!')

			const openMediaHotStandby = deviceEntry.deviceOptions.secondary?.openMediaHotStandby || false

			const coreMosHandler = await this._coreHandler.registerMosDevice(mosDevice, this, {
				openMediaHotStandby: mosDevice.idSecondary ? openMediaHotStandby : false,
			})
			// this._logger.info('mosDevice registered -------------')
			// Setup message flow between the devices:

			deviceEntry.coreMosHandler = coreMosHandler

			// Initial Status check:
			// Profile 0: -------------------------------------------------
			mosDevice.onConnectionChange((newStatus: IMOSConnectionStatus) => {
				//  MOSDevice >>>> Core
				coreMosHandler.onMosConnectionChanged(newStatus)

				// Setup the status handler upon first connection to the NRCS
				const isConnected = newStatus.PrimaryConnected || newStatus.SecondaryConnected
				if (deviceEntry.deviceOptions.statuses?.enabled && !deviceEntry.statusHandler && isConnected) {
					// Creating the handler at this point avoids sending status messages before the connection is established,
					// allowing for a sync at startup without needing manual queueing
					deviceEntry.statusHandler = new MosStatusHandler(
						this._logger,
						mosDevice,
						coreMosHandler,
						deviceEntry.deviceOptions.statuses,
						this.strict
					)
				}
			})
			coreMosHandler.onMosConnectionChanged(mosDevice.getConnectionStatus())
			mosDevice.onRequestMachineInfo(async () => {
				// MOSDevice >>>> Core
				return coreMosHandler.getMachineInfo()
			})

			// Profile 1: -------------------------------------------------
			/*
					mosDevice.onRequestMOSObject((objId: string) => {
						// coreMosHandler.fetchMosObject(objId)
						// return Promise<IMOSObject | null>
					})
					*/
			// onRequestMOSObject: (cb: (objId: string) => Promise<IMOSObject | null>) => void
			// onRequestAllMOSObjects: (cb: () => Promise<Array<IMOSObject>>) => void
			// getMOSObject: (objId: string) => Promise<IMOSObject>
			// getAllMOSObjects: () => Promise<Array<IMOSObject>>
			// Profile 2: -------------------------------------------------
			mosDevice.onCreateRunningOrder(async (ro: IMOSRunningOrder) => {
				// MOSDevice >>>> Core
				return this._getROAck(ro.ID, coreMosHandler.mosRoCreate(ro))
			})
			mosDevice.onReplaceRunningOrder(async (ro: IMOSRunningOrder) => {
				// MOSDevice >>>> Core
				return this._getROAck(ro.ID, coreMosHandler.mosRoReplace(ro))
			})
			mosDevice.onDeleteRunningOrder(async (runningOrderId: IMOSString128) => {
				// MOSDevice >>>> Core
				return this._getROAck(runningOrderId, coreMosHandler.mosRoDelete(runningOrderId))
			})
			mosDevice.onMetadataReplace(async (ro: IMOSRunningOrderBase) => {
				// MOSDevice >>>> Core
				return this._getROAck(ro.ID, coreMosHandler.mosRoMetadata(ro))
			})
			mosDevice.onRunningOrderStatus(async (status: IMOSRunningOrderStatus) => {
				// MOSDevice >>>> Core
				return this._getROAck(status.ID, coreMosHandler.mosRoStatus(status))
			})
			mosDevice.onStoryStatus(async (status: IMOSStoryStatus) => {
				// MOSDevice >>>> Core
				return this._getROAck(status.RunningOrderId, coreMosHandler.mosRoStoryStatus(status))
			})
			mosDevice.onItemStatus(async (status: IMOSItemStatus) => {
				// MOSDevice >>>> Core
				return this._getROAck(status.RunningOrderId, coreMosHandler.mosRoItemStatus(status))
			})
			mosDevice.onROInsertStories(async (Action: IMOSStoryAction, Stories: Array<IMOSROStory>) => {
				// MOSDevice >>>> Core
				return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoStoryInsert(Action, Stories))
			})
			mosDevice.onROInsertItems(async (Action: IMOSItemAction, Items: Array<IMOSItem>) => {
				// MOSDevice >>>> Core
				return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoItemInsert(Action, Items))
			})
			mosDevice.onROReplaceStories(async (Action: IMOSStoryAction, Stories: Array<IMOSROStory>) => {
				// MOSDevice >>>> Core
				return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoStoryReplace(Action, Stories))
			})
			mosDevice.onROReplaceItems(async (Action: IMOSItemAction, Items: Array<IMOSItem>) => {
				// MOSDevice >>>> Core
				return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoItemReplace(Action, Items))
			})
			mosDevice.onROMoveStories(async (Action: IMOSStoryAction, Stories: Array<IMOSString128>) => {
				// MOSDevice >>>> Core
				return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoStoryMove(Action, Stories))
			})
			mosDevice.onROMoveItems(async (Action: IMOSItemAction, Items: Array<IMOSString128>) => {
				// MOSDevice >>>> Core
				return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoItemMove(Action, Items))
			})
			mosDevice.onRODeleteStories(async (Action: IMOSROAction, Stories: Array<IMOSString128>) => {
				// MOSDevice >>>> Core
				return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoStoryDelete(Action, Stories))
			})
			mosDevice.onRODeleteItems(async (Action: IMOSStoryAction, Items: Array<IMOSString128>) => {
				// MOSDevice >>>> Core
				return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoItemDelete(Action, Items))
			})
			mosDevice.onROSwapStories(
				async (Action: IMOSROAction, StoryID0: IMOSString128, StoryID1: IMOSString128) => {
					// MOSDevice >>>> Core
					return this._getROAck(
						Action.RunningOrderID,
						coreMosHandler.mosRoStorySwap(Action, StoryID0, StoryID1)
					)
				}
			)
			mosDevice.onROSwapItems(async (Action: IMOSStoryAction, ItemID0: IMOSString128, ItemID1: IMOSString128) => {
				// MOSDevice >>>> Core
				return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoItemSwap(Action, ItemID0, ItemID1))
			})
			mosDevice.onReadyToAir(async (Action: IMOSROReadyToAir) => {
				// MOSDevice >>>> Core
				return this._getROAck(Action.ID, coreMosHandler.mosRoReadyToAir(Action))
			})
			// ----------------------------------------------------------------
			// Init actions
			/*
					mosDevice.getMachineInfo()
						.then((machineInfo: IMOSListMachInfo) => {
						})
					*/
			// Profile 3: -------------------------------------------------
			// Profile 4: -------------------------------------------------
			// onStory: (cb: (story: IMOSROFullStory) => Promise<any>) => void
			mosDevice.onRequestAllRunningOrders(async () => {
				// MOSDevice >>>> Core
				// Not implemented, as Sofie does not support this feature.
				return []
			})
			mosDevice.onRunningOrderStory(async (story: IMOSROFullStory) => {
				// MOSDevice >>>> Core
				return this._getROAck(story.RunningOrderId, coreMosHandler.mosRoFullStory(story))
			})
		} catch (e) {
			this._logger.error(stringifyError(e))
		}
	}
	private sendStatusOfAllMosDevices() {
		// Send an update to Core of the status of all mos devices
		for (const handler of this._allMosDevices.values()) {
			if (handler.coreMosHandler && !isPromise(handler.coreMosHandler)) {
				handler.coreMosHandler.onMosConnectionChanged(handler.mosDevice.getConnectionStatus())
			}
		}
	}
	private getThisPeripheralDevice(): PeripheralDeviceForDevice | undefined {
		if (!this._coreHandler) {
			throw Error('_coreHandler is undefined!')
		}

		if (!this._coreHandler.core) {
			throw Error('_coreHandler.core is undefined')
		}

		const peripheralDevices = this._coreHandler.core.getCollection(
			PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice
		)
		return peripheralDevices.findOne(this._coreHandler.core.deviceId)
	}
	private async _updateDevices(): Promise<void> {
		if (this._disposed) return Promise.resolve()
		if (!this.mos) {
			await this._initMosConnection()
		}

		const peripheralDevice = this.getThisPeripheralDevice()

		if (peripheralDevice) {
			const devices: MosSubDeviceSettings = (peripheralDevice.ingestDevices || {}) as any

			const devicesToAdd: { [id: string]: { options: MosDeviceConfig } } = {}
			const devicesToRemove: { [id: string]: true } = {}

			for (const [deviceId, device] of Object.entries<{ options: MosDeviceConfig }>(devices)) {
				if (device) {
					if (device.options.secondary) {
						// If the host isn't set, don't use secondary:
						if (!device.options.secondary.host || !device.options.secondary.id)
							delete device.options.secondary
					}

					const oldDevice = this._allMosDevices.get(deviceId)

					if (!oldDevice) {
						this._logger.info('Initializing new device: ' + deviceId)
						devicesToAdd[deviceId] = device
					} else {
						if (!_.isEqual(oldDevice.deviceOptions, device.options)) {
							this._logger.info('Re-initializing device: ' + deviceId)
							devicesToRemove[deviceId] = true
							devicesToAdd[deviceId] = device
						}
					}
				}
			}

			for (const [deviceId, oldDevice] of this._allMosDevices.entries()) {
				if (oldDevice && !devices[deviceId]) {
					this._logger.info('Un-initializing device: ' + deviceId)
					devicesToRemove[deviceId] = true
				}
			}

			await Promise.all(
				Object.keys(devicesToRemove).map(async (deviceId) => {
					return this._removeDevice(deviceId)
				})
			)

			await Promise.all(
				Object.entries<{ options: MosDeviceConfig }>(devicesToAdd).map(async ([deviceId, device]) => {
					return this._addDevice(deviceId, device.options)
				})
			)
		}
	}
	private async _addDevice(deviceId: string, deviceOptions0: MosDeviceConfig): Promise<MosDevice> {
		if (this._allMosDevices.has(deviceId)) {
			// the device is already there
			throw new Error('Unable to add device "' + deviceId + '", because it already exists!')
		}

		if (!this.mos) throw Error('mos is undefined, call _initMosConnection first!')

		const deviceOptions: MosDeviceConfig = JSON.parse(JSON.stringify(deviceOptions0)) // deep clone
		deviceOptions.primary.timeout ||= DEFAULT_MOS_TIMEOUT_TIME
		deviceOptions.primary.heartbeatInterval ||= DEFAULT_MOS_HEARTBEAT_INTERVAL

		const mosDevice: MosDevice = await this.mos.connect(deviceOptions)
		this._allMosDevices.set(deviceId, {
			deviceId: deviceId,
			mosDevice: mosDevice,
			deviceOptions,
		})

		await this.setupMosDevice(mosDevice)

		try {
			const getMachineInfoUntilConnected = async (): Promise<IMOSListMachInfo> =>
				mosDevice.requestMachineInfo().catch(async (e: any) => {
					if (
						e &&
						((e + '').match(/no connection available for failover/i) ||
							(e + '').match(/failover connection/i))
					) {
						// TODO: workaround (mos.connect resolves too soon, before the connection is actually initialted)
						return new Promise((resolve) => {
							setTimeout(() => {
								resolve(getMachineInfoUntilConnected())
							}, 2000)
						})
					} else {
						throw e
					}
				})

			const machInfo = await getMachineInfoUntilConnected()
			this._logger.info('Connected to Mos-device', machInfo)
			const machineId: string | undefined = machInfo.ID && this.mosTypes.mosString128.stringify(machInfo.ID)
			if (
				!(
					machineId === deviceOptions.primary.id ||
					(deviceOptions.secondary && machineId === deviceOptions.secondary.id)
				)
			) {
				throw new Error(
					'Mos-device has ID "' +
						machineId +
						'" but specified ncs-id is "' +
						(deviceOptions.primary.id || (deviceOptions.secondary || { id: '' }).id) +
						'"'
				)
			}
			return mosDevice
		} catch (e) {
			// something went wrong during init:
			if (!this.mos) throw Error('mos is undefined!')

			this.mos.disposeMosDevice(mosDevice).catch((e2) => {
				this._logger.error(stringifyError(e2))
			})
			throw e
		}
	}
	private async _removeDevice(deviceId: string): Promise<void> {
		const deviceEntry = this._allMosDevices.get(deviceId)
		this._allMosDevices.delete(deviceId)

		if (deviceEntry) {
			const mosDevice = deviceEntry.mosDevice

			// Cleanup the coreMosHandler from the device
			if (this._coreHandler) await this._coreHandler.unRegisterMosDevice(mosDevice)

			// Stop the status handler, if enabled
			if (deviceEntry.statusHandler) {
				deviceEntry.statusHandler.dispose()
				delete deviceEntry.statusHandler
			}

			if (!this.mos) {
				throw Error('mos is undefined!')
			}

			// TODO - why are we finding `mosDevice0`, and not using `mosDevice`?
			const mosDevice0 =
				this.mos.getDevice(mosDevice.idPrimary) ||
				(mosDevice.idSecondary && this.mos.getDevice(mosDevice.idSecondary))

			if (mosDevice0) {
				// TODO - does this need running for both primary and secondary?
				await this.mos.disposeMosDevice(mosDevice)
			}
		} else {
			// no device found
		}
		return Promise.resolve()
	}
	private async _getROAck(roId: IMOSString128, p: Promise<any>): Promise<IMOSROAck> {
		return p
			.then(() => {
				const roAck: IMOSROAck = {
					ID: roId,
					Status: this.mosTypes.mosString128.create('OK'),
					Stories: [], // Array<IMOSROAckStory> // todo: implement this later (?) (unknown if we really need to)
				}
				return roAck
			})
			.catch((err) => {
				this._logger.error(`ROAck error: ${stringifyError(err)}`)
				const roAck: IMOSROAck = {
					ID: roId,
					Status: this.mosTypes.mosString128.create('Error: ' + err.toString()),
					Stories: [], // Array<IMOSROAckStory> // todo: implement this later (?) (unknown if we really need to)
				}
				return roAck
			})
	}
}
