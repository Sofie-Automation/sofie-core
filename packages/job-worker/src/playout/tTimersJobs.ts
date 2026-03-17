import { JobContext } from '../jobs/index.js'
import { recalculateTTimerProjections } from './tTimers.js'
import { runWithPlayoutModel, runWithPlaylistLock } from './lock.js'

/**
 * Handle RecalculateTTimerProjections job
 * This is called after setNext, takes, and ingest changes to update T-Timer projections
 * Since this job doesn't take a playlistId parameter, it finds the active playlist in the studio
 */
export async function handleRecalculateTTimerProjections(context: JobContext): Promise<void> {
	// Find active playlists in this studio (projection to just get IDs)
	const activePlaylistIds = await context.directCollections.RundownPlaylists.findFetch(
		{
			studioId: context.studioId,
			activationId: { $exists: true },
		},
		{
			projection: {
				_id: 1,
			},
		}
	)

	if (activePlaylistIds.length === 0) {
		// No active playlist, nothing to do
		return
	}

	// Process each active playlist (typically there's only one)
	for (const playlistRef of activePlaylistIds) {
		await runWithPlaylistLock(context, playlistRef._id, async (lock) => {
			// Fetch the full playlist object
			const playlist = await context.directCollections.RundownPlaylists.findOne(playlistRef._id)
			if (!playlist) {
				// Playlist was removed between query and lock
				return
			}

			await runWithPlayoutModel(context, playlist, lock, null, async (playoutModel) => {
				recalculateTTimerProjections(context, playoutModel)
			})
		})
	}
}
