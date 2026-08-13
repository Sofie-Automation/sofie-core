import { IBlueprintPart, IBlueprintPiece, IEventContext, IShowStyleUserContext, Time } from '../index.js'
import { IPartAndPieceActionContext } from './partsAndPieceActionContext.js'
import { IExecuteTSRActionsContext, ITriggerIngestChangeContext } from './executeTsrActionContext.js'
import { ITTimersContext } from './tTimersContext.js'

/**
 * Context in which 'current' is the partInstance we're leaving, and 'next' is the partInstance we're taking
 */
export interface IOnTakeContext
	extends
		IPartAndPieceActionContext,
		IShowStyleUserContext,
		IEventContext,
		IExecuteTSRActionsContext,
		ITriggerIngestChangeContext,
		ITTimersContext {
	/** Inform core that a take out of the taken partinstance should be blocked until the specified time */
	blockTakeUntil(time: Time | null): Promise<void>
	/**
	 * Prevent the take.
	 * All modifications to the pieceInstances and partInstance done through this context will be persisted,
	 * but the next part will not be taken.
	 */
	abortTake(): void
	/**
	 * Insert an adlibbed part into the rundown after the take completes and set it as next.
	 * @param insertBeforePartOrInstanceId When omitted, inserts immediately after the taken part.
	 * When provided, inserts before the given PartId or PartInstanceId (PartInstanceId is checked first).
	 * The target must exist and must not be in an orphaned segment.
	 * The inserted part always becomes next via setNextPart, even when the target is far ahead — intervening scripted parts are skipped.
	 */
	queuePartAfterTake(part: IBlueprintPart, pieces: IBlueprintPiece[], insertBeforePartOrInstanceId?: string): void
}
