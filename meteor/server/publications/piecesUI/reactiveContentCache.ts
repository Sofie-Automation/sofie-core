import { BrandingContentCache, createBrandingContentCache } from '../lib/branding'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierZeroes } from '@sofie-automation/corelib/dist/mongo'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'

export type PieceOmitedFields = 'privateData' | 'timelineObjectsString'
export const pieceFieldSpecifier = literal<MongoFieldSpecifierZeroes<Piece>>({
	privateData: 0,
	timelineObjectsString: 0,
})

export interface ContentCache extends BrandingContentCache {
	Pieces: InMemoryMongoCollection<Omit<Piece, PieceOmitedFields>>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		...createBrandingContentCache(),
		Pieces: new InMemoryMongoCollection<Omit<Piece, PieceOmitedFields>>('pieces'),
	}

	return cache
}
