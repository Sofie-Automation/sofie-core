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
	/**
	 * Insert an adlibbed part into the rundown and set it as next.
	 * @param targetPartOrInstanceId When omitted, inserts immediately after the current part.
	 * When provided, inserts relative to the given PartId or PartInstanceId (PartInstanceId is checked first).
	 * @param insertBefore When targetPartOrInstanceId is set, true (default) inserts before the target, false inserts after it.
	 * The target must exist and must not be in an orphaned segment.
	 * The inserted part always becomes next via setNextPart, even when the target is far ahead — intervening scripted parts are skipped.
	 */
	queuePart(
		part: IBlueprintPart,
		pieces: IBlueprintPiece[],
		targetPartOrInstanceId?: string,
		insertBefore?: boolean
	): Promise<IBlueprintPartInstance>
	/**
	 * Insert an adlibbed part into the rundown after the take completes and set it as next.
	 * @param targetPartOrInstanceId When omitted, inserts immediately after the taken part.
	 * When provided, inserts relative to the given PartId or PartInstanceId (PartInstanceId is checked first).
	 * @param insertBefore When targetPartOrInstanceId is set, true (default) inserts before the target, false inserts after it.
	 * The target must exist and must not be in an orphaned segment.
	 * The inserted part always becomes next via setNextPart, even when the target is far ahead — intervening scripted parts are skipped.
	 */
	queuePartAfterTake(
		part: IBlueprintPart,
		pieces: IBlueprintPiece[],
		targetPartOrInstanceId?: string,
		insertBefore?: boolean
	): void
}
