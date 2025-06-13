import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { ShowStyleBaseId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor } from 'meteor/meteor'

/* *************************************************************************
This file contains types and interfaces that are used by the REST API.
When making changes to these types, you should be aware of any breaking changes
and update packages/openapi accordingly if needed.
************************************************************************* */

export interface ShowStylesRestAPI {
	/**
	 * Returns the Ids of all ShowStyleBases available in Sofie.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	getShowStyleBases(
		connection: Meteor.Connection,
		event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>>
	/**
	 * Adds a ShowStyleBase, returning the newly created Id.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBase ShowStyleBase to insert
	 */
	addShowStyleBase(
		connection: Meteor.Connection,
		event: string,
		showStyleBase: APIShowStyleBase
	): Promise<ClientAPI.ClientResponse<string>>
	/**
	 * Gets a ShowStyleBase.
	 *
	 * Throws if the ShowStyleBase does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBaseId to fetch
	 */
	getShowStyleBase(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<APIShowStyleBase>>
	/**
	 * Updates an existing ShowStyleBase, or creates it if it does not currently exist.
	 *
	 * Throws if the ShowStyleBase is currently in use in an active Rundown.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase to update or insert
	 * @param showStyleBase ShowStyleBase to insert
	 */
	addOrUpdateShowStyleBase(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleBase: APIShowStyleBase
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Gets a ShowStyle config, if the ShowStyle id exists.
	 *
	 * Throws if the specified ShowStyle does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBaseId to fetch
	 */
	getShowStyleConfig(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<object>>
	/**
	 * Updates a ShowStyle configuration.
	 *
	 * Throws if the ShowStyle is in use in an active Rundown.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId Id of the ShowStyleBase to update
	 * @param object Blueprint configuration object
	 */
	updateShowStyleConfig(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId,
		config: object
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Removed a ShowStyleBase.
	 *
	 * Throws if the ShowStyleBase is in use in an active Rundown.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase to update or insert
	 */
	deleteShowStyleBase(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Gets the Ids of all ShowStyleVariants that belong to a specified ShowStyleBase.
	 *
	 * Throws if the specified ShowStyleBase does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase to fetch ShowStyleVariants for
	 */
	getShowStyleVariants(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>>
	/**
	 * Adds a ShowStyleVariant to a specified ShowStyleBase.
	 *
	 * Throws if the specified ShowStyleBase does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase to add a ShowStyleVariant to
	 * @param showStyleVariant ShowStyleVariant to add
	 */
	addShowStyleVariant(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariant: APIShowStyleVariant
	): Promise<ClientAPI.ClientResponse<string>>
	/**
	 * Gets a ShowStyleVariant.
	 *
	 * Throws if the specified ShowStyleVariant does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase the ShowStyleVariant belongs to
	 * @param showStyleVariant ShowStyleVariant to fetch
	 */
	getShowStyleVariant(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariant: ShowStyleVariantId
	): Promise<ClientAPI.ClientResponse<APIShowStyleVariant>>
	/**
	 * Updates an existing ShowStyleVariant, or creates it if it does not exist.
	 *
	 * Throws if the specified ShowStyleBase does not exist.
	 * Throws if the ShowStyleVariant is currently in use in an active Rundown.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase to add a ShowStyleVariant to
	 * @param showStyleVariantId ShowStyleVariant Id to add/update
	 * @param showStyleVariant ShowStyleVariant to add/update
	 */
	addOrUpdateShowStyleVariant(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariantId: ShowStyleVariantId,
		showStyleVariant: APIShowStyleVariant
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Deletes a specified ShowStyleVariant.
	 *
	 * Throws if the specified ShowStyleBase does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase the ShowStyleVariant belongs to
	 * @param showStyleVariantId ShowStyleVariant to delete
	 */
	deleteShowStyleVariant(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariantId: ShowStyleVariantId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Send an action to a ShowStyleBase.
	 *
	 * Throws if the requested ShowStyleBase does not exits.
	 * Throws if the action is not valid for the requested ShowStyleBase.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase to target
	 * @param action Action to perform
	 */
	showStyleBaseAction(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId,
		action: ShowStyleBaseAction
	): Promise<ClientAPI.ClientResponse<void>>
}

export enum ShowStyleBaseActionType {
	BLUEPRINT_UPGRADE = 'blueprint_upgrade',
}

export interface ShowStyleBaseActionBase {
	type: ShowStyleBaseActionType
}

export interface ShowStyleBaseActionBlueprintUpgrade extends ShowStyleBaseActionBase {
	type: ShowStyleBaseActionType.BLUEPRINT_UPGRADE
}

export type ShowStyleBaseAction = ShowStyleBaseActionBlueprintUpgrade

export interface APIShowStyleBase {
	name: string
	blueprintId: string
	blueprintConfigPresetId?: string
	outputLayers: APIOutputLayer[]
	sourceLayers: APISourceLayer[]
	config: object
}

export interface APIShowStyleVariant {
	name: string
	showStyleBaseId: string
	blueprintConfigPresetId?: string
	config: object
	rank: number
}

export interface APIOutputLayer {
	id: string
	name: string
	rank: number
	isPgm: boolean
}

export interface APISourceLayer {
	id: string
	name: string
	abbreviation?: string
	rank: number
	layerType:
		| 'unknown'
		| 'camera'
		| 'vt'
		| 'remote'
		| 'script'
		| 'graphics'
		| 'splits'
		| 'audio'
		| 'lower-third'
		| 'live-speak'
		| 'transition'
		| 'lights'
		| 'local'
		| 'studio-screen'
		| 'remote-speak'
	exclusiveGroup?: string
}
