import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { addMigrationSteps } from './databaseMigration'
import { PlaylistBrandingSelectionMigrationStep } from './steps/X_X_X/PlaylistBrandingSelectionMigrationStep'
import { SupportMessageToPanelHtmlMigrationStep } from './steps/X_X_X/SupportMessageToPanelHtmlMigrationStep'
import { ShowStyleBases } from '../collections'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

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
	new SupportMessageToPanelHtmlMigrationStep(),
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
