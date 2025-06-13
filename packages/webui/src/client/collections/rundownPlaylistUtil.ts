import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Rundown, DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { sortRundownIDsInPlaylist } from '@sofie-automation/corelib/dist/playout/playlist'
import _ from 'underscore'
import { Rundowns } from './index.js'
import { FindOptions } from './lib.js'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'

/**
 * Direct database accessors for the RundownPlaylist
 * These used to reside on the Rundown class
 */
export class RundownPlaylistCollectionUtil {
	/** Returns an array of all Rundowns in the RundownPlaylist, sorted in playout order */
	static getRundownsOrdered(
		playlist: Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>,
		selector?: MongoQuery<Rundown>,
		options?: FindOptions<Rundown>
	): Rundown[] {
		const allRundowns = RundownPlaylistCollectionUtil.getRundownsUnordered(playlist._id, selector, options)

		const rundownsMap = normalizeArrayToMap(allRundowns, '_id')

		const sortedIds = sortRundownIDsInPlaylist(playlist.rundownIdsInOrder, Array.from(rundownsMap.keys()))

		return _.compact(sortedIds.map((id) => rundownsMap.get(id)))
	}
	/** Returns an array of all Rundowns in the RundownPlaylist, in no predictable order */
	static getRundownsUnordered(
		playlistId: RundownPlaylistId,
		selector?: MongoQuery<Rundown>,
		options?: FindOptions<Rundown>
	): Rundown[] {
		return Rundowns.find(
			{
				playlistId: playlistId,
				...selector,
			},
			{
				sort: {
					_id: 1,
				},
				...options,
			}
		).fetch()
	}
	/** Returns an array with the id:s of all Rundowns in the RundownPlaylist, sorted in playout order */
	static getRundownOrderedIDs(playlist: Pick<DBRundownPlaylist, '_id' | 'rundownIdsInOrder'>): RundownId[] {
		const allIds = RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist)

		return sortRundownIDsInPlaylist(playlist.rundownIdsInOrder, allIds)
	}
	/** Returns an array with the id:s of all Rundowns in the RundownPlaylist, in no predictable order */
	static getRundownUnorderedIDs(playlist: Pick<DBRundownPlaylist, '_id'>): RundownId[] {
		const rundowns = Rundowns.find(
			{
				playlistId: playlist._id,
			},
			{
				fields: {
					_id: 1,
				},
			}
		).fetch() as Array<Pick<DBRundown, '_id'>>

		return rundowns.map((i) => i._id)
	}
}
