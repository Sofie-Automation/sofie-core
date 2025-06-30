import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging.js'
import { JobContext } from '../../jobs/index.js'
import { PlayoutModel } from '../model/PlayoutModel.js'
import { PlayoutPartInstanceModel } from '../model/PlayoutPartInstanceModel.js'
import { selectNextPart } from '../selectNextPart.js'
import { setNextPart } from '../setNext.js'
import { updateTimeline } from '../timeline/generate.js'
import { getCurrentTime } from '../../lib/index.js'
import { afterTake, clearQueuedSegmentId, resetPreviousSegmentIfLooping, updatePartInstanceOnTake } from '../take.js'
import { INCORRECT_PLAYING_PART_DEBOUNCE, RESET_IGNORE_ERRORS } from '../constants.js'
import { Time } from '@sofie-automation/blueprints-integration'

/**
 * Set the playback of a part is confirmed to have started
 * If the part reported to be playing is not the current part, then make it be the current
 * @param context Context from the job queue
 * @param playoutModel playout model for the current playlist
 * @param data Details on the part start event
 */
export async function onPartPlaybackStarted(
	context: JobContext,
	playoutModel: PlayoutModel,
	data: {
		partInstanceId: PartInstanceId
		startedPlayback: Time
	}
): Promise<void> {
	const playingPartInstance = playoutModel.getPartInstance(data.partInstanceId)
	if (!playingPartInstance)
		throw new Error(
			`PartInstance "${data.partInstanceId}" in RundownPlaylist "${playoutModel.playlistId}" not found!`
		)

	// make sure we don't run multiple times, even if TSR calls us multiple times
	const hasStartedPlaying = !!playingPartInstance.partInstance.timings?.reportedStartedPlayback
	if (!hasStartedPlaying) {
		logger.debug(
			`Playout reports PartInstance "${data.partInstanceId}" has started playback on timestamp ${new Date(
				data.startedPlayback
			).toISOString()}`
		)

		const playlist = playoutModel.playlist

		const rundown = playoutModel.getRundown(playingPartInstance.partInstance.rundownId)
		if (!rundown) throw new Error(`Rundown "${playingPartInstance.partInstance.rundownId}" not found!`)

		const currentPartInstance = playoutModel.currentPartInstance

		if (playlist.currentPartInfo?.partInstanceId === data.partInstanceId) {
			// this is the current part, it has just started playback
			reportPartInstanceHasStarted(context, playoutModel, playingPartInstance, data.startedPlayback)

			// complete the take
			await afterTake(context, playoutModel, playingPartInstance)
		} else if (playlist.nextPartInfo?.partInstanceId === data.partInstanceId) {
			// this is the next part, clearly an autoNext has taken place

			playoutModel.cycleSelectedPartInstances()
			playoutModel.resetHoldState()

			reportPartInstanceHasStarted(context, playoutModel, playingPartInstance, data.startedPlayback)

			// Update generated properties on the newly playing partInstance
			const currentRundown = currentPartInstance
				? playoutModel.getRundown(currentPartInstance.partInstance.rundownId)
				: undefined
			const showStyleRundown = currentRundown ?? rundown
			const showStyle = await context.getShowStyleCompound(
				showStyleRundown.rundown.showStyleVariantId,
				showStyleRundown.rundown.showStyleBaseId
			)
			const blueprint = await context.getShowStyleBlueprint(showStyle._id)
			updatePartInstanceOnTake(
				context,
				playoutModel,
				showStyle,
				blueprint,
				rundown.rundown,
				playingPartInstance,
				currentPartInstance
			)

			clearQueuedSegmentId(playoutModel, playingPartInstance.partInstance, playlist.nextPartInfo)
			resetPreviousSegmentIfLooping(context, playoutModel) // Note: rare edgecase of auto-nexting into a loop causing reset of a segment outside of the loop; is it worth fixing?

			// Update the next partinstance
			const nextPart = selectNextPart(
				context,
				playlist,
				playingPartInstance.partInstance,
				null,
				playoutModel.getAllOrderedSegments(),
				playoutModel.getAllOrderedParts(),
				{ ignoreUnplayable: true, ignoreQuickLoop: false }
			)
			await setNextPart(context, playoutModel, nextPart, false)
			playoutModel.updateQuickLoopState()

			// complete the take
			await afterTake(context, playoutModel, playingPartInstance)
		} else {
			// a part is being played that has not been selected for playback by Core

			// I am pretty sure this is path is dead, I dont see how we could ever get here (in a way that we can recover from)
			// If it is confirmed to be used, then perhaps we can do something better than this,
			// but I dont think we can until we know what we are trying to solve

			// 1) We could hit this if we remove the auto-nexted part and playout-gateway gets the new timeline too late.
			//    We can't magically fix that, as the instance will no longer exist
			// 2) Maybe some other edge cases around deleting partInstances (perhaps when doing a reset?).
			//    Not much we can do about this though

			const previousReported = playlist.lastIncorrectPartPlaybackReported
			if (previousReported && Date.now() - previousReported > INCORRECT_PLAYING_PART_DEBOUNCE) {
				// first time this has happened for a while, let's make sure it has the correct timeline
				await updateTimeline(context, playoutModel)
			}

			logger.error(
				`PartInstance "${playingPartInstance.partInstance._id}" has started playback by the playout gateway, but has not been selected for playback!`
			)
		}
	}
}

