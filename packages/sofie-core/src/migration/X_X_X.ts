import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { addMigrationSteps } from './databaseMigration'
import { PlaylistBrandingSelectionMigrationStep } from './steps/X_X_X/PlaylistBrandingSelectionMigrationStep'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { PartInstances, Parts, ShowStyleBases } from '../collections'
import {
	convertLegacyAutoNextOverlap,
	convertLegacyDisableNextInTransition,
	convertLegacyOutTransitionType,
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
	new PlaylistBrandingSelectionMigrationStep(),
	{
		id: `Parts add type to outTransition`,
		canBeRunAutomatically: true,
		validate: async () => {
			const count = await Parts.countDocuments({
				outTransition: { $exists: true },
				'outTransition.type': { $exists: false },
			})
			if (count > 0) return `There are ${count} Parts with an outTransition without a type`
			return false
		},
		migrate: async () => {
			const parts = await Parts.findFetchAsync({
				outTransition: { $exists: true },
				'outTransition.type': { $exists: false },
			})

			for (const part of parts) {
				const outTransition = convertLegacyOutTransitionType(part as PartWithLegacyTransitionProps)
				if (!outTransition) continue

				await Parts.mutableCollection.updateAsync(part._id, {
					$set: { outTransition },
				})
			}
		},
	},
	{
		id: `PartInstances add type to part.outTransition`,
		canBeRunAutomatically: true,
		validate: async () => {
			const count = await PartInstances.countDocuments({
				'part.outTransition': { $exists: true },
				'part.outTransition.type': { $exists: false },
			})
			if (count > 0) return `There are ${count} PartInstances with an outTransition without a type`
			return false
		},
		migrate: async () => {
			const partInstances = await PartInstances.findFetchAsync({
				'part.outTransition': { $exists: true },
				'part.outTransition.type': { $exists: false },
			})

			for (const partInstance of partInstances) {
				const outTransition = convertLegacyOutTransitionType(partInstance.part as PartWithLegacyTransitionProps)
				if (!outTransition) continue

				await PartInstances.mutableCollection.updateAsync(partInstance._id, {
					$set: { 'part.outTransition': outTransition },
				})
			}
		},
	},
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

	{
		id: 'Add branding to ShowStyleBase',
		canBeRunAutomatically: true,
		validate: async () => {
			// Also catches docs where applyConfig has set `branding.defaults` before this migration ran
			const count = await ShowStyleBases.countDocuments({
				'branding.overrides': { $exists: false },
			})
			if (count > 0) return `There are ${count} ShowStyleBases without branding`
			return false
		},
		migrate: async () => {
			await ShowStyleBases.mutableCollection.updateAsync(
				{
					branding: { $exists: false },
				},
				{
					$set: {
						branding: wrapDefaultObject({}),
					},
				},
				{ multi: true }
			)
			// Preserve any defaults already written by applyConfig
			await ShowStyleBases.mutableCollection.updateAsync(
				{
					'branding.overrides': { $exists: false },
				},
				{
					$set: {
						'branding.overrides': [],
					},
				},
				{ multi: true }
			)
		},
	},
])
