import _ from 'underscore'
import { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TSR } from '@sofie-automation/blueprints-integration'

export interface NewClientAPI {
	clientLogger(type: string, ...args: string[]): Promise<void>
	clientErrorReport(timestamp: Time, errorString: string, location: string): Promise<void>
	clientLogNotification(timestamp: Time, from: string, severity: number, message: string, source?: any): Promise<void>
	callPeripheralDeviceFunction(
		context: string,
		deviceId: PeripheralDeviceId,
		timeoutTime: number | undefined,
		functionName: string,
		...args: any[]
	): Promise<any>
	callPeripheralDeviceAction(
		context: string,
		deviceId: PeripheralDeviceId,
		timeoutTime: number | undefined,
		actionId: string,
		payload?: Record<string, any>
	): Promise<TSR.ActionExecutionResult>
	callBackgroundPeripheralDeviceFunction(
		deviceId: PeripheralDeviceId,
		timeoutTime: number | undefined,
		functionName: string,
		...args: any[]
	): Promise<any>
}

export enum ClientAPIMethods {
	'clientLogger' = 'client.clientLogger',
	'clientErrorReport' = 'client.clientErrorReport',
	'clientLogNotification' = 'client.clientLogNotification',
	'callPeripheralDeviceFunction' = 'client.callPeripheralDeviceFunction',
	'callPeripheralDeviceAction' = 'client.callPeripheralDeviceAction',
	'callBackgroundPeripheralDeviceFunction' = 'client.callBackgroundPeripheralDeviceFunction',
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace ClientAPI {
	/** Response from a method that's called from the client */
	export interface ClientResponseError {
		/** On error, return status code (by default, use 500) */
		errorCode: number
		/** On error, provide a human-readable error message */
		error: UserError
	}
	/**
	 * Used to reply to the user that the action didn't succeed (but it's not bad enough to log it as an error)
	 * @param errorMessage
	 */
	export function responseError(error: UserError, errorCode?: number): ClientResponseError {
		return { error, errorCode: errorCode ?? 500 }
	}
	export interface ClientResponseSuccess<Result> {
		/** On success, return success code (by default, use 200) */
		success: number
		/** Optionally, provide method result */
		result: Result
	}
	export function responseSuccess<Result>(result: Result, code?: number): ClientResponseSuccess<Result> {
		if (isClientResponseSuccess(result)) result = result.result
		else if (isClientResponseError(result)) throw result.error

		return {
			success: code ?? 200,
			result,
		}
	}
	export type ClientResponse<Result> = ClientResponseError | ClientResponseSuccess<Result>
	export function isClientResponseError(res: unknown): res is ClientResponseError {
		const res0 = res as Partial<ClientResponseError>
		return !!res0 && typeof res0 === 'object' && 'error' in res0 && UserError.isUserError(res0.error)
	}
	export function isClientResponseSuccess(res: unknown): res is ClientResponseSuccess<any> {
		const res0 = res as any
		return !!(_.isObject(res0) && !_.isArray(res0) && res0.error === undefined && res0.success)
	}
}
