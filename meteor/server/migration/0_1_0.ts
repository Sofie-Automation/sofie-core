import { addMigrationSteps } from './databaseMigration'
import { logger } from '../logging'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ShowStyleBases, ShowStyleVariants, Studios } from '../collections'
import { DEFAULT_MINIMUM_TAKE_SPAN } from '@sofie-automation/shared-lib/dist/core/constants'

/**
 * This file contains system specific migration steps.
 * These files are combined with / overridden by migration steps defined in the blueprints.
 */

// 0.1.0: These are the "base" migration steps, setting up a default system
export const addSteps = addMigrationSteps('0.1.0', [
	{
		id: 'studio exists',
		canBeRunAutomatically: true,
		validate: async () => {
			const count = await Studios.countDocuments()
			if (count === 0) return 'No Studio found'
			return false
		},
		migrate: async () => {
			// create default studio
			logger.info(`Migration: Add default studio`)
			await Studios.insertAsync({
				_id: protectString('studio0'),
				name: 'Default studio',
				supportedShowStyleBase: [],
				settingsWithOverrides: wrapDefaultObject({
					frameRate: 25,
					mediaPreviewsUrl: '',
					minimumTakeSpan: DEFAULT_MINIMUM_TAKE_SPAN,
					allowHold: false,
					allowPieceDirectPlay: false,
					enableBuckets: true,
					enableEvaluationForm: true,
				}),
				mappingsWithOverrides: wrapDefaultObject({}),
				blueprintConfigWithOverrides: wrapDefaultObject({}),
				_rundownVersionHash: '',
				routeSetsWithOverrides: wrapDefaultObject({}),
				routeSetExclusivityGroupsWithOverrides: wrapDefaultObject({}),
				packageContainersWithOverrides: wrapDefaultObject({}),
				packageContainerSettingsWithOverrides: wrapDefaultObject({
					thumbnailContainerIds: [],
					previewContainerIds: [],
				}),
				peripheralDeviceSettings: {
					deviceSettings: wrapDefaultObject({}),
					playoutDevices: wrapDefaultObject({}),
					ingestDevices: wrapDefaultObject({}),
					inputDevices: wrapDefaultObject({}),
				},
				lastBlueprintConfig: undefined,
				lastBlueprintFixUpHash: undefined,
			})
		},
	},

	{
		// Create showStyleBase (migrate from studio)
		id: 'showStyleBase exists',
		canBeRunAutomatically: true,
		dependOnResultFrom: 'studio exists',
		validate: async () => {
			const count = await ShowStyleBases.countDocuments()
			if (count === 0) return 'No ShowStyleBase found'
			return false
		},
		migrate: async () => {
			// maybe copy from studio?
			const studios = await Studios.findFetchAsync({})
			if (studios.length === 1) {
				const studio = studios[0]

				const id = protectString('show0')
				await ShowStyleBases.insertAsync({
					_id: id,
					name: 'Default ShowStyle',
					blueprintId: protectString(''),
					outputLayersWithOverrides: wrapDefaultObject({}),
					sourceLayersWithOverrides: wrapDefaultObject({}),
					hotkeyLegend: [],
					blueprintConfigWithOverrides: wrapDefaultObject({}),
					_rundownVersionHash: '',
					lastBlueprintConfig: undefined,
					lastBlueprintFixUpHash: undefined,
				})

				const variantId: ShowStyleVariantId = getRandomId()
				await ShowStyleVariants.insertAsync({
					_id: variantId,
					name: 'Default Variant',
					showStyleBaseId: id,
					blueprintConfigWithOverrides: wrapDefaultObject({}),
					_rundownVersionHash: '',
					_rank: 0,
				})

				if (!studio.supportedShowStyleBase || studio.supportedShowStyleBase.length === 0) {
					await Studios.updateAsync(studio._id, {
						$set: {
							supportedShowStyleBase: [id],
						},
					})
				}
			} else {
				// create default ShowStyleBase:
				logger.info(`Migration: Add default ShowStyleBase`)

				const id = protectString('show0')
				await ShowStyleBases.insertAsync({
					_id: id,
					name: 'Default ShowStyle',
					blueprintId: protectString(''),
					outputLayersWithOverrides: wrapDefaultObject({}),
					sourceLayersWithOverrides: wrapDefaultObject({}),
					blueprintConfigWithOverrides: wrapDefaultObject({}),
					_rundownVersionHash: '',
					lastBlueprintConfig: undefined,
					lastBlueprintFixUpHash: undefined,
				})

				await ShowStyleVariants.insertAsync({
					_id: getRandomId(),
					name: 'Default Variant',
					showStyleBaseId: id,
					blueprintConfigWithOverrides: wrapDefaultObject({}),
					_rundownVersionHash: '',
					_rank: 0,
				})
			}
		},
	},
])
