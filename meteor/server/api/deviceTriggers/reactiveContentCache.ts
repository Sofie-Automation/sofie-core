import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBTriggeredActions } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { ReactiveCacheCollection } from '../../publications/lib/ReactiveCacheCollection'

export type RundownPlaylistFields = '_id' | 'name' | 'activationId' | 'currentPartInfo' | 'nextPartInfo'
export const rundownPlaylistFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, RundownPlaylistFields>>
>({
	_id: 1,
	name: 1,
	activationId: 1,
	currentPartInfo: 1,
	nextPartInfo: 1,
})

export type SegmentFields = '_id' | '_rank' | 'isHidden' | 'name' | 'rundownId' | 'identifier'
export const segmentFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBSegment, SegmentFields>>>({
	_id: 1,
	_rank: 1,
	isHidden: 1,
	name: 1,
	rundownId: 1,
	identifier: 1,
})

export type PartFields =
	| '_id'
	| '_rank'
	| 'title'
	| 'identifier'
	| 'autoNext'
	| 'floated'
	| 'gap'
	| 'invalid'
	| 'invalidReason'
	| 'rundownId'
	| 'segmentId'
	| 'untimed'
export const partFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBPart, PartFields>>>({
	_id: 1,
	_rank: 1,
	autoNext: 1,
	floated: 1,
	gap: 1,
	identifier: 1,
	invalid: 1,
	invalidReason: 1,
	rundownId: 1,
	segmentId: 1,
	title: 1,
	untimed: 1,
})

export type PartInstanceFields = '_id' | 'part'
export const partInstanceFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBPartInstance, PartInstanceFields>>
>({
	_id: 1,
	part: 1,
})

export type AdLibActionFields =
	| '_id'
	| 'actionId'
	| 'display'
	| 'partId'
	| 'rundownId'
	| 'triggerModes'
	| 'userData'
	| 'uniquenessId'
	| 'userDataManifest'
export const adLibActionFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<AdLibAction, AdLibActionFields>>>({
	_id: 1,
	actionId: 1,
	display: 1,
	partId: 1,
	rundownId: 1,
	triggerModes: 1,
	uniquenessId: 1,
	userData: 1,
	userDataManifest: 1,
})

export type AdLibPieceFields =
	| '_id'
	| '_rank'
	| 'name'
	| 'sourceLayerId'
	| 'outputLayerId'
	| 'content'
	| 'expectedDuration'
	| 'currentPieceTags'
	| 'nextPieceTags'
	| 'invertOnAirState'
	| 'invalid'
	| 'lifespan'
	| 'floated'
	| 'rundownId'
	| 'partId'
	| 'tags'
	| 'uniquenessId'
export const adLibPieceFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<AdLibPiece, AdLibPieceFields>>>({
	_id: 1,
	_rank: 1,
	name: 1,
	sourceLayerId: 1,
	outputLayerId: 1,
	content: 1,
	expectedDuration: 1,
	currentPieceTags: 1,
	nextPieceTags: 1,
	invertOnAirState: 1,
	invalid: 1,
	lifespan: 1,
	floated: 1,
	partId: 1,
	rundownId: 1,
	tags: 1,
	uniquenessId: 1,
})

export interface ContentCache {
	RundownPlaylists: ReactiveCacheCollection<Pick<DBRundownPlaylist, RundownPlaylistFields>>
	ShowStyleBases: ReactiveCacheCollection<DBShowStyleBase>
	Segments: ReactiveCacheCollection<Pick<DBSegment, SegmentFields>>
	Parts: ReactiveCacheCollection<Pick<DBPart, PartFields>>
	PartInstances: ReactiveCacheCollection<Pick<DBPartInstance, PartInstanceFields>>
	AdLibPieces: ReactiveCacheCollection<Pick<AdLibPiece, AdLibPieceFields>>
	AdLibActions: ReactiveCacheCollection<Pick<AdLibAction, AdLibActionFields>>
	RundownBaselineAdLibPieces: ReactiveCacheCollection<Pick<RundownBaselineAdLibItem, AdLibPieceFields>>
	RundownBaselineAdLibActions: ReactiveCacheCollection<Pick<RundownBaselineAdLibAction, AdLibActionFields>>
	TriggeredActions: ReactiveCacheCollection<DBTriggeredActions>
}

type ReactionWithCache = (cache: ContentCache) => void

export function createReactiveContentCache(
	reaction: ReactionWithCache,
	reactivityDebounce: number
): { cache: ContentCache; cancel: () => void } {
	let isCancelled = false
	const innerReaction = _.debounce(
		Meteor.bindEnvironment(() => {
			if (isCancelled) return
			reaction(cache)
		}),
		reactivityDebounce
	)
	const cancel = () => {
		isCancelled = true
		innerReaction.cancel()
	}

	const cache: ContentCache = {
		RundownPlaylists: new ReactiveCacheCollection<Pick<DBRundownPlaylist, RundownPlaylistFields>>(
			'rundownPlaylists',
			innerReaction
		),
		ShowStyleBases: new ReactiveCacheCollection<DBShowStyleBase>('showStyleBases', innerReaction),
		Segments: new ReactiveCacheCollection<Pick<DBSegment, SegmentFields>>('segments', innerReaction),
		PartInstances: new ReactiveCacheCollection<Pick<DBPartInstance, PartInstanceFields>>(
			'partInstances',
			innerReaction
		),
		Parts: new ReactiveCacheCollection<Pick<DBPart, PartFields>>('parts', innerReaction),
		AdLibPieces: new ReactiveCacheCollection<Pick<AdLibPiece, AdLibPieceFields>>('adLibPieces', innerReaction),
		AdLibActions: new ReactiveCacheCollection<Pick<AdLibAction, AdLibActionFields>>('adLibActions', innerReaction),
		RundownBaselineAdLibPieces: new ReactiveCacheCollection<Pick<RundownBaselineAdLibItem, AdLibPieceFields>>(
			'rundownBaselineAdLibPieces',
			innerReaction
		),
		RundownBaselineAdLibActions: new ReactiveCacheCollection<Pick<RundownBaselineAdLibAction, AdLibActionFields>>(
			'rundownBaselineAdLibActions',
			innerReaction
		),
		TriggeredActions: new ReactiveCacheCollection<DBTriggeredActions>('triggeredActions', innerReaction),
	}

	innerReaction()

	return { cache, cancel }
}
