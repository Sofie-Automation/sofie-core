import { Meteor } from 'meteor/meteor'
import { check, Match } from '../lib/check'
import _ from 'underscore'
import { PeripheralDeviceType, PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { PeripheralDeviceCommands, PeripheralDevices, Rundowns, Studios, UserActionsLog } from '../collections'
import { stringifyObjects, literal } from '@sofie-automation/corelib/dist/lib'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { getCurrentTime } from '../lib/lib'
import { logger } from '../logging'
import { TimelineHash } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { registerClassToMeteorMethods } from '../methods'
import { RundownInput } from './ingest/rundownInput'
import {
	IngestRundown,
	IngestSegment,
	IngestPart,
	ExpectedPackageStatusAPI,
	PackageInfo,
	StatusCode,
} from '@sofie-automation/blueprints-integration'
import { MosIntegration } from './ingest/mosDevice/mosIntegration'
import { MediaScannerIntegration } from './integration/media-scanner'
import { MediaObject } from '@sofie-automation/shared-lib/dist/core/model/MediaObjects'
import { MOS } from '@sofie-automation/corelib'
import { determineDiffTime } from './systemTime/systemTime'
import { getTimeDiff } from './systemTime/api'
import { MethodContextAPI, MethodContext } from './methodContext'
import { triggerWriteAccess, triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { checkAccessAndGetPeripheralDevice } from '../security/check'
import { UserActionsLogItem } from '@sofie-automation/meteor-lib/dist/collections/UserActionsLog'
import { PackageManagerIntegration } from './integration/expectedPackages'
import { profiler } from './profiler'
import { QueueStudioJob } from '../worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import {
	PlayoutChangedResults,
	PeripheralDeviceInitOptions,
	PeripheralDeviceStatusObject,
	TimelineTriggerTimeResult,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { checkStudioExists } from '../optimizations'
import {
	ExpectedPackageId,
	ExpectedPackageWorkStatusId,
	PeripheralDeviceCommandId,
	PeripheralDeviceId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	NewPeripheralDeviceAPI,
	PeripheralDeviceAPIMethods,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'
import { insertInputDeviceTriggerIntoPreview } from '../publications/deviceTriggersPreview'
import { receiveInputDeviceTrigger } from './deviceTriggers/observer'
import { upsertBundles, generateTranslationBundleOriginId } from './translationsBundles'
import { isTranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { JSONBlobParse } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import {
	applyAndValidateOverrides,
	SomeObjectOverrideOp,
} from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { convertPeripheralDeviceForGateway } from '../publications/peripheralDeviceForDevice'
import { executePeripheralDeviceFunction } from './peripheralDevice/executeFunction'
import KoaRouter from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { assertConnectionHasOneOfPermissions } from '../security/auth'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { getRootSubpath } from '../lib'

const apmNamespace = 'peripheralDevice'
export namespace ServerPeripheralDeviceAPI {
	export async function initialize(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		options: PeripheralDeviceInitOptions
	): Promise<PeripheralDeviceId> {
		triggerWriteAccess() // This is somewhat of a hack, since we want to check if it exists at all, before checking access
		check(deviceId, String)
		const existingDevice = await PeripheralDevices.findOneAsync(deviceId)
		if (existingDevice) {
			await checkAccessAndGetPeripheralDevice(deviceId, token, context)
		} else {
			triggerWriteAccessBecauseNoCheckNecessary()
		}

		check(token, String)
		check(options, Object)
		check(options.name, String)
		check(options.category, String)
		check(options.type, String)
		check(options.subType, Match.OneOf(Number, String))
		check(options.parentDeviceId, Match.Optional(String))
		check(options.versions, Match.Optional(Object))

		// Omitting some of the properties that tend to be rather large
		logger.debug('Initialize device ' + deviceId, _.omit(options, 'versions', 'configManifest'))

		if (existingDevice) {
			const newVersionsStr = stringifyObjects(options.versions)
			const oldVersionsStr = stringifyObjects(existingDevice.versions)

			await PeripheralDevices.updateAsync(deviceId, {
				$set: {
					lastSeen: getCurrentTime(),
					lastConnected: getCurrentTime(),
					connected: true,
					connectionId: options.connectionId,

					category: options.category,
					type: options.type,
					subType: options.subType,

					name:
						// Only allow name changes if the name is unmodified:
						existingDevice.name === existingDevice.deviceName || existingDevice.deviceName === undefined
							? options.name
							: existingDevice.name,
					deviceName: options.name,
					parentDeviceId: options.parentDeviceId,
					versions: options.versions,

					configManifest: options.configManifest
						? {
								...options.configManifest,
								translations: undefined, // unset the translations
							}
						: undefined,

					documentationUrl: options.documentationUrl,
				} satisfies Partial<PeripheralDevice>,
				$unset:
					newVersionsStr !== oldVersionsStr
						? {
								disableVersionChecks: 1,
							}
						: undefined,
			})
		} else {
			await PeripheralDevices.insertAsync({
				_id: deviceId,
				created: getCurrentTime(),
				status: {
					statusCode: StatusCode.UNKNOWN,
				},
				connected: true,
				connectionId: options.connectionId,
				lastSeen: getCurrentTime(),
				lastConnected: getCurrentTime(),
				token: token,

				category: options.category,
				type: options.type,
				subType: options.subType,

				name: options.name,
				deviceName: options.name,
				parentDeviceId: options.parentDeviceId,
				versions: options.versions,

				configManifest: options.configManifest
					? {
							...options.configManifest,
							translations: undefined,
						}
					: undefined,

				documentationUrl: options.documentationUrl,
			})
		}
		if (options.configManifest?.translations) {
			await upsertBundles(
				options.configManifest.translations,
				generateTranslationBundleOriginId(deviceId, 'peripheralDevice')
			)
		}
		return deviceId
	}
	export async function unInitialize(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string
	): Promise<PeripheralDeviceId> {
		await checkAccessAndGetPeripheralDevice(deviceId, token, context)

		// TODO: Add an authorization for this?

		await PeripheralDevices.removeAsync(deviceId)
		return deviceId
	}
	export async function setStatus(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		status: PeripheralDeviceStatusObject
	): Promise<PeripheralDeviceStatusObject> {
		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, context)

		check(deviceId, String)
		check(token, String)
		check(status, Object)
		check(status.statusCode, Number)
		if (status.statusCode < StatusCode.UNKNOWN || status.statusCode > StatusCode.FATAL) {
			throw new Meteor.Error(400, 'device status code is not known')
		}

		// check if we have to update something:
		if (!_.isEqual(status, peripheralDevice.status)) {
			logger.info(
				`Changed status of device ${peripheralDevice._id} "${peripheralDevice.name}" to ${status.statusCode}`
			)

			// perform the update:
			await PeripheralDevices.updateAsync(deviceId, {
				$set: {
					status: status,
					connected: true,
				},
			})
		} else if (!peripheralDevice.connected) {
			await PeripheralDevices.updateAsync(deviceId, {
				$set: {
					connected: true,
				},
			})
		}

		return status
	}
	export async function ping(context: MethodContext, deviceId: PeripheralDeviceId, token: string): Promise<void> {
		check(deviceId, String)
		check(token, String)

		const device = await checkAccessAndGetPeripheralDevice(deviceId, token, context)

		// Update lastSeen:
		const now = getCurrentTime()
		// Debounce, to avoid spamming the database:
		if (now - device.lastSeen > 1000) {
			await PeripheralDevices.updateAsync(deviceId, {
				$set: {
					lastSeen: now,
				},
			})
		}
	}

	/**
	 * Called from Playout-gateway when the trigger-time of a timeline object has updated
	 * ( typically when using the "now"-feature )
	 */
	export async function timelineTriggerTime(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		results: TimelineTriggerTimeResult
	): Promise<void> {
		const transaction = profiler.startTransaction('timelineTriggerTime', apmNamespace)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, context)

		if (!peripheralDevice.studioAndConfigId)
			throw new Meteor.Error(401, `peripheralDevice "${deviceId}" not attached to a studio`)

		// check(r.time, Number)
		check(results, Array)
		_.each(results, (o) => {
			check(o.id, String)
			check(o.time, Number)
		})

		if (results.length > 0) {
			const job = await QueueStudioJob(
				StudioJobs.OnTimelineTriggerTime,
				peripheralDevice.studioAndConfigId.studioId,
				{
					results,
				}
			)
			await job.complete
		}

		transaction?.end()
	}
	export async function playoutPlaybackChanged(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		changedResults: PlayoutChangedResults
	): Promise<void> {
		const transaction = profiler.startTransaction('playoutPlaybackChanged', apmNamespace)

		// This is called from the playout-gateway when a part starts playing.
		// Note that this function can / might be called several times from playout-gateway for the same part
		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, context)

		if (!peripheralDevice.studioAndConfigId)
			throw new Error(`PeripheralDevice "${peripheralDevice._id}" sent piecePlaybackStarted, but has no studioId`)

		if (changedResults.changes.length) {
			check(changedResults.rundownPlaylistId, String)

			const job = await QueueStudioJob(
				StudioJobs.OnPlayoutPlaybackChanged,
				peripheralDevice.studioAndConfigId.studioId,
				{
					playlistId: changedResults.rundownPlaylistId,
					changes: changedResults.changes,
				}
			)
			await job.complete
		}

		transaction?.end()
	}
	export async function pingWithCommand(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		message: string,
		cb?: (err: any | null, msg: any) => void
	): Promise<void> {
		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, context)

		executePeripheralDeviceFunction(peripheralDevice._id, 'pingResponse', message)
			.then((res) => {
				if (cb) cb(null, res)
			})
			.catch((err) => {
				logger.warn(err)

				if (cb) cb(err, null)
			})

		await ping(context, deviceId, token)
	}
	export async function killProcess(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		really: boolean
	): Promise<boolean> {
		// This is used in integration tests only
		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, context)

		// Make sure this never runs if this server isn't empty:
		if (await Rundowns.countDocuments())
			throw new Meteor.Error(400, 'Unable to run killProcess: Rundowns not empty!')

		if (really) {
			logger.info('KillProcess command received from ' + peripheralDevice._id + ', shutting down in 1000ms!')
			setTimeout(() => {
				// eslint-disable-next-line n/no-process-exit
				process.exit(0)
			}, 1000)
			return true
		}
		return false
	}
	export async function disableSubDevice(
		deviceId: PeripheralDeviceId,
		subDeviceId: string,
		disable: boolean
	): Promise<void> {
		const peripheralDevice = await PeripheralDevices.findOneAsync(deviceId)
		if (!peripheralDevice) throw new Meteor.Error(404, `PeripheralDevice "${deviceId}" not found`)

		// check that the peripheralDevice has subDevices
		if (peripheralDevice.type !== PeripheralDeviceType.PLAYOUT)
			throw new Meteor.Error(405, `PeripheralDevice "${deviceId}" cannot have subdevice disabled`)
		if (!peripheralDevice.configManifest)
			throw new Meteor.Error(405, `PeripheralDevice "${deviceId}" does not provide a configuration manifest`)
		if (!peripheralDevice.studioAndConfigId)
			throw new Meteor.Error(405, `PeripheralDevice "${deviceId}" does not belong to a Studio`)

		const studio = await Studios.findOneAsync(peripheralDevice.studioAndConfigId.studioId)
		if (!studio) throw new Meteor.Error(405, `PeripheralDevice "${deviceId}" does not belong to a Studio`)

		const playoutDevices = applyAndValidateOverrides(studio.peripheralDeviceSettings.playoutDevices).obj

		// check if the subDevice supports disabling using the magical 'disable' BOOLEAN property.
		const subDeviceSettings = playoutDevices[subDeviceId]
		if (!subDeviceSettings || subDeviceSettings.peripheralDeviceId !== peripheralDevice._id)
			throw new Meteor.Error(404, `PeripheralDevice "${deviceId}", subDevice "${subDeviceId}" is not configured`)

		// Check there is a common properties subdevice schema
		const subDeviceCommonSchemaStr = peripheralDevice.configManifest.subdeviceConfigSchema
		if (!subDeviceCommonSchemaStr)
			throw new Meteor.Error(
				405,
				`PeripheralDevice "${deviceId}" does not provide a subDevices common configuration schema`
			)

		let subDeviceCommonSchema: any
		try {
			// Try and parse the schema, making sure to hide the parse error if it isn't json
			subDeviceCommonSchema = JSONBlobParse(subDeviceCommonSchemaStr)
		} catch (_e) {
			throw new Meteor.Error(
				405,
				`PeripheralDevice "${deviceId}" does not provide a valid subDevices common configuration schema`
			)
		}

		// Check for a boolean 'disable' property, if there is one
		if (subDeviceCommonSchema?.properties?.disable?.type !== 'boolean')
			throw new Meteor.Error(
				405,
				`PeripheralDevice "${deviceId} does not support the disable property for subDevices`
			)

		const overridesPath = `peripheralDeviceSettings.playoutDevices.overrides`
		const propPath = `${subDeviceId}.options.disable`
		const newOverrideOp = literal<SomeObjectOverrideOp>({
			op: 'set',
			path: propPath,
			value: disable,
		})

		const existingIndex = studio.peripheralDeviceSettings.playoutDevices.overrides.findIndex(
			(o) => o.path === propPath
		)
		if (existingIndex !== -1) {
			await Studios.updateAsync(peripheralDevice.studioAndConfigId.studioId, {
				$set: {
					[`${overridesPath}.${existingIndex}`]: newOverrideOp,
				},
			})
		} else {
			await Studios.updateAsync(peripheralDevice.studioAndConfigId.studioId, {
				$push: {
					[overridesPath]: newOverrideOp,
				},
			})
		}
	}
	export async function getDebugStates(peripheralDeviceId: PeripheralDeviceId): Promise<object> {
		const peripheralDevice = await PeripheralDevices.findOneAsync(peripheralDeviceId)
		if (!peripheralDevice) return {}

		if (
			// Debug states are only valid for Playout devices and must be enabled with the `debugState` option
			peripheralDevice.type !== PeripheralDeviceType.PLAYOUT ||
			!peripheralDevice.studioAndConfigId // Must be attached to a studio
		) {
			return {}
		}

		// Fetch the relevant studio
		const studioForDevice = (await Studios.findOneAsync(peripheralDevice.studioAndConfigId.studioId, {
			projection: {
				peripheralDeviceSettings: 1,
			},
		})) as Pick<DBStudio, 'peripheralDeviceSettings'> | undefined
		if (!studioForDevice) return {}

		const studioDeviceSettings = applyAndValidateOverrides(
			studioForDevice.peripheralDeviceSettings.deviceSettings
		).obj

		const settingsForDevice = studioDeviceSettings[peripheralDevice.studioAndConfigId.configId]
		if (!settingsForDevice) return {}

		// Make sure debugState is enabled
		if (!(settingsForDevice.options as Record<string, any> | undefined)?.['debugState']) return {}

		try {
			return await executePeripheralDeviceFunction(peripheralDevice._id, 'getDebugStates')
		} catch (e) {
			logger.error(e)
			return {}
		}
	}
	export async function testMethod(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		returnValue: string,
		throwError?: boolean
	): Promise<string> {
		// used for integration tests with core-connection
		await checkAccessAndGetPeripheralDevice(deviceId, token, context)

		check(deviceId, String)
		check(token, String)
		check(returnValue, String)

		if (throwError) {
			throw new Meteor.Error(418, 'Error thrown, as requested')
		} else {
			return returnValue
		}
	}

	export async function requestUserAuthToken(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		authUrl: string
	): Promise<void> {
		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, context)

		if (peripheralDevice.type !== PeripheralDeviceType.SPREADSHEET) {
			throw new Meteor.Error(400, 'can only request user auth token for peripheral device of spreadsheet type')
		}
		check(authUrl, String)

		await PeripheralDevices.updateAsync(peripheralDevice._id, {
			$set: {
				accessTokenUrl: authUrl,
			},
		})
	}
	export async function storeAccessToken(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		token: string,
		accessToken: unknown
	): Promise<void> {
		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, context)

		if (peripheralDevice.type !== PeripheralDeviceType.SPREADSHEET) {
			throw new Meteor.Error(400, 'can only store access token for peripheral device of spreadsheet type')
		}

		await PeripheralDevices.updateAsync(peripheralDevice._id, {
			$set: {
				accessTokenUrl: '',
				'secretSettings.accessToken': accessToken,
				'secretSettingsStatus.accessToken': true,
			},
		})
	}
	export async function removePeripheralDevice(context: MethodContext, deviceId: PeripheralDeviceId): Promise<void> {
		assertConnectionHasOneOfPermissions(context.connection, 'configure')

		const peripheralDevice = await PeripheralDevices.findOneAsync(deviceId)
		if (!peripheralDevice) throw new Meteor.Error(404, `PeripheralDevice "${deviceId}" not found`)

		logger.info(`Removing PeripheralDevice ${peripheralDevice._id}`)

		await Promise.allSettled([
			PeripheralDevices.removeAsync(peripheralDevice._id),
			PeripheralDevices.removeAsync({
				parentDeviceId: peripheralDevice._id,
			}),
			PeripheralDeviceCommands.removeAsync({
				deviceId: peripheralDevice._id,
			}),
			// TODO: add others here (MediaWorkflows, etc?)
		])
	}
	export async function reportResolveDone(
		context: MethodContext,
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		timelineHash: TimelineHash,
		/** Resolve duration, as reported by playout-gateway/TSR */
		resolveDuration: number
	): Promise<void> {
		// Device (playout gateway) reports that it has finished resolving a timeline
		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)

		check(timelineHash, String)
		check(resolveDuration, Number)

		// Look up the userAction associated with this timelineHash.
		// We're using that to determine when the timeline was generated (in Core)
		// In order to determine the total latency (roundtrip from timeline-generation => resolving done in playout-gateway)
		const userAction = (await UserActionsLog.findOneAsync(
			{
				timelineHash: timelineHash,
			},
			{
				projection: {
					timelineGenerated: 1,
				},
			}
		)) as Pick<UserActionsLogItem, '_id' | 'timelineGenerated'>

		// Compare the timelineHash with the one we have in the timeline.

		if (userAction?.timelineGenerated) {
			/** Time when timeline was generated in Core */
			const startTime = userAction.timelineGenerated
			const endTime = getCurrentTime()

			const totalLatency = endTime - startTime

			await updatePeripheralDeviceLatency(totalLatency, peripheralDevice)

			// Also store the result to the userAction:
			await UserActionsLog.updateAsync(userAction._id, {
				$push: {
					gatewayDuration: totalLatency,
					timelineResolveDuration: resolveDuration,
				},
			})
		}
	}
}

