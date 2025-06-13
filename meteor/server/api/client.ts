import { check } from '../lib/check'
import { literal, Time, getRandomId } from '../lib/tempLib'
import { getCurrentTime } from '../lib/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { logger } from '../logging'
import { ClientAPI, NewClientAPI, ClientAPIMethods } from '@sofie-automation/meteor-lib/dist/api/client'
import { UserActionsLogItem } from '@sofie-automation/meteor-lib/dist/collections/UserActionsLog'
import { registerClassToMeteorMethods } from '../methods'
import { MethodContext, MethodContextAPI } from './methodContext'
import { isInTestWrite, triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { endTrace, sendTrace, startTrace } from './integration/influx'
import { interpollateTranslation, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import { QueueStudioJob } from '../worker/worker'
import { profiler } from './profiler'
import {
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
	StudioId,
	UserActionsLogItemId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	checkAccessToPlaylist,
	checkAccessToRundown,
	VerifiedRundownForUserAction,
	VerifiedRundownPlaylistForUserAction,
} from '../security/check'
import { UserActionsLog } from '../collections'
import { executePeripheralDeviceFunctionWithCustomTimeout } from './peripheralDevice/executeFunction'
import { LeveledLogMethodFixed } from '@sofie-automation/corelib/dist/logging'
import { assertConnectionHasOneOfPermissions } from '../security/auth'

function rewrapError(methodName: string, e: any): ClientAPI.ClientResponseError {
	const userError = UserError.fromUnknown(e)

	logger.info(`UserAction "${methodName}" failed: ${userError.toErrorString()}`)

	// Forward the error to the caller
	return ClientAPI.responseError(userError, userError.errorCode)
}

export namespace ServerClientAPI {
	/**
	 * Run a UserAction for a Playlist with a job sent to the Studio WorkerThread
	 */
	export async function runUserActionInLogForPlaylistOnWorker<T extends keyof StudioJobFunc>(
		context: MethodContext,
		userEvent: string,
		eventTime: Time,
		playlistId: RundownPlaylistId,
		checkArgs: () => void,
		jobName: T,
		jobArguments: Parameters<StudioJobFunc[T]>[0]
	): Promise<ClientAPI.ClientResponse<ReturnType<StudioJobFunc[T]>>> {
		return runUserActionInLog(
			context,
			userEvent,
			eventTime,
			`worker.${jobName}`,
			jobArguments as any,
			async (userActionMetadata) => {
				checkArgs()

				const playlist = await checkAccessToPlaylist(context.connection, playlistId)
				return runStudioJob(playlist.studioId, jobName, jobArguments, userActionMetadata)
			}
		)
	}

	/**
	 * Run a UserAction for a Rundown with a job sent to the Studio WorkerThread
	 */
	export async function runUserActionInLogForRundownOnWorker<T extends keyof StudioJobFunc>(
		context: MethodContext,
		userEvent: string,
		eventTime: Time,
		rundownId: RundownId,
		checkArgs: () => void,
		jobName: T,
		jobArguments: Parameters<StudioJobFunc[T]>[0]
	): Promise<ClientAPI.ClientResponse<ReturnType<StudioJobFunc[T]>>> {
		return runUserActionInLog(
			context,
			userEvent,
			eventTime,
			`worker.${jobName}`,
			jobArguments as any,
			async (userActionMetadata) => {
				checkArgs()

				const rundown = await checkAccessToRundown(context.connection, rundownId)
				return runStudioJob(rundown.studioId, jobName, jobArguments, userActionMetadata)
			}
		)
	}

	/**
	 * Run a UserAction for a Playlist with a custom executor
	 */
	export async function runUserActionInLogForPlaylist<T>(
		context: MethodContext,
		userEvent: string,
		eventTime: Time,
		playlistId: RundownPlaylistId,
		checkArgs: () => void,
		methodName: string,
		args: Record<string, unknown>,
		fcn: (playlist: VerifiedRundownPlaylistForUserAction) => Promise<T>
	): Promise<ClientAPI.ClientResponse<T>> {
		return runUserActionInLog(context, userEvent, eventTime, methodName, args, async () => {
			checkArgs()

			const playlist = await checkAccessToPlaylist(context.connection, playlistId)
			return fcn(playlist)
		})
	}

	/**
	 * Run a UserAction for a Rundown with a custom executor
	 */
	export async function runUserActionInLogForRundown<T>(
		context: MethodContext,
		userEvent: string,
		eventTime: Time,
		rundownId: RundownId,
		checkArgs: () => void,
		methodName: string,
		args: Record<string, unknown>,
		fcn: (rundown: VerifiedRundownForUserAction) => Promise<T>
	): Promise<ClientAPI.ClientResponse<T>> {
		return runUserActionInLog(context, userEvent, eventTime, methodName, args, async () => {
			checkArgs()

			const rundown = await checkAccessToRundown(context.connection, rundownId)
			return fcn(rundown)
		})
	}

	async function runStudioJob<T extends keyof StudioJobFunc>(
		studioId: StudioId,
		jobName: T,
		jobArguments: Parameters<StudioJobFunc[T]>[0],
		userActionMetadata: UserActionMetadata
	): Promise<ReturnType<StudioJobFunc[T]>> {
		const queuedJob = await QueueStudioJob(jobName, studioId, jobArguments)

		try {
			const span = profiler.startSpan('queued-job')
			const res = await queuedJob.complete
			span?.end()

			return res
		} finally {
			try {
				const timings = await queuedJob.getTimings
				// If the worker reported timings, use them
				if (timings.finishedTime && timings.startedTime) {
					userActionMetadata.workerDuration = timings.finishedTime - timings.startedTime
				}
			} catch (_e) {
				// Failed to get the timings, so ignore it
			}
		}
	}

	/** Metadata to track as the output of a UserAction */
	export interface UserActionMetadata {
		/** How long did the worker take to execute this job? */
		workerDuration?: number
	}

	/**
	 * Run a UserAction in the UserActionsLog
	 */
	export async function runUserActionInLog<TRes>(
		context: MethodContext,
		userEvent: string,
		eventTime: Time,
		methodName: string,
		methodArgs: Record<string, unknown>,
		fcn: (userActionMetadata: UserActionMetadata) => Promise<TRes>
	): Promise<ClientAPI.ClientResponse<TRes>> {
		// If we are in the test write auth check mode, then bypass all special logic to ensure errors dont get mangled
		if (isInTestWrite()) {
			const result = await fcn({})
			return ClientAPI.responseSuccess(result)
		}

		// Execute normally
		const startTime = Date.now()
		const transaction = profiler.startTransaction(methodName, 'userAction')
		const influxTrace = startTrace('userFunction:' + methodName)

		try {
			if (!context.connection) {
				// Called internally from server-side.
				// Just run and return right away:
				try {
					const result = await fcn({})

					return ClientAPI.responseSuccess(result)
				} catch (e) {
					return rewrapError(methodName, e)
				}
			} else {
				// Start the db entry, but don't wait for it
				const actionId: UserActionsLogItemId = getRandomId()
				const pInitialInsert = UserActionsLog.insertAsync(
					literal<UserActionsLogItem>({
						_id: actionId,
						clientAddress: context.connection.clientAddress,
						organizationId: null,
						userId: null,
						context: userEvent,
						method: methodName,
						args: JSON.stringify(methodArgs),
						timestamp: getCurrentTime(),
						clientTime: eventTime,
					})
				).catch((e) => {
					// If this fails make sure it is handled
					logger.warn(`Failed to insert into UserActionsLog: ${stringifyError(e)}`)
				})

				const userActionMetadata: UserActionMetadata = {}
				try {
					const result = await fcn(userActionMetadata)

					const completeTime = Date.now()
					pInitialInsert
						.then(async () =>
							UserActionsLog.updateAsync(actionId, {
								$set: {
									success: true,
									doneTime: completeTime,
									executionTime: completeTime - startTime,
									workerTime: userActionMetadata.workerDuration,
								},
							})
						)
						.catch((err) => {
							// If this fails make sure it is handled
							logger.warn(`Failed to update UserActionsLog: ${stringifyError(err)}`)
						})

					return ClientAPI.responseSuccess(result)
				} catch (e) {
					const errorTime = Date.now()

					const wrappedError = rewrapError(methodName, e)
					const wrappedErrorStr = `ClientResponseError: ${translateMessage(
						wrappedError.error.userMessage,
						interpollateTranslation
					)}`

					// Execute, but don't wait for it
					pInitialInsert
						.then(async () =>
							UserActionsLog.updateAsync(actionId, {
								$set: {
									success: false,
									doneTime: errorTime,
									executionTime: errorTime - startTime,
									workerTime: userActionMetadata.workerDuration,
									errorMessage: wrappedErrorStr,
								},
							})
						)
						.catch((err) => {
							// If this fails make sure it is handled
							logger.warn(`Failed to update UserActionsLog: ${stringifyError(err)}`)
						})

					return wrappedError
				}
			}
		} catch (e) {
			// Make sure the transactions are completed even when we error
			const errStr = stringifyError(e)

			if (transaction) {
				transaction.addLabels({ error: errStr })
				transaction.end()
			}

			if (!influxTrace.tags) influxTrace.tags = {}
			influxTrace.tags['error'] = errStr
			sendTrace(endTrace(influxTrace))

			return rewrapError(methodName, e)
		}
	}

	export async function callPeripheralDeviceFunctionOrAction<T>(
		methodContext: MethodContext,
		context: string,
		deviceId: PeripheralDeviceId,
		makeCall: () => Promise<T>,
		method: string,
		args: unknown
	): Promise<T> {
		check(deviceId, String)
		check(context, String)

		const actionId: UserActionsLogItemId = getRandomId()
		const startTime = Date.now()

		if (!methodContext.connection) {
			// In this case, it was called internally from server-side.
			// Just run and return right away:
			triggerWriteAccessBecauseNoCheckNecessary()
			return makeCall().catch(async (e) => {
				logger.error(stringifyError(e))
				// allow the exception to be handled by the Client code
				return Promise.reject(e instanceof Error ? e : new Error(e))
			})
		}

		// TODO - check this. This probably needs to be moved out of this method, with the client using more targetted methods
		assertConnectionHasOneOfPermissions(methodContext.connection, 'studio', 'configure', 'service')

		await UserActionsLog.insertAsync(
			literal<UserActionsLogItem>({
				_id: actionId,
				clientAddress: methodContext.connection ? methodContext.connection.clientAddress : '',
				organizationId: null,
				userId: null,
				context: context,
				method: `${deviceId}: ${method}`,
				args: JSON.stringify(args),
				timestamp: getCurrentTime(),
			})
		)

		return makeCall()
			.then(async (result) => {
				await UserActionsLog.updateAsync(actionId, {
					$set: {
						success: true,
						doneTime: getCurrentTime(),
						executionTime: Date.now() - startTime,
					},
				})

				return result
			})
			.catch(async (err) => {
				const errMsg = stringifyError(err)
				logger.error(errMsg)
				await UserActionsLog.updateAsync(actionId, {
					$set: {
						success: false,
						doneTime: getCurrentTime(),
						executionTime: Date.now() - startTime,
						errorMessage: errMsg,
					},
				})

				// allow the exception to be handled by the Client code
				return Promise.reject(err instanceof Error ? err : new Error(err))
			})
	}

	export async function callBackgroundPeripheralDeviceFunction(
		methodContext: MethodContext,
		deviceId: PeripheralDeviceId,
		timeoutTime: number | undefined,
		functionName: string,
		...args: any[]
	): Promise<any> {
		check(deviceId, String)
		check(functionName, String)

		logger.debug(`Calling "${deviceId}" with "${functionName}", ${JSON.stringify(args)}`)

		if (!methodContext.connection) {
			// In this case, it was called internally from server-side.
			// Just run and return right away:
			triggerWriteAccessBecauseNoCheckNecessary()
			return executePeripheralDeviceFunctionWithCustomTimeout(deviceId, timeoutTime, {
				functionName,
				args,
			}).catch(async (e) => {
				logger.error(stringifyError(e))
				// allow the exception to be handled by the Client code
				return Promise.reject(e instanceof Error ? e : new Error(e))
			})
		}

		// TODO - check this. This probably needs to be moved out of this method, with the client using more targetted methods
		assertConnectionHasOneOfPermissions(methodContext.connection, 'studio', 'configure', 'service')

		return executePeripheralDeviceFunctionWithCustomTimeout(deviceId, timeoutTime, {
			functionName,
			args,
		}).catch(async (err) => {
			const errMsg = stringifyError(err)
			logger.error(errMsg)
			// allow the exception to be handled by the Client code
			return Promise.reject(err instanceof Error ? err : new Error(err))
		})
	}
}

class ServerClientAPIClass extends MethodContextAPI implements NewClientAPI {
	async clientLogger(type: string, ...args: string[]): Promise<void> {
		triggerWriteAccessBecauseNoCheckNecessary()

		const loggerFunction: LeveledLogMethodFixed = (logger as any)[type] || logger.log

		loggerFunction(args.join(', '))
	}
	async clientErrorReport(timestamp: Time, errorString: string, location: string) {
		check(timestamp, Number)
		triggerWriteAccessBecauseNoCheckNecessary() // TODO: discuss if is this ok?
		logger.error(
			`Uncaught error happened in GUI\n  in "${location}"\n  on "${
				this.connection ? this.connection.clientAddress : 'N/A'
			}"\n  at ${new Date(timestamp).toISOString()}:\n"${errorString}`
		)
	}
	async clientLogNotification(timestamp: Time, from: string, severity: number, message: string, source?: any) {
		check(timestamp, Number)
		triggerWriteAccessBecauseNoCheckNecessary() // TODO: discuss if is this ok?
		const address = this.connection ? this.connection.clientAddress : 'N/A'
		logger.debug(`Notification reported from "${from}": Severity ${severity}: ${message} (${source})`, {
			time: timestamp,
			from,
			severity,
			origMessage: message,
			source,
			address,
		})
	}
	async callPeripheralDeviceFunction(
		context: string,
		deviceId: PeripheralDeviceId,
		timeoutTime: number | undefined,
		functionName: string,
		...args: any[]
	) {
		return ServerClientAPI.callPeripheralDeviceFunctionOrAction(
			this,
			context,
			deviceId,
			async () =>
				executePeripheralDeviceFunctionWithCustomTimeout(deviceId, timeoutTime, {
					functionName,
					args,
				}),
			functionName,
			args
		)
	}
	async callPeripheralDeviceAction(
		context: string,
		deviceId: PeripheralDeviceId,
		timeoutTime: number | undefined,
		actionId: string,
		payload?: Record<string, any>
	) {
		return ServerClientAPI.callPeripheralDeviceFunctionOrAction(
			this,
			context,
			deviceId,
			async () =>
				executePeripheralDeviceFunctionWithCustomTimeout(deviceId, timeoutTime, {
					actionId,
					payload,
				}),
			actionId,
			payload
		)
	}
	async callBackgroundPeripheralDeviceFunction(
		deviceId: PeripheralDeviceId,
		timeoutTime: number | undefined,
		functionName: string,
		...args: any[]
	): Promise<any> {
		return ServerClientAPI.callBackgroundPeripheralDeviceFunction(
			this,
			deviceId,
			timeoutTime,
			functionName,
			...args
		)
	}
}
registerClassToMeteorMethods(ClientAPIMethods, ServerClientAPIClass, false)
