import { Meteor } from 'meteor/meteor'
import { PeripheralDeviceCommandId, PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { getCurrentTime } from '../../lib/lib'
import { PeripheralDeviceCommands } from '../../collections'
import { logger } from '../../logging'
import { TSR } from '@sofie-automation/blueprints-integration'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

export async function executePeripheralDeviceFunctionWithCustomTimeout(
	deviceId: PeripheralDeviceId,
	timeoutTime0: number | undefined,
	action: {
		functionName: string
		args: Array<any>
	}
): Promise<any>
export async function executePeripheralDeviceFunctionWithCustomTimeout(
	deviceId: PeripheralDeviceId,
	timeoutTime0: number | undefined,
	action: {
		actionId: string
		payload?: Record<string, any>
	}
): Promise<TSR.ActionExecutionResult>
export async function executePeripheralDeviceFunctionWithCustomTimeout(
	deviceId: PeripheralDeviceId,
	timeoutTime0: number | undefined,
	action: {
		functionName?: string
		args?: Array<any>
		actionId?: string
		payload?: Record<string, any>
	}
): Promise<any> {
	const timeoutTime: number = timeoutTime0 || 3000 // also handles null

	const commandId: PeripheralDeviceCommandId = getRandomId()

	const result = Promise.withResolvers<any>()

	// logger.debug('command created: ' + functionName)

	let observer: Meteor.LiveQueryHandle | null = null
	let timeoutCheck: number | undefined

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
			const cmd = await PeripheralDeviceCommands.findOneAsync(commandId)

			if (cmd) {
				const cmdId = cmd._id
				const cleanup = () => {
					if (timeoutCheck) {
						Meteor.clearTimeout(timeoutCheck)
						timeoutCheck = undefined
					}

					observer?.stop()
					PeripheralDeviceCommands.removeAsync(cmdId).catch((e) => {
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
								`Timeout after ${timeoutTime} ms when executing the function "${
									cmd.functionName ?? cmd.actionId
								}" on device "${cmd.deviceId}"`
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

	observer = await PeripheralDeviceCommands.observeChanges(
		{
			_id: commandId,
		},
		{
			added: doCheckReply,
			changed: doCheckReply,
		}
	)
	timeoutCheck = Meteor.setTimeout(doCheckReply, timeoutTime)

	try {
		await PeripheralDeviceCommands.insertAsync({
			_id: commandId,
			deviceId: deviceId,
			time: getCurrentTime(),
			...action,
			hasReply: false,
		})
	} catch (e) {
		observer.stop()
		throw e
	}

	return result.promise
}

/** Same as executeFunction, but returns a promise instead */
export async function executePeripheralDeviceFunction(
	deviceId: PeripheralDeviceId,
	functionName: string,
	...args: any[]
): Promise<any> {
	return executePeripheralDeviceFunctionWithCustomTimeout(deviceId, undefined, { functionName, args })
}