export const peripheralDeviceRouter = new KoaRouter()

peripheralDeviceRouter.post('/:deviceId/uploadCredentials', bodyParser(), async (ctx) => {
	ctx.response.type = 'text/plain'

	try {
		const deviceId: PeripheralDeviceId = protectString(ctx.params.deviceId)
		check(deviceId, String)

		if (!deviceId) throw new Meteor.Error(400, `parameter deviceId is missing`)

		const peripheralDevice = await PeripheralDevices.findOneAsync(deviceId)
		if (!peripheralDevice) throw new Meteor.Error(404, `Peripheral device "${deviceId}" not found`)

		if (ctx.request.type !== 'application/json')
			throw new Meteor.Error(400, 'Upload credentials: Invalid content-type')

		const body = ctx.request.body
		if (!body) throw new Meteor.Error(400, 'Upload credentials: Missing request body')
		if (typeof body !== 'object' || Object.keys(body as any).length === 0)
			throw new Meteor.Error(400, 'Upload credentials: Invalid request body')

		logger.info(`Upload credentails, ${JSON.stringify(body).length} bytes`)

		await PeripheralDevices.updateAsync(peripheralDevice._id, {
			$set: {
				'secretSettings.credentials': body,
				'secretSettingsStatus.credentials': true,
			},
		})

		ctx.response.status = 200
		ctx.body = ''
	} catch (e) {
		ctx.response.status = 500
		ctx.body = e + ''
		logger.error('Upload credentials failed: ' + e)
	}
})

