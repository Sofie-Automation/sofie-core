import type { AdLibActionCommon } from './AdlibAction.js'
import type { RundownBaselineAdLibActionId } from './Ids.js'

export interface RundownBaselineAdLibAction extends AdLibActionCommon {
	_id: RundownBaselineAdLibActionId
}
