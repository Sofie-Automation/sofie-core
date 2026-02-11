import {
	CoreConnection,
	CoreOptions,
	DDPConnectorOptions,
	PeripheralDeviceAPI,
	PeripheralDeviceCommand,
	PeripheralDeviceId,
	protectString,
	StatusCode,
	Observer,
	stringifyError,
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
	ICoreHandler,
} from '@sofie-automation/server-core-integration'
import { MediaObject, DeviceOptionsAny, ActionExecutionResult } from 'timeline-state-resolver'
import _ from 'underscore'
import { DeviceConfig } from './connector.js'
import { TSRHandler } from './tsrHandler.js'
import { Logger } from 'winston'

import { MemUsageReport as ThreadMemUsageReport } from 'threadedclass'
import { compilePlayoutGatewayConfigManifest } from './configManifest.js'
import { BaseRemoteDeviceIntegration } from 'timeline-state-resolver/dist/service/remoteDeviceInstance'
import { getVersions } from './versions.js'
import { CoreConnectionChild } from '@sofie-automation/server-core-integration/dist/lib/CoreConnectionChild'
import { PlayoutGatewayConfig } from '@sofie-automation/shared-lib/dist/generated/PlayoutGatewayConfigTypes'
import { PeripheralDeviceCommandId } from '@sofie-automation/shared-lib/dist/core/model/Ids'

export interface CoreConfig {
	host: string
	port: number
	watchdog: boolean
}

export interface MemoryUsageReport {
	main: number
	threads: { [childId: string]: ThreadMemUsageReport }
}

/**
 * Represents a connection between the Gateway and Core
 */
export class CoreHandler implements ICoreHandler {
	core!: CoreConnection
	logger: Logger
	public _observers: Array<Observer<any>> = []
	public deviceSettings: PlayoutGatewayConfig = {}

	public multithreading = false
	public reportAllCommands = false

	private _deviceOptions: DeviceConfig
	private _onConnected?: () => any
	private _executedFunctions = new Set<PeripheralDeviceCommandId>()
	private _tsrHandler?: TSRHandler
	private _coreConfig?: CoreConfig
	private _certificates?: Buffer[]

	private _statusInitialized = false
	private _statusDestroyed = false

	public connectedToCore = false

	constructor(logger: Logger, deviceOptions: DeviceConfig) {
		this.logger = logger
		this._deviceOptions = deviceOptions
	}

