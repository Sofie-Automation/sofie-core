import { TimelineObjectCoreExt } from '@sofie-automation/blueprints-integration'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { PartCalculatedTimings } from '@sofie-automation/corelib/dist/playout/timings'
import { ReadonlyDeep } from 'type-fest'
import { JobContext } from '../../jobs/index.js'
import { PlayoutModel } from '../model/PlayoutModel.js'
import { selectNextPart } from '../selectNextPart.js'

export interface PartInstanceAndPieceInstances {
	part: ReadonlyDeep<DBPartInstance>
	onTimeline: boolean
	nowInPart: number
	allPieces: ReadonlyDeep<PieceInstance[]>
	calculatedTimings: PartCalculatedTimings
}
export interface PieceInstanceWithObjectMap extends ReadonlyDeep<PieceInstance> {
	/** Cache of objects built by findObjects. */
	objectMap?: Map<string, TimelineObjectCoreExt<any>>
}
export interface PartAndPieces {
	part: ReadonlyDeep<DBPart>
	/** Whether the inTransition from this part should be considered */
	usesInTransition: boolean
	pieces: PieceInstanceWithObjectMap[]
}

export function isPieceInstance(piece: Piece | PieceInstance | PieceInstancePiece): piece is PieceInstance {
	const tmpPiece = piece as PieceInstance
	return typeof tmpPiece.piece !== 'undefined'
}

/**
 * Excludes the previous, current and next part
 * @param context Job context
 * @param playoutModel The playout model
 * @param partCount Maximum number of parts to return
 * @param ignoreQuickLoop If true, ignores quickLoop markers and returns parts in linear order. Defaults to false for backwards compatibility.
 */
export function getOrderedPartsAfterPlayhead(
	context: JobContext,
	playoutModel: PlayoutModel,
	partCount: number,
	ignoreQuickLoop: boolean = false
): ReadonlyDeep<DBPart>[] {
	if (partCount <= 0) {
		return []
	}
	const span = context.startSpan('getOrderedPartsAfterPlayhead')

	const playlist = playoutModel.playlist
	const orderedSegments = playoutModel.getAllOrderedSegments()
	const orderedParts = playoutModel.getAllOrderedParts()
	const currentPartInstance = playoutModel.currentPartInstance?.partInstance
	const nextPartInstance = playoutModel.nextPartInstance?.partInstance

	// If the nextPartInstance consumes the
	const alreadyConsumedQueuedSegmentId =
		nextPartInstance && (!currentPartInstance || currentPartInstance.segmentId !== nextPartInstance.segmentId)

	const strippedPlaylist = {
		queuedSegmentId: alreadyConsumedQueuedSegmentId ? undefined : playlist.queuedSegmentId,
		quickLoop: playlist.quickLoop,
	}
	const nextNextPart = selectNextPart(
		context,
		strippedPlaylist,
		nextPartInstance ?? currentPartInstance ?? null,
		null,
		orderedSegments,
		orderedParts,
		{ ignoreUnplayable: true, ignoreQuickLoop }
	)
	if (!nextNextPart) {
		// We don't know where to begin searching, so we can't do anything
		return []
	}

	const playablePartsSlice = orderedParts.slice(nextNextPart.index).filter((p) => isPartPlayable(p))

	const res: ReadonlyDeep<DBPart>[] = []

	const nextSegmentIndex = playablePartsSlice.findIndex((p) => p.segmentId === playlist.queuedSegmentId)
	if (
		playlist.queuedSegmentId &&
		!alreadyConsumedQueuedSegmentId &&
		nextSegmentIndex !== -1 &&
		!nextNextPart.consumesQueuedSegmentId
	) {
		// TODO - this if clause needs some decent testing

		// Push the next part and the remainder of its segment
		res.push(...playablePartsSlice.filter((p) => p.segmentId === nextNextPart.part.segmentId))

		// Push from nextSegmentId to the end of the playlist
		res.push(...playablePartsSlice.slice(nextSegmentIndex))
	} else {
		// Push as many parts as we want
		res.push(...playablePartsSlice)
	}

	if (span) span.end()
	// We reached the target or ran out of parts
	return res.slice(0, partCount)
}
