import { Time } from '@sofie-automation/blueprints-integration'
import { protectString } from '../protectedString.js'
import {
	PieceInstanceInfiniteId,
	RundownPlaylistActivationId,
	PieceInstanceId,
	RundownId,
	PartInstanceId,
	PieceId,
	ExpectedPackageId,
} from './Ids.js'
import { Piece } from './Piece.js'
import { omit } from '../lib.js'
import { ReadonlyDeep } from 'type-fest'

export type PieceInstancePiece = Omit<Piece, 'startRundownId' | 'startSegmentId'>

export interface PieceInstanceInfinite {
	infinitePieceId: PieceId
	/** When the instance was a copy made from hold */
	fromHold?: boolean

	/** Whether this was 'copied' from the previous PartInstance or Part */
	fromPreviousPart: boolean
	/** Whether this was 'copied' from the previous PartInstance via the playhead, rather than from a Part */
	fromPreviousPlayhead?: boolean

	/** A random id for this instance of this infinite */
	infiniteInstanceId: PieceInstanceInfiniteId
	/** The index of this PieceInstance within the instance of the infinite (as defined by `infiniteInstanceId`) */
	infiniteInstanceIndex: number
}

export interface PieceInstance {
	_id: PieceInstanceId
	/** The rundown this piece belongs to */
	rundownId: RundownId
	/** The part instance this piece belongs to. */
	partInstanceId: PartInstanceId

	/** Whether this PieceInstance is a temprorary wrapping of a Piece */
	readonly isTemporary?: boolean

	/** The id of the playlist activation session */
	playlistActivationId: RundownPlaylistActivationId

	/** Whether this instance has been finished with and reset (to restore the original piece as the primary version) */
	reset?: boolean

	piece: PieceInstancePiece

	/** A flag to signal a given Piece has been deactivated manually */
	disabled?: boolean

	/** If this piece has been created play-time using an AdLibPiece, this should be set to it's source piece */
	adLibSourceId?: PieceId

	/** Only set when this pieceInstance is an infinite. It contains info about the infinite */
	infinite?: PieceInstanceInfinite

	/** If this piece has been insterted during run of rundown (such as adLibs), then this is set to the timestamp it was inserted */
	dynamicallyInserted?: Time

	/** This is set when the duration needs to be overriden from some user action */
	userDuration?: {
		/** The time relative to the part (milliseconds since start of part) */
		endRelativeToPart: number
	}

	/** The time the system started playback of this part, undefined if not yet played back (milliseconds since epoch) */
	reportedStartedPlayback?: Time
	/** Whether the piece has stopped playback (the most recent time it was played), undefined if not yet played back or is currently playing.
	 * This is set from a callback from the playout gateway (milliseconds since epoch)
	 */
	reportedStoppedPlayback?: Time
	plannedStartedPlayback?: Time
	plannedStoppedPlayback?: Time

	/**
	 * The IDs of ExpectedPackages that are needed for this PieceInstance
	 * This matches the data on `this.piece.expectedPackages`, resolved to the full database IDs
	 * Future: This should replace the expectedPackages on Piece entirely
	 */
	neededExpectedPackageIds?: ExpectedPackageId[]
}

export interface ResolvedPieceInstance {
	instance: ReadonlyDeep<PieceInstance>

	/** Calculated start point within the PartInstance */
	resolvedStart: number
	/** Calculated duration within the PartInstance */
	resolvedDuration?: number

	/** Timeline priority of the PieceInstance */
	timelinePriority: number
}

export function omitPiecePropertiesForInstance(piece: Piece | PieceInstancePiece): PieceInstancePiece {
	return omit(piece as Piece, 'startRundownId', 'startSegmentId')
}

export function rewrapPieceToInstance(
	piece: PieceInstancePiece,
	playlistActivationId: RundownPlaylistActivationId,
	rundownId: RundownId,
	partInstanceId: PartInstanceId,
	isTemporary?: boolean
): PieceInstance {
	return {
		isTemporary,
		_id: getPieceInstanceIdForPiece(partInstanceId, piece._id),
		rundownId: rundownId,
		playlistActivationId: playlistActivationId,
		partInstanceId: partInstanceId,
		piece: piece,
	}
}

export function wrapPieceToInstance(
	piece: Piece,
	playlistActivationId: RundownPlaylistActivationId,
	partInstanceId: PartInstanceId,
	isTemporary?: boolean
): PieceInstance {
	return rewrapPieceToInstance(
		omitPiecePropertiesForInstance(piece),
		playlistActivationId,
		piece.startRundownId,
		partInstanceId,
		partInstanceId === protectString('') || isTemporary
	)
}

export function getPieceInstanceIdForPiece(partInstanceId: PartInstanceId, pieceId: PieceId): PieceInstanceId {
	return protectString(`${partInstanceId}_${pieceId}`)
}
