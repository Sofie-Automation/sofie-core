import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict, MongoFieldSpecifierZeroes } from '@sofie-automation/corelib/dist/mongo'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'

/**
 * The PartInstances are tracked solely to know which Branding each PieceInstance is played with,
 * so only the id and the Branding are needed
 */
export type PartInstanceBranding = Pick<DBPartInstance, '_id' | 'brandingId'>
export const partInstanceBrandingFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<PartInstanceBranding>>({
	_id: 1,
	brandingId: 1,
})

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
	PartInstances: InMemoryMongoCollection<PartInstanceBranding>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		PieceInstances: new InMemoryMongoCollection<Omit<PieceInstance, PieceInstanceOmitedFields>>('pieceInstances'),
		PartInstances: new InMemoryMongoCollection<PartInstanceBranding>('partInstances'),
	}

	return cache
}
