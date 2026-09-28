import { Parts } from '../collections'
import { addMigrationSteps } from './databaseMigration'

// Release 39
export const addSteps = addMigrationSteps('1.39.0', [
	{
		id: `Parts.expectedDurationWithTransition`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objects = await Parts.countDocuments({
				expectedDuration: {
					$exists: true,
				},
				expectedDurationWithTransition: {
					$exists: false,
				},
			})
			if (objects > 0) {
				return `timing is expectedDurationWithTransition on ${objects} objects`
			}
			return false
		},
		migrate: async () => {
			const objects = await Parts.findFetchAsync({
				expectedDuration: {
					$exists: true,
				},
				expectedDurationWithTransition: {
					$exists: false,
				},
			})
			for (const obj of objects) {
				await Parts.mutableCollection.updateAsync(obj._id, {
					$set: {
						expectedDurationWithTransition: obj.expectedDuration,
					},
				})
			}
		},
	},
])
