import {
	Conductor,
	DeviceType,
	ConductorOptions,
	TimelineTriggerTimeResult,
	DeviceOptionsAny,
	TSRTimelineObj,
	TSRTimeline,
	TSRTimelineContent,
	DeviceOptionsAtem,
	AtemMediaPoolAsset,
	ExpectedPlayoutItem,
	ExpectedPlayoutItemContent,
	StatusCode,
	Datastore,
} from 'timeline-state-resolver'
import { CoreHandler, CoreTSRDeviceHandler } from './coreHandler.js'
import * as crypto from 'crypto'
import * as cp from 'child_process'

import _ from 'underscore'
import {
	Observer,
	PeripheralDevicePubSubCollectionsNames,
	stringifyError,
} from '@sofie-automation/server-core-integration'
import { Logger } from 'winston'
import { disableAtemUpload } from './config.js'
import Debug from 'debug'
import { FinishedTrace, sendTrace } from './influxdb.js'

import { RundownId, RundownPlaylistId, StudioId, TimelineHash } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import {
	deserializeTimelineBlob,
	RoutedMappings,
	RoutedTimeline,
	TimelineObjGeneric,
} from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import { PLAYOUT_DEVICE_CONFIG } from './configManifest.js'
import { PlayoutGatewayConfig } from '@sofie-automation/shared-lib/dist/generated/PlayoutGatewayConfigTypes'
import {
	assertNever,
	getSchemaDefaultValues,
	JSONBlobParse,
	PeripheralDeviceAPI,
	PeripheralDeviceForDevice,
	protectString,
	SubdeviceManifest,
	unprotectObject,
	unprotectString,
} from '@sofie-automation/server-core-integration'
import { BaseRemoteDeviceIntegration } from 'timeline-state-resolver/dist/service/remoteDeviceInstance'

const debug = Debug('playout-gateway')

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TSRConfig {}

// ----------------------------------------------------------------------------

export interface TimelineContentObjectTmp<TContent extends { deviceType: DeviceType }>
	extends TSRTimelineObj<TContent> {
	inGroup?: string
}

/**
 * Represents a connection between Gateway and TSR
 */
export class TSRHandler {
	logger: Logger
	tsr!: Conductor
	// private _config: TSRConfig
	private _coreHandler!: CoreHandler
	private _triggerupdateExpectedPlayoutItemsTimeout: NodeJS.Timeout | null = null
	private _coreTsrHandlers: { [deviceId: string]: CoreTSRDeviceHandler } = {}
	private _observers: Array<Observer<any>> = []
	private _cachedStudioId: StudioId | null = null

	private _initialized = false
	private _multiThreaded: boolean | null = null
	private _reportAllCommands: boolean | null = null

	private _updateDevicesIsRunning = false
	private _lastReportedObjHashes: string[] = []
	private _triggerUpdateDevicesCheckAgain = false
	private _triggerUpdateDevicesTimeout: NodeJS.Timeout | undefined

	private defaultDeviceOptions: { [deviceType: string]: Record<string, any> } = {}
	private _debugStates: Map<string, object> = new Map()

	constructor(logger: Logger) {
		this.logger = logger
	}

