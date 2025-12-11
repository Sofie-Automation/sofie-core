import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { ReactiveCacheCollection } from '../lib/ReactiveCacheCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict, MongoFieldSpecifierZeroes } from '@sofie-automation/corelib/dist/mongo'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBStudio, IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'

export type RundownPlaylistCompact = Pick<DBRundownPlaylist, '_id' | 'activationId' | 'quickLoop' | 'rundownIdsInOrder'>
export const rundownPlaylistFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<RundownPlaylistCompact>>({
	_id: 1,
	activationId: 1,
	quickLoop: 1, // so that it invalidates when the markers or state of the loop change
	rundownIdsInOrder: 1,
})

export type SegmentFields = '_id' | '_rank' | 'rundownId'
export const segmentFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBSegment, SegmentFields>>>({
	_id: 1,
	_rank: 1,
	rundownId: 1,
})

export type PartFields = '_id' | '_rank' | 'rundownId' | 'segmentId'
export const partFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBPart, PartFields>>>({
	_id: 1,
	_rank: 1,
	segmentId: 1,
	rundownId: 1,
})

export type PartInstanceOmitedFields = 'part.privateData'
export const partInstanceFieldSpecifier = literal<MongoFieldSpecifierZeroes<DBPartInstance>>({
	// @ts-expect-error Mongo typings aren't clever enough yet
	'part.privateData': 0,
})

export type StudioFields = '_id' | 'settingsWithOverrides'
export const studioFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBStudio, StudioFields>>>({
	_id: 1,
	settingsWithOverrides: 1,
})

export interface StudioSettingsDoc {
	_id: StudioId
	settings: IStudioSettings
}

export interface ContentCache {
	StudioSettings: ReactiveCacheCollection<StudioSettingsDoc>
	Segments: ReactiveCacheCollection<Pick<DBSegment, SegmentFields>>
	Parts: ReactiveCacheCollection<Pick<DBPart, PartFields>>
	PartInstances: ReactiveCacheCollection<Omit<DBPartInstance, PartInstanceOmitedFields>>
	RundownPlaylists: ReactiveCacheCollection<RundownPlaylistCompact>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		StudioSettings: new ReactiveCacheCollection<StudioSettingsDoc>('studioSettings'),
		Segments: new ReactiveCacheCollection<Pick<DBSegment, SegmentFields>>('segments'),
		Parts: new ReactiveCacheCollection<Pick<DBPart, PartFields>>('parts'),
		PartInstances: new ReactiveCacheCollection<Omit<DBPartInstance, PartInstanceOmitedFields>>('partInstances'),
		RundownPlaylists: new ReactiveCacheCollection<RundownPlaylistCompact>('rundownPlaylists'),
	}

	return cache
}
