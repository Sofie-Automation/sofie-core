import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { IBlueprintPlayoutDevice, TSR } from '../index.js'

export interface IExecuteTSRActionsContext {
	/** Returns a list of the PeripheralDevices */
	listPlayoutDevices(): Promise<IBlueprintPlayoutDevice[]>
	/** Execute an action on a certain PeripheralDevice */
	executeTSRAction(
		deviceId: PeripheralDeviceId,
		actionId: string,
		payload: Record<string, any>,
		/** Timeout for the action, default: 3000 */
		timeoutMs?: number
	): Promise<TSR.ActionExecutionResult>
}

export interface ITriggerIngestChangeContext {
	/**
	 * Execute an ingest operation
	 * This dispatches the operation but does not wait for it to be processed
	 * Note: This should be used with caution, it will not be good for performance to trigger a lot of ingest operations
	 * during playout of a rundown, especially if they need to make changes to many segments
	 * @param operation The blueprint defined payload for the operation
	 */
	emitIngestOperation(operation: unknown): Promise<void>
}
