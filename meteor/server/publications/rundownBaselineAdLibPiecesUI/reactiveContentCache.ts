import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierZeroes } from '@sofie-automation/corelib/dist/mongo'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'

export type RundownBaselineAdLibItemOmitedFields = 'privateData' | 'timelineObjectsString'
export const rundownBaselineAdLibPieceFieldSpecifier = literal<MongoFieldSpecifierZeroes<RundownBaselineAdLibItem>>({
	privateData: 0,
	timelineObjectsString: 0,
})

export interface ContentCache {
	RundownBaselineAdLibPieces: InMemoryMongoCollection<
		Omit<RundownBaselineAdLibItem, RundownBaselineAdLibItemOmitedFields>
	>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		RundownBaselineAdLibPieces: new InMemoryMongoCollection<
			Omit<RundownBaselineAdLibItem, RundownBaselineAdLibItemOmitedFields>
		>('rundownBaselineAdLibPieces'),
	}

	return cache
}
