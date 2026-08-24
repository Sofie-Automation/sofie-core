import '../../../__mocks__/_extendJest'
import { StatusCode } from '@sofie-automation/blueprints-integration'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { PeripheralDeviceStatusObject } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { PeripheralDeviceAPIMethods } from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'
import { makeMeteorCallForTest } from '../../../__mocks__/helpers/methods'
import {
	DefaultEnvironment,
	setupDefaultStudioEnvironment,
	setupMockStudioBlueprintWithDeviceStatusMessages,
} from '../../../__mocks__/helpers/database'
import { PeripheralDevices, Studios } from '../../collections'
import { ServerPeripheralDeviceAPIClass } from '../peripheralDevice'

const MeteorCall = makeMeteorCallForTest({
	methods: PeripheralDeviceAPIMethods,
	class: ServerPeripheralDeviceAPIClass,
})

const STATUS_CODE_OFFLINE = 'DEVICE_MOCK_OFFLINE'
const STATUS_CODE_NOISY = 'DEVICE_MOCK_NOISY'

/** A status as sent by a device built against an older server-core-integration */
function legacyDeviceStatus(statusCode: StatusCode, messages: string[]): PeripheralDeviceStatusObject {
	return { statusCode, messages } as unknown as PeripheralDeviceStatusObject
}

