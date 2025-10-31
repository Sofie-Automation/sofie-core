import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor } from 'meteor/meteor'

/* *************************************************************************
This file contains types and interfaces that are used by the REST API.
When making changes to these types, you should be aware of any breaking changes
and update packages/openapi accordingly if needed.
************************************************************************* */

export interface StudiosRestAPI {
	/**
	 * Gets the Ids of all Studios.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	getStudios(connection: Meteor.Connection, event: string): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>>
	/**
	 * Adds a new Studio, returns the Id of the newly created Studio.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studio Studio to add
	 */
	addStudio(
		connection: Meteor.Connection,
		event: string,
		studio: APIStudio
	): Promise<ClientAPI.ClientResponse<string>>
	/**
	 * Gets a Studio, if it exists.
	 *
	 * Throws if the specified Studio does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Id of the Studio to fetch
	 */
	getStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<APIStudio>>
	/**
	 * Adds a new Studio or updates an already existing one.
	 *
	 * Throws if the Studio already exists and is in use in an active Rundown.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Id of the Studio to add or update
	 * @param studio Studio to add or update
	 */
	addOrUpdateStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		studio: APIStudio
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Gets a Studio config, if it exists.
	 *
	 * Throws if the specified Studio does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Id of the Studio to fetch
	 */
	getStudioConfig(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<object>>
	/**
	 * Updates a Studio configuration.
	 *
	 * Throws if the Studio already exists and is in use in an active Rundown.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Id of the Studio to update
	 * @param object Blueprint configuration object
	 */
	updateStudioConfig(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		config: object
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Deletes a Studio.
	 *
	 * Throws if the specified Studio is in use in an active Rundown.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Id of the Studio to delete
	 */
	deleteStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Send an action to a studio.
	 *
	 * Throws if the requested studio does not exits.
	 * Throws if the action is not valid for the requested studio.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Studio to target
	 * @param action Action to perform
	 */
	studioAction(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		action: StudioAction
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Fetches all of the peripheral devices attached to a studio.
	 *
	 * Throws if the requested Studio does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Studio to fetch devices for
	 */
	getPeripheralDevicesForStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>>
	/**
	 * Assigns a device to a studio.
	 *
	 * Throws if the device is already attached to a studio.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Studio to attach to
	 * @param deviceId Device to attach
	 * @param configId Id of the studio owned configuration to assign to the device. If not set, one will be created.
	 */
	attachDeviceToStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		deviceId: PeripheralDeviceId,
		configId: string | undefined
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Detaches a device from a studio.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Studio to detach from
	 * @param deviceId Device to detach
	 */
	detachDeviceFromStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		deviceId: PeripheralDeviceId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Sets a route set to the described state
	 *
	 * Throws if specified studioId does not exist
	 * Throws if specified route set does not exist
	 * Throws if `state` is `false` and the specified route set cannot be deactivated.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Studio to target
	 * @param routeSetId Route set within studio
	 * @param state Whether state should be set to active (true) or inactive (false)
	 */
	switchRouteSet(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		routeSetId: string,
		state: boolean
	): Promise<ClientAPI.ClientResponse<void>>
}

export enum StudioActionType {
	BLUEPRINT_UPGRADE = 'blueprint_upgrade',
}

export interface StudioActionBase {
	type: StudioActionType
}

export interface StudioActionBlueprintUpgrade extends StudioActionBase {
	type: StudioActionType.BLUEPRINT_UPGRADE
}

export type StudioAction = StudioActionBlueprintUpgrade

export interface APIStudio {
	name: string
	blueprintId?: string
	blueprintConfigPresetId?: string
	supportedShowStyleBase?: string[]
	config: object
	settings: APIStudioSettings
}

export interface APIStudioSettings {
	frameRate: number
	mediaPreviewsUrl: string
	slackEvaluationUrls?: string[]
	supportedMediaFormats?: string[]
	supportedAudioStreams?: string[]
	enablePlayFromAnywhere?: boolean
	forceMultiGatewayMode?: boolean
	multiGatewayNowSafeLatency?: number
	allowRundownResetOnAir?: boolean
	preserveOrphanedSegmentPositionInRundown?: boolean
	enableQuickLoop?: boolean
	forceQuickLoopAutoNext?: 'disabled' | 'enabled_when_valid_duration' | 'enabled_forcing_min_duration'
	minimumTakeSpan?: number
	fallbackPartDuration?: number
	enableUserEdits?: boolean
	allowAdlibTestingSegment?: boolean
	allowTestingAdlibsToPersist?: boolean
	allowHold?: boolean
	allowPieceDirectPlay?: boolean
	enableBuckets?: boolean
	enableEvaluationForm?: boolean
	mockPieceContentStatus?: boolean
	rundownGlobalPiecesPrepareTime?: number
}
