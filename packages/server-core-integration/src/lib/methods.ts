import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import {
	NewPeripheralDeviceAPI,
	PeripheralDeviceAPIMethods,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'
import _ from 'underscore'
import { CoreConnection, CoreCredentials } from './coreConnection.js'
import { DDPError } from './ddpClient.js'
import { DDPConnector } from './ddpConnector.js'

export function makeMethods(connection: Pick<CoreConnection, 'callMethodRaw'>, methods: object): any {
	const o: any = {}
	_.each(methods, (value: any, methodName: string) => {
		o[methodName] = async (...args: any[]) => connection.callMethodRaw(value, args)
	})
	return o
}
export function makeMethodsLowPrio(connection: Pick<CoreConnection, 'callMethodLowPrioRaw'>, methods: object): any {
	const o: any = {}
	_.each(methods, (value: any, methodName: string) => {
		o[methodName] = async (...args: any[]) => connection.callMethodLowPrioRaw(value, args)
	})
	return o
}

type ParametersExceptDeviceIds<F> = F extends (
	deviceId: PeripheralDeviceId,
	deviceToken: string,
	...rest: infer R
) => any
	? R
	: never

type ExecutableFunction<T extends keyof NewPeripheralDeviceAPI> = (
	...args: ParametersExceptDeviceIds<NewPeripheralDeviceAPI[T]>
) => Promise<ReturnType<NewPeripheralDeviceAPI[T]>>

/**
 * Translate NewPeripheralDeviceAPI, to remove the deviceId and deviceToken parameters at the start, as they will be injected by the
 */
export type ExternalPeripheralDeviceAPI = {
	[T in keyof NewPeripheralDeviceAPI]: ExecutableFunction<T>
}

// low-prio calls:
export const TIMEOUTCALL = 200 // ms, time to wait after a call
export const TIMEOUTREPLY = 50 // ms, time to wait after a reply

interface QueuedMethodCall {
	f: () => Promise<any>
	resolve: (r: any) => void
	reject: (e: Error) => void
}

export class ConnectionMethodsQueue {
	private _triggerDoQueueTimer: NodeJS.Timeout | null = null
	private _timeLastMethodCall = 0
	private _timeLastMethodReply = 0
	private queuedMethodCalls: Array<QueuedMethodCall> = []

	private _ddp: DDPConnector
	private _credentials: CoreCredentials

	constructor(ddp: DDPConnector, credentials: CoreCredentials) {
		this._ddp = ddp
		this._credentials = credentials
	}

	/**
	 * This should not be used directly, use the `coreMethods` wrapper instead.
	 * Call a meteor method
	 * @param methodName The name of the method to call
	 * @param attrs Parameters to the method
	 * @returns Resopnse, if any
	 */
	async callMethodRaw(methodName: string, attrs: Array<any>): Promise<any> {
		return new Promise((resolve, reject) => {
			if (!methodName) {
				reject(new Error('callMethod: argument missing: methodName'))
				return
			}

			const fullAttrs = [this._credentials.deviceId, this._credentials.deviceToken].concat(attrs || [])

			this._timeLastMethodCall = Date.now()
			if (!this._ddp.ddpClient) {
				reject(new Error('callMehod: DDP client has not been initialized'))
				return
			}
			const timeout = setTimeout(() => {
				// Timeout
				console.error(`Timeout "${methodName}"`)
				console.error(JSON.stringify(fullAttrs))
				reject(
					new Error(
						`Timeout when calling method "${methodName}", arguments: ${JSON.stringify(fullAttrs).slice(0, 200)}`
					)
				)
			}, 10 * 1000) // 10 seconds
			this._ddp.ddpClient.call(methodName, fullAttrs, (err: DDPError | undefined, result: any) => {
				clearTimeout(timeout)
				this._timeLastMethodReply = Date.now()
				if (err) {
					if (typeof err === 'object') {
						// Add a custom toString() method, because the default object will just print "[object Object]"
						err.toString = () => {
							if (err.message) {
								return err.message // + (err.stack ? '\n' + err.stack : '')
							} else {
								return JSON.stringify(err)
							}
						}
					}

					// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
					reject(err)
				} else {
					resolve(result)
				}
			})
		})
	}
	async callMethodLowPrioRaw(methodName: PeripheralDeviceAPIMethods | string, attrs: Array<any>): Promise<any> {
		return new Promise((resolve, reject) => {
			this.queuedMethodCalls.push({
				f: async () => {
					return this.callMethodRaw(methodName, attrs)
				},
				resolve: resolve,
				reject: reject,
			})
			this._triggerDoQueue()
		})
	}

	private _triggerDoQueue(time = 2) {
		if (!this._triggerDoQueueTimer) {
			this._triggerDoQueueTimer = setTimeout(() => {
				this._triggerDoQueueTimer = null

				this._doQueue()
			}, time)
		}
	}
	private _doQueue() {
		// check if we can send a call?
		const timeSinceLastMethodCall = Date.now() - this._timeLastMethodCall
		const timeSinceLastMethodReply = Date.now() - this._timeLastMethodReply

		if (timeSinceLastMethodCall < TIMEOUTCALL) {
			// Not enough time has passed since last method call
			this._triggerDoQueue(TIMEOUTCALL - timeSinceLastMethodCall + 1)
		} else if (timeSinceLastMethodReply < TIMEOUTREPLY) {
			// Not enough time has passed since last method reply
			this._triggerDoQueue(TIMEOUTREPLY - timeSinceLastMethodReply + 1)
		} else {
			// yep, it's time to send a command!

			const c = this.queuedMethodCalls.shift()
			if (c) {
				c.f()
					.then((result) => {
						this._triggerDoQueue()
						c.resolve(result)
					})
					.catch((err) => {
						this._triggerDoQueue()
						c.reject(err)
					})
			}
		}
	}
}
