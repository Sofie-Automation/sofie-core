import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor } from 'meteor/meteor'

/* *************************************************************************
This file contains types and interfaces that are used by the REST API.
When making changes to these types, you should be aware of any breaking changes
and update packages/openapi accordingly if needed.
************************************************************************* */

export interface DevicesRestAPI {
	/**
	 * Gets all devices attached to Sofie.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	getPeripheralDevices(
		connection: Meteor.Connection,
		event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>>
	/**
	 * Get a specific device.
	 *
	 * Throws if the requested device does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param deviceId Device to get
	 */
	getPeripheralDevice(
		connection: Meteor.Connection,
		event: string,
		deviceId: PeripheralDeviceId
	): Promise<ClientAPI.ClientResponse<APIPeripheralDevice>>
	/**
	 * Send an action to a device.
	 *
	 * Throws if the requested device does not exits.
	 * Throws if the action is not valid for the requested device.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param deviceId Device to target
	 * @param action Action to perform
	 */
	peripheralDeviceAction(
		connection: Meteor.Connection,
		event: string,
		deviceId: PeripheralDeviceId,
		action: PeripheralDeviceAction
	): Promise<ClientAPI.ClientResponse<void>>
}

// This interface should be auto-generated in future
export interface APIPeripheralDevice {
	id: string
	name: string
	status: 'unknown' | 'good' | 'warning_major' | 'marning_minor' | 'bad' | 'fatal'
	messages: string[]
	deviceType: 'unknown' | 'mos' | 'spreadsheet' | 'inews' | 'playout' | 'package_manager' | 'live_status' | 'input'
	connected: boolean
}

export enum PeripheralDeviceActionType {
	RESTART = 'restart',
}

export interface PeripheralDeviceActionBase {
	type: PeripheralDeviceActionType
}

export interface PeripheralDeviceActionRestart extends PeripheralDeviceActionBase {
	type: PeripheralDeviceActionType.RESTART
}

export type PeripheralDeviceAction = PeripheralDeviceActionRestart
