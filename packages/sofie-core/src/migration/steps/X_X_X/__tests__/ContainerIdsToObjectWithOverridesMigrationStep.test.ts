import { setupEmptyEnvironment, setupMockStudio } from '../../../../__mocks__/helpers/database'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Studios } from '../../../../collections'
import { ContainerIdsToObjectWithOverridesMigrationStep } from '../ContainerIdsToObjectWithOverridesMigrationStep'

describe('ContainerIdsToObjectWithOverridesMigrationStep', () => {
	beforeEach(async () => {
		await setupEmptyEnvironment()
	})

	test('migration is needed when studio is missing packageContainerSettingsWithOverrides', async () => {
		await setupMockStudio({
			_id: protectString<StudioId>('studio0'),
			// @ts-expect-error
			previewContainerIds: ['preview1'],
			thumbnailContainerIds: ['thumb1'],
			packageContainerSettingsWithOverrides: undefined as any,
		})

		const step = new ContainerIdsToObjectWithOverridesMigrationStep()
		const validateResult = await step.validate()
		expect(validateResult).toBe(
			'previewContainerIds and thumbnailContainerIds must be converted to an ObjectWithOverrides'
		)

		await step.migrate()

		const studio = await Studios.findOneAsync(protectString<StudioId>('studio0'))
		expect(studio).toBeTruthy()
		expect(studio?.packageContainerSettingsWithOverrides).toMatchObject({
			defaults: {
				previewContainerIds: [],
				thumbnailContainerIds: [],
			},
			overrides: [
				{ op: 'set', path: 'previewContainerIds', value: ['preview1'] },
				{ op: 'set', path: 'thumbnailContainerIds', value: ['thumb1'] },
			],
		})
		// @ts-expect-error
		expect(studio?.previewContainerIds).toBeUndefined()
		// @ts-expect-error
		expect(studio?.thumbnailContainerIds).toBeUndefined()

		const validateResultAfter = await step.validate()
		expect(validateResultAfter).toBe(false)
	})

	test('migration handles missing optional old fields', async () => {
		await setupMockStudio({
			_id: protectString<StudioId>('studio1'),
			packageContainerSettingsWithOverrides: undefined as any,
		})

		const step = new ContainerIdsToObjectWithOverridesMigrationStep()
		const validateResult = await step.validate()
		expect(validateResult).toBe(
			'previewContainerIds and thumbnailContainerIds must be converted to an ObjectWithOverrides'
		)

		await step.migrate()

		const studio = await Studios.findOneAsync(protectString<StudioId>('studio1'))
		expect(studio).toBeTruthy()
		expect(studio?.packageContainerSettingsWithOverrides).toMatchObject({
			defaults: {
				previewContainerIds: [],
				thumbnailContainerIds: [],
			},
			overrides: [],
		})

		const validateResultAfter = await step.validate()
		expect(validateResultAfter).toBe(false)
	})
})
