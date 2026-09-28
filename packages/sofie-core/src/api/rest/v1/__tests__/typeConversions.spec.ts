import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { APIPeripheralDeviceFrom, buildStudioFromResolved } from '../typeConversion'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { DBStudio, IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IBlueprintConfig, StudioBlueprintManifest } from '@sofie-automation/blueprints-integration'
import { APIStudio } from '../../../../lib/rest/v1'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { StatusCode } from '@sofie-automation/blueprints-integration'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'

describe('buildStudioFromResolved', () => {
	test('preserves existing fields and overrides API ones', async () => {
		const blueprintManifest = {} as unknown as StudioBlueprintManifest
		const apiStudio = {
			name: 'New Name',
			settings: { frameRate: 25 } as IStudioSettings,
			config: { someValue: 1 },
			supportedShowStyleBase: ['A'],
		} as APIStudio
		const existingStudio = {
			_id: protectString<StudioId>('studio0'),
			name: 'Studio 0',
			settingsWithOverrides: wrapDefaultObject({ frameRate: 50, allowHold: true } as IStudioSettings),
			blueprintConfigWithOverrides: wrapDefaultObject({ B: 0 } as IBlueprintConfig),
		} as DBStudio
		const studio = await buildStudioFromResolved({
			apiStudio,
			existingStudio,
			blueprintManifest,
			blueprintId: protectString('bp1'),
			studioId: protectString('studio0'),
		})

		expect(studio._id).toBe('studio0')
		expect(studio.name).toBe('New Name')
		expect(studio.blueprintId).toBe('bp1')
		expect(studio.settingsWithOverrides.overrides).toContainEqual({
			op: 'set',
			path: 'frameRate',
			value: 25,
		})
		expect(studio.blueprintConfigWithOverrides.overrides).toContainEqual({
			op: 'set',
			path: 'someValue',
			value: 1,
		})
	})
	test('preserves existing fields and overrides API ones with blueprintConfigFromAPI defined', async () => {
		const blueprintManifest = { blueprintConfigFromAPI: async () => ({ fromBlueprints: true }) } as any
		const apiStudio = {
			name: 'New Name',
			settings: { frameRate: 25 } as IStudioSettings,
			config: { someValue: 1 },
			supportedShowStyleBase: ['A'],
			blueprintConfigPresetId: 'preset0',
		} as APIStudio
		const existingStudio = {
			_id: protectString<StudioId>('studio0'),
			name: 'Studio 0',
			settingsWithOverrides: wrapDefaultObject({ frameRate: 50 } as IStudioSettings),
			blueprintConfigWithOverrides: wrapDefaultObject({ B: 0 } as IBlueprintConfig),
		} as DBStudio
		const studio = await buildStudioFromResolved({
			apiStudio,
			existingStudio,
			blueprintManifest,
			blueprintId: protectString('bp1'),
			studioId: protectString('studio0'),
		})

		expect(studio._id).toBe('studio0')
		expect(studio.name).toBe('New Name')
		expect(studio.blueprintId).toBe('bp1')
		expect(studio.settingsWithOverrides.overrides).toContainEqual({
			op: 'set',
			path: 'frameRate',
			value: 25,
		})
		expect(studio.blueprintConfigWithOverrides.overrides).toContainEqual({
			op: 'set',
			path: 'fromBlueprints',
			value: true,
		})
	})
})

describe('APIPeripheralDeviceFrom', () => {
	function makeDevice(status: PeripheralDevice['status']): PeripheralDevice {
		return {
			_id: protectString('device0'),
			name: 'Mock device',
			connected: true,
			category: PeripheralDeviceCategory.PLAYOUT,
			type: PeripheralDeviceType.PLAYOUT,
			status,
		} as PeripheralDevice
	}

	test('derives the messages of the API device from statusDetails', () => {
		// `messages` is no longer stored on the device, but the REST API still exposes the human
		// readable half of each status detail under that name:
		const apiDevice = APIPeripheralDeviceFrom(
			makeDevice({
				statusCode: StatusCode.BAD,
				statusDetails: [
					{ code: 'DEVICE_MOCK_OFFLINE', context: { host: '10.0.0.1' }, message: 'Mock device is offline' },
					{ message: 'And another thing' },
				],
			})
		)

		expect(apiDevice.messages).toEqual(['Mock device is offline', 'And another thing'])
		expect(apiDevice.status).toBe('bad')
	})

	test('returns no messages when there are no statusDetails', () => {
		const apiDevice = APIPeripheralDeviceFrom(makeDevice({ statusCode: StatusCode.GOOD, statusDetails: [] }))

		expect(apiDevice.messages).toEqual([])
		expect(apiDevice.status).toBe('good')
	})

	test('returns no messages for a device stored before statusDetails existed', () => {
		// Devices which never reconnected after the upgrade have neither field resolved:
		const apiDevice = APIPeripheralDeviceFrom(
			makeDevice({ statusCode: StatusCode.GOOD } as PeripheralDevice['status'])
		)

		expect(apiDevice.messages).toEqual([])
	})
})
