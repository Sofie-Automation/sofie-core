import type { IBlueprintTriggeredActions } from '../triggers.js'
import type { MigrationStepSystem } from '../migrations.js'
import type { BlueprintManifestBase, BlueprintManifestType } from './base.js'
import type { ICoreSystemApplyConfigContext } from '../context/systemApplyConfigContext.js'
import type { ICoreSystemSettings } from '@sofie-automation/shared-lib/dist/core/model/CoreSystemSettings'
import type { SystemErrorCode } from '@sofie-automation/shared-lib/dist/systemErrorMessages'

// Re-export so blueprints can import from blueprints-integration
export { SystemErrorCode } from '@sofie-automation/shared-lib/dist/systemErrorMessages'

export interface SystemBlueprintManifest extends BlueprintManifestBase {
	blueprintType: BlueprintManifestType.SYSTEM

	/** A list of Migration steps related to the Core system
	 * @deprecated This has been replaced with `applyConfig`
	 */
	coreMigrations: MigrationStepSystem[]

	/** Translations connected to the studio (as stringified JSON) */
	translations?: string

	/**
	 * Alternate system error messages, to override the builtin ones produced by Sofie.
	 * Keys are SystemErrorCode values (e.g., 'DATABASE_CONNECTION_LOST').
	 *
	 * Templates use {{variable}} syntax for interpolation with context values.
	 *
	 * @example
	 * ```typescript
	 * import { SystemErrorCode } from '@sofie-automation/blueprints-integration'
	 *
	 * systemErrorMessages: {
	 *   [SystemErrorCode.DATABASE_CONNECTION_LOST]: 'Database offline - contact IT support',
	 *   [SystemErrorCode.SERVICE_UNAVAILABLE]: 'Service {{serviceName}} is not responding',
	 * }
	 * ```
	 */
	systemErrorMessages?: Partial<Record<SystemErrorCode | string, string | undefined>>

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
