import { ShowStyleBaseId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBStudio, StudioLight } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { ShowStyleBases, Studios } from './collections'

/**
 * Returns a "light" version of the Studio, where the most heavy/large properties are omitted.
 */
export async function fetchStudioLight(studioId: StudioId): Promise<StudioLight | undefined> {
	return Studios.findOneAsync(studioId, {
		projection: {
			mappingsWithOverrides: 0,
			blueprintConfigWithOverrides: 0,
		},
	})
}

export async function fetchStudioIds(selector: MongoQuery<DBStudio>): Promise<StudioId[]> {
	const studios = await Studios.findFetchAsync(selector, {
		projection: {
			_id: 1,
		},
	})

	return studios.map((s) => s._id)
}

/** Checks if a studio exists */
export async function checkStudioExists(studioId: StudioId): Promise<boolean> {
	const studio = await Studios.findOneAsync(studioId, {
		projection: {
			_id: 1,
		},
	})

	return !!studio
}

/**
 * Returns a "light" version of the Studio, where the most heavy/large properties are omitted.
 */
export async function fetchShowStyleBaseLight(showStyleId: ShowStyleBaseId): Promise<ShowStyleBaseLight | undefined> {
	return ShowStyleBases.findOneAsync(showStyleId, {
		projection: {
			blueprintConfigWithOverrides: 0,
			outputLayersWithOverrides: 0,
			sourceLayersWithOverrides: 0,
		},
	})
}
export async function fetchShowStyleBasesLight(selector: MongoQuery<DBShowStyleBase>): Promise<ShowStyleBaseLight[]> {
	return ShowStyleBases.findFetchAsync(selector, {
		projection: {
			blueprintConfigWithOverrides: 0,
			outputLayersWithOverrides: 0,
			sourceLayersWithOverrides: 0,
		},
	})
}
export type ShowStyleBaseLight = Omit<
	DBShowStyleBase,
	'blueprintConfigWithOverrides' | 'outputLayersWithOverrides' | 'sourceLayersWithOverrides'
>
