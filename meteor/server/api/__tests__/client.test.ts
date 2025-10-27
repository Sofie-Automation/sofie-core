import { Meteor } from 'meteor/meteor'
import { MeteorMock } from '../../../__mocks__/meteor'
import { UserActionsLogItem } from '@sofie-automation/meteor-lib/dist/collections/UserActionsLog'
import { ClientAPIMethods } from '@sofie-automation/meteor-lib/dist/api/client'
import { protectString, LogLevel } from '../../lib/tempLib'
import { PeripheralDeviceCommand } from '@sofie-automation/corelib/dist/dataModel/PeripheralDeviceCommand'
import { setLogLevel } from '../../logging'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { setupMockPeripheralDevice, setupMockStudio } from '../../../__mocks__/helpers/database'
import { MeteorCall } from '../methods'
import { PeripheralDeviceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDeviceCommands, UserActionsLog } from '../../collections'
import { SupressLogMessages } from '../../../__mocks__/suppressLogging'

require('../client') // include in order to create the Meteor methods needed

setLogLevel(LogLevel.INFO)

const orgSetTimeout = setTimeout

describe('ClientAPI', () => {
	let mockDeviceId: PeripheralDeviceId = protectString('not set yet')
	beforeAll(async () => {
		const studio = await setupMockStudio()
		const mockDevice = await setupMockPeripheralDevice(
			PeripheralDeviceCategory.PLAYOUT,
			PeripheralDeviceType.PLAYOUT,
			PERIPHERAL_SUBTYPE_PROCESS,
			studio
		)
		mockDeviceId = mockDevice._id
	})
	describe('clientErrorReport', () => {
		test('Exports a Meteor method to the client', () => {
			expect(MeteorMock.mockMethods[ClientAPIMethods.clientErrorReport]).toBeTruthy()
		})
		test('Returns a success response to the client', async () => {
			SupressLogMessages.suppressLogMessage(/Uncaught error happened in GUI/i)
			// should not throw:
			await MeteorCall.client.clientErrorReport(1000, 'MockString', 'MockLocation')
		})
	})

	describe('callPeripheralDeviceFunction', () => {
		const mockFunctionName = 'mockFunction'
		const mockFailingFunctionName = 'mockFailFunction'
		const mockContext = 'Context description'
		const mockArgs = ['mockArg1', 'mockArg2']

		test('Exports a Meteor method to the client', () => {
			expect(MeteorMock.mockMethods[ClientAPIMethods.callPeripheralDeviceFunction]).toBeTruthy()
		})

		describe('Call a method on the peripheralDevice', () => {
			let logMethodName = `not set yet`
			let promise: Promise<any>
			beforeAll(async () => {
				logMethodName = `${mockDeviceId}: ${mockFunctionName}`
				promise = MeteorCall.client.callPeripheralDeviceFunction(
					mockContext,
					mockDeviceId,
					undefined,
					mockFunctionName,
					...mockArgs
				)
				promise.catch(() => null) // Dismiss uncaught promise warning
				await new Promise((resolve) => orgSetTimeout(resolve, 100))
			})
			test('Logs the call in UserActionsLog', async () => {
				const log = (await UserActionsLog.findOneAsync({
					method: logMethodName,
				})) as UserActionsLogItem
				expect(log).toBeTruthy()

				expect(log.method).toBe(logMethodName)
				expect(log.userId).toBeDefined()
			})

			test('Sends a call to the peripheralDevice', async () => {
				const pdc = (await PeripheralDeviceCommands.findOneAsync({
					deviceId: mockDeviceId,
					functionName: mockFunctionName,
				})) as PeripheralDeviceCommand
				expect(pdc).toBeTruthy()

				expect(pdc.deviceId).toBe(mockDeviceId)
				expect(pdc.functionName).toBe(mockFunctionName)
				expect(pdc.args).toMatchObject(mockArgs)
			})
			test('Resolves the returned promise once a response from the peripheralDevice is received', async () => {
				await PeripheralDeviceCommands.updateAsync(
					{
						deviceId: mockDeviceId,
						functionName: mockFunctionName,
					},
					{
						$set: {
							hasReply: true,
							reply: 'OK',
						},
					},
					{ multi: true }
				)
				return promise.then(async (value) => {
					const log = (await UserActionsLog.findOneAsync({
						method: logMethodName,
					})) as UserActionsLogItem
					expect(log).toBeTruthy()

					expect(log.success).toBe(true)
					expect(log.doneTime).toBeDefined()
					expect(value).toBe('OK')
				})
			})
		})
		describe('Call a failing method on the peripheralDevice', () => {
			let logMethodName = `not set yet`
			let promise: Promise<unknown>
			beforeAll(async () => {
				logMethodName = `${mockDeviceId}: ${mockFailingFunctionName}`

				promise = Meteor.callAsync(
					ClientAPIMethods.callPeripheralDeviceFunction,
					mockContext,
					mockDeviceId,
					undefined,
					mockFailingFunctionName,
					...mockArgs
				)
				promise.catch(() => null) // Dismiss uncaught promise warning

				await new Promise((resolve) => orgSetTimeout(resolve, 100))
			})

			test('Logs the call in UserActionsLog', async () => {
				const log = (await UserActionsLog.findOneAsync({
					method: logMethodName,
				})) as UserActionsLogItem
				expect(log).toBeTruthy()

				expect(log.method).toBe(logMethodName)
				expect(log.userId).toBeDefined()
			})
			test('Sends a call to the peripheralDevice', async () => {
				const pdc = (await PeripheralDeviceCommands.findOneAsync({
					deviceId: mockDeviceId,
					functionName: mockFailingFunctionName,
				})) as PeripheralDeviceCommand
				expect(pdc).toBeTruthy()

				expect(pdc.deviceId).toBe(mockDeviceId)
				expect(pdc.functionName).toBe(mockFailingFunctionName)
				expect(pdc.args).toMatchObject(mockArgs)
			})
			test('Resolves the returned promise once a response from the peripheralDevice is received', async () => {
				SupressLogMessages.suppressLogMessage(/Failed/i)
				SupressLogMessages.suppressLogMessage(/Failed/i)
				await PeripheralDeviceCommands.updateAsync(
					{
						deviceId: mockDeviceId,
						functionName: mockFailingFunctionName,
					},
					{
						$set: {
							hasReply: true,
							replyError: 'Failed',
						},
					},
					{ multi: true }
				)

				// This will probably resolve after around 3s, since that is the timeout time
				// of checkReply and the observeChanges is not implemented in the mock
				await expect(promise).rejects.toThrow(/Failed/)

				const log = (await UserActionsLog.findOneAsync({
					method: logMethodName,
				})) as UserActionsLogItem
				expect(log).toBeTruthy()

				expect(log.success).toBe(false)
				expect(log.doneTime).toBeDefined()
			})
		})
	})
})
