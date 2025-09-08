import { JobContext } from '../../jobs/index.js'
import { PartInstanceId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging.js'
import { EventsJobs } from '@sofie-automation/corelib/dist/worker/events'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

const EVENT_WAIT_TIME = 500

const partInstanceTimingDebounceFunctions = new Map<string, NodeJS.Timeout>()

/**
 * Queue a PartInstanceTimings event to be sent
 * @param context Context from the job queue
 * @param playlistId Id of the playlist to run the event for
 * @param partInstanceId Id of the rundown to run the event for
 */
export function queuePartInstanceTimingEvent(
	context: JobContext,
	playlistId: RundownPlaylistId,
	partInstanceId: PartInstanceId
): void {
	// Future: this should be workqueue backed, not in-memory

	// wait EVENT_WAIT_TIME, because blueprint.onAsRunEvent() it is likely for there to be a bunch of started and stopped events coming in at the same time
	// These blueprint methods are not time critical (meaning they do raw db operations), and can be easily delayed
	const funcId = `${playlistId}_${partInstanceId}`
	const pendingTimer = partInstanceTimingDebounceFunctions.get(funcId)
	if (pendingTimer) clearTimeout(pendingTimer)

	// Future: using context inside a timer like this is not supposed to be done...
	const newTimer = setTimeout(() => {
		partInstanceTimingDebounceFunctions.delete(funcId)

		context
			.queueEventJob(EventsJobs.PartInstanceTimings, {
				playlistId,
				partInstanceId,
			})
			.catch((e) => {
				logger.error(`Failed to queue job in handlePartInstanceTimingEvent "${funcId}": "${stringifyError(e)}"`)
			})
	}, EVENT_WAIT_TIME)

	partInstanceTimingDebounceFunctions.set(funcId, newTimer)
}
