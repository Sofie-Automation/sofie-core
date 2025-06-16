import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { ReactiveCacheCollection } from '../lib/ReactiveCacheCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'

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

export type PartInstanceFields = '_id' | 'segmentId' | 'rundownId' | 'orphaned' | 'reset' | 'part'
export const partInstanceFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<PartInstance, PartInstanceFields>>
>({
	_id: 1,
	segmentId: 1,
	rundownId: 1,
	orphaned: 1,
	reset: 1,
	// @ts-expect-error Deep not supported
	'part.title': 1,
})

export interface ContentCache {
	Rundowns: ReactiveCacheCollection<Pick<Rundown, RundownFields>>
	Segments: ReactiveCacheCollection<Pick<DBSegment, SegmentFields>>
	Parts: ReactiveCacheCollection<Pick<DBPart, PartFields>>
	DeletedPartInstances: ReactiveCacheCollection<Pick<PartInstance, PartInstanceFields>>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		Rundowns: new ReactiveCacheCollection<Pick<Rundown, RundownFields>>('rundowns'),
		Segments: new ReactiveCacheCollection<Pick<DBSegment, SegmentFields>>('segments'),
		Parts: new ReactiveCacheCollection<Pick<DBPart, PartFields>>('parts'),
		DeletedPartInstances: new ReactiveCacheCollection<Pick<PartInstance, PartInstanceFields>>(
			'deletedPartInstances'
		),
	}

	return cache
}
