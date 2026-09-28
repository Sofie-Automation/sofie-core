import { addMigrationSteps } from './databaseMigration'
import { RundownPlaylists, Rundowns } from '../collections'

// Release 44

export const addSteps = addMigrationSteps('1.44.0', [
	{
		id: 'Add new rundownIdsInOrder property to playlists where missing',
		canBeRunAutomatically: true,
		validate: async () => {
			return (
				(await RundownPlaylists.countDocuments({
					rundownIdsInOrder: { $exists: false },
				})) > 0
			)
		},
		migrate: async () => {
			const playlists = await RundownPlaylists.findFetchAsync({
				rundownIdsInOrder: { $exists: false },
			})

			for (const playlist of playlists) {
				const rundowns = await Rundowns.findFetchAsync(
					{
						playlistId: playlist._id,
					},
					{
						sort: {
							/* @ts-expect-error Field has been removed */
							_rank: 1,
							_id: 1,
						},
					}
				)

				await RundownPlaylists.mutableCollection.updateAsync(playlist._id, {
					$set: {
						rundownIdsInOrder: rundowns.map((rd) => rd._id),
					},
				})
			}
		},
	},
])
