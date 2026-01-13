import { RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { JobContext } from '../jobs/index.js'

export async function getActiveRundownPlaylistsInStudioFromDb(
	context: JobContext,
	studioId: StudioId,
	excludeRundownPlaylistId?: RundownPlaylistId
): Promise<Array<Pick<DBRundownPlaylist, '_id' | 'name' | 'activationId'>>> {
	return context.directCollections.RundownPlaylists.findFetch(
		{
			studioId: studioId,
			activationId: { $exists: true },
			_id: {
				$ne: excludeRundownPlaylistId || protectString(''),
			},
		},
		{
			projection: {
				_id: 1,
				name: 1,
				activationId: 1,
			},
		}
	)
}
