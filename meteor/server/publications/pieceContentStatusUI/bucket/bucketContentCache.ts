import { ReactiveCacheCollection } from '../../lib/ReactiveCacheCollection'
import { DBShowStyleBase, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { BlueprintId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'

export interface SourceLayersDoc {
	_id: ShowStyleBaseId
	blueprintId: BlueprintId
	sourceLayers: SourceLayers
}

export type BucketAdLibFields =
	| '_id'
	| 'bucketId'
	| 'studioId'
	| 'showStyleBaseId'
	| 'name'
	| 'sourceLayerId'
	| 'content'
	| 'expectedPackages'
export const bucketAdlibFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<BucketAdLib, BucketAdLibFields>>>({
	_id: 1,
	bucketId: 1,
	studioId: 1,
	showStyleBaseId: 1,
	name: 1,
	sourceLayerId: 1,
	content: 1,
	expectedPackages: 1,
})

export type BucketActionFields = '_id' | 'bucketId' | 'studioId' | 'showStyleBaseId' | 'display' | 'expectedPackages'
export const bucketActionFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<BucketAdLibAction, BucketActionFields>>
>({
	_id: 1,
	bucketId: 1,
	studioId: 1,
	showStyleBaseId: 1,
	display: 1,
	expectedPackages: 1,
})

export type ShowStyleBaseFields = '_id' | 'blueprintId' | 'sourceLayersWithOverrides'
export const showStyleBaseFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBShowStyleBase, ShowStyleBaseFields>>
>({
	_id: 1,
	blueprintId: 1,
	sourceLayersWithOverrides: 1,
})

export type BlueprintFields = '_id' | 'packageStatusMessages'
export const blueprintFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<Blueprint, BlueprintFields>>>({
	_id: 1,
	packageStatusMessages: 1,
})

export interface BucketContentCache {
	BucketAdLibs: ReactiveCacheCollection<Pick<BucketAdLib, BucketAdLibFields>>
	BucketAdLibActions: ReactiveCacheCollection<Pick<BucketAdLibAction, BucketActionFields>>
	ShowStyleSourceLayers: ReactiveCacheCollection<SourceLayersDoc>
	Blueprints: ReactiveCacheCollection<Pick<Blueprint, BlueprintFields>>
}

export function createReactiveContentCache(): BucketContentCache {
	const cache: BucketContentCache = {
		BucketAdLibs: new ReactiveCacheCollection<Pick<BucketAdLib, BucketAdLibFields>>('bucketAdlibs'),
		BucketAdLibActions: new ReactiveCacheCollection<Pick<BucketAdLibAction, BucketActionFields>>(
			'bucketAdlibActions'
		),
		ShowStyleSourceLayers: new ReactiveCacheCollection<SourceLayersDoc>('sourceLayers'),
		Blueprints: new ReactiveCacheCollection<Pick<Blueprint, BlueprintFields>>('blueprints'),
	}

	return cache
}
