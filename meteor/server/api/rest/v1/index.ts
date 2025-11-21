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
import { registerRoutes as registerIngestRoutes } from './ingest'
import { APIFactory, ServerAPIContext } from './types'
import { getSystemStatus } from '../../../systemStatus/systemStatus'
import { Component, ExternalStatus } from '@sofie-automation/meteor-lib/dist/api/systemStatus'

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
		return e.error.errorCode
	} else if (UserError.isSerializedUserErrorObject(e) || e instanceof UserError) {
		return e.errorCode
	} else if ((e as Meteor.Error).error && typeof (e as Meteor.Error).error === 'number') {
		return (e as Meteor.Error).error as number
	} else {
		return 500
	}
}

function validateUserError(e: unknown): UserError | undefined {
	if (e instanceof UserError) {
		return e
	} else if (UserError.isSerializedUserErrorObject(e)) {
		return UserError.fromUnknown(e)
	}
}

function extractErrorUserMessage(e: unknown): string {
	if (ClientAPI.isClientResponseError(e)) {
		return translateMessage(e.error.userMessage, interpollateTranslation)
	} else if (UserError.isSerializedUserErrorObject(e) || e instanceof UserError) {
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
	errMsgFallbacks: Map<number, UserErrorMessage[]>,
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
			if (ClientAPI.isClientResponseError(response)) {
				throw UserError.fromSerialized(response.error)
			}
			ctx.body = JSON.stringify({ status: response.success, result: response.result })
			ctx.status = response.success
		} catch (e) {
			const userError = validateUserError(e)
			const errCode = extractErrorCode(e)
			let errMsg = extractErrorUserMessage(e)
			// Get the fallback messages of the endpoint
			const fallbackMsgs = errMsgFallbacks.get(errCode)

			if (fallbackMsgs && (userError?.message === errMsg || userError?.message === '')) {
				// If no detailed error message is provided then return the fallback error messages.
				const msgConcat = {
					key: fallbackMsgs
						.map((msg) => UserError.create(msg, undefined, errCode).userMessage.key)
						.reduce((acc, msg) => acc + (acc.length ? ' or ' : '') + msg, errMsg),
				}
				errMsg = translateMessage(msgConcat, interpollateTranslation)
			} else if (userError?.message) {
				// If we have a detailed arbitrary error message then return that together with the standard error message.
				errMsg = `${errMsg}${userError.message !== errMsg && userError.message !== '' ? ` - ${userError?.message}` : ''}`
			}

			// Log unknown error codes
			logger.error(
				`${method.toUpperCase()} failed for route ${route}:${!fallbackMsgs ? ' returned unexpected error code' : ''} ${errCode} - ${errMsg}`
			)

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

koaRouter.get('/health', async (ctx, next) => {
	ctx.type = 'application/json'
	const systemStatus = await getSystemStatus(null)
	const coreVersion = systemStatus._internal.versions['core'] ?? 'unknown'
	const blueprint = Object.keys(systemStatus._internal.versions).find((component) =>
		component.startsWith('blueprint')
	)
	const blueprintsVersion = blueprint ? systemStatus._internal.versions[blueprint] : 'unknown'

	interface ComponentStatus {
		name: string
		updated: string
		status: ExternalStatus
		version?: string
		components?: ComponentStatus[]
		statusMessage?: string
	}

	// Array of all devices that have a parentId
	const subComponents =
		systemStatus.components?.filter((c) => c.instanceId !== undefined && c.parentId !== undefined) ?? []

	function mapComponents(components?: Component[]): ComponentStatus[] | undefined {
		return (
			components?.map((c) => {
				const version = c._internal.versions['_process']
				const children = subComponents.filter((sub) => sub.parentId === c.instanceId)
				return {
					name: c.name,
					updated: c.updated,
					status: c.status,
					version: version ?? undefined,
					components: children.length ? mapComponents(children) : undefined,
					statusMessage: c.statusMessage?.length ? c.statusMessage : undefined,
				}
			}) ?? undefined
		)
	}

	// Patch the component statusMessage to be from the _internal field if required
	const allComponentsPatched = systemStatus.components?.map((c) => {
		return {
			...c,
			statusMessage: c.statusMessage ?? (c.status !== 'OK' ? c._internal.messages.join(', ') : undefined),
		}
	})

	// Report status for all devices that are not children and any non-devices that are not OK
	const componentStatus =
		mapComponents(
			allComponentsPatched?.filter(
				(c) => (c.instanceId !== undefined || c.status !== 'OK') && c.parentId === undefined
			)
		) ?? []

	const allStatusMessages =
		allComponentsPatched // include children by not using componentStatus here
			?.filter((c) => c.statusMessage !== undefined)
			.map((c) => `${c.name}: ${c.statusMessage}`)
			.join('; ') ?? ''

	const response = ClientAPI.responseSuccess({
		name: systemStatus.name,
		updated: systemStatus.updated,
		status: systemStatus.status,
		version: coreVersion,
		blueprintsVersion: blueprintsVersion,
		components: componentStatus,
		statusMessage: allStatusMessages,
	})

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
registerIngestRoutes(sofieAPIRequest)
