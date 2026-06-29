import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict, MongoFieldSpecifierZeroes } from '@sofie-automation/corelib/dist/mongo'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { DBStudio, IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

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

export type PartOmitedFields = 'privateData'
export const partFieldSpecifier = literal<MongoFieldSpecifierZeroes<Pick<DBPart, PartOmitedFields>>>({
	privateData: 0,
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
	StudioSettings: InMemoryMongoCollection<StudioSettingsDoc>
	Segments: InMemoryMongoCollection<Pick<DBSegment, SegmentFields>>
	Parts: InMemoryMongoCollection<Omit<DBPart, PartOmitedFields>>
	RundownPlaylists: InMemoryMongoCollection<RundownPlaylistCompact>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		StudioSettings: new InMemoryMongoCollection<StudioSettingsDoc>('studioSettings'),
		Segments: new InMemoryMongoCollection<Pick<DBSegment, SegmentFields>>('segments'),
		Parts: new InMemoryMongoCollection<Omit<DBPart, PartOmitedFields>>('parts'),
		RundownPlaylists: new InMemoryMongoCollection<RundownPlaylistCompact>('rundownPlaylists'),
	}

	return cache
}
