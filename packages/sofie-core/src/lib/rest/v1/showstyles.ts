import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { ShowStyleBaseId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DDPClientConnection } from '../../../ddp-server/types'
import type { APIBlueprintFixUpConfigMessage, APIBlueprintValidateAndApplyConfigResult } from './blueprints'

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
		connection: DDPClientConnection,
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
		connection: DDPClientConnection,
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
		connection: DDPClientConnection,
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
		connection: DDPClientConnection,
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
		connection: DDPClientConnection,
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
		connection: DDPClientConnection,
		event: string,
		showStyleBaseId: ShowStyleBaseId,
		config: object
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Runs the blueprint `fixUpConfig` method for a ShowStyleBase, and stores the fixed-up config.
	 *
	 * This must be run whenever the ShowStyle blueprint has changed, before the config can be validated and applied.
	 * Throws if the specified ShowStyleBase does not exist.
	 * Throws if a fix up is not needed (the ShowStyle blueprint does not support `fixUpConfig`, or it has already been run for the current blueprint version).
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId Id of the ShowStyleBase to fix up
	 * @returns Messages produced by the blueprint while fixing up the config
	 */
	fixupShowStyleConfig(
		connection: DDPClientConnection,
		event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<APIBlueprintFixUpConfigMessage[]>>
	/**
	 * Validates the blueprint config of a ShowStyleBase (`validateConfig`), and then applies it (`applyConfig`), storing the result.
	 * This is the same as the 'Validate and Apply Config' action in the UI.
	 *
	 * Throws if the specified ShowStyleBase does not exist.
	 * Throws if the blueprint config is not valid, or must be fixed up first.
	 * Throws if the blueprint does not support `validateConfig` and `applyConfig`.
	 * Throws if the validation reports any errors, without applying the config.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId Id of the ShowStyleBase to apply the config of
	 * @returns The changes that were applied (empty if the config was already up to date), and the messages produced by the blueprint while validating the config
	 */
	applyShowStyleConfig(
		connection: DDPClientConnection,
		event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<APIBlueprintValidateAndApplyConfigResult>>
	/**
	 * Removed a ShowStyleBase.
	 *
	 * Throws if the ShowStyleBase is in use in an active Rundown.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase to update or insert
	 */
	deleteShowStyleBase(
		connection: DDPClientConnection,
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
		connection: DDPClientConnection,
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
		connection: DDPClientConnection,
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
		connection: DDPClientConnection,
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
		connection: DDPClientConnection,
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
		connection: DDPClientConnection,
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
		connection: DDPClientConnection,
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
	/**
	 * Branding variations for this ShowStyle.
	 * Optional: when omitted the existing Branding is left unchanged, so that a client which does not know
	 * about Branding cannot remove it.
	 */
	branding?: APIBranding[]
	config: object
}

export interface APIBranding {
	id: string
	name: string
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
	isRemoteInput?: boolean
	isGuestInput?: boolean
	isClearable?: boolean
	isSticky?: boolean
	stickyOriginalOnly?: boolean
	isQueueable?: boolean
	isHidden?: boolean
	allowDisable?: boolean
	onPresenterScreen?: boolean
	onListViewColumn?: boolean
	onListViewAdLibColumn?: boolean
}
