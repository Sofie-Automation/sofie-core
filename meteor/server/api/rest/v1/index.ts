import KoaRouter from '@koa/router'
import { interpollateTranslation, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { IConfigMessage, NoteSeverity } from '@sofie-automation/blueprints-integration'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { MethodContextAPI } from '../../methodContext'
import { logger } from '../../../logging'
import { CURRENT_SYSTEM_VERSION } from '../../../migration/currentSystemVersion'
import { triggerWriteAccess } from '../../../security/securityVerify'
import { makeMeteorConnectionFromKoa } from '../koa'
import { registerRoutes as registerBlueprintsRoutes } from './blueprints'
import { registerRoutes as registerDevicesRoutes } from './devices'
import { registerRoutes as registerPlaylistsRoutes } from './playlists'
import { registerRoutes as registerShowStylesRoutes } from './showstyles'
import { registerRoutes as registerStudiosRoutes } from './studios'
import { registerRoutes as registerSystemRoutes } from './system'
import { registerRoutes as registerBucketsRoutes } from './buckets'
import { registerRoutes as registerSnapshotRoutes } from './snapshots'
import { APIFactory, ServerAPIContext } from './types'

function restAPIUserEvent(
	ctx: Koa.ParameterizedContext<
		Koa.DefaultState,
		Koa.DefaultContext & KoaRouter.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>,
		unknown
	>
): string {
	// the ctx.URL.pathname will contain `/v1.0`, but will not contain `/api`
	return `REST API: ${ctx.method} /api${ctx.URL.pathname} ${ctx.URL.origin}`
}

class APIContext implements ServerAPIContext {
	public getMethodContext(connection: Meteor.Connection): MethodContextAPI {
		return {
			connection,
			unblock: () => {
				/* no-op */
			},
		}
	}
}

export const koaRouter = new KoaRouter()
koaRouter.use(bodyParser())

function extractErrorCode(e: unknown): number {
	if (ClientAPI.isClientResponseError(e)) {
		return e.errorCode
	} else if (UserError.isUserError(e)) {
		return e.errorCode
	} else if ((e as Meteor.Error).error && typeof (e as Meteor.Error).error === 'number') {
		return (e as Meteor.Error).error as number
	} else {
		return 500
	}
}

function extractErrorMessage(e: unknown): string {
	if (ClientAPI.isClientResponseError(e)) {
		return translateMessage(e.error.userMessage, interpollateTranslation)
	} else if (UserError.isUserError(e)) {
		return translateMessage(e.userMessage, interpollateTranslation)
	} else if ((e as Meteor.Error).reason && typeof (e as Meteor.Error).reason === 'string') {
		return (e as Meteor.Error).reason as string
	} else {
		return (e as Error).message ?? 'Internal Server Error' // Fallback in case e is not an error type
	}
}

function extractErrorDetails(e: unknown): string[] | undefined {
	if ((e as Meteor.Error).details && typeof (e as Meteor.Error).details === 'string') {
		try {
			const details = JSON.parse((e as Meteor.Error).details as string) as string[]
			return Array.isArray(details) ? details : undefined
		} catch (e) {
			logger.error(`Failed to parse details to string array: ${(e as Meteor.Error).details}`)
			return undefined
		}
	} else {
		return undefined
	}
}

export const checkValidation = (method: string, configValidationMsgs: IConfigMessage[]): void => {
	/**
	 * Throws if any of the configValidationMsgs indicates that the config has errors.
	 * Will log any messages with severity WARNING or INFO
	 */
	const configValidationOK = configValidationMsgs.reduce((acc, msg) => acc && msg.level !== NoteSeverity.ERROR, true)
	if (!configValidationOK) {
		const details = JSON.stringify(
			configValidationMsgs.filter((msg) => msg.level === NoteSeverity.ERROR).map((msg) => msg.message.key),
			null,
			2
		)
		logger.error(`${method} failed blueprint config validation with errors: ${details}`)
		throw new Meteor.Error(409, `${method} has failed blueprint config validation`, details)
	} else {
		const details = JSON.stringify(
			configValidationMsgs.map((msg) => msg.message.key),
			null,
			2
		)
		logger.info(`${method} received messages from bluepring config validation: ${details}`)
	}
}

interface APIRequestError {
	status: number
	message: string
	details?: string[]
}

function sofieAPIRequest<API, Params, Body, Response>(
	method: 'get' | 'post' | 'put' | 'delete',
	route: string,
	errMsgs: Map<number, UserErrorMessage[]>,
	serverAPIFactory: APIFactory<API>,
	handler: (
		serverAPI: API,
		connection: Meteor.Connection,
		event: string,
		params: Params,
		body: Body
	) => Promise<ClientAPI.ClientResponse<Response>>
) {
	koaRouter[method](route, async (ctx, next) => {
		try {
			const context = new APIContext()
			const serverAPI = serverAPIFactory.createServerAPI(context)
			const response = await handler(
				serverAPI,
				makeMeteorConnectionFromKoa(ctx),
				restAPIUserEvent(ctx),
				ctx.params as unknown as Params,
				ctx.request.body as unknown as Body
			)
			if (ClientAPI.isClientResponseError(response)) throw response.error
			ctx.body = JSON.stringify({ status: response.success, result: response.result })
			ctx.status = response.success
		} catch (e) {
			const errCode = extractErrorCode(e)
			let errMsg = extractErrorMessage(e)
			const msgs = errMsgs.get(errCode)
			if (msgs) {
				const msgConcat = {
					key: msgs
						.map((msg) => UserError.create(msg, undefined, errCode).userMessage.key)
						.reduce((acc, msg) => acc + (acc.length ? ' or ' : '') + msg, ''),
				}
				errMsg = translateMessage(msgConcat, interpollateTranslation)
			} else {
				logger.error(
					`${method.toUpperCase()} for route ${route} returned unexpected error code ${errCode} - ${errMsg}`
				)
			}

			logger.error(`${method.toUpperCase()} failed for route ${route}: ${errCode} - ${errMsg}`)
			ctx.type = 'application/json'
			const bodyObj: APIRequestError = { status: errCode, message: errMsg }
			const details = extractErrorDetails(e)
			if (details) bodyObj['details'] = details
			ctx.body = JSON.stringify(bodyObj)
			ctx.status = errCode
		}
		await next()
	})
}

/* ****************************************************************************
  IMPORTANT: IF YOU MAKE ANY MODIFICATIONS TO THE API, YOU MUST ENSURE THAT
  THEY ARE REFLECTED IN THE OPENAPI SPECIFICATION FILES
  (/packages/openapi/api/definitions)
**************************************************************************** */

class IndexServerAPI {
	async index(): Promise<ClientAPI.ClientResponse<{ version: string }>> {
		triggerWriteAccess()

		return ClientAPI.responseSuccess({ version: CURRENT_SYSTEM_VERSION })
	}
}

koaRouter.get('/', async (ctx, next) => {
	ctx.type = 'application/json'
	const server = new IndexServerAPI()
	const response = ClientAPI.responseSuccess(await server.index())
	ctx.body = JSON.stringify({ status: response.success, result: response.result })
	ctx.status = response.success
	await next()
})

registerBlueprintsRoutes(sofieAPIRequest)
registerDevicesRoutes(sofieAPIRequest)
registerPlaylistsRoutes(sofieAPIRequest)
registerShowStylesRoutes(sofieAPIRequest)
registerStudiosRoutes(sofieAPIRequest)
registerSystemRoutes(sofieAPIRequest)
registerBucketsRoutes(sofieAPIRequest)
registerSnapshotRoutes(sofieAPIRequest)
