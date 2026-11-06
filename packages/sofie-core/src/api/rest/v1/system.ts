import { z } from 'zod'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { APIBlueprintApplyConfigResult, MigrationData, PendingMigrations, SystemRestAPI } from '../../../lib/rest/v1'
import { logger } from '../../../logging'
import { APIFactory, APIRegisterHook, ServerAPIContext } from './types'
import { check } from '../../../lib/check'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { assignSystemBlueprint } from '../../blueprints/api'
import * as Migrations from '../../../migration/databaseMigration'
import type { DDPClientConnection } from '../../../ddp-server/types'
import { BlueprintManifestType } from '@sofie-automation/blueprints-integration'
import { Blueprints } from '../../../collections'
import { getCoreSystemAsync } from '../../../coreSystem/collection'
import { runUpgradeForCoreSystem } from '../../../migration/upgrades/system'
import { BlueprintMapEntry, checkSystemUpgradeStatus } from '../../../publications/blueprintUpgradeStatus/checkStatus'
import { assertBlueprintConfigCanBeApplied } from '.'

class SystemServerAPI implements SystemRestAPI {
	constructor(private context: ServerAPIContext) {}

	async assignSystemBlueprint(
		connection: DDPClientConnection,
		_event: string,
		blueprintId: BlueprintId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ClientAPI.responseSuccess(
			await assignSystemBlueprint(this.context.getMethodContext(connection), blueprintId)
		)
	}

	async unassignSystemBlueprint(
		connection: DDPClientConnection,
		_event: string
	): Promise<ClientAPI.ClientResponse<void>> {
		return ClientAPI.responseSuccess(await assignSystemBlueprint(this.context.getMethodContext(connection), null))
	}

	async getPendingMigrations(
		connection: DDPClientConnection,
		_event: string
	): Promise<ClientAPI.ClientResponse<{ inputs: PendingMigrations }>> {
		const migrationStatus = await Migrations.getMigrationStatus(this.context.getMethodContext(connection))
		if (!migrationStatus.migrationNeeded) return ClientAPI.responseSuccess({ inputs: [] })

		// Inputs are no longer supported, but need to be preserved for api compatibility
		return ClientAPI.responseSuccess({ inputs: [] })
	}

	async applyPendingMigrations(
		connection: DDPClientConnection,
		_event: string
	): Promise<ClientAPI.ClientResponse<void>> {
		const migrationStatus = await Migrations.getMigrationStatus(this.context.getMethodContext(connection))
		if (!migrationStatus.migrationNeeded) throw new Error(`Migration does not need to be applied`)

		const result = await Migrations.runMigration(
			this.context.getMethodContext(connection),
			migrationStatus.migration.chunks,
			migrationStatus.migration.hash
		)
		if (result.migrationCompleted) return ClientAPI.responseSuccess(undefined)
		throw new Error(`Unknown error occurred`)
	}

	async applySystemConfig(
		_connection: DDPClientConnection,
		_event: string
	): Promise<ClientAPI.ClientResponse<APIBlueprintApplyConfigResult>> {
		const coreSystem = await getCoreSystemAsync()
		if (!coreSystem)
			throw UserError.from(new Error(`CoreSystem not found`), UserErrorMessage.InternalError, undefined, 500)

		const blueprint = coreSystem.blueprintId
			? await Blueprints.findOneAsync({
					_id: coreSystem.blueprintId,
					blueprintType: BlueprintManifestType.SYSTEM,
				})
			: undefined
		const blueprintMap = new Map<BlueprintId, BlueprintMapEntry>()
		if (blueprint) {
			blueprintMap.set(blueprint._id, {
				_id: blueprint._id,
				configPresets: {},
				configSchema: undefined,
				blueprintHash: blueprint.blueprintHash,
				hasFixUpFunction: false,
			})
		}
		const changes = assertBlueprintConfigCanBeApplied(
			checkSystemUpgradeStatus(blueprintMap, coreSystem),
			coreSystem.blueprintId
		)

		await runUpgradeForCoreSystem(coreSystem._id)

		return ClientAPI.responseSuccess({ changes })
	}
}

class SystemAPIFactory implements APIFactory<SystemRestAPI> {
	createServerAPI(context: ServerAPIContext): SystemRestAPI {
		return new SystemServerAPI(context)
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

	registerRoute<never, never, APIBlueprintApplyConfigResult>(
		'post',
		'/system/config/apply',
		new Map(),
		systemAPIFactory,
		async (serverAPI, connection, event, _params, _body) => {
			logger.info(`API POST: Apply system config`)

			return await serverAPI.applySystemConfig(connection, event)
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

			check(blueprintId, z.string())
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
