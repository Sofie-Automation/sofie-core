/* eslint-disable @typescript-eslint/no-unsafe-function-type, @typescript-eslint/only-throw-error */
import _ from 'underscore'
import type { DDP } from 'meteor/ddp'

let controllableDefer = false

export function useControllableDefer(): void {
	controllableDefer = true
}
export function useNextTickDefer(): void {
	controllableDefer = false
}

export namespace Meteor {
	export interface Settings {
		public: {
			[id: string]: any
		}
		[id: string]: any
	}

	export interface ErrorStatic {
		new (error: string | number, reason?: string, details?: string): Error
	}
	export interface Error {
		error: string | number
		reason?: string
		details?: string
	}

	export interface SubscriptionHandle {
		stop(): void
		ready(): boolean
	}
	export interface LiveQueryHandle {
		stop(): void
	}
}
const orgSetTimeout = setTimeout
const orgSetInterval = setInterval
const orgClearTimeout = clearTimeout
const orgClearInterval = clearInterval

const $ = {
	Error,
	get setTimeout(): Function {
		return setTimeout
	},
	get setInterval(): Function {
		return setInterval
	},
	get clearTimeout(): Function {
		return clearTimeout
	},
	get clearInterval(): Function {
		return clearInterval
	},

	get orgSetTimeout(): Function {
		return orgSetTimeout
	},
	get orgSetInterval(): Function {
		return orgSetInterval
	},
	get orgClearTimeout(): Function {
		return orgClearTimeout
	},
	get orgClearInterval(): Function {
		return orgClearInterval
	},
}

export class MeteorMock {}

export namespace MeteorMock {
	export const settings: any = {}

	export const mockMethods: { [name: string]: Function } = {}
	export const mockStartupFunctions: Function[] = []

	export function status(): DDP.DDPStatus {
		return {
			connected: true,
			status: 'connected',
			retryCount: 0,
		}
	}

	function getMethodContext() {
		return {
			connection: {
				clientAddress: '1.1.1.1',
			},
			unblock: () => {
				// noop
			},
		}
	}
	export class Error {
		private _stack?: string
		constructor(
			public error: number,
			public reason?: string
		) {
			const e = new $.Error('')
			let stack: string = e.stack || ''

			const lines = stack.split('\n')
			if (lines.length > 1) {
				lines.shift()
				stack = lines.join('\n')
			}
			this._stack = stack
			// console.log(this._stack)
		}
		get name(): string {
			return this.toString()
		}
		get message(): string {
			return this.toString()
		}
		get details(): any {
			return undefined
		}
		get errorType(): string {
			return 'Meteor.Error'
		}
		get isClientSafe(): boolean {
			return false
		}
		get stack(): string | undefined {
			return this._stack
		}
		toString(): string {
			return `[${this.error}] ${this.reason}` // TODO: This should be changed to "${this.reason} [${this.error}]"
		}
	}
	export function methods(addMethods: { [name: string]: Function }): void {
		Object.assign(mockMethods, addMethods)
	}
	export function call(methodName: string, ...args: any[]): any {
		const fcn: Function = mockMethods[methodName]
		if (!fcn) {
			console.log(methodName)
			console.log(mockMethods)
			console.log(new Error(1).stack)
			throw new Error(404, `Method '${methodName}' not found`)
		}

		const lastArg = args.length > 0 && args[args.length - 1]
		if (lastArg && typeof lastArg === 'function') {
			const callback = args.pop()

			defer(() => {
				try {
					Promise.resolve(fcn.call(getMethodContext(), ...args))
						.then((result) => {
							callback(undefined, result)
						})
						.catch((e) => {
							callback(e)
						})
				} catch (e) {
					callback(e)
				}
			})
		} else {
			throw new Error(500, 'callback must be supplied on the client to Meteor.call')
		}
	}
	export function apply(
		methodName: string,
		args: any[],
		_options?: {
			wait?: boolean
			onResultReceived?: Function
		},
		asyncCallback?: Function
	): any {
		// ?
		// This is a bad mock, since it doesn't support any of the options..
		// but it'll do for now:
		call(methodName, ...args, asyncCallback)
	}
	export function setTimeout(fcn: () => void | Promise<void>, time: number): number {
		return $.setTimeout(fcn, time) as number
	}
	export function clearTimeout(timer: number): void {
		$.clearTimeout(timer)
	}
	export function setInterval(fcn: () => void | Promise<void>, time: number): number {
		return $.setInterval(fcn, time) as number
	}
	export function clearInterval(timer: number): void {
		$.clearInterval(timer)
	}
	export function defer(fcn: () => void | Promise<void>): void {
		return (controllableDefer ? $.setTimeout : $.orgSetTimeout)(() => fcn, 0)
	}

	export function startup(fcn: Function): void {
		mockStartupFunctions.push(fcn)
	}

	export function bindEnvironment(_fcn: Function): any {
		throw new Error(500, 'bindEnvironment not supported on client')
	}

	// -- Mock functions: --------------------------
	/**
	 * Run the Meteor.startup() functions
	 */
	export async function mockRunMeteorStartup(): Promise<void> {
		_.each(mockStartupFunctions, (fcn) => {
			fcn()
		})

		await waitTimeNoFakeTimers(10) // So that any observers or defers has had time to run.
	}

	/** Wait for time to pass ( unaffected by jest.useFakeTimers() ) */
	export async function sleepNoFakeTimers(time: number): Promise<void> {
		return new Promise<void>((resolve) => $.orgSetTimeout(resolve, time))
	}

	export function _setImmediate(cb: () => void): number {
		return setTimeout(cb, 0)
	}
}
export function setup(): any {
	return {
		Meteor: MeteorMock,
	}
}

/** Wait for time to pass ( unaffected by jest.useFakeTimers() ) */
export async function waitTimeNoFakeTimers(time: number): Promise<void> {
	await MeteorMock.sleepNoFakeTimers(time)
}