	public async init(_config: TSRConfig, coreHandler: CoreHandler): Promise<void> {
		// this._config = config
		this._coreHandler = coreHandler

		this._coreHandler.setTSR(this)

		this.logger.info('TSRHandler init')

		const peripheralDevice = await coreHandler.core.getPeripheralDevice()
		const settings: PlayoutGatewayConfig = peripheralDevice.deviceSettings as PlayoutGatewayConfig
		const devices = peripheralDevice.playoutDevices

		this.logger.info('Devices', devices)
		const c: ConductorOptions = {
			getCurrentTime: (): number => {
				return this._coreHandler.core.getCurrentTime()
			},
			multiThreadedResolver: settings.multiThreadedResolver === true,
			useCacheWhenResolving: settings.useCacheWhenResolving === true,
			proActiveResolve: true,
		}

		this.defaultDeviceOptions = this.loadSubdeviceConfigurations()

		this.tsr = new Conductor(c)
		this._triggerupdateTimelineAndMappings('TSRHandler.init()')

		coreHandler.onConnected(() => {
			this.setupObservers()
			this.resendStatuses()
		})
		this.setupObservers()

		this.tsr.on('error', (e, ...args) => {
			// CasparCG play and load 404 errors should be warnings:
			const msg: string = e + ''
			const cmdReply = args[0]

			if (
				msg.match(/casparcg/i) &&
				(msg.match(/PlayCommand/i) || msg.match(/LoadbgCommand/i)) &&
				cmdReply &&
				_.isObject(cmdReply) &&
				cmdReply.response &&
				cmdReply.response.code === 404
			) {
				this.logger.warn(`TSR: ${stringifyError(e)}`, args)
			} else {
				this.logger.error(`TSR: ${stringifyError(e)}`, args)
			}
		})
		this.tsr.on('info', (msg, ...args) => {
			this.logger.info(`TSR: ${msg + ''}`, args)
		})
		this.tsr.on('warning', (msg, ...args) => {
			this.logger.warn(`TSR: ${msg + ''}`, args)
		})
		this.tsr.on('debug', (...args: any[]) => {
			if (!this._coreHandler.logDebug) {
				return
			}
			const data = args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
			this.logger.debug(`TSR debug message (${args.length})`, { data })
		})

		this.tsr.on('setTimelineTriggerTime', (r: TimelineTriggerTimeResult) => {
			this._coreHandler.core.coreMethods
				.timelineTriggerTime(r)
				.catch((error) => this.logger.error('Error in setTimelineTriggerTime', error))
		})

		this.tsr.on('timelineCallback', (time, objId, callbackName, data) => {
			this.handleTSRTimelineCallback(time, objId, callbackName, data)
		})
		this.tsr.on('resolveDone', (timelineHash: string, resolveDuration: number) => {
			// Make sure we only report back once, per update timeline
			if (this._lastReportedObjHashes.includes(timelineHash)) return

			this._lastReportedObjHashes.unshift(timelineHash)
			if (this._lastReportedObjHashes.length > 10) {
				this._lastReportedObjHashes.length = 10
			}

			this._coreHandler.core.coreMethods
				.reportResolveDone(protectString<TimelineHash>(timelineHash), resolveDuration)
				.catch((e) => {
					this.logger.error('Error in reportResolveDone', e)
				})

			sendTrace({
				measurement: 'playout-gateway.tlResolveDone',
				tags: {},
				start: Date.now() - resolveDuration,
				duration: resolveDuration,
				ended: Date.now(),
			})
		})
		this.tsr.on('timeTrace', (trace: FinishedTrace) => sendTrace(trace))

		this.attachTSRConnectionEvents()

		this.logger.debug('tsr init')
		await this.tsr.init()

		this._initialized = true
		this._triggerupdateTimelineAndMappings('TSRHandler.init(), later')
		this.onSettingsChanged()
		this._triggerUpdateDevices()
		this._triggerUpdateDatastore()
		this.logger.debug('tsr init done')
	}

