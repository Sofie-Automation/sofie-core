import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { RundownPlaylists, Segments, Studios } from '../collections'
import { ContainerIdsToObjectWithOverridesMigrationStep } from './steps/X_X_X/ContainerIdsToObjectWithOverridesMigrationStep'
import { PreviousPartInfoToArrayMigrationStep } from './steps/X_X_X/PreviousPartInfoToArrayMigrationStep'
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
	// Add your migration here
])
