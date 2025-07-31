import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ReactiveCacheCollection } from '../../publications/lib/ReactiveCacheCollection'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'

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
	RundownPlaylists: ReactiveCacheCollection<Pick<DBRundownPlaylist, RundownPlaylistFields>>
	ShowStyleBases: ReactiveCacheCollection<DBShowStyleBase>
	PieceInstances: ReactiveCacheCollection<Pick<PieceInstance, PieceInstanceFields>>
	PartInstances: ReactiveCacheCollection<Pick<DBPartInstance, PartInstanceFields>>
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
		PieceInstances: new ReactiveCacheCollection<Pick<PieceInstance, PieceInstanceFields>>(
			'pieceInstances',
			innerReaction
		),
		PartInstances: new ReactiveCacheCollection<Pick<DBPartInstance, PartInstanceFields>>(
			'partInstances',
			innerReaction
		),
	}

	innerReaction()

	return { cache, cancel }
}
