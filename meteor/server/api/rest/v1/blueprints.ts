import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { check } from '../../../lib/check'
import { protectString, unprotectString } from '../../../lib/tempLib'
import { logger } from '../../../logging'
import { APIFactory, APIRegisterHook, ServerAPIContext } from './types'
import { APIBlueprint } from '../../../lib/rest/v1'
import { BlueprintsRestAPI } from '../../../lib/rest/v1'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { Blueprints } from '../../../collections'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { APIBlueprintFrom } from './typeConversion'

class BlueprintsServerAPI implements BlueprintsRestAPI {
	async getAllBlueprints(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const blueprints = (await Blueprints.findFetchAsync({}, { projection: { _id: 1 } })) as Array<
			Pick<Blueprint, '_id'>
		>

		return ClientAPI.responseSuccess(blueprints.map((blueprint) => ({ id: unprotectString(blueprint._id) })))
	}

	async getBlueprint(
		_connection: Meteor.Connection,
		_event: string,
		blueprintId: BlueprintId
	): Promise<ClientAPI.ClientResponse<APIBlueprint>> {
		const blueprint = await Blueprints.findOneAsync(blueprintId)
		if (!blueprint) {
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Blueprint ${blueprintId} not found`),
					UserErrorMessage.BlueprintNotFound,
					undefined,
					404
				)
			)
		}

		const apiBlueprint = APIBlueprintFrom(blueprint)
		if (!apiBlueprint) throw new Error(`Blueprint could not be converted to API representation`)
		return ClientAPI.responseSuccess(apiBlueprint)
	}
}

class BlueprintsAPIFactory implements APIFactory<BlueprintsRestAPI> {
	createServerAPI(_context: ServerAPIContext): BlueprintsRestAPI {
		return new BlueprintsServerAPI()
	}
}

export function registerRoutes(registerRoute: APIRegisterHook<BlueprintsRestAPI>): void {
	const blueprintsAPIFactory = new BlueprintsAPIFactory()

	registerRoute<never, never, Array<{ id: string }>>(
		'get',
		'/blueprints',
		new Map(),
		blueprintsAPIFactory,
		async (serverAPI, connection, event, _params, _body) => {
			logger.info(`API GET: blueprints`)
			return await serverAPI.getAllBlueprints(connection, event)
		}
	)

	registerRoute<{ blueprintId: string }, never, APIBlueprint>(
		'get',
		'/blueprints/:blueprintId',
		new Map(),
		blueprintsAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const blueprintId = protectString<BlueprintId>(params.blueprintId)
			logger.info(`API GET: blueprint ${blueprintId}`)

			check(blueprintId, String)
			return await serverAPI.getBlueprint(connection, event, blueprintId)
		}
	)
}
