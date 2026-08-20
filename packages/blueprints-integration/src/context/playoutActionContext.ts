import type { IBlueprintPart, IBlueprintPartInstance, IBlueprintPiece } from '../index.js'

/**
 * The playout-action methods shared between {@link IActionExecutionContext} and {@link IExternalEventContext}.
 */
export interface IPlayoutActionContext {
	/**
	 * Move the next part through the rundown. Can move by either a number of parts, or segments in either direction.
	 * @returns Whether a new Part was found using the provided offset
	 **/
	moveNextPart(partDelta: number, segmentDelta: number, ignoreQuickloop?: boolean): Promise<boolean>
	/** Set flag to perform a take after the current handler completes. Returns state of the flag after each call. */
	takeAfterExecuteAction(take: boolean): Promise<boolean>
	/** Insert a queued part to follow the current part */
	queuePart(part: IBlueprintPart, pieces: IBlueprintPiece[]): Promise<IBlueprintPartInstance>
	/** Insert a queued part to follow the taken part */
	queuePartAfterTake(part: IBlueprintPart, pieces: IBlueprintPiece[]): void
}
