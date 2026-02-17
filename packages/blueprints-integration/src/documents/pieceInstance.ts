import type { Time } from '../common.js'
import type { IBlueprintPieceDB } from './piece.js'

export interface IBlueprintPieceInstance<TPrivateData = unknown, TPublicData = unknown> {
	_id: string
	/** The part instace this piece belongs to */
	partInstanceId: string

	/** If this piece has been created play-time using an AdLibPiece, this should be set to it's source piece */
	adLibSourceId?: string
	/** If this piece has been insterted during run of rundown (such as adLibs), then this is set to the timestamp it was inserted */
	dynamicallyInserted?: Time

	piece: IBlueprintPieceDB<TPrivateData, TPublicData>

	/** The time the system started playback of this part, undefined if not yet played back (milliseconds since epoch) */
	reportedStartedPlayback?: Time
	/** Whether the piece has stopped playback (the most recent time it was played), undefined if not yet played back or is currently playing.
	 * This is set from a callback from the playout gateway (milliseconds since epoch)
	 */
	reportedStoppedPlayback?: Time

	infinite?: {
		infinitePieceId: string
		/** When the instance was a copy made from hold */
		fromHold?: boolean

		/** Whether this was 'copied' from the previous PartInstance or Part */
		fromPreviousPart: boolean
		/** Whether this was 'copied' from the previous PartInstance via the playhead, rather than from a Part */
		fromPreviousPlayhead?: boolean

		/** A random id for this instance of this infinite */
		infiniteInstanceId: string
		/** The index of this PieceInstance within the instance of the infinite (as defined by `infiniteInstanceId`) */
		infiniteInstanceIndex: number
	}
}
export interface IBlueprintResolvedPieceInstance<
	TPrivateData = unknown,
	TPublicData = unknown,
> extends IBlueprintPieceInstance<TPrivateData, TPublicData> {
	/**
	 * Calculated start point within the PartInstance
	 */
	resolvedStart: number
	/**
	 * Calculated duration within the PartInstance
	 */
	resolvedDuration?: number
}
