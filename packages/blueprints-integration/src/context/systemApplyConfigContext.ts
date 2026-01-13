import type { IBlueprintDefaultCoreSystemTriggers } from '../triggers.js'
import type { ICommonContext } from './baseContext.js'

export interface ICoreSystemApplyConfigContext extends ICommonContext {
	getDefaultSystemActionTriggers(): IBlueprintDefaultCoreSystemTriggers
}