	private attachTSRConnectionEvents() {
		this.tsr.connectionManager.on('info', (info) => this.logger.info('TSR ConnectionManager: ' + info))
		this.tsr.connectionManager.on('warning', (warning) => this.logger.warn('TSR ConnectionManager: ' + warning))
		this.tsr.connectionManager.on('debug', (...args) => {
			if (!this._coreHandler.logDebug) {
				return
			}
			const data = args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
			this.logger.debug(`TSR ConnectionManager debug (${args.length})`, { data })
		})

		this.tsr.connectionManager.on('connectionAdded', (id, container) => {
			const coreTsrHandler = new CoreTSRDeviceHandler(this._coreHandler, Promise.resolve(container), id)
			this._coreTsrHandlers[id] = coreTsrHandler

			// set the status to uninitialized for now:
			coreTsrHandler.statusChanged(
				{
					statusCode: StatusCode.BAD,
					messages: ['Device initialising...'],
				},
				false
			)

			this._triggerupdateExpectedPlayoutItems() // So that any recently created devices will get all the ExpectedPlayoutItems
		})

		this.tsr.connectionManager.on('connectionInitialised', (id) => {
			const coreTsrHandler = this._coreTsrHandlers[id]

			if (!coreTsrHandler) {
				this.logger.error('TSR Connection initialised when there was not CoreTSRHandler for it')
				return
			}

			coreTsrHandler.init().catch((e) => this.logger.error('CoreTSRHandler failed to initialise', e)) // todo - is this the right way to log this?
		})

		this.tsr.connectionManager.on('connectionRemoved', (id) => {
			const coreTsrHandler = this._coreTsrHandlers[id]

			if (!coreTsrHandler) {
				this.logger.error('TSR Connection was removed when but there was not CoreTSRHandler to handle that')
				return
			}

			coreTsrHandler.dispose('removeSubDevice').catch((e) => {
				this.logger.error('Failed to dispose of coreTsrHandler for ' + id + ': ' + e)
			})
			delete this._coreTsrHandlers[id]
		})

		const fixLog = (id: string, e: string): string => {
			const device = this._coreTsrHandlers[id]?._device

			return `Device "${device?.deviceName ?? id}" (${device?.instanceId ?? 'instance unknown'}): ` + e
		}
		const fixError = (id: string, e: Error): any => {
			const device = this._coreTsrHandlers[id]?._device
			const name = `Device "${device?.deviceName ?? id}" (${device?.instanceId ?? 'instance unknown'})`

			return {
				message: e.message && name + ': ' + e.message,
				name: e.name && name + ': ' + e.name,
				stack: e.stack && e.stack + '\nAt device' + name,
			}
		}
		const fixContext = (...context: any[]): any => {
			return {
				context,
			}
		}

		this.tsr.connectionManager.on('connectionEvent:connectionChanged', (id, status) => {
			const coreTsrHandler = this._coreTsrHandlers[id]
			if (!coreTsrHandler) return

			coreTsrHandler.statusChanged(status)

			if (!coreTsrHandler._device) return
			// When the status has changed, the deviceName might have changed:
			coreTsrHandler._device.reloadProps().catch((err) => {
				this.logger.error(`Error in reloadProps: ${stringifyError(err)}`)
			})
			// hack to make sure atem has media after restart
			if (
				(status.statusCode === StatusCode.GOOD ||
					status.statusCode === StatusCode.WARNING_MINOR ||
					status.statusCode === StatusCode.WARNING_MAJOR) &&
				coreTsrHandler._device.deviceType === DeviceType.ATEM &&
				!disableAtemUpload
			) {
				const assets = (coreTsrHandler._device.deviceOptions as DeviceOptionsAtem).options?.mediaPoolAssets
				if (assets && assets.length > 0) {
					try {
						this.uploadFilesToAtem(
							coreTsrHandler._device,
							assets.filter((asset) => _.isNumber(asset.position) && asset.path)
						)
					} catch (_e) {
						// don't worry about it.
					}
				}
			}
		})
		this.tsr.connectionManager.on('connectionEvent:slowSentCommand', (id, info) => {
			// If the internalDelay is too large, it should be logged as an error,
			// since something took too long internally.

			if (info.internalDelay > 100) {
				this.logger.error('slowSentCommand', {
					id,
					...info,
				})
			} else {
				this.logger.warn('slowSentCommand', {
					id,
					...info,
				})
			}
		})
		this.tsr.connectionManager.on('connectionEvent:slowFulfilledCommand', (id, info) => {
			// Note: we don't emit slow fulfilled commands as error, since
			// the fulfillment of them lies on the device being controlled, not on us.

			this.logger.warn('slowFulfilledCommand', {
				id,
				...info,
			})
		})
		this.tsr.connectionManager.on('connectionEvent:commandError', (id, error, context) => {
			// todo: handle this better
			this.logger.error(fixError(id, error), { context })
		})
		this.tsr.connectionManager.on('connectionEvent:commandReport', (_id, commandReport) => {
			if (this._reportAllCommands) {
				// Todo: send these to Core
				this.logger.info('commandReport', {
					commandReport: commandReport,
				})
			}
		})
		this.tsr.connectionManager.on('connectionEvent:updateMediaObject', (id, collectionId, docId, doc) => {
			const coreTsrHandler = this._coreTsrHandlers[id]
			if (!coreTsrHandler) return

			coreTsrHandler.onUpdateMediaObject(collectionId, docId, doc)
		})
		this.tsr.connectionManager.on('connectionEvent:clearMediaObjects', (id, collectionId) => {
			const coreTsrHandler = this._coreTsrHandlers[id]
			if (!coreTsrHandler) return

			coreTsrHandler.onClearMediaObjectCollection(collectionId)
		})
		this.tsr.connectionManager.on('connectionEvent:info', (id, info) => {
			this.logger.info(fixLog(id, info))
		})
		this.tsr.connectionManager.on('connectionEvent:warning', (id, warning) => {
			this.logger.warn(fixLog(id, warning))
		})
		this.tsr.connectionManager.on('connectionEvent:error', (id, context, error) => {
			this.logger.error(fixError(id, error), fixContext(context))
		})
		this.tsr.connectionManager.on('connectionEvent:debug', (id, ...args) => {
			const device = this._coreTsrHandlers[id]?._device

			if (!device?.debugLogging && !this._coreHandler.logDebug) {
				return
			}
			if (args.length === 0) {
				this.logger.debug('>empty message<')
				return
			}
			const data = args.map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : arg))
			this.logger.debug(`Device "${device?.deviceName || id}" (${device?.instanceId})`, { data })
		})
		this.tsr.connectionManager.on('connectionEvent:debugState', (id, state) => {
			const device = this._coreTsrHandlers[id]?._device

			if (device?.debugState && this._coreHandler.logDebug) {
				// Fetch the Id that core knows this device by
				const coreId = this._coreTsrHandlers[device.deviceId].core.deviceId
				this._debugStates.set(unprotectString(coreId), state)
			}
		})
		this.tsr.connectionManager.on('connectionEvent:timeTrace', (_id, trace) => {
			sendTrace(trace)
		})
	}

	private loadSubdeviceConfigurations(): { [deviceType: string]: Record<string, any> } {
		const defaultDeviceOptions: { [deviceType: string]: Record<string, any> } = {}

		for (const [deviceType, deviceManifest] of Object.entries<SubdeviceManifest[0]>(
			PLAYOUT_DEVICE_CONFIG.subdeviceManifest
		)) {
			const schema = JSONBlobParse(deviceManifest.configSchema)
			defaultDeviceOptions[deviceType] = getSchemaDefaultValues(schema)
		}

		return defaultDeviceOptions
	}

	private setupObservers(): void {
		if (this._observers.length) {
			this.logger.debug('Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		this.logger.debug('Renewing observers')

		const timelineObserver = this._coreHandler.core.observe(PeripheralDevicePubSubCollectionsNames.studioTimeline)
		timelineObserver.added = () => {
			this._triggerupdateTimelineAndMappings('studioTimeline.added', true)
		}
		timelineObserver.changed = () => {
			this._triggerupdateTimelineAndMappings('studioTimeline.changed', true)
		}
		timelineObserver.removed = () => {
			this._triggerupdateTimelineAndMappings('studioTimeline.removed', true)
		}
		this._observers.push(timelineObserver)

		const mappingsObserver = this._coreHandler.core.observe(PeripheralDevicePubSubCollectionsNames.studioMappings)
		mappingsObserver.added = () => {
			this._triggerupdateTimelineAndMappings('studioMappings.added')
		}
		mappingsObserver.changed = () => {
			this._triggerupdateTimelineAndMappings('studioMappings.changed')
		}
		mappingsObserver.removed = () => {
			this._triggerupdateTimelineAndMappings('studioMappings.removed')
		}
		this._observers.push(mappingsObserver)

		const deviceObserver = this._coreHandler.core.observe(
			PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice
		)
		deviceObserver.added = () => {
			debug('triggerUpdateDevices from deviceObserver added')
			this._triggerUpdateDevices()
		}
		deviceObserver.changed = (_id, _oldFields, _clearedFields, newFields) => {
			// Only react to changes in the .settings property:
			if (newFields['playoutDevices'] !== undefined) {
				debug('triggerUpdateDevices from deviceObserver changed')
				this._triggerUpdateDevices()
			}
		}
		deviceObserver.removed = () => {
			debug('triggerUpdateDevices from deviceObserver removed')
			this._triggerUpdateDevices()
		}
		this._observers.push(deviceObserver)

		const expectedPlayoutItemsObserver = this._coreHandler.core.observe(
			PeripheralDevicePubSubCollectionsNames.expectedPlayoutItems
		)
		expectedPlayoutItemsObserver.added = () => {
			this._triggerupdateExpectedPlayoutItems()
		}
		expectedPlayoutItemsObserver.changed = () => {
			this._triggerupdateExpectedPlayoutItems()
		}
		expectedPlayoutItemsObserver.removed = () => {
			this._triggerupdateExpectedPlayoutItems()
		}
		this._observers.push(expectedPlayoutItemsObserver)

		const timelineDatastoreObserver = this._coreHandler.core.observe(
			PeripheralDevicePubSubCollectionsNames.timelineDatastore
		)
		timelineDatastoreObserver.added = () => {
			this._triggerUpdateDatastore()
		}
		timelineDatastoreObserver.changed = () => {
			this._triggerUpdateDatastore()
		}
		timelineDatastoreObserver.removed = () => {
			this._triggerUpdateDatastore()
		}
		this._observers.push(timelineDatastoreObserver)
	}
	private resendStatuses(): void {
		_.each(this._coreTsrHandlers, (tsrHandler) => {
			tsrHandler.sendStatus()
		})
	}
	async destroy(): Promise<void> {
		if (this._observers.length) {
			this.logger.debug('Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}

		return this.tsr.destroy()
	}
	getTimeline(): RoutedTimeline | undefined {
		const studioId = this._getStudioId()
		if (!studioId) {
			this.logger.warn('no studioId')
			return undefined
		}

		return this._coreHandler.core
			.getCollection(PeripheralDevicePubSubCollectionsNames.studioTimeline)
			.findOne(studioId)
	}
	getMappings(): RoutedMappings | undefined {
		const studioId = this._getStudioId()
		if (!studioId) {
			// this.logger.warn('no studioId')
			return undefined
		}
		// Note: The studioMappings virtual collection contains a single object that contains all mappings
		return this._coreHandler.core
			.getCollection(PeripheralDevicePubSubCollectionsNames.studioMappings)
			.findOne(studioId)
	}
	onSettingsChanged(): void {
		if (!this._initialized) return

		if (this.tsr.logDebug !== this._coreHandler.logDebug) {
			this.logger.info(`Log settings: ${this._coreHandler.logDebug}`)
			this.tsr.logDebug = this._coreHandler.logDebug
		}

		if (this.tsr.estimateResolveTimeMultiplier !== this._coreHandler.estimateResolveTimeMultiplier) {
			this.tsr.estimateResolveTimeMultiplier = this._coreHandler.estimateResolveTimeMultiplier
			this.logger.info('estimateResolveTimeMultiplier: ' + this._coreHandler.estimateResolveTimeMultiplier)
		}
		if (this._multiThreaded !== this._coreHandler.multithreading) {
			this._multiThreaded = this._coreHandler.multithreading

			this.logger.info('Multithreading: ' + this._multiThreaded)

			debug('triggerUpdateDevices from onSettingsChanged')
			this._triggerUpdateDevices()
		}
		if (this._reportAllCommands !== this._coreHandler.reportAllCommands) {
			this._reportAllCommands = this._coreHandler.reportAllCommands

			this.logger.info('ReportAllCommands: ' + this._reportAllCommands)

			debug('triggerUpdateDevices from onSettingsChanged')
			this._triggerUpdateDevices()
		}
	}
	private _triggerupdateTimelineAndMappings(context: string, fromTlChange?: boolean) {
		if (!this._initialized) return

		this._updateTimelineAndMappings(context, fromTlChange)
	}
	private _updateTimelineAndMappings(context: string, fromTlChange?: boolean) {
		const timeline = this.getTimeline()
		const mappingsObject = this.getMappings()

		if (!timeline) {
			this.logger.debug(`Cancel resolving: No timeline`)
			return
		}
		if (!mappingsObject) {
			this.logger.debug(`Cancel resolving: No mappings`)
			return
		}
		// Compare mappingsHash to ensure that the timeline we've received is in sync with the mappings:
		if (timeline.mappingsHash !== mappingsObject.mappingsHash) {
			this.logger.info(
				`Cancel resolving: mappingsHash differ: "${timeline.mappingsHash}" vs "${mappingsObject.mappingsHash}"`
			)
			return
		}

		this.logger.debug(
			`Trigger new resolving (${context}, hash: ${timeline.timelineHash}, gen: ${new Date(
				timeline.generated
			).toISOString()})`
		)
		if (fromTlChange) {
			sendTrace({
				measurement: 'playout-gateway:timelineReceived',
				start: timeline.generated,
				tags: {},
				ended: Date.now(),
				duration: Date.now() - timeline.generated,
			})
		}

		const transformedTimeline = this._transformTimeline(deserializeTimelineBlob(timeline.timelineBlob))
		this.tsr.timelineHash = unprotectString(timeline.timelineHash)
		this.tsr.setTimelineAndMappings(transformedTimeline, unprotectObject(mappingsObject.mappings))
	}
	private _getPeripheralDevice(): PeripheralDeviceForDevice {
		const peripheralDevices = this._coreHandler.core.getCollection(
			PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice
		)
		const doc = peripheralDevices.findOne(this._coreHandler.core.deviceId)
		if (!doc) throw new Error('Missing PeripheralDevice document!')
		return doc
	}
	private _getStudioId(): StudioId | null {
		if (this._cachedStudioId) return this._cachedStudioId

		const peripheralDevice = this._getPeripheralDevice()
		return peripheralDevice.studioId ?? null
	}
	private _triggerUpdateDevices() {
		if (!this._initialized) return

		if (this._triggerUpdateDevicesTimeout) {
			clearTimeout(this._triggerUpdateDevicesTimeout)
		}
		this._triggerUpdateDevicesTimeout = undefined

		if (this._updateDevicesIsRunning) {
			debug('triggerUpdateDevices already running, cue a check again later')
			this._triggerUpdateDevicesCheckAgain = true
			return
		}
		this._updateDevicesIsRunning = true
		debug('triggerUpdateDevices now')

		// Defer:
		setTimeout(() => {
			this._updateDevices()
				.then(() => {
					if (this._triggerUpdateDevicesCheckAgain)
						debug('triggerUpdateDevices from updateDevices promise resolved')
				})
				.catch(() => {
					if (this._triggerUpdateDevicesCheckAgain)
						debug('triggerUpdateDevices from updateDevices promise rejected')
				})
				.finally(() => {
					this._updateDevicesIsRunning = false
					if (!this._triggerUpdateDevicesCheckAgain) {
						return
					}
					if (this._triggerUpdateDevicesTimeout) {
						clearTimeout(this._triggerUpdateDevicesTimeout)
					}
					this._triggerUpdateDevicesTimeout = setTimeout(() => this._triggerUpdateDevices(), 1000)
					this._triggerUpdateDevicesCheckAgain = false
				})
		}, 10)
	}

	private async _updateDevices(): Promise<void> {
		const peripheralDevice = this._getPeripheralDevice()

		if (peripheralDevice) {
			const connections: Record<string, DeviceOptionsAny> = {}
			const devices = peripheralDevice.playoutDevices

			for (const [deviceId, device0] of Object.entries<DeviceOptionsAny>(devices)) {
				if (device0.disable) continue

				const deviceOptions = _.extend(
					{
						// Defaults:
						limitSlowSentCommand: 40,
						limitSlowFulfilledCommand: 100,
						options: {},
					},
					this.populateDefaultValuesIfMissing(device0)
				)
				if (this._multiThreaded !== null && deviceOptions.isMultiThreaded === undefined) {
					deviceOptions.isMultiThreaded = this._multiThreaded
				}
				if (this._reportAllCommands !== null && deviceOptions.reportAllCommands === undefined) {
					deviceOptions.reportAllCommands = this._reportAllCommands
				}

				connections[deviceId] = deviceOptions
			}

			this.tsr.connectionManager.setConnections(connections)
		}
	}

	private populateDefaultValuesIfMissing(deviceOptions: DeviceOptionsAny): DeviceOptionsAny {
		const options = Object.fromEntries<any>(
			Object.entries<any>({ ...deviceOptions.options }).filter(([_key, value]) => value !== '')
		)
		deviceOptions.options = { ...this.defaultDeviceOptions[deviceOptions.type], ...options }
		return deviceOptions
	}
	/**
	 * This function is a quick and dirty solution to load a still to the atem mixers.
	 * This does not serve as a proper implementation! And need to be refactor
	 * // @todo: proper atem media management
	 * /Balte - 22-08
	 */
	private uploadFilesToAtem(device: BaseRemoteDeviceIntegration<DeviceOptionsAny>, files: AtemMediaPoolAsset[]) {
		if (!device || device.deviceType !== DeviceType.ATEM) {
			return
		}
		this.logger.info('try to load ' + JSON.stringify(files.map((f) => f.path).join(', ')) + ' to atem')
		const options = device.deviceOptions.options as { host: string }
		this.logger.info('options ' + JSON.stringify(options))
		if (!options || !options.host) {
			throw Error('ATEM host option not set')
		}
		this.logger.info('uploading files to ' + options.host)
		const process = cp.spawn(`node`, [`./dist/atemUploader.js`, options.host, JSON.stringify(files)])
		process.stdout.on('data', (data) => this.logger.info(data.toString()))
		process.stderr.on('data', (data) => this.logger.info(data.toString()))
		process.on('close', () => process.removeAllListeners())
	}
	private _triggerupdateExpectedPlayoutItems() {
		if (!this._initialized) return
		if (this._triggerupdateExpectedPlayoutItemsTimeout) {
			clearTimeout(this._triggerupdateExpectedPlayoutItemsTimeout)
		}
		this._triggerupdateExpectedPlayoutItemsTimeout = setTimeout(() => {
			this._updateExpectedPlayoutItems().catch((e) => {
				this.logger.error('Error in _updateExpectedPlayoutItems', e)
			})
		}, 200)
	}
	private async _updateExpectedPlayoutItems() {
		const expectedPlayoutItems = this._coreHandler.core.getCollection(
			PeripheralDevicePubSubCollectionsNames.expectedPlayoutItems
		)
		const peripheralDevice = this._getPeripheralDevice()

		const expectedItems = expectedPlayoutItems.find({
			studioId: peripheralDevice.studioId,
		})

		const rundownIdToPlaylistId = new Map<RundownId, RundownPlaylistId>()
		const allRundowns = this._coreHandler.core.getCollection(PeripheralDevicePubSubCollectionsNames.rundowns).find({
			studioId: peripheralDevice.studioId,
		})
		for (const rundown of allRundowns) {
			rundownIdToPlaylistId.set(rundown._id, rundown.playlistId)
		}

		await Promise.all(
			_.map(this.tsr.connectionManager.getConnections(), async (container) => {
				if (!container.details.supportsExpectedPlayoutItems) {
					return
				}
				await container.device.handleExpectedPlayoutItems(
					expectedItems
						.filter(
							(item) => item.deviceSubType === container.deviceType
							// TODO: implement item.deviceId === container.deviceId
						)
						.map((item): ExpectedPlayoutItem => {
							const itemContent: ExpectedPlayoutItemContent = item.content
							return {
								...itemContent,
								rundownId: unprotectString(item.rundownId) ?? '',
								playlistId:
									(item.rundownId && unprotectString(rundownIdToPlaylistId.get(item.rundownId))) ??
									'',
								baseline: item.baseline,
							}
						})
				)
			})
		)
	}
	private _triggerUpdateDatastore() {
		if (!this._initialized) return
		this._updateDatastore().catch((e) => this.logger.error('Error in _updateDatastore', e))
	}
	private async _updateDatastore() {
		const datastoreCollection = this._coreHandler.core.getCollection(
			PeripheralDevicePubSubCollectionsNames.timelineDatastore
		)
		const peripheralDevice = this._getPeripheralDevice()

		const datastoreObjs = datastoreCollection.find({
			studioId: peripheralDevice.studioId,
		})
		const datastore: Datastore = {}
		for (const { key, value, modified } of datastoreObjs) {
			datastore[key] = { value, modified }
		}

		this.logger.debug('datastore', datastore)
		this.tsr.setDatastore(datastore)
	}
	/**
	 * Go through and transform timeline and generalize the Core-specific things
	 * @param timeline
	 */
	private _transformTimeline(timeline: Array<TimelineObjGeneric>): TSRTimeline {
		// First, transform and convert timeline to a key-value store, for fast referencing:
		const objects: { [id: string]: TimelineContentObjectTmp<TSRTimelineContent> } = {}
		for (const obj of timeline) {
			objects[obj.id] = obj
		}

		// Go through all objects:
		const transformedTimeline: Array<TSRTimelineObj<TSRTimelineContent>> = []
		for (const obj of Object.values<TimelineContentObjectTmp<TSRTimelineContent>>(objects)) {
			if (!obj.inGroup) {
				// Add object to timeline
				delete obj.inGroup
				transformedTimeline.push(obj)
				continue
			}
			const groupObj = objects[obj.inGroup]
			if (!groupObj) {
				// referenced group not found
				this.logger.error(`Referenced group "${obj.inGroup}" not found! Referenced by "${obj.id}"`)
				continue
			}
			// Add object into group:
			if (!groupObj.children) groupObj.children = []
			groupObj.children.push(obj)
			delete obj.inGroup
		}

		return transformedTimeline
	}

	private changedResults: PeripheralDeviceAPI.PlayoutChangedResults | undefined = undefined
	private sendCallbacksTimeout: NodeJS.Timeout | undefined = undefined

	private sendChangedResults = (): void => {
		this.sendCallbacksTimeout = undefined
		if (this.changedResults) {
			this._coreHandler.core.coreMethods.playoutPlaybackChanged(this.changedResults).catch((e) => {
				this.logger.error('Error in timelineCallback', e)
			})
			this.changedResults = undefined
		}
	}

	private handleTSRTimelineCallback(
		time: number,
		objId: string,
		callbackName0: string,
		data:
			| PeripheralDeviceAPI.PartPlaybackCallbackData
			| PeripheralDeviceAPI.PiecePlaybackCallbackData
			| PeripheralDeviceAPI.TriggerRegenerationCallbackData
	): void {
		if (
			![
				PeripheralDeviceAPI.PlayoutChangedType.PART_PLAYBACK_STARTED,
				PeripheralDeviceAPI.PlayoutChangedType.PART_PLAYBACK_STOPPED,
				PeripheralDeviceAPI.PlayoutChangedType.PIECE_PLAYBACK_STARTED,
				PeripheralDeviceAPI.PlayoutChangedType.PIECE_PLAYBACK_STOPPED,
				PeripheralDeviceAPI.PlayoutChangedType.TRIGGER_REGENERATION,
			].includes(callbackName0 as PeripheralDeviceAPI.PlayoutChangedType)
		) {
			// @ts-expect-error Untyped bunch of methods
			const method = PeripheralDeviceAPIMethods[callbackName]
			if (!method) {
				this.logger.error(`Unknown callback method "${callbackName0}"`)
				return
			}

			this._coreHandler.core
				.callMethodRaw(method, [
					{
						...data,
						objId: objId,
						time: time,
					},
				])
				.catch((error) => {
					this.logger.error('Error in timelineCallback', error)
				})
			return
		}
		const callbackName = callbackName0 as PeripheralDeviceAPI.PlayoutChangedType
		// debounce
		if (this.changedResults && this.changedResults.rundownPlaylistId !== data.rundownPlaylistId) {
			// The playlistId changed. Send what we have right away and reset:
			this._coreHandler.core.coreMethods.playoutPlaybackChanged(this.changedResults).catch((e) => {
				this.logger.error('Error in timelineCallback', e)
			})
			this.changedResults = undefined
		}
		if (!this.changedResults) {
			this.changedResults = {
				rundownPlaylistId: data.rundownPlaylistId,
				changes: [],
			}
		}

		switch (callbackName) {
			case PeripheralDeviceAPI.PlayoutChangedType.PART_PLAYBACK_STARTED:
			case PeripheralDeviceAPI.PlayoutChangedType.PART_PLAYBACK_STOPPED:
				this.changedResults.changes.push({
					type: callbackName,
					objId,
					data: {
						time,
						partInstanceId: (data as PeripheralDeviceAPI.PartPlaybackCallbackData).partInstanceId,
					},
				})
				break
			case PeripheralDeviceAPI.PlayoutChangedType.PIECE_PLAYBACK_STARTED:
			case PeripheralDeviceAPI.PlayoutChangedType.PIECE_PLAYBACK_STOPPED:
				this.changedResults.changes.push({
					type: callbackName,
					objId,
					data: {
						time,
						partInstanceId: (data as PeripheralDeviceAPI.PiecePlaybackCallbackData).partInstanceId,
						pieceInstanceId: (data as PeripheralDeviceAPI.PiecePlaybackCallbackData).pieceInstanceId,
					},
				})
				break
			case PeripheralDeviceAPI.PlayoutChangedType.TRIGGER_REGENERATION:
				this.changedResults.changes.push({
					type: callbackName,
					objId,
					data: {
						regenerationToken: (data as PeripheralDeviceAPI.TriggerRegenerationCallbackData)
							.regenerationToken,
					},
				})
				break
			default:
				assertNever(callbackName)
		}

		// Based on the use-case, we generally expect the callbacks to come in batches, so it only makes sense
		// to wait a little bit to collect the changed callbacks
		if (!this.sendCallbacksTimeout) {
			this.sendCallbacksTimeout = setTimeout(this.sendChangedResults, 20)
		}
	}

	public getDebugStates(): Map<string, object> {
		return this._debugStates
	}
}

export function getHash(str: string): string {
	const hash = crypto.createHash('sha1')
	return hash.update(str).digest('base64').replace(/[+/=]/g, '_') // remove +/= from strings, because they cause troubles
}

export function stringifyIds(ids: string[]): string {
	return ids.map((id) => `"${id}"`).join(', ')
}
