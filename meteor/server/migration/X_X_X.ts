import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { RundownPlaylists } from '../collections'
import { ContainerIdsToObjectWithOverridesMigrationStep } from './steps/X_X_X/ContainerIdsToObjectWithOverridesMigrationStep'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	{
		id: `Rename previousPersistentState to privatePlayoutPersistentState`,
		canBeRunAutomatically: true,
		validate: async () => {
			const playlists = await RundownPlaylists.countDocuments({
				previousPersistentState: { $exists: true },
				privatePlayoutPersistentState: { $exists: false },
			})
			if (playlists > 0) {
				return 'One or more Playlists has previousPersistentState field that needs to be renamed to privatePlayoutPersistentState'
			}

			return false
		},
		migrate: async () => {
			const playlists = await RundownPlaylists.findFetchAsync(
				{
					previousPersistentState: { $exists: true },
					privatePlayoutPersistentState: { $exists: false },
				},
				{
					projection: {
						_id: 1,
						// @ts-expect-error - This field is being renamed, so it won't exist on the type anymore
						previousPersistentState: 1,
					},
				}
			)

			for (const playlist of playlists) {
				// @ts-expect-error - This field is being renamed, so it won't exist on the type anymore
				const previousPersistentState = playlist.previousPersistentState

				await RundownPlaylists.mutableCollection.updateAsync(playlist._id, {
					$set: {
						privatePlayoutPersistentState: previousPersistentState,
					},
					$unset: {
						previousPersistentState: 1,
					},
				})
			}
		},
	},
	// Add your migration here

	new ContainerIdsToObjectWithOverridesMigrationStep(),
])
