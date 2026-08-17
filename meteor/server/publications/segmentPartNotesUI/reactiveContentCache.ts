import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'

export type RundownFields = '_id' | 'playlistId' | 'source'
export const rundownFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<Rundown, RundownFields>>>({
	_id: 1,
	playlistId: 1,
	source: 1,
})

export type SegmentFields = '_id' | '_rank' | 'rundownId' | 'name' | 'notes' | 'orphaned'
export const segmentFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBSegment, SegmentFields>>>({
	_id: 1,
	_rank: 1,
	rundownId: 1,
	name: 1,
	notes: 1,
	orphaned: 1,
})

export type PartFields = '_id' | '_rank' | 'segmentId' | 'rundownId' | 'notes' | 'title' | 'invalid' | 'invalidReason'
export const partFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBPart, PartFields>>>({
	_id: 1,
	_rank: 1,
	segmentId: 1,
	rundownId: 1,
	notes: 1,
	title: 1,
	invalid: 1,
	invalidReason: 1,
})

export type PartInstanceFields = '_id' | 'segmentId' | 'rundownId' | 'orphaned' | 'reset' | 'part' | 'invalidReason'
export const partInstanceFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<PartInstance, PartInstanceFields>>
>({
	_id: 1,
	segmentId: 1,
	rundownId: 1,
	orphaned: 1,
	reset: 1,
	invalidReason: 1,
	// @ts-expect-error Deep not supported
	'part._id': 1,
	'part.title': 1,
})

export interface ContentCache {
	Rundowns: InMemoryMongoCollection<Pick<Rundown, RundownFields>>
	Segments: InMemoryMongoCollection<Pick<DBSegment, SegmentFields>>
	Parts: InMemoryMongoCollection<Pick<DBPart, PartFields>>
	PartInstances: InMemoryMongoCollection<Pick<PartInstance, PartInstanceFields>>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		Rundowns: new InMemoryMongoCollection<Pick<Rundown, RundownFields>>('rundowns'),
		Segments: new InMemoryMongoCollection<Pick<DBSegment, SegmentFields>>('segments'),
		Parts: new InMemoryMongoCollection<Pick<DBPart, PartFields>>('parts'),
		PartInstances: new InMemoryMongoCollection<Pick<PartInstance, PartInstanceFields>>('partInstances'),
	}

	return cache
}
