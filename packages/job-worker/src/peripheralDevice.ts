import { IBlueprintPlayoutDevice, TSR } from '@sofie-automation/blueprints-integration'
import { PeripheralDeviceCommandId, PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { clone, Complete, getRandomId, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { JobContext } from './jobs/index.js'
import { getCurrentTime } from './lib/index.js'
import { logger } from './logging.js'
import { PlayoutModel } from './playout/model/PlayoutModel.js'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { SubdeviceAction } from '@sofie-automation/corelib/dist/deviceConfig'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

export async function executePeripheralDeviceAction(
	context: JobContext,
	deviceId: PeripheralDeviceId,
	timeoutTime0: number | null,
	actionId: string,
	payload: Record<string, any>
): Promise<TSR.ActionExecutionResult> {
	return executePeripheralDeviceGenericFunction(context, deviceId, timeoutTime0, {
		actionId,
		payload,
	})
}

export async function executePeripheralDeviceFunction(
	context: JobContext,
	deviceId: PeripheralDeviceId,
	timeoutTime0: number | null,
	functionName: string,
	args: Array<any>
): Promise<any> {
	return executePeripheralDeviceGenericFunction(context, deviceId, timeoutTime0, {
		functionName,
		args,
	})
}

async function executePeripheralDeviceGenericFunction(
	context: JobContext,
	deviceId: PeripheralDeviceId,
	timeoutTime0: number | null,
	action:
		| {
				actionId: string
				payload: Record<string, any>
		  }
		| {
				// Legacy (?) function calls:
				functionName: string
				args: Array<any>
		  }
): Promise<any> {
	const timeoutTime = timeoutTime0 ?? 3000 // also handles null

	const commandId: PeripheralDeviceCommandId = getRandomId()

	const result = Promise.withResolvers<any>()

	// logger.debug('command created: ' + functionName)

	let timeoutCheck: NodeJS.Timeout | undefined

	let completed = false
	let pending = false
	let running = false

	// we've sent the command, let's just wait for the reply
	const checkReply = async () => {
		// If already running, set pending
		if (running) {
			pending = true
			return
		}
		// Mark running
		running = true
		pending = false

		try {
			const cmd = await context.directCollections.PeripheralDeviceCommands.findOne(commandId)
			// if (!cmd) throw new Meteor.Error('Command "' + commandId + '" not found')
			// logger.debug('checkReply')

			if (cmd) {
				const cmdId = cmd._id
				const cleanup = () => {
					if (timeoutCheck) {
						clearTimeout(timeoutCheck)
						timeoutCheck = undefined
					}

					Promise.resolve(watcher.close()).catch((e) => {
						logger.error(
							`Cleanup PeripheralDeviceCommand "${commandId}" watcher failed: ${stringifyError(e)}`
						)
					})
					context.directCollections.PeripheralDeviceCommands.remove(cmdId).catch((e) => {
						logger.error(
							`Cleanup PeripheralDeviceCommand "${commandId}" document failed: ${stringifyError(e)}`
						)
					})
				}

				if (cmd.hasReply) {
					// We've got a reply!

					// Do cleanup before the callback to ensure it doesn't get a timeout during the callback:
					cleanup()

					if (!completed) {
						completed = true
						// Handle result
						if (cmd.replyError) {
							result.reject(cmd.replyError)
						} else {
							result.resolve(cmd.reply)
						}
					}
				} else if (getCurrentTime() - (cmd.time || 0) >= timeoutTime) {
					// Timeout

					// Do cleanup:
					cleanup()

					if (!completed) {
						completed = true
						result.reject(
							new Error(
								`Timeout after ${timeoutTime} ms when executing the function "${cmd.functionName}" on device "${cmd.deviceId}"`
							)
						)
					}
				}
			}
		} finally {
			running = false
			// If another run is pending, try again
			if (pending) {
				doCheckReply()
			}
		}
	}

	const doCheckReply = () => {
		checkReply().catch((e) => {
			logger.error(`PeripheralDeviceCommand "${commandId}" check failed: ${stringifyError(e)}`)
		})
	}

	const watcher = context.directCollections.PeripheralDeviceCommands.rawCollection.watch([
		{
			$match: { [`documentKey._id`]: commandId },
		},
	])
	watcher.on('change', (_change) => {
		// assume the change is something we want to look at
		doCheckReply()
	})
	watcher.on('error', (err) => {
		Promise.resolve(watcher.close()).catch((e) => {
			logger.error(`Cleanup PeripheralDeviceCommand "${commandId}" watcher failed: ${stringifyError(e)}`)
		})

		if (!completed) {
			completed = true
			result.reject(err)
		}
	})

	timeoutCheck = setTimeout(doCheckReply, timeoutTime)

	try {
		await context.directCollections.PeripheralDeviceCommands.insertOne({
			_id: commandId,
			deviceId: deviceId,
			time: getCurrentTime(),
			...action,
			hasReply: false,
		})
	} catch (e) {
		Promise.resolve(watcher.close()).catch((e) => {
			logger.error(`Cleanup PeripheralDeviceCommand "${commandId}" watcher failed: ${stringifyError(e)}`)
		})
		throw e
	}

	return result.promise
}

export async function listPlayoutDevices(
	context: JobContext,
	playoutModel: PlayoutModel
): Promise<IBlueprintPlayoutDevice[]> {
	const parentDevicesMap = normalizeArrayToMap(
		playoutModel.peripheralDevices.filter(
			(doc) => doc.studioAndConfigId?.studioId === context.studioId && doc.type === PeripheralDeviceType.PLAYOUT
		),
		'_id'
	)
	const parentDeviceIds = Array.from(parentDevicesMap.keys())
	if (parentDeviceIds.length === 0) {
		throw new Error('No parent devices are configured')
	}

	const devices = await context.directCollections.PeripheralDevices.findFetch({
		parentDeviceId: {
			$in: parentDeviceIds,
		},
	})

	return devices.map((d) => {
		// Future: Do we need to retrieve the config from the studio?
		const parentDevice = d.parentDeviceId && parentDevicesMap.get(d.parentDeviceId)

		// Only expose a subset of the PeripheralDevice to the blueprints
		return literal<Complete<IBlueprintPlayoutDevice>>({
			deviceId: d._id,
			deviceType: d.subType as TSR.DeviceType,
			actions: clone<SubdeviceAction[] | undefined>(
				parentDevice?.configManifest?.subdeviceManifest?.[d.subType]?.actions
			),
		})
	})
}
