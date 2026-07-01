/* eslint-disable @typescript-eslint/no-unsafe-function-type, @typescript-eslint/only-throw-error */

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

let mockIsClient = false
const publications: Record<string, Function> = {}
export class MeteorMock {
	static get isClient(): boolean {
		return mockIsClient
	}
	static get isServer(): boolean {
		return !MeteorMock.isClient
	}
}

export namespace MeteorMock {
	export const isTest = true

	export const isCordova = false

	export const isProduction = false
	export const release = ''

	export const settings: any = {}

	export const mockStartupFunctions: Function[] = []

	export const absolutePath = process.cwd()

	export class Error {
		private _stack?: string
		constructor(
			public error: number,
			public reason?: string,
			public details?: unknown
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
	export function call(_methodName: string, ..._args: any[]): any {
		throw new Error(500, `Meteor.call is not supported without ddp`)
	}
	export async function callAsync(_methodName: string, ..._args: any[]): Promise<any> {
		throw new Error(500, `Meteor.callAsync is not supported without ddp`)
	}
	export function apply(
		_methodName: string,
		_args: any[],
		_options?: {
			wait?: boolean
			onResultReceived?: Function
			returnStubValue?: boolean
			throwStubExceptions?: boolean
		},
		_asyncCallback?: Function
	): any {
		throw new Error(500, `Meteor.apply is not supported without ddp`)
	}
	export async function applyAsync(
		_methodName: string,
		_args: any[],
		_options?: {
			wait?: boolean
			onResultReceived?: Function
			returnStubValue?: boolean
			throwStubExceptions?: boolean
		}
	): Promise<any> {
		throw new Error(500, `Meteor.applyAsync is not supported without ddp`)
	}
	export function setTimeout(fcn: () => void | Promise<void>, time: number): number {
		return $.setTimeout(() => {
			Promise.resolve()
				.then(async () => fcn())
				.catch(console.error)
		}, time) as number
	}
	export function clearTimeout(timer: number): void {
		$.clearTimeout(timer)
	}
	export function setInterval(fcn: () => void | Promise<void>, time: number): number {
		return $.setInterval(() => {
			Promise.resolve()
				.then(async () => fcn())
				.catch(console.error)
		}, time) as number
	}
	export function clearInterval(timer: number): void {
		$.clearInterval(timer)
	}
	export function defer(fcn: () => void | Promise<void>): void {
		return (controllableDefer ? $.setTimeout : $.orgSetTimeout)(() => {
			Promise.resolve()
				.then(async () => fcn())
				.catch(console.error)
		}, 0)
	}

	export function startup(fcn: Function): void {
		mockStartupFunctions.push(fcn)
	}

	export function onConnection(_callback: (connection: any) => void): void {
		// no-op in tests; the standalone DDP server / Connections.ts register a handler here at import time
	}

	export function publish(publicationName: string, handler: Function): any {
		publications[publicationName] = handler
	}

	export function bindEnvironment(fcn: Function): any {
		return (...args: any[]) => {
			return fcn(...args)
		}
	}

	// -- Mock functions: --------------------------
	/**
	 * Run the Meteor.startup() functions
	 */
	export async function mockRunMeteorStartup(): Promise<void> {
		for (const fcn of mockStartupFunctions) {
			await fcn()
		}

		await waitTimeNoFakeTimers(10) // So that any observers or defers has had time to run.
	}
	export function mockSetClientEnvironment(): void {
		mockIsClient = true
	}
	export function mockSetServerEnvironment(): void {
		mockIsClient = false
	}
	export function mockGetPublications(): Record<string, Function> {
		return publications
	}

	/** Wait for time to pass ( unaffected by jest.useFakeTimers() ) */
	export async function sleepNoFakeTimers(time: number): Promise<void> {
		return new Promise<void>((resolve) => $.orgSetTimeout(resolve, time))
	}
}
export function setup(): any {
	return {
		Meteor: MeteorMock,
	}
}

/** Wait for time to pass ( unaffected by jest.useFakeTimers() ) */
export async function waitTimeNoFakeTimers(time: number): Promise<void> {
	return MeteorMock.sleepNoFakeTimers(time)
}
