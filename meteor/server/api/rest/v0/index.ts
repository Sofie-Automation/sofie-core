/**
 * NOTE: This is a legacy, deprecated REST API, exposing internal Sofie Publications and Methods as HTTP endpoints
 *
 * You should generally use the latest REST API for integrating with Sofie.
 */

import _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { MeteorMethodSignatures } from '../../../methods'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { MeteorPublications, MeteorPublicationSignatures } from '../../../publications/lib/lib'
import { UserActionAPIMethods } from '@sofie-automation/meteor-lib/dist/api/userActions'
import { logger } from '../../../logging'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { PeripheralDevicePubSub } from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'

const LEGACY_API_VERSION = 0

/**
 * Takes an array of strings and converts them to Null, Boolean, Number, String primitives or Objects, if the string
 * seems like a valid JSON.
 *
 * @param args Array of URL-encoded strings
 */
function typeConvertUrlParameters(args: any[]) {
	const convertedArgs: any[] = []

	args.forEach((val, i) => {
		if (val === 'null') val = null
		else if (val === 'true') val = true
		else if (val === 'false') val = false
		else {
			val = decodeURIComponent(val)

			if (!isNaN(Number(val))) {
				val = Number(val)
			} else {
				let json: any = null
				try {
					json = JSON.parse(val)
				} catch (_e) {
					// ignore
				}
				if (json) val = json
			}
		}

		convertedArgs[i] = val
	})

	return convertedArgs
}

export function createLegacyApiRouter(): KoaRouter {
	const router = new KoaRouter()

	const index = {
		version: `${LEGACY_API_VERSION}`,
		GET: [] as string[],
		POST: [] as string[],
	}

	// Expose all user actions:

	for (const [methodName, methodValue] of Object.entries<any>(UserActionAPIMethods)) {
		const signature = MeteorMethodSignatures[methodValue] || []

		let resource = `/action/${methodName}`
		let docString = `/api/${LEGACY_API_VERSION}${resource}`

		signature.forEach((paramName, i) => {
			resource += `/:param${i}`
			docString += `/:${paramName}`
		})

		index.POST.push(docString)

		assignRoute(router, 'POST', resource, signature.length, async (args) => {
			const convArgs = typeConvertUrlParameters(args)
			return Meteor.callAsync(methodValue, ...convArgs)
		})
	}

	function exposePublication(pubName: string, pubValue: string) {
		const signature = MeteorPublicationSignatures[pubValue] || []

		const f = MeteorPublications[pubValue]

		if (f) {
			let resource = `/publication/${pubName}`
			let docString = `/api/${LEGACY_API_VERSION}${resource}`
			signature.forEach((paramName, i) => {
				resource += `/:param${i}`
				docString += `/:${paramName}`
			})

			index.GET.push(docString)

			assignRoute(router, 'GET', resource, signature.length, async (args) => {
				const convArgs = typeConvertUrlParameters(args)
				const cursor = await f.apply(
					{
						ready: () => null,
					},
					convArgs
				)

				if (cursor) return cursor.fetch()
				return []
			})
		}
	}

	// Expose publications:
	for (const [pubName, pubValue] of Object.entries<string>(MeteorPubSub)) {
		exposePublication(pubName, pubValue)
	}
	for (const [pubName, pubValue] of Object.entries<string>(CorelibPubSub)) {
		exposePublication(pubName, pubValue)
	}
	for (const [pubName, pubValue] of Object.entries<string>(PeripheralDevicePubSub)) {
		exposePublication(pubName, pubValue)
	}

	router.get('/', async (ctx) => {
		ctx.response.type = 'application/json'
		ctx.response.status = 200
		ctx.body = JSON.stringify(index, undefined, 2)
	})

	return router
}

/**
 * Send a resulting payload back to the HTTP client. If the payload is an Object, it will be sent as JSON, otherwise
 * will be sent as Plain Text.
 *
 * @param res
 * @param statusCode
 * @param payload
 */
function sendResult(ctx: Koa.ParameterizedContext, statusCode: number, payload: any) {
	ctx.response.status = statusCode

	if (typeof payload === 'object') {
		ctx.response.type = 'application/json'
		ctx.body = payload
	} else {
		ctx.response.type = 'text/plain'
		ctx.body = String(payload)
	}
}

function assignRoute(
	router: KoaRouter,
	routeType: 'POST' | 'GET',
	resource: string,
	paramCount: number,
	fcn: (p: any[]) => Promise<any>
) {
	const route = routeType === 'POST' ? router.post.bind(router) : router.get.bind(router)

	route(resource, async (ctx) => {
		logger.info(`REST APIv0: ${ctx.socket.remoteAddress} ${routeType} "${ctx.url}"`, {
			url: ctx.url,
			method: routeType,
			remoteAddress: ctx.socket.remoteAddress,
			remotePort: ctx.socket.remotePort,
			headers: ctx.headers,
		})

		try {
			const p: any[] = []
			for (let i = 0; i < paramCount; i++) {
				if (_.has(ctx.params, 'param' + i)) {
					p.push(ctx.params['param' + i])
				} else {
					break
				}
			}

			const result = await fcn(p)

			const code = ClientAPI.isClientResponseError(result) ? 500 : 200
			sendResult(ctx, code, result)
		} catch (e: any) {
			if (e.error && e.reason) {
				// is Meteor.Error
				sendResult(ctx, e.error, String(e.reason))
			} else {
				sendResult(ctx, 500, String(e))
			}
		}
	})
}