peripheralDeviceRouter.get('/:deviceId/oauthResponse', async (ctx) => {
	try {
		const deviceId: PeripheralDeviceId = protectString(ctx.params.deviceId)
		check(deviceId, String)

		if (!deviceId) throw new Meteor.Error(400, `parameter deviceId is missing`)

		const peripheralDevice = await PeripheralDevices.findOneAsync(deviceId)
		if (!peripheralDevice) throw new Meteor.Error(404, `Peripheral device "${deviceId}" not found`)

		if (!peripheralDevice.studioAndConfigId)
			throw new Meteor.Error(400, `Peripheral device "${deviceId}" is not attached to a studio`)

		if (!(await checkStudioExists(peripheralDevice.studioAndConfigId.studioId)))
			throw new Meteor.Error(404, `Studio "${peripheralDevice.studioAndConfigId.studioId}" not found`)

		let accessToken = ctx.query['code'] || undefined
		const scopes = ctx.query['scope'] || undefined

		check(accessToken, String)
		check(scopes, String)

		accessToken = (accessToken + '').trim()
		if (accessToken && accessToken.length > 5) {
			// If this fails, there's not much we can do except kick the user back to the
			//  device config screen to try again.
			executePeripheralDeviceFunction(deviceId, 'receiveAuthToken', accessToken)
				.then(() => {
					logger.info(`Sent auth token to device "${deviceId}"`)
				})
				.catch(logger.error)
		}

		ctx.redirect(`${getRootSubpath()}/settings/peripheralDevice/${deviceId}`)
	} catch (e) {
		ctx.response.type = 'text/plain'
		ctx.response.status = 500
		ctx.body = e + ''
		logger.error('Upload credentials failed: ' + e)
	}
})

