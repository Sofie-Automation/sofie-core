import { UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { MigrationData, PendingMigrations, SystemRestAPI } from '../../../lib/rest/v1'
import { logger } from '../../../logging'
import { APIFactory, APIRegisterHook, ServerAPIContext } from './types'
import { check } from '../../../lib/check'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { MeteorCall } from '../../methods'

class SystemServerAPI implements SystemRestAPI {
	async assignSystemBlueprint(
		_connection: Meteor.Connection,
		_event: string,
		blueprintId: BlueprintId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ClientAPI.responseSuccess(await MeteorCall.blueprint.assignSystemBlueprint(blueprintId))
	}

	async unassignSystemBlueprint(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<void>> {
		return ClientAPI.responseSuccess(await MeteorCall.blueprint.assignSystemBlueprint(undefined))
	}

	async getPendingMigrations(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<{ inputs: PendingMigrations }>> {
		const migrationStatus = await MeteorCall.migration.getMigrationStatus()
		if (!migrationStatus.migrationNeeded) return ClientAPI.responseSuccess({ inputs: [] })

		// Inputs are no longer supported, but need to be preserved for api compatibility
		return ClientAPI.responseSuccess({ inputs: [] })
	}

	async applyPendingMigrations(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<void>> {
		const migrationStatus = await MeteorCall.migration.getMigrationStatus()
		if (!migrationStatus.migrationNeeded) throw new Error(`Migration does not need to be applied`)

		const result = await MeteorCall.migration.runMigration(
			migrationStatus.migration.chunks,
			migrationStatus.migration.hash
		)
		if (result.migrationCompleted) return ClientAPI.responseSuccess(undefined)
		throw new Error(`Unknown error occurred`)
	}
}

class SystemAPIFactory implements APIFactory<SystemRestAPI> {
	createServerAPI(_context: ServerAPIContext): SystemRestAPI {
		return new SystemServerAPI()
	}
}

export function registerRoutes(registerRoute: APIRegisterHook<SystemRestAPI>): void {
	const systemAPIFactory = new SystemAPIFactory()

	registerRoute<never, never, { inputs: PendingMigrations }>(
		'get',
		'/system/migrations',
		new Map(),
		systemAPIFactory,
		async (serverAPI, connection, event, _params, _body) => {
			logger.info(`API GET: System migrations`)

			return await serverAPI.getPendingMigrations(connection, event)
		}
	)

	registerRoute<never, { inputs: MigrationData }, void>(
		'post',
		'/system/migrations',
		new Map([[400, [UserErrorMessage.NoMigrationsToApply]]]),
		systemAPIFactory,
		async (serverAPI, connection, event, _params, _body) => {
			logger.info(`API POST: System migrations`)

			return await serverAPI.applyPendingMigrations(connection, event)
		}
	)

	registerRoute<never, { blueprintId: string }, void>(
		'put',
		'/system/blueprint',
		new Map(),
		systemAPIFactory,
		async (serverAPI, connection, events, _, body) => {
			const blueprintId = protectString<BlueprintId>(body.blueprintId)
			logger.info(`API PUT: system blueprint ${blueprintId}`)

			check(blueprintId, String)
			return await serverAPI.assignSystemBlueprint(connection, events, blueprintId)
		}
	)

	registerRoute<never, never, void>(
		'delete',
		'/system/blueprint',
		new Map(),
		systemAPIFactory,
		async (serverAPI, connection, events, _params, _body) => {
			logger.info(`API DELETE: system blueprint`)

			return await serverAPI.unassignSystemBlueprint(connection, events)
		}
	)
}
