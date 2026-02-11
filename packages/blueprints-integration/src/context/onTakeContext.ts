import { IBlueprintPart, IBlueprintPiece, IEventContext, IShowStyleUserContext, Time } from '../index.js'
import { IPartAndPieceActionContext } from './partsAndPieceActionContext.js'
import { IExecuteTSRActionsContext } from './executeTsrActionContext.js'

/**
 * Context in which 'current' is the partInstance we're leaving, and 'next' is the partInstance we're taking
 */
export interface IOnTakeContext
	extends IPartAndPieceActionContext, IShowStyleUserContext, IEventContext, IExecuteTSRActionsContext {
	/** Inform core that a take out of the taken partinstance should be blocked until the specified time */
	blockTakeUntil(time: Time | null): Promise<void>
	/**
	 * Prevent the take.
	 * All modifications to the pieceInstances and partInstance done through this context will be persisted,
	 * but the next part will not be taken.
	 */
	abortTake(): void
	/** Insert a queued part to follow the taken part */
	queuePartAfterTake(part: IBlueprintPart, pieces: IBlueprintPiece[]): void
}
