// not really middlewares

import { Meteor } from 'meteor/meteor'
import { APIHandler } from './types'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import idempotencyService from './idempotencyService'
import rateLimitingService from './rateLimitingService'

export function makeIdempotent<T, Params, Body, Response>(
	handler: APIHandler<T, Params, Body, Response>
): APIHandler<T, Params, Body, Response> {
	return async (serverAPI: T, connection: Meteor.Connection, event: string, params: Params, body: Body) => {
		const idempotencyKey = connection.httpHeaders['idempotency-key']
		if (typeof idempotencyKey !== 'string' || idempotencyKey.length <= 0) {
			throw UserError.create(UserErrorMessage.IdempotencyKeyMissing, undefined, 400)
		}
		if (!idempotencyService.isUniqueWithinIdempotencyPeriod(idempotencyKey)) {
			throw UserError.create(UserErrorMessage.IdempotencyKeyAlreadyUsed, undefined, 422)
		}
		return await handler(serverAPI, connection, event, params, body)
	}
}

export function makeRateLimited<T, Params, Body, Response>(
	handler: APIHandler<T, Params, Body, Response>,
	resourceName: string
): APIHandler<T, Params, Body, Response> {
	return async (serverAPI: T, connection: Meteor.Connection, event: string, params: Params, body: Body) => {
		if (!rateLimitingService.isAllowedToAccess(resourceName)) {
			throw UserError.create(UserErrorMessage.RateLimitExceeded, undefined, 429)
		}
		return await handler(serverAPI, connection, event, params, body)
	}
}
