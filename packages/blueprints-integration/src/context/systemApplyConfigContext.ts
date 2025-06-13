import type { IBlueprintDefaultCoreSystemTriggers } from '../triggers'
import type { ICommonContext } from './baseContext'

export interface ICoreSystemApplyConfigContext extends ICommonContext {
	getDefaultSystemActionTriggers(): IBlueprintDefaultCoreSystemTriggers
}
