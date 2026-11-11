import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { DBStudio, IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { UIPart } from '../partsUI/publication'
import type { UIPartInstance } from '../partInstancesUI/publication'

export type RundownPlaylistFields =
	| '_id'
	| 'studioId'
	| 'activationId'
	| 'timing'
	| 'startedPlayback'
	| 'currentPartInfo'
	| 'nextPartInfo'
	| 'outOfOrderTiming'
	| 'segmentsStartedPlayback'
	| 'quickLoop'
	| 'rundownIdsInOrder'
export const rundownPlaylistFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, RundownPlaylistFields>>
>({
	_id: 1,
	studioId: 1,
	activationId: 1,
	timing: 1,
	startedPlayback: 1,
	currentPartInfo: 1,
	nextPartInfo: 1,
	outOfOrderTiming: 1,
	segmentsStartedPlayback: 1,
	quickLoop: 1,
	rundownIdsInOrder: 1,
})

export type SegmentFields = '_id' | '_rank' | 'rundownId' | 'segmentTiming'
export const segmentFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBSegment, SegmentFields>>>({
	_id: 1,
	_rank: 1,
	rundownId: 1,
	segmentTiming: 1,
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
	RundownPlaylists: InMemoryMongoCollection<Pick<DBRundownPlaylist, RundownPlaylistFields>>
	Segments: InMemoryMongoCollection<Pick<DBSegment, SegmentFields>>
	/** As published by `uiParts`, not the Parts collection - see RundownContentObserver */
	Parts: InMemoryMongoCollection<UIPart>
	/** As published by `uiPartInstances`, not the PartInstances collection - see RundownContentObserver */
	PartInstances: InMemoryMongoCollection<UIPartInstance>
}

export function createReactiveContentCache(): ContentCache {
	const cache: ContentCache = {
		StudioSettings: new InMemoryMongoCollection<StudioSettingsDoc>('studioSettings'),
		RundownPlaylists: new InMemoryMongoCollection<Pick<DBRundownPlaylist, RundownPlaylistFields>>(
			'rundownPlaylists'
		),
		Segments: new InMemoryMongoCollection<Pick<DBSegment, SegmentFields>>('segments'),
		Parts: new InMemoryMongoCollection<UIPart>('parts'),
		PartInstances: new InMemoryMongoCollection<UIPartInstance>('partInstances'),
	}

	return cache
}