peripheralDeviceRouter.post('/:deviceId/resetAuth', async (ctx) => {
	ctx.response.type = 'text/plain'

	try {
		const deviceId: PeripheralDeviceId = protectString(ctx.params.deviceId)
		check(deviceId, String)

		if (!deviceId) throw new Meteor.Error(400, `parameter deviceId is missing`)

		const peripheralDevice = await PeripheralDevices.findOneAsync(deviceId)
		if (!peripheralDevice) throw new Meteor.Error(404, `Peripheral device "${deviceId}" not found`)

		await PeripheralDevices.updateAsync(peripheralDevice._id, {
			$unset: {
				// User credentials
				'secretSettings.accessToken': true,
				'secretSettingsStatus.accessToken': true,
				accessTokenUrl: true,
			},
		})

		ctx.response.status = 200
		ctx.body = ''
	} catch (e) {
		ctx.response.status = 500
		ctx.body = e + ''
		logger.error('Reset credentials failed: ' + e)
	}
})

peripheralDeviceRouter.post('/:deviceId/resetAppCredentials', async (ctx) => {
	ctx.response.type = 'text/plain'

	try {
		const deviceId: PeripheralDeviceId = protectString(ctx.params.deviceId)
		check(deviceId, String)

		if (!deviceId) throw new Meteor.Error(400, `parameter deviceId is missing`)

		const peripheralDevice = await PeripheralDevices.findOneAsync(deviceId)
		if (!peripheralDevice) throw new Meteor.Error(404, `Peripheral device "${deviceId}" not found`)

		await PeripheralDevices.updateAsync(peripheralDevice._id, {
			$unset: {
				// App credentials
				'secretSettings.credentials': true,
				'secretSettingsStatus.credentials': true,
				// User credentials
				'secretSettings.accessToken': true,
				'secretSettingsStatus.accessToken': true,
				accessTokenUrl: true,
			},
		})

		// executePeripheralDeviceFunction(deviceId, 'killProcess', 1).catch(logger.error)

		ctx.response.status = 200
		ctx.body = ''
	} catch (e) {
		ctx.response.status = 500
		ctx.body = e + ''
		logger.error('Reset credentials failed: ' + e)
	}
})

