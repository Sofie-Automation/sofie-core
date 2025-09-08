import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	APIPeripheralDevice,
	DevicesRestAPI,
	PeripheralDeviceActionRestart,
	PeripheralDeviceActionType,
} from '../../../lib/rest/v1'
import { logger } from '../../../logging'
import { APIFactory, APIRegisterHook, ServerAPIContext } from './types'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { check } from '../../../lib/check'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { PeripheralDevices } from '../../../collections'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { APIPeripheralDeviceFrom } from './typeConversion'
import { executePeripheralDeviceFunction } from '../../peripheralDevice/executeFunction'
import { assertNever } from '@sofie-automation/corelib/dist/lib'

class DevicesServerAPI implements DevicesRestAPI {
	async getPeripheralDevices(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>> {
		const peripheralDevices = (await PeripheralDevices.findFetchAsync({}, { projection: { _id: 1 } })) as Array<
			Pick<PeripheralDevice, '_id'>
		>
		return ClientAPI.responseSuccess(peripheralDevices.map((p) => ({ id: unprotectString(p._id) })))
	}

	async getPeripheralDevice(
		_connection: Meteor.Connection,
		_event: string,
		deviceId: PeripheralDeviceId
	): Promise<ClientAPI.ClientResponse<APIPeripheralDevice>> {
		const device = await PeripheralDevices.findOneAsync(deviceId)
		if (!device)
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Device ${deviceId} does not exist`),
					UserErrorMessage.PeripheralDeviceNotFound,
					undefined,
					404
				)
			)
		return ClientAPI.responseSuccess(APIPeripheralDeviceFrom(device))
	}

	async peripheralDeviceAction(
		_connection: Meteor.Connection,
		_event: string,
		deviceId: PeripheralDeviceId,
		action: PeripheralDeviceActionRestart
	): Promise<ClientAPI.ClientResponse<void>> {
		const device = await PeripheralDevices.findOneAsync(deviceId)
		if (!device)
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Device ${deviceId} does not exist`),
					UserErrorMessage.PeripheralDeviceNotFound,
					undefined,
					404
				)
			)

		switch (action.type) {
			case PeripheralDeviceActionType.RESTART:
				// This dispatches the command but does not wait for it to complete
				await executePeripheralDeviceFunction(deviceId, 'killProcess', 1).catch(logger.error)
				break
			default:
				assertNever(action.type)
		}

		return ClientAPI.responseSuccess(undefined, 202)
	}
}

class DevicesAPIFactory implements APIFactory<DevicesRestAPI> {
	createServerAPI(_context: ServerAPIContext): DevicesRestAPI {
		return new DevicesServerAPI()
	}
}

export function registerRoutes(registerRoute: APIRegisterHook<DevicesRestAPI>): void {
	const devicesAPIFactory = new DevicesAPIFactory()

	registerRoute<never, never, Array<{ id: string }>>(
		'get',
		'/devices',
		new Map(),
		devicesAPIFactory,
		async (serverAPI, connection, event, _params, _body) => {
			logger.info(`API GET: peripheral devices`)
			return await serverAPI.getPeripheralDevices(connection, event)
		}
	)

	registerRoute<{ deviceId: string }, never, APIPeripheralDevice>(
		'get',
		'/devices/:deviceId',
		new Map(),
		devicesAPIFactory,
		async (serverAPI, connection, event, params, _) => {
			const deviceId = protectString<PeripheralDeviceId>(params.deviceId)
			logger.info(`API GET: peripheral device ${deviceId}`)

			check(deviceId, String)
			return await serverAPI.getPeripheralDevice(connection, event, deviceId)
		}
	)

	registerRoute<{ deviceId: string }, { action: string }, void>(
		'post',
		'/devices/:deviceId/action',
		new Map(),
		devicesAPIFactory,
		async (serverAPI, connection, event, params, body) => {
			const deviceId = protectString<PeripheralDeviceId>(params.deviceId)
			logger.info(`API POST: peripheral device ${deviceId} action ${body.action}`)

			check(deviceId, String)
			check(body.action, String)
			const peripheralAction = { type: body.action as PeripheralDeviceActionType }
			return await serverAPI.peripheralDeviceAction(connection, event, deviceId, peripheralAction)
		}
	)
}
