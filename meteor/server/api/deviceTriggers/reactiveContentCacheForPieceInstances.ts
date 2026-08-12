import _ from 'underscore'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { runOnAbort } from '../../lib/observerLifetime'

export type RundownPlaylistFields =
	| '_id'
	| 'name'
	| 'activationId'
	| 'currentPartInfo'
	| 'nextPartInfo'
	| 'previousPartInfo'
export const rundownPlaylistFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, RundownPlaylistFields>>
>({
	_id: 1,
	name: 1,
	activationId: 1,
	currentPartInfo: 1,
	nextPartInfo: 1,
	previousPartInfo: 1,
})

export type PieceInstanceFields =
	| '_id'
	| 'partInstanceId'
	| 'playlistActivationId'
	| 'reportedStartedPlayback'
	| 'reportedStoppedPlayback'
	| 'piece'
	| 'disabled'
	| 'infinite'
	| 'reset'
export const pieceInstanceFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<PieceInstance, PieceInstanceFields>>
>({
	_id: 1,
	partInstanceId: 1,
	playlistActivationId: 1,
	reportedStartedPlayback: 1,
	reportedStoppedPlayback: 1,
	piece: 1,
	disabled: 1,
	infinite: 1,
	reset: 1,
})

export type PartInstanceFields = '_id' | 'playlistActivationId' | 'timings' | 'reset'
export const partInstanceFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBPartInstance, PartInstanceFields>>
>({
	_id: 1,
	playlistActivationId: 1,
	timings: 1,
	reset: 1,
})

export interface ContentCache {
	RundownPlaylists: InMemoryMongoCollection<Pick<DBRundownPlaylist, RundownPlaylistFields>>
	ShowStyleBases: InMemoryMongoCollection<DBShowStyleBase>
	PieceInstances: InMemoryMongoCollection<Pick<PieceInstance, PieceInstanceFields>>
	PartInstances: InMemoryMongoCollection<Pick<DBPartInstance, PartInstanceFields>>
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
		PieceInstances: new InMemoryMongoCollection<Pick<PieceInstance, PieceInstanceFields>>('pieceInstances', {
			onChange: innerReaction,
		}),
		PartInstances: new InMemoryMongoCollection<Pick<DBPartInstance, PartInstanceFields>>('partInstances', {
			onChange: innerReaction,
		}),
	}

	innerReaction()

	return cache
}