async function updatePeripheralDeviceLatency(totalLatency: number, peripheralDevice: PeripheralDevice) {
	/** How many latencies we store for statistics */
	const LATENCIES_MAX_LENGTH = 100

	/** Any latency higher than this is not realistic */
	const MAX_REALISTIC_LATENCY = 3000 // ms

	if (totalLatency < MAX_REALISTIC_LATENCY) {
		if (!peripheralDevice.latencies) peripheralDevice.latencies = []
		peripheralDevice.latencies.unshift(totalLatency)

		if (peripheralDevice.latencies.length > LATENCIES_MAX_LENGTH) {
			// Trim anything after LATENCIES_MAX_LENGTH
			peripheralDevice.latencies.splice(LATENCIES_MAX_LENGTH, 999)
		}
		await PeripheralDevices.updateAsync(peripheralDevice._id, {
			$set: {
				latencies: peripheralDevice.latencies,
			},
		})
	}
}

/** WHen a device has executed a PeripheralDeviceCommand, it will reply to this endpoint with the result */
async function functionReply(
	context: MethodContext,
	deviceId: PeripheralDeviceId,
	deviceToken: string,
	commandId: PeripheralDeviceCommandId,
	err: any,
	result: any
): Promise<void> {
	const device = await checkAccessAndGetPeripheralDevice(deviceId, deviceToken, context)

	if (result && typeof result === 'object' && 'response' in result && isTranslatableMessage(result.response)) {
		result.response.namespaces = [
			unprotectString(generateTranslationBundleOriginId(deviceId, 'peripheralDevice')),
			...(result.response.namespaces || []),
		]
	}

	// logger.debug('functionReply', err, result)
	await PeripheralDeviceCommands.updateAsync(
		{
			_id: commandId,
			deviceId: { $in: _.compact([device._id, device.parentDeviceId]) },
		},
		{
			$set: {
				hasReply: true,
				reply: result,
				replyError: err,
				replyTime: getCurrentTime(),
			},
		},
		{
			multi: false,
		}
	)
}

