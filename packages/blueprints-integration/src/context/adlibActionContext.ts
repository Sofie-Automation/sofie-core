import type { DatastorePersistenceMode, Time } from '../common.js'
import type { IEventContext } from './index.js'
import type { IShowStyleUserContext } from './showStyleContext.js'
import { IPartAndPieceActionContext } from './partsAndPieceActionContext.js'
import { IExecuteTSRActionsContext } from './executeTsrActionContext.js'
import { IBlueprintPart, IBlueprintPartInstance, IBlueprintPiece } from '../index.js'
import { IRouteSetMethods } from './routeSetContext.js'

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
	extends IShowStyleUserContext,
		IEventContext,
		IDataStoreMethods,
		IPartAndPieceActionContext,
		IExecuteTSRActionsContext,
		IRouteSetMethods {
	/** Fetch the showstyle config for the specified part */
	// getNextShowStyleConfig(): Readonly<{ [key: string]: ConfigItemValue }>

	/** Move the next part through the rundown. Can move by either a number of parts, or segments in either direction. */
	moveNextPart(partDelta: number, segmentDelta: number, ignoreQuickloop?: boolean): Promise<void>
	/** Set flag to perform take after executing the current action. Returns state of the flag after each call. */
	takeAfterExecuteAction(take: boolean): Promise<boolean>
	/** Inform core that a take out of the current partinstance should be blocked until the specified time */
	blockTakeUntil(time: Time | null): Promise<void>

	/** Insert a queued part to follow the current part */
	queuePart(part: IBlueprintPart, pieces: IBlueprintPiece[]): Promise<IBlueprintPartInstance>

	/** Misc actions */
	// updateAction(newManifest: Pick<IBlueprintAdLibActionManifest, 'description' | 'payload'>): void // only updates itself. to allow for the next one to do something different
	// executePeripheralDeviceAction(deviceId: string, functionName: string, args: any[]): Promise<any>
	// openUIDialogue(message: string) // ?????
}