/**
 * Set the playback of a part is confirmed to have stopped
 * @param context Context from the job queue
 * @param playoutModel playout model for the current playlist
 * @param data Details on the part stop event
 */
export function onPartPlaybackStopped(
	context: JobContext,
	playoutModel: PlayoutModel,
	data: {
		partInstanceId: PartInstanceId
		stoppedPlayback: Time
	}
): void {
	const playlist = playoutModel.playlist

	const partInstance = playoutModel.getPartInstance(data.partInstanceId)
	if (partInstance) {
		// make sure we don't run multiple times, even if TSR calls us multiple times

		const isPlaying =
			partInstance.partInstance.timings?.reportedStartedPlayback &&
			!partInstance.partInstance.timings?.reportedStoppedPlayback
		if (isPlaying) {
			logger.debug(
				`onPartPlaybackStopped: Playout reports PartInstance "${
					data.partInstanceId
				}" has stopped playback on timestamp ${new Date(data.stoppedPlayback).toISOString()}`
			)

			reportPartInstanceHasStopped(context, playoutModel, partInstance, data.stoppedPlayback)
		}
	} else if (!playlist.activationId) {
		logger.warn(`onPartPlaybackStopped: Received for inactive RundownPlaylist "${playlist._id}"`)
	} else if (getCurrentTime() - (playlist.resetTime ?? 0) > RESET_IGNORE_ERRORS) {
		// Ignore errors that happen just after a reset, so do nothing here.
	} else {
		throw new Error(`PartInstance "${data.partInstanceId}" in RundownPlaylist "${playlist._id}" not found!`)
	}
}

/**
 * Set the playback of a PartInstance is confirmed to have started
 * @param context Context from the job queue
 * @param playoutModel playout model for the current playlist
 * @param partInstance PartInstance to be updated
 * @param timestamp timestamp the PieceInstance started
 */
export function reportPartInstanceHasStarted(
	_context: JobContext,
	playoutModel: PlayoutModel,
	partInstance: PlayoutPartInstanceModel,
	timestamp: Time
): void {
	const timestampUpdated = partInstance.setReportedStartedPlayback(timestamp)

	if (!playoutModel.isMultiGatewayMode) {
		if (timestamp) {
			partInstance.setPlannedStartedPlayback(timestamp)
		}
		const previousPartInstance = playoutModel.previousPartInstance
		if (timestampUpdated && previousPartInstance) {
			// Ensure the plannedStoppedPlayback is set for the previous partinstance too
			previousPartInstance.setPlannedStoppedPlayback(timestamp)
		}
	}

	// Update the playlist:
	if (!partInstance.partInstance.part.untimed) {
		playoutModel.setRundownStartedPlayback(partInstance.partInstance.rundownId, timestamp)
	}

	if (
		partInstance.partInstance.segmentPlayoutId !== playoutModel.previousPartInstance?.partInstance.segmentPlayoutId
	) {
		playoutModel.setSegmentStartedPlayback(partInstance.partInstance.segmentPlayoutId, timestamp)
	}

	if (timestampUpdated) {
		playoutModel.queuePartInstanceTimingEvent(partInstance.partInstance._id)
	}
}

/**
 * Set the playback of a PartInstance is confirmed to have stopped
 * @param context Context from the job queue
 * @param playoutModel playout model for the current playlist
 * @param partInstance PartInstance to be updated
 * @param timestamp timestamp the PieceInstance stopped
 */
export function reportPartInstanceHasStopped(
	_context: JobContext,
	playoutModel: PlayoutModel,
	partInstance: PlayoutPartInstanceModel,
	timestamp: Time
): void {
	const timestampUpdated = partInstance.setReportedStoppedPlayback(timestamp)
	if (timestampUpdated && !playoutModel.isMultiGatewayMode) {
		partInstance.setPlannedStoppedPlayback(timestamp)
	}

	if (timestampUpdated) {
		playoutModel.queuePartInstanceTimingEvent(partInstance.partInstance._id)
	}
}
