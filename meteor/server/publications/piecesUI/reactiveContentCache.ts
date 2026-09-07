import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierZeroes } from '@sofie-automation/corelib/dist/mongo'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'

export type PieceOmitedFields = 'privateData' | 'timelineObjectsString'
export const pieceFieldSpecifier = literal<MongoFieldSpecifierZeroes<Piece>>({
	privateData: 0,
	timelineObjectsString: 0,
})

export interface ContentCache {
	Pieces: InMemoryMongoCollection<Omit<Piece, PieceOmitedFields>>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		Pieces: new InMemoryMongoCollection<Omit<Piece, PieceOmitedFields>>('pieces'),
	}

	return cache
}
