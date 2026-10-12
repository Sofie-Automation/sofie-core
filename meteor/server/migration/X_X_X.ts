import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { addMigrationSteps } from './databaseMigration'
import { PartTransitionsMigrationStep } from './steps/X_X_X/PartTransitionsMigrationStep'
import { PartPlayoutTimingsTransitionMigrationStep } from './steps/X_X_X/PartPlayoutTimingsTransitionMigrationStep'

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
	new PartTransitionsMigrationStep(),
	new PartPlayoutTimingsTransitionMigrationStep(),
	// Add your migration here
])