// Set up ALL PeripheralDevice methods:
class ServerPeripheralDeviceAPIClass extends MethodContextAPI implements NewPeripheralDeviceAPI {
	// -------- System time --------
	async determineDiffTime() {
		triggerWriteAccessBecauseNoCheckNecessary()
		return determineDiffTime()
	}
	async getTimeDiff() {
		triggerWriteAccessBecauseNoCheckNecessary()
		return getTimeDiff()
	}
	async getTime() {
		triggerWriteAccessBecauseNoCheckNecessary()
		return getCurrentTime()
	}

	// ----- PeripheralDevice --------------
	async functionReply(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		commandId: PeripheralDeviceCommandId,
		err: any,
		result: any
	) {
		return functionReply(this, deviceId, deviceToken, commandId, err, result)
	}
	async initialize(deviceId: PeripheralDeviceId, deviceToken: string, options: PeripheralDeviceInitOptions) {
		return ServerPeripheralDeviceAPI.initialize(this, deviceId, deviceToken, options)
	}
	async unInitialize(deviceId: PeripheralDeviceId, deviceToken: string) {
		return ServerPeripheralDeviceAPI.unInitialize(this, deviceId, deviceToken)
	}
	async setStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: PeripheralDeviceStatusObject) {
		return ServerPeripheralDeviceAPI.setStatus(this, deviceId, deviceToken, status)
	}
	async ping(deviceId: PeripheralDeviceId, deviceToken: string) {
		return ServerPeripheralDeviceAPI.ping(this, deviceId, deviceToken)
	}
	async getPeripheralDevice(deviceId: PeripheralDeviceId, deviceToken: string) {
		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, deviceToken, this)

		const studio =
			peripheralDevice.studioAndConfigId?.studioId &&
			(await Studios.findOneAsync(peripheralDevice.studioAndConfigId.studioId))

		return convertPeripheralDeviceForGateway(peripheralDevice, studio)
	}
	async pingWithCommand(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		message: string,
		cb?: (err: any | null, msg: any) => void
	) {
		return ServerPeripheralDeviceAPI.pingWithCommand(this, deviceId, deviceToken, message, cb)
	}
	async killProcess(deviceId: PeripheralDeviceId, deviceToken: string, really: boolean) {
		return ServerPeripheralDeviceAPI.killProcess(this, deviceId, deviceToken, really)
	}
	async testMethod(deviceId: PeripheralDeviceId, deviceToken: string, returnValue: string, throwError?: boolean) {
		return ServerPeripheralDeviceAPI.testMethod(this, deviceId, deviceToken, returnValue, throwError)
	}
	async removePeripheralDevice(deviceId: PeripheralDeviceId) {
		return ServerPeripheralDeviceAPI.removePeripheralDevice(this, deviceId)
	}

	// ------ Playout Gateway --------
	async timelineTriggerTime(deviceId: PeripheralDeviceId, deviceToken: string, r: TimelineTriggerTimeResult) {
		return ServerPeripheralDeviceAPI.timelineTriggerTime(this, deviceId, deviceToken, r)
	}
	async playoutPlaybackChanged(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		changedResults: PlayoutChangedResults
	) {
		return ServerPeripheralDeviceAPI.playoutPlaybackChanged(this, deviceId, deviceToken, changedResults)
	}
	async reportResolveDone(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		timelineHash: TimelineHash,
		resolveDuration: number
	) {
		return ServerPeripheralDeviceAPI.reportResolveDone(this, deviceId, deviceToken, timelineHash, resolveDuration)
	}

	// ------ Spreadsheet Gateway --------
	async requestUserAuthToken(deviceId: PeripheralDeviceId, deviceToken: string, authUrl: string) {
		return ServerPeripheralDeviceAPI.requestUserAuthToken(this, deviceId, deviceToken, authUrl)
	}
	async storeAccessToken(deviceId: PeripheralDeviceId, deviceToken: string, authToken: unknown) {
		return ServerPeripheralDeviceAPI.storeAccessToken(this, deviceId, deviceToken, authToken)
	}

	// ------ Ingest methods: ------------
	async dataPlaylistGet(deviceId: PeripheralDeviceId, deviceToken: string, playlistExternalId: string) {
		return RundownInput.dataPlaylistGet(this, deviceId, deviceToken, playlistExternalId)
	}
	async dataRundownList(deviceId: PeripheralDeviceId, deviceToken: string) {
		return RundownInput.dataRundownList(this, deviceId, deviceToken)
	}
	async dataRundownGet(deviceId: PeripheralDeviceId, deviceToken: string, rundownExternalId: string) {
		return RundownInput.dataRundownGet(this, deviceId, deviceToken, rundownExternalId)
	}
	async dataRundownDelete(deviceId: PeripheralDeviceId, deviceToken: string, rundownExternalId: string) {
		return RundownInput.dataRundownDelete(this, deviceId, deviceToken, rundownExternalId)
	}
	async dataRundownCreate(deviceId: PeripheralDeviceId, deviceToken: string, ingestRundown: IngestRundown) {
		return RundownInput.dataRundownCreate(this, deviceId, deviceToken, ingestRundown)
	}
	async dataRundownUpdate(deviceId: PeripheralDeviceId, deviceToken: string, ingestRundown: IngestRundown) {
		return RundownInput.dataRundownUpdate(this, deviceId, deviceToken, ingestRundown)
	}
	async dataRundownMetaDataUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		ingestRundown: Omit<IngestRundown, 'segments'>
	) {
		return RundownInput.dataRundownMetaDataUpdate(this, deviceId, deviceToken, ingestRundown)
	}
	async dataSegmentGet(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string
	) {
		return RundownInput.dataSegmentGet(this, deviceId, deviceToken, rundownExternalId, segmentExternalId)
	}
	async dataSegmentDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string
	) {
		return RundownInput.dataSegmentDelete(this, deviceId, deviceToken, rundownExternalId, segmentExternalId)
	}
	async dataSegmentCreate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	) {
		return RundownInput.dataSegmentCreate(this, deviceId, deviceToken, rundownExternalId, ingestSegment)
	}
	async dataSegmentUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		ingestSegment: IngestSegment
	) {
		return RundownInput.dataSegmentUpdate(this, deviceId, deviceToken, rundownExternalId, ingestSegment)
	}
	async dataSegmentRanksUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		newRanks: { [segmentExternalId: string]: number }
	) {
		return RundownInput.dataSegmentRanksUpdate(this, deviceId, deviceToken, rundownExternalId, newRanks)
	}
	async dataPartDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		partExternalId: string
	) {
		return RundownInput.dataPartDelete(
			this,
			deviceId,
			deviceToken,
			rundownExternalId,
			segmentExternalId,
			partExternalId
		)
	}
	async dataPartCreate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	) {
		return RundownInput.dataPartCreate(
			this,
			deviceId,
			deviceToken,
			rundownExternalId,
			segmentExternalId,
			ingestPart
		)
	}
	async dataPartUpdate(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		rundownExternalId: string,
		segmentExternalId: string,
		ingestPart: IngestPart
	) {
		return RundownInput.dataPartUpdate(
			this,
			deviceId,
			deviceToken,
			rundownExternalId,
			segmentExternalId,
			ingestPart
		)
	}

	// ------ MOS methods: --------
	async mosRoCreate(deviceId: PeripheralDeviceId, deviceToken: string, mosRunningOrder: MOS.IMOSRunningOrder) {
		return MosIntegration.mosRoCreate(this, deviceId, deviceToken, mosRunningOrder)
	}
	async mosRoReplace(deviceId: PeripheralDeviceId, deviceToken: string, mosRunningOrder: MOS.IMOSRunningOrder) {
		return MosIntegration.mosRoReplace(this, deviceId, deviceToken, mosRunningOrder)
	}
	async mosRoDelete(deviceId: PeripheralDeviceId, deviceToken: string, mosRunningOrderId: MOS.IMOSString128) {
		return MosIntegration.mosRoDelete(this, deviceId, deviceToken, mosRunningOrderId)
	}
	async mosRoMetadata(deviceId: PeripheralDeviceId, deviceToken: string, metadata: MOS.IMOSRunningOrderBase) {
		return MosIntegration.mosRoMetadata(this, deviceId, deviceToken, metadata)
	}
	async mosRoStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: MOS.IMOSRunningOrderStatus) {
		return MosIntegration.mosRoStatus(this, deviceId, deviceToken, status)
	}
	async mosRoStoryStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: MOS.IMOSStoryStatus) {
		return MosIntegration.mosRoStoryStatus(this, deviceId, deviceToken, status)
	}
	async mosRoItemStatus(deviceId: PeripheralDeviceId, deviceToken: string, status: MOS.IMOSItemStatus) {
		return MosIntegration.mosRoItemStatus(this, deviceId, deviceToken, status)
	}
	async mosRoStoryInsert(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.IMOSROStory>
	) {
		return MosIntegration.mosRoStoryInsert(this, deviceId, deviceToken, Action, Stories)
	}
	async mosRoItemInsert(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.IMOSItem>
	) {
		return MosIntegration.mosRoItemInsert(this, deviceId, deviceToken, Action, Items)
	}
	async mosRoStoryReplace(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.IMOSROStory>
	) {
		return MosIntegration.mosRoStoryReplace(this, deviceId, deviceToken, Action, Stories)
	}
	async mosRoItemReplace(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.IMOSItem>
	) {
		return MosIntegration.mosRoItemReplace(this, deviceId, deviceToken, Action, Items)
	}
	async mosRoStoryMove(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.IMOSString128>
	) {
		return MosIntegration.mosRoStoryMove(this, deviceId, deviceToken, Action, Stories)
	}
	async mosRoItemMove(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.IMOSString128>
	) {
		return MosIntegration.mosRoItemMove(this, deviceId, deviceToken, Action, Items)
	}
	async mosRoStoryDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSROAction,
		Stories: Array<MOS.IMOSString128>
	) {
		return MosIntegration.mosRoStoryDelete(this, deviceId, deviceToken, Action, Stories)
	}
	async mosRoItemDelete(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		Items: Array<MOS.IMOSString128>
	) {
		return MosIntegration.mosRoItemDelete(this, deviceId, deviceToken, Action, Items)
	}
	async mosRoStorySwap(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSROAction,
		StoryID0: MOS.IMOSString128,
		StoryID1: MOS.IMOSString128
	) {
		return MosIntegration.mosRoStorySwap(this, deviceId, deviceToken, Action, StoryID0, StoryID1)
	}
	async mosRoItemSwap(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		Action: MOS.IMOSStoryAction,
		ItemID0: MOS.IMOSString128,
		ItemID1: MOS.IMOSString128
	) {
		return MosIntegration.mosRoItemSwap(this, deviceId, deviceToken, Action, ItemID0, ItemID1)
	}
	async mosRoReadyToAir(deviceId: PeripheralDeviceId, deviceToken: string, Action: MOS.IMOSROReadyToAir) {
		return MosIntegration.mosRoReadyToAir(this, deviceId, deviceToken, Action)
	}
	async mosRoFullStory(deviceId: PeripheralDeviceId, deviceToken: string, story: MOS.IMOSROFullStory) {
		return MosIntegration.mosRoFullStory(this, deviceId, deviceToken, story)
	}
	// ------- Expected Playout Items (Previously: Media Manager (Media Scanner))
	async getMediaObjectRevisions(deviceId: PeripheralDeviceId, deviceToken: string, collectionId: string) {
		return MediaScannerIntegration.getMediaObjectRevisions(this, deviceId, deviceToken, collectionId)
	}
	async updateMediaObject(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		collectionId: string,
		id: string,
		doc: MediaObject | null
	) {
		return MediaScannerIntegration.updateMediaObject(this, deviceId, deviceToken, collectionId, id, doc)
	}
	async clearMediaObjectCollection(deviceId: PeripheralDeviceId, deviceToken: string, collectionId: string) {
		return MediaScannerIntegration.clearMediaObjectCollection(this, deviceId, deviceToken, collectionId)
	}
	// ------- Package Manager --------------
	async updateExpectedPackageWorkStatuses(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		changes: (
			| {
					id: ExpectedPackageWorkStatusId
					type: 'delete'
			  }
			| {
					id: ExpectedPackageWorkStatusId
					type: 'insert'
					status: ExpectedPackageStatusAPI.WorkStatus
			  }
			| {
					id: ExpectedPackageWorkStatusId
					type: 'update'
					status: Partial<ExpectedPackageStatusAPI.WorkStatus>
			  }
		)[]
	): Promise<void> {
		await PackageManagerIntegration.updateExpectedPackageWorkStatuses(this, deviceId, deviceToken, changes)
	}
	async removeAllExpectedPackageWorkStatusOfDevice(deviceId: PeripheralDeviceId, deviceToken: string) {
		await PackageManagerIntegration.removeAllExpectedPackageWorkStatusOfDevice(this, deviceId, deviceToken)
	}
	async updatePackageContainerPackageStatuses(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		changes: (
			| {
					containerId: string
					packageId: string
					type: 'delete'
			  }
			| {
					containerId: string
					packageId: string
					type: 'update'
					status: ExpectedPackageStatusAPI.PackageContainerPackageStatus
			  }
		)[]
	): Promise<void> {
		await PackageManagerIntegration.updatePackageContainerPackageStatuses(this, deviceId, deviceToken, changes)
	}
	async removeAllPackageContainerPackageStatusesOfDevice(deviceId: PeripheralDeviceId, deviceToken: string) {
		await PackageManagerIntegration.removeAllPackageContainerPackageStatusesOfDevice(this, deviceId, deviceToken)
	}
	async updatePackageContainerStatuses(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		changes: (
			| {
					containerId: string
					type: 'delete'
			  }
			| {
					containerId: string
					type: 'update'
					status: ExpectedPackageStatusAPI.PackageContainerStatus
			  }
		)[]
	): Promise<void> {
		await PackageManagerIntegration.updatePackageContainerStatuses(this, deviceId, deviceToken, changes)
	}
	async removeAllPackageContainerStatusesOfDevice(deviceId: PeripheralDeviceId, deviceToken: string) {
		await PackageManagerIntegration.removeAllPackageContainerStatusesOfDevice(this, deviceId, deviceToken)
	}

	async fetchPackageInfoMetadata(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		type: string,
		packageIds: ExpectedPackageId[]
	) {
		return PackageManagerIntegration.fetchPackageInfoMetadata(this, deviceId, deviceToken, type, packageIds)
	}
	async updatePackageInfo(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		type: PackageInfo.Type, // string
		packageId: ExpectedPackageId,
		expectedContentVersionHash: string,
		actualContentVersionHash: string,
		payload: any
	) {
		await PackageManagerIntegration.updatePackageInfo(
			this,
			deviceId,
			deviceToken,
			type,
			packageId,
			expectedContentVersionHash,
			actualContentVersionHash,
			payload
		)
	}
	async removePackageInfo(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		type: string,
		packageId: ExpectedPackageId,
		removeDelay?: number
	) {
		await PackageManagerIntegration.removePackageInfo(this, deviceId, deviceToken, type, packageId, removeDelay)
	}
	// --- Triggers ---
	/**
	 * This receives an arbitrary input from an Input-handling Peripheral Device. See
	 * shared-lib\src\peripheralDevice\methodsAPI.ts inputDeviceTrigger for more info
	 */
	async inputDeviceTrigger(
		deviceId: PeripheralDeviceId,
		deviceToken: string,
		triggerDeviceId: string,
		triggerId: string,
		values?: Record<string, string | number | boolean> | null
	) {
		await receiveInputDeviceTrigger(this, deviceId, deviceToken, triggerDeviceId, triggerId, values ?? undefined)
		await insertInputDeviceTriggerIntoPreview(deviceId, triggerDeviceId, triggerId, values ?? undefined)
	}
}
registerClassToMeteorMethods(PeripheralDeviceAPIMethods, ServerPeripheralDeviceAPIClass, false)
