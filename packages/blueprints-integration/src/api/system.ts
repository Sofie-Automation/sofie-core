import type { IBlueprintTriggeredActions } from '../triggers.js'
import type { MigrationStepSystem } from '../migrations.js'
import type { BlueprintManifestBase, BlueprintManifestType } from './base.js'
import type { ICoreSystemApplyConfigContext } from '../context/systemApplyConfigContext.js'
import type { ICoreSystemSettings } from '@sofie-automation/shared-lib/dist/core/model/CoreSystemSettings'

export interface SystemBlueprintManifest extends BlueprintManifestBase {
	blueprintType: BlueprintManifestType.SYSTEM

	/** A list of Migration steps related to the Core system
	 * @deprecated This has been replaced with `applyConfig`
	 */
	coreMigrations: MigrationStepSystem[]

	/** Translations connected to the studio (as stringified JSON) */
	translations?: string

	/**
	 * Apply the config by generating the data to be saved into the db.
	 * This should be written to give a predictable and stable result, it can be called with the same config multiple times
	 */
	applyConfig?: (
		context: ICoreSystemApplyConfigContext
		// config: TRawConfig,
	) => BlueprintResultApplySystemConfig
}

export interface BlueprintResultApplySystemConfig {
	settings: ICoreSystemSettings

	triggeredActions: IBlueprintTriggeredActions[]
}
