import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'

/* *************************************************************************
This file contains types and interfaces that are used by the REST API.
When making changes to these types, you should be aware of any breaking changes
and update packages/openapi accordingly if needed.
************************************************************************* */

export interface BlueprintsRestAPI {
	/*
	 * Gets all available Blueprints.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	getAllBlueprints(
		connection: Meteor.Connection,
		event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>>
	/**
	 * Gets a specific Blueprint.
	 *
	 * Throws if the specified Blueprint does not exist.
	 * Throws if the specified Blueprint is of unknown type.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param blueprintId Blueprint to fetch
	 */
	getBlueprint(
		connection: Meteor.Connection,
		event: string,
		blueprintId: BlueprintId
	): Promise<ClientAPI.ClientResponse<APIBlueprint>>
}

export interface APIBlueprint {
	id: string
	name: string
	blueprintType: 'system' | 'studio' | 'showstyle'
	blueprintVersion: string
}
