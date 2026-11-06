import KoaRouter from '@koa/router'
import { interpollateTranslation, translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { UserError, UserErrorMessage, SofieError } from '@sofie-automation/corelib/dist/error'
import {
	IConfigMessage,
	NoteSeverity,
	ShowStyleBlueprintManifest,
	StudioBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
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
import type { DDPClientConnection } from '../../../ddp-server/types'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import type { Blueprint, BlueprintHash } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import type { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import type { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import type { BlueprintValidateConfigForStudioResult } from '@sofie-automation/corelib/dist/worker/studio'
import type { UIBlueprintUpgradeStatusBase } from '@sofie-automation/meteor-lib/dist/api/upgradeStatus'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { evalBlueprint } from '../../blueprints/cache'
import { BlueprintMapEntry, checkDocUpgradeStatus } from '../../../publications/blueprintUpgradeStatus/checkStatus'
import type {
	ShowStyleBaseFields,
	StudioFields,
} from '../../../publications/blueprintUpgradeStatus/reactiveContentCache'
import type { APIBlueprintValidateConfigMessage } from '../../../lib/rest/v1'

function restAPIUserEvent(ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, unknown>): string {
	// the ctx.URL.pathname will contain `/v1.0`, but will not contain `/api`
	return `REST API: ${ctx.method} /api${ctx.URL.pathname} ${ctx.URL.origin}`
}

class APIContext implements ServerAPIContext {
	public getMethodContext(connection: DDPClientConnection): MethodContextAPI {
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
	} else if (e instanceof SofieError) {
		return e.error
	} else {
		return 500
	}
}

function validateUserError(e: unknown): UserError | undefined {
	if (e instanceof UserError) {
		return e
	} else if (UserError.isSerializedUserErrorObject(e)) {
		return UserError.fromUnknown(e)
	} else {
		return undefined
	}
}

function extractErrorUserMessage(e: unknown): string {
	if (ClientAPI.isClientResponseError(e)) {
		return translateMessage(e.error.userMessage, interpollateTranslation)
	} else if (UserError.isSerializedUserErrorObject(e) || e instanceof UserError) {
		return translateMessage(e.userMessage, interpollateTranslation)
	} else if (e instanceof SofieError && e.reason) {
		return e.reason
	} else {
		return (e as Error).message ?? 'Internal Server Error' // Fallback in case e is not an error type
	}
}

function extractErrorDetails(e: unknown): string[] | undefined {
	if (e instanceof SofieError && e.details) {
		try {
			const details = JSON.parse(e.details) as string[]
			return Array.isArray(details) ? details : undefined
		} catch (_parseError) {
			logger.error(`Failed to parse details to string array: ${e.details}`)
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
		throw new SofieError(409, `${method} has failed blueprint config validation`, details)
	} else {
		const details = JSON.stringify(
			configValidationMsgs.map((msg) => msg.message.key),
			null,
			2
		)
		logger.info(`${method} received messages from bluepring config validation: ${details}`)
	}
}

/**
 * Throws if running the blueprint `fixUpConfig` method is not needed for a document.
 * Matches the logic used by the blueprint upgrade status: a fix up is only pending when the blueprint
 * has a `fixUpConfig` method and it has not yet been run against the current version of the blueprint.
 */
export function assertBlueprintFixUpNeeded(
	lastBlueprintFixUpHash: BlueprintHash | undefined,
	blueprint: Pick<Blueprint, '_id' | 'blueprintHash' | 'hasFixUpFunction'>
): void {
	const args = { blueprintId: unprotectString(blueprint._id) }
	if (!blueprint.hasFixUpFunction) {
		throw UserError.create(UserErrorMessage.BlueprintFixUpNotSupported, args, 412)
	}
	if (lastBlueprintFixUpHash && lastBlueprintFixUpHash === blueprint.blueprintHash) {
		throw UserError.create(UserErrorMessage.BlueprintFixUpNotNeeded, args, 412)
	}
}

type BlueprintUpgradeStatus = Pick<
	UIBlueprintUpgradeStatusBase,
	'invalidReason' | 'changes' | 'pendingRunOfFixupFunction'
>

/**
 * Throws if the blueprint config of a document cannot be applied.
 * Uses the same status as the blueprint upgrade status shown in the UI.
 * @returns The changes that applying the config will apply, translated. Empty if the config is already up to date
 */
export function assertBlueprintConfigCanBeApplied(
	status: BlueprintUpgradeStatus,
	blueprintId: BlueprintId | undefined
): string[] {
	if (status.invalidReason) {
		throw UserError.create(
			UserErrorMessage.BlueprintConfigInvalid,
			{ reason: translateMessage(status.invalidReason, interpollateTranslation) },
			412
		)
	}
	if (status.pendingRunOfFixupFunction) {
		throw UserError.create(
			UserErrorMessage.BlueprintConfigFixUpRequired,
			{ blueprintId: unprotectString(blueprintId) },
			412
		)
	}

	return status.changes.map((change) => translateMessage(change, interpollateTranslation))
}

/**
 * Throws if the blueprint config of a Studio or ShowStyleBase cannot be validated and applied.
 * @returns The changes that applying the config will apply, translated. Empty if the config is already up to date
 */
export function assertBlueprintConfigCanBeValidatedAndApplied(
	doc: Pick<DBStudio, StudioFields> | Pick<DBShowStyleBase, ShowStyleBaseFields>,
	blueprint: Blueprint | undefined,
	blueprintMapEntry: Omit<BlueprintMapEntry, '_id' | 'blueprintHash' | 'hasFixUpFunction'>
): string[] {
	const blueprintMap = new Map<BlueprintId, BlueprintMapEntry>()
	if (blueprint) {
		blueprintMap.set(blueprint._id, {
			...blueprintMapEntry,
			_id: blueprint._id,
			blueprintHash: blueprint.blueprintHash,
			hasFixUpFunction: blueprint.hasFixUpFunction,
		})
	}

	const changes = assertBlueprintConfigCanBeApplied(checkDocUpgradeStatus(blueprintMap, doc), doc.blueprintId)

	if (!blueprint) throw UserError.create(UserErrorMessage.BlueprintNotFound, undefined, 412)

	const manifest = evalBlueprint(blueprint) as StudioBlueprintManifest | ShowStyleBlueprintManifest
	for (const method of ['validateConfig', 'applyConfig'] as const) {
		if (typeof manifest[method] !== 'function') {
			throw UserError.create(
				UserErrorMessage.BlueprintMethodNotSupported,
				{ blueprintId: unprotectString(blueprint._id), method },
				412
			)
		}
	}

	return changes
}

function APINoteSeverityFrom(level: NoteSeverity): APIBlueprintValidateConfigMessage['level'] {
	switch (level) {
		case NoteSeverity.ERROR:
			return 'error'
		case NoteSeverity.WARNING:
			return 'warning'
		case NoteSeverity.INFO:
			return 'info'
		default:
			assertNever(level)
			return 'info'
	}
}

/**
 * Throws if the blueprint config validation reported any errors
 * @returns The validation messages, translated
 */
export function assertBlueprintConfigValidationPassed(
	result: BlueprintValidateConfigForStudioResult
): APIBlueprintValidateConfigMessage[] {
	const messages = result.messages.map((msg) => ({
		level: APINoteSeverityFrom(msg.level),
		message: translateMessage(msg.message, interpollateTranslation),
	}))

	const errors = messages.filter((msg) => msg.level === 'error')
	if (errors.length > 0) {
		throw UserError.create(
			UserErrorMessage.ValidationFailed,
			{ message: errors.map((msg) => msg.message).join('; ') },
			409
		)
	}

	return messages
}

interface APIRequestError {
	status: number
	message: string
	details?: string[]
	additionalInfo?: Record<string, unknown>
}

function sofieAPIRequest<API, Params, Body, Response>(
	method: 'get' | 'post' | 'put' | 'delete',
	route: string,
	errMsgFallbacks: Map<number, UserErrorMessage[]>,
	serverAPIFactory: APIFactory<API>,
	handler: (
		serverAPI: API,
		connection: DDPClientConnection,
		event: string,
		params: Params,
		body: Body
	) => Promise<ClientAPI.ClientResponse<Response>>
) {
	koaRouter[method](route, async (ctx, next) => {
		let responseAdditionalInfo: Record<string, unknown> | undefined
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
				responseAdditionalInfo = response.additionalInfo
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
			if (details) bodyObj.details = details
			if (responseAdditionalInfo) bodyObj.additionalInfo = responseAdditionalInfo
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
