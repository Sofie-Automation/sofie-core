import {
	DebugRegenerateNextPartInstanceProps,
	DebugSyncInfinitesForNextPartInstanceProps,
} from '@sofie-automation/corelib/dist/worker/studio'
import { runJobWithStudioPlayoutModel } from '../studio/lock.js'
import { JobContext } from '../jobs/index.js'
import { logger } from '../logging.js'
import { syncPlayheadInfinitesForNextPartInstance } from './infinites.js'
import { setNextPart } from './setNext.js'
import { runJobWithPlayoutModel } from './lock.js'
import { updateTimeline } from './timeline/generate.js'
import { updateTimelineFromStudioPlayoutModel } from './lib.js'

/**
 * Ensure that the infinite pieces on the nexted-part are correct
 * Added to debug some issues with infinites not updating
 */
export async function handleDebugSyncPlayheadInfinitesForNextPartInstance(
	context: JobContext,
	data: DebugSyncInfinitesForNextPartInstanceProps
): Promise<void> {
	logger.info(`syncPlayheadInfinitesForNextPartInstance ${data.playlistId}`)

	await runJobWithPlayoutModel(context, data, null, async (playoutModel) => {
		await syncPlayheadInfinitesForNextPartInstance(
			context,
			playoutModel,
			undefined,
			playoutModel.currentPartInstance,
			playoutModel.nextPartInstance
		)
	})
}

/**
 * Regenerate the nexted-partinstance from its part.
 * This can be useful to get ingest updates across when the blueprint syncIngestUpdateToPartInstance method is not implemented, or to bypass that method when it is defined
 */
export async function handleDebugRegenerateNextPartInstance(
	context: JobContext,
	data: DebugRegenerateNextPartInstanceProps
): Promise<void> {
	logger.info('regenerateNextPartInstance')

	await runJobWithPlayoutModel(context, data, null, async (playoutModel) => {
		const playlist = playoutModel.playlist
		const originalNextPartInfo = playlist.nextPartInfo
		if (originalNextPartInfo && playlist.activationId) {
			const nextPartInstance = playoutModel.nextPartInstance
			const part = nextPartInstance ? playoutModel.findPart(nextPartInstance.partInstance.part._id) : undefined
			if (part) {
				await setNextPart(context, playoutModel, null, false)
				await setNextPart(
					context,
					playoutModel,
					{ part: part, consumesQueuedSegmentId: false },
					originalNextPartInfo.manuallySelected
				)

				await updateTimeline(context, playoutModel)
			}
		}
	})
}

/**
 * Debug: Force the worker to throw an error
 */
export async function handleDebugCrash(context: JobContext, data: DebugRegenerateNextPartInstanceProps): Promise<void> {
	logger.info('debugCrash')

	await runJobWithPlayoutModel(context, data, null, async (playoutModel) => {
		setTimeout(() => {
			//@ts-expect-error: 2339
			playoutModel.callUndefined()
		}, 10)
	})
}

/**
 * Debug: Regenerate the timeline for the Studio
 */
export async function handleDebugUpdateTimeline(context: JobContext, _data: void): Promise<void> {
	await runJobWithStudioPlayoutModel(context, async (studioPlayoutModel) => {
		await updateTimelineFromStudioPlayoutModel(context, studioPlayoutModel)
	})
}
