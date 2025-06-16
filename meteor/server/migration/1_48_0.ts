import { addMigrationSteps } from './databaseMigration'
import { TranslationsBundle } from '@sofie-automation/meteor-lib/dist/collections/TranslationsBundles'
import { generateTranslationBundleOriginId } from '../api/translationsBundles'
import { BlueprintId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { TranslationsBundles } from '../collections'

// Release 48

export const addSteps = addMigrationSteps('1.48.0', [
	{
		id: `TranslationBundles originId`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await TranslationsBundles.countDocuments({
				blueprintOriginId: { $exists: true },
			})
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await TranslationsBundles.findFetchAsync({
				blueprintOriginId: { $exists: true },
			})
			for (const obj0 of objects) {
				const obj = obj0 as TranslationsBundle & { blueprintOriginId: BlueprintId }
				const id = generateTranslationBundleOriginId(obj.blueprintOriginId, 'blueprints')
				await TranslationsBundles.updateAsync(obj._id, {
					$set: {
						originId: id,
						namespace: unprotectString(id),
					},
					$unset: {
						blueprintOriginId: 1,
					},
				})
			}
		},
	},
])
