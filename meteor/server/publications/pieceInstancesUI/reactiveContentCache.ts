import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierZeroes } from '@sofie-automation/corelib/dist/mongo'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'

export type PieceInstanceOmitedFields = 'piece.privateData' | 'piece.timelineObjectsString'
export const pieceInstanceFieldSpecifier = literal<MongoFieldSpecifierZeroes<PieceInstance>>({
	// @ts-expect-error Mongo typings aren't clever enough yet
	'piece.privateData': 0,
	'piece.timelineObjectsString': 0,
})

/**
 * As {@link pieceInstanceFieldSpecifier}, but with the timing information omitted too.
 * This is used by consumers which don't care about the playback timings, and lets them avoid being
 * woken up every time a Piece starts or stops playing.
 */
export const pieceInstanceSimpleFieldSpecifier = literal<MongoFieldSpecifierZeroes<PieceInstance>>({
	...pieceInstanceFieldSpecifier,
	plannedStartedPlayback: 0,
	plannedStoppedPlayback: 0,
})

export interface ContentCache {
	PieceInstances: InMemoryMongoCollection<Omit<PieceInstance, PieceInstanceOmitedFields>>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		PieceInstances: new InMemoryMongoCollection<Omit<PieceInstance, PieceInstanceOmitedFields>>('pieceInstances'),
	}

	return cache
}
