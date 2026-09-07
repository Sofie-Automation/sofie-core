import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierZeroes } from '@sofie-automation/corelib/dist/mongo'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'

export type AdLibPieceOmitedFields = 'privateData' | 'timelineObjectsString'
export const adLibPieceFieldSpecifier = literal<MongoFieldSpecifierZeroes<AdLibPiece>>({
	privateData: 0,
	timelineObjectsString: 0,
})

export interface ContentCache {
	AdLibPieces: InMemoryMongoCollection<Omit<AdLibPiece, AdLibPieceOmitedFields>>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		AdLibPieces: new InMemoryMongoCollection<Omit<AdLibPiece, AdLibPieceOmitedFields>>('adLibPieces'),
	}

	return cache
}
