import { Meteor } from 'meteor/meteor'
import { logger } from './logging'
import { MethodContext } from './api/methodContext'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { isPromise } from '@sofie-automation/shared-lib/dist/lib/lib'

export type MeteorMethod = (this: MethodContext, ...args: any[]) => any

export interface RunningMethods {
	[methodId: string]: {
		method: string
		startTime: number
		i: number
	}
}
let runningMethods: RunningMethods = {}
let runningMethodsId = 0

/** This expects an array of values (likely the output of Parameters<T>), and makes anything optional be nullable instead */
export type ReplaceOptionalWithNullInArray<T extends any[]> = {
	[K in keyof T]-?: undefined extends T[K] ? NonNullable<T[K]> | null : T[K]
}

/**
 * This expects an interface of functions, and makes any optional parameters to the functions be nullable instead
 * Using this is necessary for any methods exposed to DDP, as undefined values there are encoded as null
 */
export type ReplaceOptionalWithNullInMethodArguments<T> = {
	[K in keyof T]: T[K] extends (...args: infer P) => infer R
		? (...args: ReplaceOptionalWithNullInArray<P>) => R
		: T[K]
}

/**
 * Wrap a method so that it is tracked while running, unblocks the session when it returns a promise
 * (preserving Meteor 2.7 behaviour, to avoid breaking Sofie), and logs errors.
 * This is transport-agnostic: it applies equally to methods served over Meteor's DDP server and
 * over the standalone DDP server.
 */
export function wrapMethodForExecution(methodName: string, method: MeteorMethod): MeteorMethod {
	return function (this: MethodContext, ...args: any[]) {
		const i = runningMethodsId++
		const methodId = 'm' + i

		runningMethods[methodId] = {
			method: methodName,
			startTime: Date.now(),
			i: i,
		}
		try {
			const result = method.apply(this, args)

			if (isPromise(result)) {
				// Don't block execution of other methods while waiting for this to resolve. (This is how meteor 2.7 behaved, added to avoid breaking Sofie)
				this.unblock()

				// The method result is a promise
				return Promise.resolve(result)
					.finally(() => {
						delete runningMethods[methodId]
					})
					.catch(async (err) => {
						if (!_suppressExtraErrorLogging) {
							logger.error(stringifyError(err))
						}
						// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
						return Promise.reject(err)
					})
			} else {
				delete runningMethods[methodId]
				return result
			}
		} catch (err) {
			if (!_suppressExtraErrorLogging) {
				logger.error(stringifyError(err))
			}
			delete runningMethods[methodId]
			throw err
		}
	}
}

export type MeteorDebugMethod = (this: Meteor.MethodThisType, ...args: any[]) => Promise<any> | any

export function getRunningMethods(): RunningMethods {
	return runningMethods
}
export function resetRunningMethods(): void {
	runningMethods = {}
}
let _suppressExtraErrorLogging = false
export function suppressExtraErrorLogging(value: boolean): void {
	_suppressExtraErrorLogging = value
}
