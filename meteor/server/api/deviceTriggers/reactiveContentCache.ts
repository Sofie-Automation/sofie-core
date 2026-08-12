import _ from 'underscore'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBTriggeredActions } from '@sofie-automation/meteor-lib/dist/collections/TriggeredActions'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { runOnAbort } from '../../lib/observerLifetime'

export type RundownPlaylistFields =
	| '_id'
	| 'name'
	| 'activationId'
	| 'currentPartInfo'
	| 'nextPartInfo'
	| 'studioId'
	| 'rehearsal'
export const rundownPlaylistFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, RundownPlaylistFields>>
>({
	_id: 1,
	name: 1,
	activationId: 1,
	currentPartInfo: 1,
	nextPartInfo: 1,
	studioId: 1,
	rehearsal: 1,
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
	RundownPlaylists: InMemoryMongoCollection<Pick<DBRundownPlaylist, RundownPlaylistFields>>
	ShowStyleBases: InMemoryMongoCollection<DBShowStyleBase>
	Segments: InMemoryMongoCollection<Pick<DBSegment, SegmentFields>>
	Parts: InMemoryMongoCollection<Pick<DBPart, PartFields>>
	PartInstances: InMemoryMongoCollection<Pick<DBPartInstance, PartInstanceFields>>
	AdLibPieces: InMemoryMongoCollection<Pick<AdLibPiece, AdLibPieceFields>>
	AdLibActions: InMemoryMongoCollection<Pick<AdLibAction, AdLibActionFields>>
	RundownBaselineAdLibPieces: InMemoryMongoCollection<Pick<RundownBaselineAdLibItem, AdLibPieceFields>>
	RundownBaselineAdLibActions: InMemoryMongoCollection<Pick<RundownBaselineAdLibAction, AdLibActionFields>>
	TriggeredActions: InMemoryMongoCollection<DBTriggeredActions>
}

type ReactionWithCache = (cache: ContentCache) => void

/**
 * Build the cache and start reacting to changes in it, for the lifetime of `signal`: once that aborts
 * no further reactions are delivered and any pending one is cancelled.
 */
export function createReactiveContentCache(
	reaction: ReactionWithCache,
	reactivityDebounce: number,
	signal: AbortSignal
): ContentCache {
	const innerReaction = _.debounce(() => {
		if (signal.aborted) return
		reaction(cache)
	}, reactivityDebounce)
	runOnAbort(signal, () => innerReaction.cancel())

	const cache: ContentCache = {
		RundownPlaylists: new InMemoryMongoCollection<Pick<DBRundownPlaylist, RundownPlaylistFields>>(
			'rundownPlaylists',
			{ onChange: innerReaction }
		),
		ShowStyleBases: new InMemoryMongoCollection<DBShowStyleBase>('showStyleBases', { onChange: innerReaction }),
		Segments: new InMemoryMongoCollection<Pick<DBSegment, SegmentFields>>('segments', { onChange: innerReaction }),
		PartInstances: new InMemoryMongoCollection<Pick<DBPartInstance, PartInstanceFields>>('partInstances', {
			onChange: innerReaction,
		}),
		Parts: new InMemoryMongoCollection<Pick<DBPart, PartFields>>('parts', { onChange: innerReaction }),
		AdLibPieces: new InMemoryMongoCollection<Pick<AdLibPiece, AdLibPieceFields>>('adLibPieces', {
			onChange: innerReaction,
		}),
		AdLibActions: new InMemoryMongoCollection<Pick<AdLibAction, AdLibActionFields>>('adLibActions', {
			onChange: innerReaction,
		}),
		RundownBaselineAdLibPieces: new InMemoryMongoCollection<Pick<RundownBaselineAdLibItem, AdLibPieceFields>>(
			'rundownBaselineAdLibPieces',
			{ onChange: innerReaction }
		),
		RundownBaselineAdLibActions: new InMemoryMongoCollection<Pick<RundownBaselineAdLibAction, AdLibActionFields>>(
			'rundownBaselineAdLibActions',
			{ onChange: innerReaction }
		),
		TriggeredActions: new InMemoryMongoCollection<DBTriggeredActions>('triggeredActions', {
			onChange: innerReaction,
		}),
	}

	innerReaction()

	return cache
}
