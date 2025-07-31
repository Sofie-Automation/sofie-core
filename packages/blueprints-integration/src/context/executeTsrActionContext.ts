import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { IBlueprintPlayoutDevice, TSR } from '../index.js'

export interface IExecuteTSRActionsContext {
	/** Returns a list of the PeripheralDevices */
	listPlayoutDevices(): Promise<IBlueprintPlayoutDevice[]>
	/** Execute an action on a certain PeripheralDevice */
	executeTSRAction(
		deviceId: PeripheralDeviceId,
		actionId: string,
		payload: Record<string, any>
	): Promise<TSR.ActionExecutionResult>
}
