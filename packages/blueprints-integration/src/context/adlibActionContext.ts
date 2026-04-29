import type { DatastorePersistenceMode } from '../common.js'
import type { IEventContext } from './index.js'
import type { IShowStyleUserContext } from './showStyleContext.js'
import { IPartAndPieceActionContext } from './partsAndPieceActionContext.js'
import { IExecuteTSRActionsContext, ITriggerIngestChangeContext } from './executeTsrActionContext.js'
import { IRouteSetMethods } from './routeSetContext.js'
import { ITTimersContext } from './tTimersContext.js'
import type { IPlayoutActionContext } from './playoutActionContext.js'

/** Actions */
export interface IDataStoreMethods {
	/**
	 * Setting a value in the datastore allows us to overwrite parts of a timeline content object with that value
	 * @param key Key to use when referencing from the timeline object
	 * @param value Value to overwrite the timeline object's content with
	 * @param mode In temporary mode the value may be removed when the key is no longer on the timeline
	 */
	setTimelineDatastoreValue(key: string, value: any, mode: DatastorePersistenceMode): Promise<void>
	/** Deletes a previously set value from the datastore */
	removeTimelineDatastoreValue(key: string): Promise<void>
}
export interface IDataStoreActionExecutionContext extends IDataStoreMethods, IShowStyleUserContext, IEventContext {}

export interface IActionExecutionContext
	extends
		IShowStyleUserContext,
		IEventContext,
		IDataStoreMethods,
		IPartAndPieceActionContext,
		IExecuteTSRActionsContext,
		ITriggerIngestChangeContext,
		IRouteSetMethods,
		ITTimersContext,
		IPlayoutActionContext {
	/** Fetch the showstyle config for the specified part */
	// getNextShowStyleConfig(): Readonly<{ [key: string]: ConfigItemValue }>
	/** Misc actions */
	// updateAction(newManifest: Pick<IBlueprintAdLibActionManifest, 'description' | 'payload'>): void // only updates itself. to allow for the next one to do something different
	// executePeripheralDeviceAction(deviceId: string, functionName: string, args: any[]): Promise<any>
	// openUIDialogue(message: string) // ?????
}
