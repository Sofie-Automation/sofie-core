import { addMigrationSteps } from './databaseMigration'
import { Blueprints, ShowStyleVariants } from '../collections'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'

// Release 49

export const addSteps = addMigrationSteps('1.49.0', [
	{
		id: 'Add missing ranks to ShowStyleVariants',
		canBeRunAutomatically: true,
		validate: async () => {
			return (
				(await ShowStyleVariants.countDocuments({
					_rank: { $exists: false },
				})) > 0
			)
		},
		migrate: async () => {
			// This version introduces ShowStyleVariant sorting, this means we need to create them now
			const variants = await ShowStyleVariants.findFetchAsync({
				_rank: { $exists: false },
			})

			for (let i = 0; i < variants.length; i++) {
				const variant = variants[i]

				await ShowStyleVariants.updateAsync(variant._id, {
					$set: {
						_rank: i,
					},
				})
			}
		},
	},

	{
		id: `Blueprints ensure blueprintHash is set`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await Blueprints.countDocuments({ blueprintHash: { $exists: false } })
			if (objects > 0) {
				return `object needs to be converted`
			}
			return false
		},
		migrate: async () => {
			const objects = await Blueprints.findFetchAsync({ blueprintHash: { $exists: false } })
			for (const obj of objects) {
				await Blueprints.updateAsync(obj._id, {
					$set: {
						blueprintHash: getRandomString(),
					},
				})
			}
		},
	},
])
