import { BrandingContentCache, createBrandingContentCache } from '../lib/branding'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierZeroes } from '@sofie-automation/corelib/dist/mongo'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'

export type RundownBaselineAdLibActionOmitedFields = 'privateData'
export const rundownBaselineAdLibActionFieldSpecifier = literal<MongoFieldSpecifierZeroes<RundownBaselineAdLibAction>>({
	privateData: 0,
})

export interface ContentCache extends BrandingContentCache {
	RundownBaselineAdLibActions: InMemoryMongoCollection<
		Omit<RundownBaselineAdLibAction, RundownBaselineAdLibActionOmitedFields>
	>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		...createBrandingContentCache(),
		RundownBaselineAdLibActions: new InMemoryMongoCollection<
			Omit<RundownBaselineAdLibAction, RundownBaselineAdLibActionOmitedFields>
		>('rundownBaselineAdLibActions'),
	}

	return cache
}