	async init(config: CoreConfig, certificates: Buffer[]): Promise<void> {
		this._statusInitialized = false
		this._coreConfig = config
		this._certificates = certificates

		this.core = new CoreConnection(this.getCoreConnectionOptions())

		this.core.onConnected(() => {
			this.logger.info('Core Connected!')
			this.connectedToCore = true

			if (this._onConnected) this._onConnected()
		})
		this.core.onDisconnected(() => {
			this.logger.warn('Core Disconnected!')
			this.connectedToCore = false
		})
		this.core.onError((err: any) => {
			this.logger.error('Core Error: ' + (typeof err === 'string' ? err : err.message || err.toString() || err))
		})

		const ddpConfig: DDPConnectorOptions = {
			host: config.host,
			port: config.port,
		}
		if (this._certificates.length) {
			ddpConfig.tlsOpts = {
				ca: this._certificates,
			}
		}

		await this.core.init(ddpConfig)

		this.logger.info('Core id: ' + this.core.deviceId)
		await this.setupObserversAndSubscriptions()
		if (this._onConnected) this._onConnected()

		this._statusInitialized = true
		await this.updateCoreStatus()
	}
	setTSR(tsr: TSRHandler): void {
		this._tsrHandler = tsr
	}
	private async setupObserversAndSubscriptions(): Promise<void> {
		this.logger.info('Core: Setting up subscriptions..')
		this.logger.info('DeviceId: ' + this.core.deviceId)
		await Promise.all([
			this.core.autoSubscribe(PeripheralDevicePubSub.peripheralDeviceForDevice, this.core.deviceId),
			this.core.autoSubscribe(PeripheralDevicePubSub.mappingsForDevice, this.core.deviceId),
			this.core.autoSubscribe(PeripheralDevicePubSub.timelineForDevice, this.core.deviceId),
			this.core.autoSubscribe(PeripheralDevicePubSub.timelineDatastoreForDevice, this.core.deviceId),
			this.core.autoSubscribe(PeripheralDevicePubSub.peripheralDeviceCommands, this.core.deviceId),
			this.core.autoSubscribe(PeripheralDevicePubSub.rundownsForDevice, this.core.deviceId),
			this.core.autoSubscribe(PeripheralDevicePubSub.expectedPlayoutItemsForDevice, this.core.deviceId),
		])

		this.logger.info('Core: Subscriptions are set up!')
		if (this._observers.length) {
			this.logger.info('CorePlayout: Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		// setup observers
		const observer = this.core.observe(PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice)
		observer.added = (id) => this.onDeviceChanged(id)
		observer.changed = (id) => this.onDeviceChanged(id)
		this.setupObserverForPeripheralDeviceCommands(this)

		// trigger this callback because the observer doesn't the first time..
		this.onDeviceChanged(this.core.deviceId)
	}
	async destroy(): Promise<void> {
		this._statusDestroyed = true
		await this.updateCoreStatus()
		await this.core.destroy()
	}
	private getCoreConnectionOptions(): CoreOptions {
		if (!this._deviceOptions.deviceId) {
			// this.logger.warn('DeviceId not set, using a temporary random id!')
			throw new Error('DeviceId is not set!')
		}

		const options: CoreOptions = {
			deviceId: protectString(this._deviceOptions.deviceId + 'PlayoutCoreParent'),
			deviceToken: this._deviceOptions.deviceToken,

			deviceCategory: PeripheralDeviceAPI.PeripheralDeviceCategory.PLAYOUT,
			deviceType: PeripheralDeviceAPI.PeripheralDeviceType.PLAYOUT,

			deviceName: 'Playout gateway',
			watchDog: this._coreConfig ? this._coreConfig.watchdog : true,

			configManifest: compilePlayoutGatewayConfigManifest(),

			versions: getVersions(this.logger),

			documentationUrl: 'https://github.com/Sofie-Automation/sofie-core',
		}

		if (!options.deviceToken) {
			this.logger.warn('Token not set, only id! This might be unsecure!')
			options.deviceToken = 'unsecureToken'
		}

		return options
	}
	onConnected(fcn: () => any): void {
		this._onConnected = fcn
	}
	onDeviceChanged(id: PeripheralDeviceId): void {
		if (id === this.core.deviceId) {
			const col = this.core.getCollection(PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice)
			if (!col) throw new Error('collection "peripheralDevices" not found!')

			const device = col.findOne(id)
			this.deviceSettings = device?.deviceSettings ?? {}

			const logLevel = this.deviceSettings.debugLogging ? 'debug' : 'info'
			if (logLevel !== this.logger.level) {
				this.logger.level = logLevel

				for (const transport of this.logger.transports) {
					transport.level = logLevel
				}

				this.logger.info('Loglevel: ' + this.logger.level)
			}

			if (this.deviceSettings.multiThreading !== this.multithreading) {
				this.multithreading = this.deviceSettings.multiThreading || false
			}
			if (this.deviceSettings.reportAllCommands !== this.reportAllCommands) {
				this.reportAllCommands = this.deviceSettings.reportAllCommands || false
			}

			const studioId = device?.studioId
			if (!studioId) throw new Error('PeripheralDevice has no studio!')

			if (this._tsrHandler) {
				this._tsrHandler.onSettingsChanged()
			}
		}
	}
	get logDebug(): boolean {
		return !!this.deviceSettings['debugLogging']
	}
	get logState(): boolean {
		return !!this.deviceSettings['debugState']
	}
	get estimateResolveTimeMultiplier(): number {
		if (!isNaN(Number(this.deviceSettings.estimateResolveTimeMultiplier))) {
			return this.deviceSettings.estimateResolveTimeMultiplier || 1
		} else return 1
	}

	executeFunction(cmd: PeripheralDeviceCommand, fcnObject: CoreHandler | CoreTSRDeviceHandler): void {
		if (cmd) {
			if (this._executedFunctions.has(cmd._id)) return // prevent it from running multiple times

			const cb = (errStr: string | null, res?: any) => {
				if (errStr) {
					this.logger.error(`executeFunction error: ${errStr}`)
				}
				fcnObject.core.coreMethods.functionReply(cmd._id, errStr, res).catch((error: any) => {
					this.logger.error(stringifyError(error))
				})
			}

			if (cmd.functionName) {
				// Ignore specific commands, to reduce noise:
				if (cmd.functionName !== 'getDebugStates') {
					this.logger.debug(`Executing function "${cmd.functionName}", args: ${JSON.stringify(cmd.args)}`)
				}
				this._executedFunctions.add(cmd._id)
				// @ts-expect-error Untyped bunch of functions
				// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
				const fcn: Function = fcnObject[cmd.functionName]
				try {
					if (!fcn) throw Error(`Function "${cmd.functionName}" not found on device "${cmd.deviceId}"!`)

					Promise.resolve(fcn.apply(fcnObject, cmd.args))
						.then((result) => {
							cb(null, result)
						})
						.catch((e) => {
							cb(stringifyError(e), null)
						})
				} catch (e: any) {
					cb(stringifyError(e), null)
				}
			} else if (cmd.actionId && 'executeAction' in fcnObject) {
				this.logger.debug(`Executing action "${cmd.actionId}", payload: ${JSON.stringify(cmd.payload)}`)
				this._executedFunctions.add(cmd._id)

				fcnObject
					.executeAction(cmd.actionId, cmd.payload)
					.then((result) => cb(null, result))
					.catch((e) => cb(stringifyError(e), null))
			} else if (cmd.actionId) {
				this.logger.warning(`Could not execute action "${cmd.actionId}", because there is no handler`)
				cb(`Could not execute action "${cmd.actionId}", because there is no handler`)
			} else {
				this.logger.debug('Received incomplete peripheralDeviceCommand')
				cb('Received incomplete peripheralDeviceCommand')
			}
		}
	}
	retireExecuteFunction(cmdId: PeripheralDeviceCommandId): void {
		this._executedFunctions.delete(cmdId)
	}
	setupObserverForPeripheralDeviceCommands(functionObject: CoreTSRDeviceHandler | CoreHandler): void {
		const observer = functionObject.core.observe(PeripheralDevicePubSubCollectionsNames.peripheralDeviceCommands)
		functionObject._observers.push(observer)
		const addedChangedCommand = (id: PeripheralDeviceCommandId) => {
			const cmds = functionObject.core.getCollection(
				PeripheralDevicePubSubCollectionsNames.peripheralDeviceCommands
			)
			if (!cmds) throw Error('"peripheralDeviceCommands" collection not found!')
			const cmd = cmds.findOne(id)
			if (!cmd) throw Error('PeripheralCommand "' + id + '" not found!')
			// console.log('addedChangedCommand', id)
			if (cmd.deviceId === functionObject.core.deviceId) {
				this.executeFunction(cmd, functionObject)
			} else {
				// console.log('not mine', cmd.deviceId, this.core.deviceId)
			}
		}
		observer.added = (id) => {
			addedChangedCommand(id)
		}
		observer.changed = (id) => {
			addedChangedCommand(id)
		}
		observer.removed = (id) => {
			this.retireExecuteFunction(id)
		}
		const cmds = functionObject.core.getCollection(PeripheralDevicePubSubCollectionsNames.peripheralDeviceCommands)
		if (!cmds) throw Error('"peripheralDeviceCommands" collection not found!')
		cmds.find({}).forEach((cmd) => {
			if (cmd.deviceId === functionObject.core.deviceId) {
				this.executeFunction(cmd, functionObject)
			}
		})
	}
	killProcess(): void {
		this.logger.info('KillProcess command received, shutting down in 1000ms!')
		setTimeout(() => {
			// eslint-disable-next-line n/no-process-exit
			process.exit(0)
		}, 1000)
	}
	pingResponse(message: string): void {
		this.core.setPingResponse(message)
	}
	getSnapshot(): any {
		this.logger.info('getSnapshot')
		const timeline = this._tsrHandler ? this._tsrHandler.getTimeline() : []
		const mappings = this._tsrHandler ? this._tsrHandler.getMappings() : []
		return {
			timeline: timeline,
			mappings: mappings,
		}
	}
	getDevicesInfo(): any {
		this.logger.info('getDevicesInfo')

		const devices: any[] = []
		if (this._tsrHandler) {
			for (const device of this._tsrHandler.tsr.connectionManager.getConnections()) {
				devices.push({
					instanceId: device.instanceId,
					deviceId: device.deviceId,
					deviceName: device.deviceName,
					startTime: device.startTime,
					upTime: Date.now() - device.startTime,
				})
			}
		}
		return devices
	}
	async getMemoryUsage(): Promise<MemoryUsageReport> {
		if (this._tsrHandler) {
			/** Convert all properties from bytes to MB */
			const toMB = (o: any) => {
				if (typeof o === 'object') {
					const o2: any = {}
					for (const key of Object.keys(o)) {
						o2[key] = toMB(o[key])
					}
					return o2
				} else if (typeof o === 'number') {
					return o / 1024 / 1024
				}
				return o
			}

			const values: MemoryUsageReport = {
				main: toMB(process.memoryUsage()),
				threads: toMB(await this._tsrHandler.tsr.getThreadsMemoryUsage()),
			}

			return toMB(values)
		} else {
			throw new Error('TSR not set up!')
		}
	}
	async getDebugStates(): Promise<any> {
		if (!this._tsrHandler) throw new Error('TSRHandler is not initialized')

		return Object.fromEntries(this._tsrHandler.getDebugStates().entries())
	}
	getCoreStatus(): {
		statusCode: StatusCode
		messages: string[]
	} {
		let statusCode = StatusCode.GOOD
		const messages: string[] = []

		if (!this._statusInitialized) {
			statusCode = StatusCode.BAD
			messages.push('Starting up...')
		}
		if (this._statusDestroyed) {
			statusCode = StatusCode.BAD
			messages.push('Shut down')
		}
		return {
			statusCode,
			messages,
		}
	}
	async updateCoreStatus(): Promise<any> {
		return this.core.setStatus(this.getCoreStatus())
	}
}

export class CoreTSRDeviceHandler {
	core!: CoreConnectionChild
	public _observers: Array<Observer<any>> = []
	public _devicePr: Promise<BaseRemoteDeviceIntegration<DeviceOptionsAny>>
	public _deviceId: string
	public _device!: BaseRemoteDeviceIntegration<DeviceOptionsAny>
	private _coreParentHandler: CoreHandler
	private _hasGottenStatusChange = false
	private _deviceStatus: PeripheralDeviceAPI.PeripheralDeviceStatusObject = {
		statusCode: StatusCode.BAD,
		messages: ['Starting up...'],
	}
	private disposed = false

	constructor(parent: CoreHandler, device: Promise<BaseRemoteDeviceIntegration<DeviceOptionsAny>>, deviceId: string) {
		this._coreParentHandler = parent
		this._devicePr = device
		this._deviceId = deviceId
	}
	async init(): Promise<void> {
		this._device = await this._devicePr
		if (this.disposed) throw new Error('CoreTSRDeviceHandler cant init, is disposed')
		const deviceId = this._device.deviceId
		const deviceName = `${deviceId} (${this._device.deviceName})`

		this.core = await this._coreParentHandler.core.createChild({
			deviceId: protectString(this._coreParentHandler.core.deviceId + 'Playout' + deviceId),

			deviceName,

			deviceSubType: this._device.deviceOptions.type,
		})
		if (this.disposed) throw new Error('CoreTSRDeviceHandler cant init, is disposed')
		this.core.on('error', (err: any) => {
			this._coreParentHandler.logger.error(
				'Core Error: ' + ((_.isObject(err) && err.message) || err.toString() || err)
			)
		})

		console.log('has got status? ' + this._hasGottenStatusChange)
		if (!this._hasGottenStatusChange) {
			this._deviceStatus = await this._device.device.getStatus()
		}
		this.sendStatus()
		if (this.disposed) throw new Error('CoreTSRDeviceHandler cant init, is disposed')
		await this.setupSubscriptionsAndObservers()
		if (this.disposed) throw new Error('CoreTSRDeviceHandler cant init, is disposed')

		this._coreParentHandler.logger.debug('setupSubscriptionsAndObservers done')
	}
	private async setupSubscriptionsAndObservers(): Promise<void> {
		// console.log('setupObservers', this.core.deviceId)
		if (this._observers.length) {
			this._coreParentHandler.logger.info('CoreTSRDevice: Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		const deviceId = this._device.deviceId

		this._coreParentHandler.logger.info(
			'CoreTSRDevice: Setting up subscriptions for ' + this.core.deviceId + ' for device ' + deviceId + ' ..'
		)
		try {
			await this.core.autoSubscribe(PeripheralDevicePubSub.peripheralDeviceCommands, this.core.deviceId)
		} catch (e) {
			this._coreParentHandler.logger.error(e)
		}

		this._coreParentHandler.logger.info('CoreTSRDevice: Setting up observers..')

		// setup observers
		this._coreParentHandler.setupObserverForPeripheralDeviceCommands(this)
	}
	statusChanged(deviceStatus: Partial<PeripheralDeviceAPI.PeripheralDeviceStatusObject>, fromDevice = true): void {
		console.log('device ' + this._deviceId + ' status set to ' + deviceStatus.statusCode)
		if (fromDevice) this._hasGottenStatusChange = true

		this._deviceStatus = {
			...this._deviceStatus,
			...deviceStatus,
		}
		this.sendStatus()
	}
	/** Send the device status to Core */
	sendStatus(): void {
		if (!this.core) return // not initialized yet

		this.core
			.setStatus(this._deviceStatus)
			.catch((e: any) => this._coreParentHandler.logger.error(`Error when setting status: ${stringifyError(e)}`))
	}
	onCommandError(
		_errorMessage: string,
		_ref: {
			rundownId?: string
			partId?: string
			pieceId?: string
			context: string
			timelineObjId: string
		}
	): void {
		// This is not implemented in Core
		// this.core
		// 		.callMethodLowPrio(PeripheralDeviceAPIMethods.reportCommandError, [errorMessage, ref])
		// 		.catch((e: any) =>
		// 			this._coreParentHandler.logger.error(`Error when callMethodLowPrio: ${stringifyError(e)}`)
		// 		)
		// }
	}
	onUpdateMediaObject(collectionId: string, docId: string, doc: MediaObject | null): void {
		this.core.coreMethodsLowPriority
			.updateMediaObject(collectionId, docId, doc as any)
			.catch((e: any) =>
				this._coreParentHandler.logger.error(`Error when updating Media Object: ${stringifyError(e)}`)
			)
	}
	onClearMediaObjectCollection(collectionId: string): void {
		this.core.coreMethodsLowPriority
			.clearMediaObjectCollection(collectionId)
			.catch((e: any) =>
				this._coreParentHandler.logger.error(
					`Error when clearing Media Objects collection: ${stringifyError(e)}`
				)
			)
	}

	async dispose(subdevice: 'keepSubDevice' | 'removeSubDevice' = 'keepSubDevice'): Promise<void> {
		this._observers.forEach((obs) => obs.stop())

		if (!this.core) return

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
	async executeAction(actionId: string, payload?: Record<string, any>): Promise<ActionExecutionResult> {
		this._coreParentHandler.logger.info(`Exec ${actionId} on ${this._deviceId}`)
		const device = this._device.device

		return device.executeAction(actionId, payload || {})
	}
}
