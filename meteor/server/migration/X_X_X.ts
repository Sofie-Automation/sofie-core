import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { RundownPlaylists, Segments, Studios } from '../collections'
import { ContainerIdsToObjectWithOverridesMigrationStep } from './steps/X_X_X/ContainerIdsToObjectWithOverridesMigrationStep'
import { ShelfButtonSize } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'

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
	new ContainerIdsToObjectWithOverridesMigrationStep(),
	{
		id: 'Add T-timers to RundownPlaylist',
		canBeRunAutomatically: true,
		validate: async () => {
			const playlistCount = await RundownPlaylists.countDocuments({ tTimers: { $exists: false } })
			if (playlistCount > 0) return `There are ${playlistCount} RundownPlaylists without T-timers`
			return false
		},
		migrate: async () => {
			await RundownPlaylists.mutableCollection.updateAsync(
				{ tTimers: { $exists: false } },
				{
					$set: {
						tTimers: [
							{ index: 1, label: '', mode: null, state: null },
							{ index: 2, label: '', mode: null, state: null },
							{ index: 3, label: '', mode: null, state: null },
						],
					},
				},
				{ multi: true }
			)
		},
	},
	{
		id: `studios settings create default shelfAdlibButtonSize=large`,
		canBeRunAutomatically: true,
		validate: async () => {
			const studios = await Studios.findFetchAsync({
				'settingsWithOverrides.defaults.shelfAdlibButtonSize': { $exists: false },
			})

			if (studios.length > 0) return `Some studios are missing settings default shelfAdlibButtonSize`
			return false
		},
		migrate: async () => {
			const studios = await Studios.findFetchAsync({
				'settingsWithOverrides.defaults.shelfAdlibButtonSize': { $exists: false },
			})

			for (const studio of studios) {
				await Studios.updateAsync(studio._id, {
					$set: {
						'settingsWithOverrides.defaults.shelfAdlibButtonSize': ShelfButtonSize.LARGE,
					},
				})
			}
		},
	},
	{
		id: `segments migrate showShelf to displayMinishelf`,
		canBeRunAutomatically: true,
		validate: async () => {
			const count = await Segments.countDocuments({
				showShelf: { $exists: true },
			})
			if (count > 0) return `There are ${count} Segments with legacy showShelf`
			return false
		},
		migrate: async () => {
			// showShelf: true => displayMinishelf: inherit (if missing)
			await Segments.mutableCollection.updateAsync(
				{
					showShelf: true,
					displayMinishelf: { $exists: false },
				},
				{
					$set: {
						displayMinishelf: ShelfButtonSize.INHERIT,
					},
				},
				{ multi: true }
			)

			// Always remove legacy field
			await Segments.mutableCollection.updateAsync(
				{
					showShelf: { $exists: true },
				},
				{
					$unset: {
						showShelf: 1,
					},
				},
				{ multi: true }
			)
		},
	},
	// Add your migration here
])
