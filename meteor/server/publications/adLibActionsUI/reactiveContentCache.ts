import { BrandingContentCache, createBrandingContentCache } from '../lib/branding'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierZeroes } from '@sofie-automation/corelib/dist/mongo'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'

export type AdLibActionOmitedFields = 'privateData'
export const adLibActionFieldSpecifier = literal<MongoFieldSpecifierZeroes<AdLibAction>>({
	privateData: 0,
})

export interface ContentCache extends BrandingContentCache {
	AdLibActions: InMemoryMongoCollection<Omit<AdLibAction, AdLibActionOmitedFields>>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		...createBrandingContentCache(),
		AdLibActions: new InMemoryMongoCollection<Omit<AdLibAction, AdLibActionOmitedFields>>('adLibActions'),
	}

	return cache
}
