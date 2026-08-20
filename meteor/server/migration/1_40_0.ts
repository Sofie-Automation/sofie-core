import { addMigrationSteps } from './databaseMigration'
import { Studios } from '../collections'

// Release 40 (Skipped)

/**
 * Prior to 1.40.0, various settings were defined globally in `Meteor.settings.public` instead of per Studio.
 * That is no longer readable, so any Studio missing a value gets the documented default instead.
 */
const DEFAULT_FRAME_RATE = 25

export const addSteps = addMigrationSteps('1.40.0', [
	{
		id: `Studio.settings.frameRate`,
		canBeRunAutomatically: true,
		validate: async () => {
			const count = await Studios.countDocuments({
				'settings.frameRate': {
					$exists: false,
				},
			})
			if (count > 0) return `${count} studios need to be updated`
			return false
		},
		migrate: async () => {
			await Studios.updateAsync(
				{
					'settings.frameRate': {
						$exists: false,
					},
				},
				{
					$set: {
						'settings.frameRate': DEFAULT_FRAME_RATE,
					},
				},
				{ multi: true }
			)
		},
	},
])