describe('peripheralDevice setStatus', () => {
	let env: DefaultEnvironment
	let device: PeripheralDevice

	beforeEach(async () => {
		env = await setupDefaultStudioEnvironment()
		device = env.ingestDevice
	})

	async function setStatus(status: PeripheralDeviceStatusObject) {
		await MeteorCall.peripheralDevice.setStatus(device._id, device.token, status)
	}
	async function getStoredStatus() {
		return ((await PeripheralDevices.findOneAsync(device._id)) as PeripheralDevice).status
	}
	/** Point the studio at a blueprint which customises the given status codes */
	async function useBlueprintWithDeviceStatusMessages(deviceStatusMessages: Record<string, string>) {
		const blueprint = await setupMockStudioBlueprintWithDeviceStatusMessages(
			env.showStyleBaseId,
			deviceStatusMessages
		)
		await Studios.updateAsync(env.studio._id, { $set: { blueprintId: blueprint._id } })
	}

	describe('normalising what the device sent', () => {
		test('stores statusDetails as sent', async () => {
			await setStatus({
				statusCode: StatusCode.WARNING_MINOR,
				statusDetails: [{ message: 'Something is off' }, { message: 'And another thing' }],
			})

			expect(await getStoredStatus()).toEqual({
				statusCode: StatusCode.WARNING_MINOR,
				statusDetails: [{ message: 'Something is off' }, { message: 'And another thing' }],
			})
		})

		test('converts a legacy messages array into statusDetails', async () => {
			await setStatus(legacyDeviceStatus(StatusCode.BAD, ['Not enough workers', 'Expectation failed']))

			expect(await getStoredStatus()).toEqual({
				statusCode: StatusCode.BAD,
				statusDetails: [{ message: 'Not enough workers' }, { message: 'Expectation failed' }],
			})
		})

		test('converts a legacy messages array when statusDetails is empty', async () => {
			await setStatus({
				statusCode: StatusCode.BAD,
				statusDetails: [],
				messages: ['Not enough workers'],
			} as unknown as PeripheralDeviceStatusObject)

			expect(await getStoredStatus()).toEqual({
				statusCode: StatusCode.BAD,
				statusDetails: [{ message: 'Not enough workers' }],
			})
		})

		test('never stores a messages property', async () => {
			await setStatus(legacyDeviceStatus(StatusCode.BAD, ['Not enough workers']))

			expect(await getStoredStatus()).not.toHaveProperty('messages')
		})

		test('stores an empty statusDetails when the device sends neither', async () => {
			await setStatus({ statusCode: StatusCode.GOOD } as PeripheralDeviceStatusObject)

			expect(await getStoredStatus()).toEqual({
				statusCode: StatusCode.GOOD,
				statusDetails: [],
			})
		})

		test('rejects a statusDetails which is not an array of details', async () => {
			// Without validation this is stored as-is, and every reader of statusDetails then throws:
			await expect(
				setStatus({
					statusCode: StatusCode.BAD,
					statusDetails: 'not an array',
				} as unknown as PeripheralDeviceStatusObject)
			).rejects.toThrow(/Match error/)

			expect(await getStoredStatus()).toEqual({ statusCode: StatusCode.GOOD, statusDetails: [] })
		})

		test('rejects a legacy messages which is not an array of strings', async () => {
			await expect(
				setStatus(legacyDeviceStatus(StatusCode.BAD, 'not an array' as unknown as string[]))
			).rejects.toThrow(/Match error/)
		})

		test('does not write when an unchanged status is reported again', async () => {
			await setStatus(legacyDeviceStatus(StatusCode.BAD, ['Not enough workers']))

			const updateSpy = jest.spyOn(PeripheralDevices, 'updateAsync')
			try {
				await setStatus(legacyDeviceStatus(StatusCode.BAD, ['Not enough workers']))

				// Already connected with this exact status, so there is nothing to write:
				expect(updateSpy).not.toHaveBeenCalled()
			} finally {
				updateSpy.mockRestore()
			}
		})
	})

	describe('blueprint resolution', () => {
		test('rewrites the message of a detail the blueprint recognises', async () => {
			await useBlueprintWithDeviceStatusMessages({
				[STATUS_CODE_OFFLINE]: '{{deviceName}} cannot be reached on {{host}}',
			})

			await setStatus({
				statusCode: StatusCode.BAD,
				statusDetails: [
					{ code: STATUS_CODE_OFFLINE, context: { host: '10.0.0.1' }, message: 'Mock device disconnected' },
				],
			})

			const status = await getStoredStatus()
			expect(status.statusDetails).toHaveLength(1)
			expect(status.statusDetails[0].message).toBe(`${device.name} cannot be reached on 10.0.0.1`)
			// The code and context are kept, so consumers can re-render it:
			expect(status.statusDetails[0].code).toBe(STATUS_CODE_OFFLINE)
			expect(status.statusDetails[0].context).toMatchObject({ host: '10.0.0.1' })
		})

		test('survives a blueprint message containing quote, backslash and dollar', async () => {
			// The mock helper embeds these templates in generated source, so they must survive that round trip:
			const awkward = "it's a \\ backslash and a $dollar"
			await useBlueprintWithDeviceStatusMessages({ [STATUS_CODE_OFFLINE]: awkward })

			await setStatus({
				statusCode: StatusCode.BAD,
				statusDetails: [{ code: STATUS_CODE_OFFLINE, context: {}, message: 'Mock device disconnected' }],
			})

			expect((await getStoredStatus()).statusDetails[0].message).toBe(awkward)
		})

		test('drops a detail whose message the blueprint suppresses', async () => {
			// An empty template suppresses that status code:
			await useBlueprintWithDeviceStatusMessages({
				[STATUS_CODE_NOISY]: '',
				[STATUS_CODE_OFFLINE]: '{{deviceName}} cannot be reached',
			})

			await setStatus({
				statusCode: StatusCode.BAD,
				statusDetails: [
					{ code: STATUS_CODE_NOISY, context: {}, message: 'Noisy thing happened' },
					{ code: STATUS_CODE_OFFLINE, context: {}, message: 'Mock device disconnected' },
				],
			})

			expect((await getStoredStatus()).statusDetails).toEqual([
				expect.objectContaining({ code: STATUS_CODE_OFFLINE, message: `${device.name} cannot be reached` }),
			])
		})

		test('leaves a detail without a code alone', async () => {
			await useBlueprintWithDeviceStatusMessages({
				[STATUS_CODE_OFFLINE]: '{{deviceName}} cannot be reached',
			})

			await setStatus({
				statusCode: StatusCode.BAD,
				statusDetails: [{ message: 'Something the blueprint knows nothing about' }],
			})

			expect((await getStoredStatus()).statusDetails).toEqual([
				{ message: 'Something the blueprint knows nothing about' },
			])
		})

		test('leaves a detail whose code the blueprint does not customise alone', async () => {
			await useBlueprintWithDeviceStatusMessages({
				[STATUS_CODE_OFFLINE]: '{{deviceName}} cannot be reached',
			})

			await setStatus({
				statusCode: StatusCode.BAD,
				statusDetails: [{ code: 'DEVICE_MOCK_SOMETHING_ELSE', context: {}, message: 'Pre-rendered message' }],
			})

			expect((await getStoredStatus()).statusDetails[0].message).toBe('Pre-rendered message')
		})

		test('keeps the pre-rendered message when the device has no studio', async () => {
			await useBlueprintWithDeviceStatusMessages({
				[STATUS_CODE_OFFLINE]: '{{deviceName}} cannot be reached',
			})
			await PeripheralDevices.mutableCollection.updateAsync(device._id, {
				$unset: { studioAndConfigId: 1 },
			})

			await setStatus({
				statusCode: StatusCode.BAD,
				statusDetails: [{ code: STATUS_CODE_OFFLINE, context: {}, message: 'Mock device disconnected' }],
			})

			expect((await getStoredStatus()).statusDetails[0].message).toBe('Mock device disconnected')
		})
	})
})
