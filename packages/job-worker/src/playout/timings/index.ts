import { OnPlayoutPlaybackChangedProps } from '@sofie-automation/corelib/dist/worker/studio'
import { logger } from '../../logging.js'
import { JobContext } from '../../jobs/index.js'
import { runJobWithPlayoutModel } from '../lock.js'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { PlayoutChangedType } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { onPiecePlaybackStarted, onPiecePlaybackStopped } from './piecePlayback.js'
import { onPartPlaybackStarted, onPartPlaybackStopped } from './partPlayback.js'
import { updateTimeline } from '../timeline/generate.js'

export { handleTimelineTriggerTime } from './timelineTriggerTime.js'

/**
 * Called by playout-gateway when playback timings of any Parts or Pieces on the timeline have changed
 */
export async function handleOnPlayoutPlaybackChanged(
	context: JobContext,
	data: OnPlayoutPlaybackChangedProps
): Promise<void> {
	return runJobWithPlayoutModel(context, data, null, async (playoutModel) => {
		let triggerRegeneration = false

		for (const change of data.changes) {
			try {
				if (change.type === PlayoutChangedType.PART_PLAYBACK_STARTED) {
					await onPartPlaybackStarted(context, playoutModel, {
						partInstanceId: change.data.partInstanceId,
						startedPlayback: change.data.time,
					})
				} else if (change.type === PlayoutChangedType.PART_PLAYBACK_STOPPED) {
					onPartPlaybackStopped(context, playoutModel, {
						partInstanceId: change.data.partInstanceId,
						stoppedPlayback: change.data.time,
					})
				} else if (change.type === PlayoutChangedType.PIECE_PLAYBACK_STARTED) {
					onPiecePlaybackStarted(context, playoutModel, {
						partInstanceId: change.data.partInstanceId,
						pieceInstanceId: change.data.pieceInstanceId,
						startedPlayback: change.data.time,
					})
				} else if (change.type === PlayoutChangedType.PIECE_PLAYBACK_STOPPED) {
					onPiecePlaybackStopped(context, playoutModel, {
						partInstanceId: change.data.partInstanceId,
						pieceInstanceId: change.data.pieceInstanceId,
						stoppedPlayback: change.data.time,
					})
				} else if (change.type === PlayoutChangedType.TRIGGER_REGENERATION) {
					if (
						playoutModel.timeline?.regenerateTimelineToken &&
						change.data.regenerationToken === playoutModel.timeline.regenerateTimelineToken
					) {
						triggerRegeneration = true
					} else {
						logger.warn(
							`Playout gateway requested a regeneration of the timeline, with an incorrect regenerationToken. Got ${change.data.regenerationToken}, expected ${playoutModel.timeline?.regenerateTimelineToken}`
						)
					}
				} else {
					assertNever(change)
				}

				if (triggerRegeneration) {
					logger.info('Playout gateway requested a regeneration of the timeline')
					await updateTimeline(context, playoutModel)
				}
			} catch (err) {
				logger.error(stringifyError(err))
			}
		}
	})
}
