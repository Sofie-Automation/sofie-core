import { Meteor } from 'meteor/meteor'
import { z } from 'zod'
import { logger } from '../../logging'
import { PartInstances, PieceInstances, RundownPlaylists } from '../../collections'
import { check } from '../../lib/check'
import { profiler } from '../profiler'
import { QueueForceClearAllCaches, QueueStudioJob } from '../../worker/worker'
import { StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { fetchStudioIds } from '../../optimizations'
import { PeripheralDeviceId, RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { insertInputDeviceTriggerIntoPreview } from '../../publications/deviceTriggersPreview'
import { MeteorDebugMethod } from '../../methods'

// These are temporary method to fill the rundown database with some sample data
// for development

export const playoutDebugMethods: { [key: string]: MeteorDebugMethod } = {
	/**
	 * Remove a playlist from the system.
	 * This can be done in the ui too, but this will bypass any checks that are usually performed
	 */
	async debug_removePlaylist(id: RundownPlaylistId) {
		logger.debug('Remove rundown "' + id + '"')

		const playlist = await RundownPlaylists.findOneAsync(id)
		if (!playlist) throw new Meteor.Error(404, `RundownPlaylist "${id}" not found`)

		const job = await QueueStudioJob(StudioJobs.RemovePlaylist, playlist.studioId, {
			playlistId: playlist._id,
		})
		await job.complete
	},

	/**
	 * Remove ALL playlists from the system.
	 * Be careful with this, it doesn't care that they might be active
	 */
	async debug_removeAllPlaylists() {
		logger.debug('Remove all rundowns')

		const playlists = await RundownPlaylists.findFetchAsync({})

		await Promise.all(
			playlists.map(async (playlist) => {
				const job = await QueueStudioJob(StudioJobs.RemovePlaylist, playlist.studioId, {
					playlistId: playlist._id,
				})
				await job.complete
			})
		)
	},

	/**
	 * Regenerate the timeline for the specified studio
	 * This will rerun the onTimelineGenerate for your showstyle blueprints, and is particularly useful for debugging that
	 */
	debug_updateTimeline: async (studioId: StudioId) => {
		try {
			check(studioId, z.string())
			logger.info(`debug_updateTimeline: "${studioId}"`)

			const transaction = profiler.startTransaction('updateTimeline', 'meteor-debug')

			const job = await QueueStudioJob(StudioJobs.UpdateTimeline, studioId, undefined)

			const span = transaction?.startSpan('queued-job')
			await job.complete
			span?.end()

			console.log(await job.getTimings)

			if (transaction) transaction.end()

			logger.info(`debug_updateTimeline: "${studioId}" - done`)
		} catch (e) {
			logger.error(e)
			throw e
		}
	},

	/**
	 * Ensure that the infinite pieces on the nexted-part are correct
	 * Added to debug some issues with infinites not updating
	 */
	async debug_syncPlayheadInfinitesForNextPartInstance(id: RundownPlaylistId) {
		logger.info(`syncPlayheadInfinitesForNextPartInstance ${id}`)

		const playlist = await RundownPlaylists.findOneAsync(id)
		if (!playlist) throw new Error(`RundownPlaylist "${id}" not found`)

		const job = await QueueStudioJob(StudioJobs.DebugSyncInfinitesForNextPartInstance, playlist.studioId, {
			playlistId: id,
		})

		await job.complete
	},

	/**
	 * Clear various caches in the system
	 * Good to run if you suspect a cache is stuck with some stale data
	 */
	async debug_forceClearAllCaches() {
		logger.info('forceClearAllCaches')

		const studioIds = await fetchStudioIds({})
		await QueueForceClearAllCaches(studioIds)
	},

	/**
	 * Remove all 'reset' partisntances and pieceinstances
	 * I don't know when this would be useful
	 */
	async debug_clearAllResetInstances() {
		logger.info('clearAllResetInstances')

		await PartInstances.mutableCollection.removeAsync({ reset: true })
		await PieceInstances.mutableCollection.removeAsync({ reset: true })
	},

	/**
	 * Regenerate the nexted-partinstance from its part.
	 * This can be useful to get ingest updates across when the blueprint syncIngestUpdateToPartInstance method is not implemented, or to bypass that method when it is defined
	 */
	async debug_regenerateNextPartInstance(id: RundownPlaylistId) {
		logger.info('regenerateNextPartInstance')

		const playlist = await RundownPlaylists.findOneAsync(id)
		if (!playlist) throw new Error(`RundownPlaylist "${id}" not found`)

		const job = await QueueStudioJob(StudioJobs.DebugRegenerateNextPartInstance, playlist.studioId, {
			playlistId: id,
		})

		await job.complete
	},

	async debug_previewTrigger(
		peripheralDeviceId: PeripheralDeviceId,
		triggerDeviceId: string,
		triggerId: string,
		values?: Record<string, string | number | boolean>
	) {
		logger.info('previewTrigger')

		await insertInputDeviceTriggerIntoPreview(peripheralDeviceId, triggerDeviceId, triggerId, values)
	},
}
