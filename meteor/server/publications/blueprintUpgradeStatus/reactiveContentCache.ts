import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { Blueprint } from '@sofie-automation/corelib/dist/dataModel/Blueprint'
import { ICoreSystem } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'

export type CoreSystemFields =
	| '_id'
	| 'blueprintId'
	| 'blueprintConfigPresetId'
	| 'lastBlueprintConfig'
	| 'blueprintConfigWithOverrides'
	| 'lastBlueprintFixUpHash'
	| 'name'
export const coreSystemFieldsSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<ICoreSystem, CoreSystemFields>>>({
	_id: 1,
	blueprintId: 1,
	blueprintConfigPresetId: 1,
	lastBlueprintConfig: 1,
	lastBlueprintFixUpHash: 1,
	blueprintConfigWithOverrides: 1,
	name: 1,
})

export type StudioFields =
	| '_id'
	| 'blueprintId'
	| 'blueprintConfigPresetId'
	| 'lastBlueprintConfig'
	| 'lastBlueprintFixUpHash'
	| 'blueprintConfigWithOverrides'
	| 'name'
export const studioFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBStudio, StudioFields>>>({
	_id: 1,
	blueprintId: 1,
	blueprintConfigPresetId: 1,
	lastBlueprintConfig: 1,
	lastBlueprintFixUpHash: 1,
	blueprintConfigWithOverrides: 1,
	name: 1,
})

export type ShowStyleBaseFields =
	| '_id'
	| 'blueprintId'
	| 'blueprintConfigPresetId'
	| 'lastBlueprintConfig'
	| 'lastBlueprintFixUpHash'
	| 'blueprintConfigWithOverrides'
	| 'name'
export const showStyleFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBShowStyleBase, ShowStyleBaseFields>>
>({
	_id: 1,
	blueprintId: 1,
	blueprintConfigPresetId: 1,
	lastBlueprintConfig: 1,
	lastBlueprintFixUpHash: 1,
	blueprintConfigWithOverrides: 1,
	name: 1,
})

export type BlueprintFields =
	| '_id'
	| 'studioConfigPresets'
	| 'studioConfigSchema'
	| 'showStyleConfigPresets'
	| 'showStyleConfigSchema'
	| 'blueprintHash'
	| 'blueprintType'
	| 'hasFixUpFunction'
export const blueprintFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<Blueprint, BlueprintFields>>>({
	_id: 1,
	studioConfigPresets: 1,
	studioConfigSchema: 1,
	showStyleConfigPresets: 1,
	showStyleConfigSchema: 1,
	blueprintHash: 1,
	blueprintType: 1,
	hasFixUpFunction: 1,
})

export interface ContentCache {
	CoreSystem: InMemoryMongoCollection<Pick<ICoreSystem, CoreSystemFields>>
	Studios: InMemoryMongoCollection<Pick<DBStudio, StudioFields>>
	ShowStyleBases: InMemoryMongoCollection<Pick<DBShowStyleBase, ShowStyleBaseFields>>
	Blueprints: InMemoryMongoCollection<Pick<Blueprint, BlueprintFields>>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		CoreSystem: new InMemoryMongoCollection<Pick<ICoreSystem, CoreSystemFields>>('coreSystem'),
		Studios: new InMemoryMongoCollection<Pick<DBStudio, StudioFields>>('studios'),
		ShowStyleBases: new InMemoryMongoCollection<Pick<DBShowStyleBase, ShowStyleBaseFields>>('showStyleBases'),
		Blueprints: new InMemoryMongoCollection<Pick<Blueprint, BlueprintFields>>('blueprints'),
	}

	return cache
}
