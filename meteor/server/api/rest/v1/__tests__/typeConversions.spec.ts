import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { buildStudioFromResolved } from '../typeConversion'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { DBStudio, IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IBlueprintConfig, StudioBlueprintManifest } from '@sofie-automation/blueprints-integration'
import { APIStudio } from '../../../../lib/rest/v1'

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
