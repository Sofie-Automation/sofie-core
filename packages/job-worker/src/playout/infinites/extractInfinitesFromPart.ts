import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { JobContext } from '../../jobs/index.js'
import { ReadonlyDeep, ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { PartId, SegmentId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part.js'
import { MongoQuery } from '../../db/collections.js'
import _ from 'underscore'
import { PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance.js'
import { getPrecedingContext } from './getIdsBeforeThisPart.js'
import { PlayoutModel } from '../model/PlayoutModel.js'
import { PieceLifespan } from '@sofie-automation/corelib/dist/playout/pieceLifespan.js'
import { IngestModelReadonly } from '../../ingest/model/IngestModel.js'
import { mongoWhere } from '@sofie-automation/corelib/dist/mongo.js'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance.js'

export function extractInfinitesFromPart(
	context: JobContext,
	playoutModel: PlayoutModel,
	unsavedIngestModel: Pick<IngestModelReadonly, 'rundownId' | 'getAllPieces'> | undefined,
	part: ReadonlyObjectDeep<DBPartInstance> | undefined
): ReadonlyObjectDeep<Piece>[] {
	if (!part || !unsavedIngestModel) return []

	const _precedingIds = getPrecedingContext(context, {
		part: part,
		loadedPartInstances: playoutModel.loadedPartInstances,
		segment: playoutModel.getAllOrderedSegments().find((s) => s.segment._id === part.segmentId),
		rundowns: playoutModel.rundowns,
	})

	const query = buildPastInfinitePiecesForThisPartQuery(part.part, {
		parts: _precedingIds.parts,
		segments: _precedingIds.segments,
		rundowns: _precedingIds.rundowns.map((r) => r.rundownId),
	})

	const precedingInfinitePieces =
		query === null ? [] : unsavedIngestModel.getAllPieces().filter((p) => mongoWhere(p, query))

	const partPieces = playoutModel.getPartInstance(part._id)?.pieceInstances

	// TODO: This here is very ugly, hard to understand, I'd say unreadable -----------
	const partInfinitePieces: ReadonlyObjectDeep<PieceInstancePiece>[] = (
		partPieces?.filter(
			(pieceInstance) => new PieceLifespan(pieceInstance.pieceInstance.piece.lifespan).scope !== 'part'
		) ?? []
	).map((pieceInstance) => pieceInstance.pieceInstance.piece)

	const infinitePieces = new Map(precedingInfinitePieces.map((piece) => [piece._id, piece]))

	for (const piece of partInfinitePieces) {
		const ingestedPiece = infinitePieces.get(piece._id)
		infinitePieces.set(piece._id, {
			...piece,
			startRundownId: ingestedPiece ? ingestedPiece.startRundownId : part.rundownId,
			startSegmentId: ingestedPiece ? ingestedPiece.startSegmentId : part.segmentId,
		})
	}
	// --------------------------------------------------------------------------------

	return [...infinitePieces.values()]
}

interface RecieveInfinitePiecesFrom {
	parts: PartId[]
	segments: SegmentId[]
	rundowns: RundownId[]
}

export function buildPastInfinitePiecesForThisPartQuery(
	part: ReadonlyDeep<DBPart>,
	{ parts, segments, rundowns }: RecieveInfinitePiecesFrom
): MongoQuery<Piece> | null {
	const fragments = _.compact([
		parts.length > 0
			? {
					// relevant pieces from past parts in the same segment
					lifespan: {
						scope: { $in: ['segment', 'rundown', 'showstyle', 'playlist'] },
					},
					startRundownId: part.rundownId,
					startSegmentId: part.segmentId,
					startPartId: { $in: parts },
				}
			: undefined,
		segments.length > 0
			? {
					// relevant pieces from past segments in the same rundown
					lifespan: {
						scope: { $in: ['rundown', 'showstyle', 'playlist'] },
					},
					startRundownId: part.rundownId,
					startSegmentId: { $in: segments },
				}
			: undefined,
		rundowns.length > 0
			? {
					// relevant pieces from past rundowns in the same showstyle and playlist
					lifespan: {
						scope: { $in: ['showstyle', 'playlist'] },
					},
					startRundownId: { $in: rundowns },
				}
			: undefined,
	])

	return wrapToQuery(fragments, part)
}

/**
 * No fragments means no relevant pieces found, so we return null
 *
 * Otherwise we wrap the fragments into a MongoDB query that ignores the current part and invalid pieces.
 */
function wrapToQuery(fragments: any, part: any): any {
	if (fragments.length === 0) {
		// No valid query possible
		return null
	}

	// Ignores pieces that are invalid and in the current part
	const baseQuery = {
		invalid: { $ne: true },
		startPartId: { $ne: part._id },
	}

	if (fragments.length === 1) {
		return {
			...baseQuery,
			// If there is only one fragment, we can just use it directly
			...fragments[0],
		}
	} else {
		return {
			...baseQuery,
			// If there are multiple fragments, we pass the array in an $or query
			$or: fragments,
		}
	}
}
