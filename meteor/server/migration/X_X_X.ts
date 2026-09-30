import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { PartInstances, Parts, RundownPlaylists, Segments, Studios } from '../collections'
import { ContainerIdsToObjectWithOverridesMigrationStep } from './steps/X_X_X/ContainerIdsToObjectWithOverridesMigrationStep'
import { PreviousPartInfoToArrayMigrationStep } from './steps/X_X_X/PreviousPartInfoToArrayMigrationStep'
import { ShelfButtonSize } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import {
	convertLegacyAutoNextOverlap,
	convertLegacyDisableNextInTransition,
	PartWithLegacyTransitionProps,
} from '@sofie-automation/corelib/dist/playout/legacyTransitions'
import { logger } from '../logging'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

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
	new PreviousPartInfoToArrayMigrationStep(),
	{
		id: `Parts convert autoNextOverlap to autoNextOutTransition`,
		canBeRunAutomatically: true,
		validate: async () => {
			const count = await Parts.countDocuments({ autoNextOverlap: { $exists: true } })
			if (count > 0) return `There are ${count} Parts with legacy autoNextOverlap`
			return false
		},
		migrate: async () => {
			const parts = await Parts.findFetchAsync({ autoNextOverlap: { $exists: true } })

			const changedIds: string[] = []
			for (const part of parts) {
				const { autoNextOutTransition, behaviourChanged } = convertLegacyAutoNextOverlap(
					part as PartWithLegacyTransitionProps
				)
				if (behaviourChanged) changedIds.push(unprotectString(part._id))

				await Parts.mutableCollection.updateAsync(part._id, {
					...(autoNextOutTransition ? { $set: { autoNextOutTransition } } : {}),
					$unset: { autoNextOverlap: 1 } as any,
				})
			}

			if (changedIds.length) {
				logger.warn(
					`Parts with both autoNextOverlap and an additive outTransition will no longer use the outTransition when autonexting: ${changedIds.join(', ')}`
				)
			}
		},
	},
	{
		id: `PartInstances convert part.autoNextOverlap to part.autoNextOutTransition`,
		canBeRunAutomatically: true,
		validate: async () => {
			const count = await PartInstances.countDocuments({ 'part.autoNextOverlap': { $exists: true } })
			if (count > 0) return `There are ${count} PartInstances with legacy autoNextOverlap`
			return false
		},
		migrate: async () => {
			const partInstances = await PartInstances.findFetchAsync({ 'part.autoNextOverlap': { $exists: true } })

			const changedIds: string[] = []
			for (const partInstance of partInstances) {
				const { autoNextOutTransition, behaviourChanged } = convertLegacyAutoNextOverlap(
					partInstance.part as PartWithLegacyTransitionProps
				)
				if (behaviourChanged) changedIds.push(unprotectString(partInstance._id))

				await PartInstances.mutableCollection.updateAsync(partInstance._id, {
					...(autoNextOutTransition ? { $set: { 'part.autoNextOutTransition': autoNextOutTransition } } : {}),
					$unset: { 'part.autoNextOverlap': 1 } as any,
				})
			}

			if (changedIds.length) {
				logger.warn(
					`PartInstances with both autoNextOverlap and an additive outTransition will no longer use the outTransition when autonexting: ${changedIds.join(', ')}`
				)
			}
		},
	},
	{
		id: `Parts convert disableNextInTransition to outTransition`,
		canBeRunAutomatically: true,
		validate: async () => {
			const count = await Parts.countDocuments({ disableNextInTransition: { $exists: true } })
			if (count > 0) return `There are ${count} Parts with legacy disableNextInTransition`
			return false
		},
		migrate: async () => {
			const parts = await Parts.findFetchAsync({ disableNextInTransition: { $exists: true } })

			for (const part of parts) {
				const outTransition = convertLegacyDisableNextInTransition(part as PartWithLegacyTransitionProps)

				await Parts.mutableCollection.updateAsync(part._id, {
					...(outTransition ? { $set: { outTransition } } : {}),
					$unset: { disableNextInTransition: 1 } as any,
				})
			}
		},
	},
	{
		id: `PartInstances convert part.disableNextInTransition to part.outTransition`,
		canBeRunAutomatically: true,
		validate: async () => {
			const count = await PartInstances.countDocuments({ 'part.disableNextInTransition': { $exists: true } })
			if (count > 0) return `There are ${count} PartInstances with legacy disableNextInTransition`
			return false
		},
		migrate: async () => {
			const partInstances = await PartInstances.findFetchAsync({
				'part.disableNextInTransition': { $exists: true },
			})

			for (const partInstance of partInstances) {
				const outTransition = convertLegacyDisableNextInTransition(
					partInstance.part as PartWithLegacyTransitionProps
				)

				await PartInstances.mutableCollection.updateAsync(partInstance._id, {
					...(outTransition ? { $set: { 'part.outTransition': outTransition } } : {}),
					$unset: { 'part.disableNextInTransition': 1 } as any,
				})
			}
		},
	},
	// Add your migration here
])
