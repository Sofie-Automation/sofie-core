import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { RundownPlaylists, Rundowns, Segments } from '../../collections'
import { logger } from '../../logging'
import { runIngestOperation } from './lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { QueueStudioJob } from '../../worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { MeteorDebugMethods } from '../../methods'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'

MeteorDebugMethods({
	/**
	 * Simulate a 'Reload from NRCS' for the specified playlist
	 */
	debug_playlistRunBlueprints: async (rundownPlaylistId: RundownPlaylistId) => {
		try {
			check(rundownPlaylistId, String)

			const playlist = await RundownPlaylists.findOneAsync(rundownPlaylistId)
			if (!playlist) throw new Error('Playlist not found')

			const job = await QueueStudioJob(StudioJobs.RegeneratePlaylist, playlist.studioId, {
				playlistId: playlist._id,
			})
			await job.complete
		} catch (e) {
			logger.error(e)
			throw e
		}
	},
	/**
	 * Simulate a 'Reload from NRCS' for a particular segment in a rundown
	 * Getting the segmentId is tricky, but can be done by either inspecting the DOM, or the mongo database
	 */
	debug_segmentRunBlueprints: async (segmentId: SegmentId) => {
		check(segmentId, String)

		const segment = await Segments.findOneAsync(segmentId)
		if (!segment) throw new Meteor.Error(404, 'Segment not found')
		const rundown = await Rundowns.findOneAsync(segment.rundownId)
		if (!rundown) throw new Meteor.Error(404, 'Rundown not found')

		await runIngestOperation(rundown.studioId, IngestJobs.RegenerateSegment, {
			rundownExternalId: rundown.externalId,
			segmentExternalId: segment.externalId,
		})
	},
	/**
	 * Regenerate all the expected packages for all rundowns in the system.
	 * Additionally it will recreate any expectedPlayoutItems.
	 * This shouldn't be necessary as ingest will do this for each rundown as part of its workflow
	 */
	debug_recreateExpectedPackages: async () => {
		const rundowns = (await Rundowns.findFetchAsync(
			{},
			{
				projection: {
					_id: 1,
					studioId: 1,
					source: 1,
				},
			}
		)) as Array<Pick<DBRundown, '_id' | 'studioId' | 'source'>>

		await Promise.all(
			rundowns
				.filter((rundown) => rundown.source.type !== 'snapshot')
				.map(async (rundown) =>
					runIngestOperation(rundown.studioId, IngestJobs.ExpectedPackagesRegenerate, {
						rundownId: rundown._id,
					})
				)
		)
	},
})
