import { UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import {
	APIShowStyleBase,
	APIShowStyleVariant,
	ShowStyleBaseAction,
	ShowStyleBaseActionType,
	ShowStylesRestAPI,
} from '../../../lib/rest/v1'
import { logger } from '../../../logging'
import { APIFactory, APIRegisterHook, ServerAPIContext } from './types'
import { ShowStyleBaseId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { check } from '../../../lib/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { RundownPlaylists, Rundowns, ShowStyleBases, ShowStyleVariants } from '../../../collections'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import {
	APIShowStyleBaseFrom,
	APIShowStyleVariantFrom,
	showStyleBaseFrom,
	showStyleVariantFrom,
	validateAPIBlueprintConfigForShowStyle,
} from './typeConversion'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { runUpgradeForShowStyleBase, validateConfigForShowStyleBase } from '../../../migration/upgrades'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { checkValidation } from '.'

class ShowStylesServerAPI implements ShowStylesRestAPI {
	async getShowStyleBases(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const showStyleBases = (await ShowStyleBases.findFetchAsync({}, { projection: { _id: 1 } })) as Array<
			Pick<DBShowStyleBase, '_id'>
		>
		return ClientAPI.responseSuccess(showStyleBases.map((base) => ({ id: unprotectString(base._id) })))
	}

	async addShowStyleBase(
		_connection: Meteor.Connection,
		_event: string,
		apiShowStyleBase: APIShowStyleBase
	): Promise<ClientAPI.ClientResponse<string>> {
		const blueprintConfigValidation = await validateAPIBlueprintConfigForShowStyle(
			apiShowStyleBase,
			protectString(apiShowStyleBase.blueprintId)
		)
		checkValidation(`addShowStyleBase`, blueprintConfigValidation)

		const showStyle = await showStyleBaseFrom(apiShowStyleBase)
		if (!showStyle) throw new Meteor.Error(400, `Invalid ShowStyleBase`)
		const showStyleId = showStyle._id
		await ShowStyleBases.insertAsync(showStyle)

		return ClientAPI.responseSuccess(unprotectString(showStyleId), 200)
	}

	async getShowStyleBase(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<APIShowStyleBase>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} does not exist`)

		return ClientAPI.responseSuccess(await APIShowStyleBaseFrom(showStyleBase))
	}

	async addOrUpdateShowStyleBase(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		apiShowStyleBase: APIShowStyleBase
	): Promise<ClientAPI.ClientResponse<void>> {
		const blueprintConfigValidation = await validateAPIBlueprintConfigForShowStyle(
			apiShowStyleBase,
			protectString(apiShowStyleBase.blueprintId)
		)
		checkValidation(`addOrUpdateShowStyleBase ${showStyleBaseId}`, blueprintConfigValidation)

		const showStyle = await showStyleBaseFrom(apiShowStyleBase, showStyleBaseId)
		if (!showStyle) throw new Meteor.Error(400, `Invalid ShowStyleBase`)

		const existingShowStyle = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (existingShowStyle) {
			const rundowns = (await Rundowns.findFetchAsync(
				{ showStyleBaseId },
				{ projection: { playlistId: 1 } }
			)) as Array<Pick<Rundown, 'playlistId'>>
			const playlists = (await RundownPlaylists.findFetchAsync(
				{ _id: { $in: rundowns.map((r) => r.playlistId) } },
				{
					projection: {
						activationId: 1,
					},
				}
			)) as Array<Pick<DBRundownPlaylist, 'activationId'>>
			if (playlists.some((playlist) => playlist.activationId !== undefined)) {
				throw new Meteor.Error(
					412,
					`Cannot update ShowStyleBase ${showStyleBaseId} as it is in use by an active Playlist`
				)
			}
		}

		await ShowStyleBases.upsertAsync(showStyleBaseId, showStyle)

		// wait for the upsert to complete before validation and upgrade read from the showStyleBases collection
		await new Promise<void>((resolve) => setTimeout(() => resolve(), 200))

		const validation = await validateConfigForShowStyleBase(showStyleBaseId)
		checkValidation(`addOrUpdateShowStyleBase ${showStyleBaseId}`, validation.messages)

		return ClientAPI.responseSuccess(await runUpgradeForShowStyleBase(showStyleBaseId))
	}

	async getShowStyleConfig(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<object>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} does not exist`)

		return ClientAPI.responseSuccess((await APIShowStyleBaseFrom(showStyleBase)).config)
	}

	async updateShowStyleConfig(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		config: object
	): Promise<ClientAPI.ClientResponse<void>> {
		const existingShowStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (existingShowStyleBase) {
			const rundowns = (await Rundowns.findFetchAsync(
				{ showStyleBaseId },
				{ projection: { playlistId: 1 } }
			)) as Array<Pick<Rundown, 'playlistId'>>
			const playlists = (await RundownPlaylists.findFetchAsync(
				{ _id: { $in: rundowns.map((r) => r.playlistId) } },
				{
					projection: {
						activationId: 1,
					},
				}
			)) as Array<Pick<DBRundownPlaylist, 'activationId'>>
			if (playlists.some((playlist) => playlist.activationId !== undefined)) {
				throw new Meteor.Error(
					412,
					`Cannot update ShowStyleBase ${showStyleBaseId} as it is in use by an active Playlist`
				)
			}
		} else throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} not found`)

		const apiShowStyleBase = await APIShowStyleBaseFrom(existingShowStyleBase)
		apiShowStyleBase.config = config

		const blueprintConfigValidation = await validateAPIBlueprintConfigForShowStyle(
			apiShowStyleBase,
			protectString(apiShowStyleBase.blueprintId)
		)
		checkValidation(`updateShowStyleConfig ${showStyleBaseId}`, blueprintConfigValidation)

		const showStyle = await showStyleBaseFrom(apiShowStyleBase, showStyleBaseId)
		if (!showStyle) throw new Meteor.Error(400, `Invalid ShowStyleBase`)

		await ShowStyleBases.upsertAsync(showStyleBaseId, showStyle)

		// wait for the upsert to complete before validation and upgrade read from the showStyleBases collection
		await new Promise<void>((resolve) => setTimeout(() => resolve(), 200))

		const validation = await validateConfigForShowStyleBase(showStyleBaseId)
		checkValidation(`updateShowStyleConfig ${showStyleBaseId}`, validation.messages)

		return ClientAPI.responseSuccess(await runUpgradeForShowStyleBase(showStyleBaseId))
	}

	async deleteShowStyleBase(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<void>> {
		const rundowns = (await Rundowns.findFetchAsync(
			{ showStyleBaseId },
			{ projection: { playlistId: 1 } }
		)) as Array<Pick<Rundown, 'playlistId'>>
		const playlists = (await RundownPlaylists.findFetchAsync(
			{ _id: { $in: rundowns.map((r) => r.playlistId) } },
			{
				projection: {
					activationId: 1,
				},
			}
		)) as Array<Pick<DBRundownPlaylist, 'activationId'>>
		if (playlists.some((playlist) => playlist.activationId !== undefined)) {
			throw new Meteor.Error(
				412,
				`Cannot delete ShowStyleBase ${showStyleBaseId} as it is in use by an active Playlist`
			)
		}

		await ShowStyleBases.removeAsync(showStyleBaseId)
		return ClientAPI.responseSuccess(undefined)
	}

	async getShowStyleVariants(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} not found`)

		const showStyleVariants = (await ShowStyleVariants.findFetchAsync(
			{ showStyleBaseId },
			{ projection: { _id: 1 } }
		)) as Array<Pick<DBShowStyleVariant, '_id'>>

		return ClientAPI.responseSuccess(showStyleVariants.map((variant) => ({ id: unprotectString(variant._id) })))
	}

	async addShowStyleVariant(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariant: APIShowStyleVariant
	): Promise<ClientAPI.ClientResponse<string>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} not found`)

		const variant = showStyleVariantFrom(showStyleVariant)
		if (!variant) throw new Meteor.Error(400, `Invalid ShowStyleVariant`)

		const variantId = variant._id
		await ShowStyleVariants.insertAsync(variant)

		return ClientAPI.responseSuccess(unprotectString(variantId), 200)
	}

	async getShowStyleVariant(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariantId: ShowStyleVariantId
	): Promise<ClientAPI.ClientResponse<APIShowStyleVariant>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} not found`)

		const variant = await ShowStyleVariants.findOneAsync(showStyleVariantId)
		if (!variant) throw new Meteor.Error(404, `ShowStyleVariant ${showStyleVariantId} not found`)

		return ClientAPI.responseSuccess(await APIShowStyleVariantFrom(showStyleBase, variant))
	}

	async addOrUpdateShowStyleVariant(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariantId: ShowStyleVariantId,
		apiShowStyleVariant: APIShowStyleVariant
	): Promise<ClientAPI.ClientResponse<void>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} does not exist`)

		const blueprintConfigValidation = await validateAPIBlueprintConfigForShowStyle(
			apiShowStyleVariant,
			showStyleBase.blueprintId
		)
		checkValidation(`addOrUpdateShowStyleVariant ${showStyleVariantId}`, blueprintConfigValidation)

		const showStyle = showStyleVariantFrom(apiShowStyleVariant, showStyleVariantId)
		if (!showStyle) throw new Meteor.Error(400, `Invalid ShowStyleVariant`)

		const existingShowStyle = await ShowStyleVariants.findOneAsync(showStyleVariantId)
		if (existingShowStyle) {
			const rundowns = (await Rundowns.findFetchAsync(
				{ showStyleVariantId },
				{ projection: { playlistId: 1 } }
			)) as Array<Pick<Rundown, 'playlistId'>>
			const playlists = (await RundownPlaylists.findFetchAsync(
				{ _id: { $in: rundowns.map((r) => r.playlistId) } },
				{
					projection: {
						activationId: 1,
					},
				}
			)) as Array<Pick<DBRundownPlaylist, 'activationId'>>
			if (playlists.some((playlist) => playlist.activationId !== undefined)) {
				throw new Meteor.Error(
					412,
					`Cannot update ShowStyleVariant ${showStyleVariantId} as it is in use by an active Playlist`
				)
			}
		}

		await ShowStyleVariants.upsertAsync(showStyleVariantId, showStyle)
		return ClientAPI.responseSuccess(undefined, 200)
	}

	async deleteShowStyleVariant(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariantId: ShowStyleVariantId
	): Promise<ClientAPI.ClientResponse<void>> {
		const showStyleBase = await ShowStyleBases.findOneAsync(showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase ${showStyleBaseId} does not exist`)

		const rundowns = (await Rundowns.findFetchAsync(
			{ showStyleVariantId },
			{ projection: { playlistId: 1 } }
		)) as Array<Pick<Rundown, 'playlistId'>>
		const playlists = (await RundownPlaylists.findFetchAsync(
			{ _id: { $in: rundowns.map((r) => r.playlistId) } },
			{
				projection: {
					activationId: 1,
				},
			}
		)) as Array<Pick<DBRundownPlaylist, 'activationId'>>
		if (playlists.some((playlist) => playlist.activationId !== undefined)) {
			throw new Meteor.Error(
				412,
				`Cannot delete ShowStyleVariant ${showStyleVariantId} as it is in use by an active Playlist`
			)
		}

		await ShowStyleVariants.removeAsync(showStyleVariantId)
		return ClientAPI.responseSuccess(undefined, 200)
	}

	async showStyleBaseAction(
		_connection: Meteor.Connection,
		_event: string,
		showStyleBaseId: ShowStyleBaseId,
		action: ShowStyleBaseAction
	): Promise<ClientAPI.ClientResponse<void>> {
		switch (action.type) {
			case ShowStyleBaseActionType.BLUEPRINT_UPGRADE:
				return ClientAPI.responseSuccess(await runUpgradeForShowStyleBase(showStyleBaseId))
			default:
				assertNever(action.type)
				throw new Meteor.Error(400, `Invalid action type`)
		}
	}
}

