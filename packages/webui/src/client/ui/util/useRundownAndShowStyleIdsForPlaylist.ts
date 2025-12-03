import {
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	ShowStyleVariantId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownPlaylistCollectionUtil } from '../../collections/rundownPlaylistUtil.js'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData.js'
import _ from 'underscore'

interface RundownAndShowStyleIds {
	rundownIds: RundownId[]
	showStyleBaseIds: ShowStyleBaseId[]
	showStyleVariantIds: ShowStyleVariantId[]
}

export function useRundownAndShowStyleIdsForPlaylist(
	playlistId: RundownPlaylistId | undefined
): RundownAndShowStyleIds {
	return useTracker(
		() => {
			if (playlistId) {
				const rundowns = RundownPlaylistCollectionUtil.getRundownsUnordered(playlistId, undefined, {
					fields: {
						_id: 1,
						showStyleBaseId: 1,
						showStyleVariantId: 1,
					},
				}) as Array<Pick<Rundown, '_id' | 'showStyleBaseId' | 'showStyleVariantId'>>
				const rundownIds = rundowns.map((r) => r._id)
				const showStyleBaseIds = _.uniq(rundowns.map((r) => r.showStyleBaseId))
				const showStyleVariantIds = _.uniq(rundowns.map((r) => r.showStyleVariantId))

				return { rundownIds, showStyleBaseIds, showStyleVariantIds }
			} else {
				return { rundownIds: [], showStyleBaseIds: [], showStyleVariantIds: [] }
			}
		},
		[playlistId],
		{ rundownIds: [], showStyleBaseIds: [], showStyleVariantIds: [] }
	)
}
