import { addMigrationSteps } from './databaseMigration'
import { DBStudio, MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { DBShowStyleBase, OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBBlueprintTrigger, TriggeredActionsObj } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { getRandomString, normalizeArray } from '@sofie-automation/corelib/dist/lib'
import { IBlueprintConfig, IOutputLayer, ISourceLayer, SomeAction } from '@sofie-automation/blueprints-integration'
import { ShowStyleBases, ShowStyleVariants, Studios, TriggeredActions } from '../collections'

// Release 47
interface StudioOld {
	mappings: MappingsExt
	blueprintConfig: IBlueprintConfig
}
interface ShowStyleBaseOld {
	blueprintConfig: IBlueprintConfig
	outputLayers: IOutputLayer[]
	sourceLayers: ISourceLayer[]
}
interface ShowStyleVariantOld {
	blueprintConfig: IBlueprintConfig
}
interface TriggeredActionsOld {
	triggers: DBBlueprintTrigger[]
	actions: SomeAction[]
}

function normalizeArrayRandomId<T>(array: Array<T>): { [indexKey: string]: T } {
	const normalizedObject: any = {}
	for (const obj of array) {
		normalizedObject[getRandomString()] = obj
	}
	return normalizedObject as { [key: string]: T }
}

export const addSteps = addMigrationSteps('1.47.0', [
	{
		id: `Studios generate *withOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await Studios.countDocuments({
				$or: [
					{ blueprintConfigWithOverrides: { $exists: false } },
					{ mappingsWithOverrides: { $exists: false } },
				],
			})
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await Studios.findFetchAsync({
				$or: [
					{ blueprintConfigWithOverrides: { $exists: false } },
					{ mappingsWithOverrides: { $exists: false } },
				],
			})
			for (const obj0 of objects) {
				const obj = obj0 as unknown as DBStudio & StudioOld
				await Studios.updateAsync(obj._id, {
					$set: {
						blueprintConfigWithOverrides:
							obj.blueprintConfigWithOverrides ??
							wrapDefaultObject<IBlueprintConfig>(obj.blueprintConfig),
						mappingsWithOverrides:
							obj.mappingsWithOverrides ?? wrapDefaultObject<MappingsExt>(obj.mappings),
					},
					// Old properties removed by later migration
				})
			}
		},
	},
	{
		id: `ShowStyleVariants generate *withOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await ShowStyleVariants.countDocuments({
				blueprintConfigWithOverrides: { $exists: false },
			})
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await ShowStyleVariants.findFetchAsync({
				blueprintConfigWithOverrides: { $exists: false },
			})
			for (const obj0 of objects) {
				const obj = obj0 as unknown as DBShowStyleVariant & ShowStyleVariantOld
				await ShowStyleVariants.updateAsync(obj._id, {
					$set: {
						blueprintConfigWithOverrides:
							obj.blueprintConfigWithOverrides ??
							wrapDefaultObject<IBlueprintConfig>(obj.blueprintConfig),
					},
					// Old properties removed by later migration
				})
			}
		},
	},
	{
		id: `ShowStyleBases generate *withOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await ShowStyleBases.countDocuments({
				$or: [
					{ blueprintConfigWithOverrides: { $exists: false } },
					{ sourceLayersWithOverrides: { $exists: false } },
					{ outputLayersWithOverrides: { $exists: false } },
				],
			})
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await ShowStyleBases.findFetchAsync({
				$or: [
					{ blueprintConfigWithOverrides: { $exists: false } },
					{ sourceLayersWithOverrides: { $exists: false } },
					{ outputLayersWithOverrides: { $exists: false } },
				],
			})
			for (const obj0 of objects) {
				const obj = obj0 as unknown as DBShowStyleBase & ShowStyleBaseOld
				await ShowStyleBases.updateAsync(obj._id, {
					$set: {
						blueprintConfigWithOverrides:
							obj.blueprintConfigWithOverrides ??
							wrapDefaultObject<IBlueprintConfig>(obj.blueprintConfig),
						sourceLayersWithOverrides:
							obj.sourceLayersWithOverrides ??
							wrapDefaultObject<SourceLayers>(normalizeArray(obj.sourceLayers, '_id')),
						outputLayersWithOverrides:
							obj.outputLayersWithOverrides ??
							wrapDefaultObject<OutputLayers>(normalizeArray(obj.outputLayers, '_id')),
					},
					// Old properties removed by later migration
				})
			}
		},
	},
	{
		id: `TriggeredActions generate *withOverrides`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await TriggeredActions.countDocuments({
				$or: [{ triggersWithOverrides: { $exists: false } }, { actionsWithOverrides: { $exists: false } }],
			})
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await TriggeredActions.findFetchAsync({
				$or: [{ triggersWithOverrides: { $exists: false } }, { actionsWithOverrides: { $exists: false } }],
			})
			for (const obj0 of objects) {
				const obj = obj0 as unknown as TriggeredActionsObj & TriggeredActionsOld

				await TriggeredActions.updateAsync(obj._id, {
					$set: {
						triggersWithOverrides:
							obj.triggersWithOverrides ??
							wrapDefaultObject<Record<string, DBBlueprintTrigger>>(normalizeArrayRandomId(obj.triggers)),
						actionsWithOverrides:
							obj.actionsWithOverrides ??
							wrapDefaultObject<Record<string, SomeAction>>(normalizeArrayRandomId(obj.actions)),
					},
					// Old properties removed by later migration
				})
			}
		},
	},

	{
		id: `Studios remove pre *WithOverrides properties`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await Studios.countDocuments({
				$or: [{ blueprintConfig: { $exists: true } }, { mappings: { $exists: true } }],
			})
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await Studios.findFetchAsync({
				$or: [{ blueprintConfig: { $exists: true } }, { mappings: { $exists: true } }],
			})
			for (const obj0 of objects) {
				const obj = obj0 as unknown as DBStudio & StudioOld
				await Studios.updateAsync(obj._id, {
					$unset: {
						blueprintConfig: 1,
						mappings: 1,
					},
				})
			}
		},
	},
	{
		id: `ShowStyleVariants remove pre *withOverrides properties`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await ShowStyleVariants.countDocuments({
				blueprintConfig: { $exists: true },
			})
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await ShowStyleVariants.findFetchAsync({
				blueprintConfig: { $exists: true },
			})
			for (const obj0 of objects) {
				const obj = obj0 as unknown as DBShowStyleVariant & ShowStyleVariantOld
				await ShowStyleVariants.updateAsync(obj._id, {
					$unset: {
						blueprintConfig: 1,
					},
				})
			}
		},
	},
	{
		id: `ShowStyleBases remove pre *withOverrides properties`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await ShowStyleBases.countDocuments({
				$or: [
					{ blueprintConfig: { $exists: true } },
					{ sourceLayers: { $exists: true } },
					{ outputLayers: { $exists: true } },
				],
			})
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await ShowStyleBases.findFetchAsync({
				$or: [
					{ blueprintConfig: { $exists: true } },
					{ sourceLayers: { $exists: true } },
					{ outputLayers: { $exists: true } },
				],
			})
			for (const obj0 of objects) {
				const obj = obj0 as unknown as DBShowStyleBase & ShowStyleBaseOld
				await ShowStyleBases.updateAsync(obj._id, {
					$unset: {
						blueprintConfig: 1,
						sourceLayers: 1,
						outputLayers: 1,
					},
				})
			}
		},
	},
	{
		id: `TriggeredActions remove pre *withOverrides properties`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await TriggeredActions.countDocuments({
				$or: [{ triggers: { $exists: true } }, { actions: { $exists: true } }],
			})
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await TriggeredActions.findFetchAsync({
				$or: [{ triggers: { $exists: true } }, { actions: { $exists: true } }],
			})
			for (const obj0 of objects) {
				const obj = obj0 as unknown as TriggeredActionsObj & TriggeredActionsOld

				await TriggeredActions.updateAsync(obj._id, {
					$unset: {
						triggers: 1,
						actions: 1,
					},
				})
			}
		},
	},
])
