import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { ReactiveCacheCollection } from '../lib/ReactiveCacheCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import type { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import type { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import type { NrcsIngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import type { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

export type PlaylistCompact = Pick<
	DBRundownPlaylist,
	'_id' | 'activationId' | 'rehearsal' | 'currentPartInfo' | 'nextPartInfo'
>
export const playlistFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<PlaylistCompact>>({
	_id: 1,
	activationId: 1,
	rehearsal: 1,
	currentPartInfo: 1,
	nextPartInfo: 1,
})

export type RundownCompact = Pick<DBRundown, '_id' | 'externalId' | 'playlistId'>
export const rundownFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<RundownCompact>>({
	_id: 1,
	externalId: 1,
	playlistId: 1,
})

export type PartCompact = Pick<
	DBPart,
	| '_id'
	| 'rundownId'
	| 'segmentId'
	| 'externalId'
	| 'shouldNotifyCurrentPlayingPart'
	| 'ingestNotifyPartReady'
	| 'ingestNotifyItemsReady'
	| 'ingestNotifyPartExternalId'
>
export const partFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<PartCompact>>({
	_id: 1,
	rundownId: 1,
	segmentId: 1,
	externalId: 1,
	shouldNotifyCurrentPlayingPart: 1,
	ingestNotifyPartReady: 1,
	ingestNotifyItemsReady: 1,
	ingestNotifyPartExternalId: 1,
})

export type PartInstanceCompact = Pick<PartInstance, '_id' | 'rundownId' | 'segmentId' | 'part' | 'takeCount'>
export const partInstanceFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<PartInstanceCompact>>({
	_id: 1,
	rundownId: 1,
	segmentId: 1,
	part: 1, // This could be more granular, but it should be pretty stable
	takeCount: 1,
})

export type NrcsIngestDataCacheObjCompact = Pick<
	NrcsIngestDataCacheObj,
	'_id' | 'type' | 'rundownId' | 'segmentId' | 'partId'
> & { data: { externalId: string } }
export const nrcsIngestDataCacheObjSpecifier = literal<MongoFieldSpecifierOnesStrict<NrcsIngestDataCacheObjCompact>>({
	_id: 1,
	type: 1,
	rundownId: 1,
	segmentId: 1,
	partId: 1,
	data: {
		// We need to be very selective here, as the payload portion could contain data not safe for minimongo
		externalId: 1,
	},
})

export interface ContentCache {
	RundownIds: RundownId[]

	Playlists: ReactiveCacheCollection<PlaylistCompact>
	Rundowns: ReactiveCacheCollection<RundownCompact>
	NrcsIngestData: ReactiveCacheCollection<NrcsIngestDataCacheObjCompact>
	Parts: ReactiveCacheCollection<PartCompact>
	PartInstances: ReactiveCacheCollection<PartInstanceCompact>
}

export function createReactiveContentCache(rundownIds: RundownId[]): ContentCache {
	const cache: ContentCache = {
		RundownIds: rundownIds,

		Playlists: new ReactiveCacheCollection<PlaylistCompact>('playlists'),
		Rundowns: new ReactiveCacheCollection<RundownCompact>('rundowns'),
		NrcsIngestData: new ReactiveCacheCollection<NrcsIngestDataCacheObjCompact>('nrcsIngestData'),
		Parts: new ReactiveCacheCollection<PartCompact>('parts'),
		PartInstances: new ReactiveCacheCollection<PartInstanceCompact>('partInstances'),
	}

	return cache
}