class ShowStylesAPIFactory implements APIFactory<ShowStylesRestAPI> {
	createServerAPI(_context: ServerAPIContext): ShowStylesRestAPI {
		return new ShowStylesServerAPI()
	}
}

export function registerRoutes(registerRoute: APIRegisterHook<ShowStylesRestAPI>): void {
	const showStylesAPIFactory = new ShowStylesAPIFactory()

	registerRoute<never, never, Array<{ id: string }>>(
		'get',
		'/showstyles',
		new Map(),
		showStylesAPIFactory,
		async (serverAPI, connection, event, _params, _body) => {
			logger.info(`API GET: ShowStyleBases`)
			return await serverAPI.getShowStyleBases(connection, event)
		}
	)

	registerRoute<never, APIShowStyleBase, string>(
		'post',
		'/showstyles',
		new Map([[400, [UserErrorMessage.BlueprintNotFound]]]),
		showStylesAPIFactory,
		async (serverAPI, connection, event, _params, body) => {
			logger.info(`API POST: Add ShowStyleBase ${body.name}`)
			return await serverAPI.addShowStyleBase(connection, event, body)
		}
	)

	registerRoute<{ showStyleBaseId: ShowStyleBaseId }, never, APIShowStyleBase>(
		'get',
		'/showstyles/:showStyleBaseId',
		new Map([[404, [UserErrorMessage.BlueprintNotFound]]]),
		showStylesAPIFactory,
		async (serverAPI, connection, event, params, _body) => {
			logger.info(`API GET: ShowStyleBase ${params.showStyleBaseId}`)
			return await serverAPI.getShowStyleBase(connection, event, params.showStyleBaseId)
		}
	)

	registerRoute<{ showStyleBaseId: string }, APIShowStyleBase, void>(
		'put',
		'/showstyles/:showStyleBaseId',
		new Map([
			[400, [UserErrorMessage.BlueprintNotFound]],
			[409, [UserErrorMessage.ValidationFailed]],
			[412, [UserErrorMessage.RundownAlreadyActive]],
		]),
		showStylesAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
			logger.info(`API PUT: Add or Update ShowStyleBase ${showStyleBaseId}`)

			check(showStyleBaseId, String)
			return await serverAPI.addOrUpdateShowStyleBase(connection, event, showStyleBaseId, body)
		}
	)

	registerRoute<{ showStyleBaseId: string }, never, object>(
		'get',
		'/showstyles/:showStyleBaseId/config',
		new Map([[404, [UserErrorMessage.ShowStyleBaseNotFound]]]),
		showStylesAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
			logger.info(`API GET: ShowStyleBase config ${showStyleBaseId}`)

			check(showStyleBaseId, String)
			return await serverAPI.getShowStyleConfig(connection, event, showStyleBaseId)
		}
	)

	registerRoute<{ showStyleBaseId: string }, object, void>(
		'put',
		'/showstyles/:showStyleBaseId/config',
		new Map([
			[404, [UserErrorMessage.ShowStyleBaseNotFound]],
			[409, [UserErrorMessage.ValidationFailed]],
		]),
		showStylesAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
			logger.info(`API PUT: Update ShowStyleBase config ${showStyleBaseId}`)

			check(showStyleBaseId, String)
			return await serverAPI.updateShowStyleConfig(connection, event, showStyleBaseId, body)
		}
	)

	registerRoute<{ showStyleBaseId: string }, never, void>(
		'delete',
		'/showstyles/:showStyleBaseId',
		new Map([[412, [UserErrorMessage.RundownAlreadyActive]]]),
		showStylesAPIFactory,
		async (serverAPI, connection, event, params, _body) => {
			const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
			logger.info(`API DELETE: ShowStyleBase ${showStyleBaseId}`)

			check(showStyleBaseId, String)
			return await serverAPI.deleteShowStyleBase(connection, event, showStyleBaseId)
		}
	)

	registerRoute<{ showStyleBaseId: string }, never, Array<{ id: string }>>(
		'get',
		'/showstyles/:showStyleBaseId/variants',
		new Map([[404, [UserErrorMessage.BlueprintNotFound]]]),
		showStylesAPIFactory,
		async (serverAPI, connection, event, params, _body) => {
			const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
			logger.info(`API GET: ShowStyleVariants ${showStyleBaseId}`)

			check(showStyleBaseId, String)
			return await serverAPI.getShowStyleVariants(connection, event, showStyleBaseId)
		}
	)

	registerRoute<{ showStyleBaseId: string }, APIShowStyleVariant, string>(
		'post',
		'/showstyles/:showStyleBaseId/variants',
		new Map([[404, [UserErrorMessage.BlueprintNotFound]]]),
		showStylesAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
			logger.info(`API POST: Add ShowStyleVariant ${showStyleBaseId}`)

			check(showStyleBaseId, String)
			return await serverAPI.addShowStyleVariant(connection, event, showStyleBaseId, body)
		}
	)

	registerRoute<{ showStyleBaseId: string; showStyleVariantId: string }, never, APIShowStyleVariant>(
		'get',
		'/showstyles/:showStyleBaseId/variants/:showStyleVariantId',
		new Map([[404, [UserErrorMessage.BlueprintNotFound]]]),
		showStylesAPIFactory,
		async (serverAPI, connection, event, params, _body) => {
			const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
			const showStyleVariantId = protectString<ShowStyleVariantId>(params.showStyleVariantId)
			logger.info(`API GET: ShowStyleVariant ${showStyleBaseId} ${showStyleVariantId}`)

			check(showStyleBaseId, String)
			check(showStyleVariantId, String)
			return await serverAPI.getShowStyleVariant(connection, event, showStyleBaseId, showStyleVariantId)
		}
	)

	registerRoute<{ showStyleBaseId: string; showStyleVariantId: string }, APIShowStyleVariant, void>(
		'put',
		'/showstyles/:showStyleBaseId/variants/:showStyleVariantId',
		new Map([
			[400, [UserErrorMessage.BlueprintNotFound]],
			[404, [UserErrorMessage.BlueprintNotFound]],
			[412, [UserErrorMessage.RundownAlreadyActive]],
		]),
		showStylesAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
			const showStyleVariantId = protectString<ShowStyleVariantId>(params.showStyleVariantId)
			logger.info(`API PUT: Add or Update ShowStyleVariant ${showStyleBaseId} ${showStyleVariantId}`)

			check(showStyleBaseId, String)
			check(showStyleVariantId, String)
			return await serverAPI.addOrUpdateShowStyleVariant(
				connection,
				event,
				showStyleBaseId,
				showStyleVariantId,
				body
			)
		}
	)

	registerRoute<{ showStyleBaseId: string; showStyleVariantId: string }, never, void>(
		'delete',
		'/showstyles/:showStyleBaseId/variants/:showStyleVariantId',
		new Map([
			[404, [UserErrorMessage.BlueprintNotFound]],
			[412, [UserErrorMessage.RundownAlreadyActive]],
		]),
		showStylesAPIFactory,
		async (serverAPI, connection, event, params, _body) => {
			const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleBaseId)
			const showStyleVariantId = protectString<ShowStyleVariantId>(params.showStyleVariantId)
			logger.info(`API DELETE: ShowStyleVariant ${showStyleBaseId} ${showStyleVariantId}`)

			check(showStyleBaseId, String)
			check(showStyleVariantId, String)
			return await serverAPI.deleteShowStyleVariant(connection, event, showStyleBaseId, showStyleVariantId)
		}
	)

	registerRoute<{ showStyleId: string }, { action: ShowStyleBaseAction }, void>(
		'put',
		'/showstyles/{showStyleBaseId}/actions',
		new Map([[404, [UserErrorMessage.ShowStyleBaseNotFound]]]),
		showStylesAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const showStyleBaseId = protectString<ShowStyleBaseId>(params.showStyleId)
			const action = body.action
			logger.info(`API PUT: ShowStyleBase action ${showStyleBaseId} ${body.action.type}`)

			check(showStyleBaseId, String)
			check(action, Object)
			return await serverAPI.showStyleBaseAction(connection, event, showStyleBaseId, action)
		}
	)
}
