import { PartInstanceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { logger } from '../../logging.js'
import { JobContext } from '../../jobs/index.js'
import { PlayoutModel } from '../model/PlayoutModel.js'
import { Time } from '@sofie-automation/blueprints-integration'
import { PlayoutPartInstanceModel } from '../model/PlayoutPartInstanceModel.js'
import { PlayoutPieceInstanceModel } from '../model/PlayoutPieceInstanceModel.js'

/**
 * Set the playback of a piece is confirmed to have started
 * @param context Context from the job queue
 * @param playoutModel playout model for the current playlist
 * @param data Details on the piece start event
 */
export function onPiecePlaybackStarted(
	context: JobContext,
	playoutModel: PlayoutModel,
	data: {
		partInstanceId: PartInstanceId
		pieceInstanceId: PieceInstanceId
		startedPlayback: Time
	}
): void {
	const playlist = playoutModel.playlist

	if (!playlist.activationId) {
		logger.warn(`onPiecePlaybackStarted: Received for inactive RundownPlaylist "${playlist._id}"`)
		return
	}

	const partInstance = playoutModel.getPartInstance(data.partInstanceId)
	if (!partInstance) {
		throw new Error(`PartInstance "${data.partInstanceId}" in RundownPlaylist "${playlist._id}" not found!`)
	}

	const pieceInstance = partInstance.getPieceInstance(data.pieceInstanceId)
	if (!pieceInstance) {
		throw new Error(`PieceInstance "${data.partInstanceId}" in RundownPlaylist "${playlist._id}" not found!`)
	}

	const isPlaying = !!(
		pieceInstance.pieceInstance.reportedStartedPlayback && !pieceInstance.pieceInstance.reportedStoppedPlayback
	)
	if (!isPlaying) {
		logger.debug(
			`onPiecePlaybackStarted: Playout reports pieceInstance "${
				data.pieceInstanceId
			}" has started playback on timestamp ${new Date(data.startedPlayback).toISOString()}`
		)
		reportPieceHasStarted(context, playoutModel, partInstance, pieceInstance, data.startedPlayback)

		// We don't need to bother with an updateTimeline(), as this hasn't changed anything, but lets us accurately add started items when reevaluating
	}
}

/**
 * Set the playback of a piece is confirmed to have stopped
 * @param context Context from the job queue
 * @param playoutModel playout model for the current playlist
 * @param data Details on the piece stop event
 */
export function onPiecePlaybackStopped(
	context: JobContext,
	playoutModel: PlayoutModel,
	data: {
		partInstanceId: PartInstanceId
		pieceInstanceId: PieceInstanceId
		stoppedPlayback: Time
	}
): void {
	const playlist = playoutModel.playlist

	if (!playlist.activationId) {
		logger.warn(`onPiecePlaybackStopped: Received for inactive RundownPlaylist "${playlist._id}"`)
		return
	}

	const partInstance = playoutModel.getPartInstance(data.partInstanceId)
	if (!partInstance) {
		// PartInstance not found, so we can rely on the onPartPlaybackStopped callback erroring
		return
	}

	const pieceInstance = partInstance.getPieceInstance(data.pieceInstanceId)
	if (!pieceInstance) {
		throw new Error(`PieceInstance "${data.partInstanceId}" in RundownPlaylist "${playlist._id}" not found!`)
	}

	const isPlaying = !!(
		pieceInstance.pieceInstance.reportedStartedPlayback && !pieceInstance.pieceInstance.reportedStoppedPlayback
	)
	if (isPlaying) {
		logger.debug(
			`onPiecePlaybackStopped: Playout reports pieceInstance "${
				data.pieceInstanceId
			}" has stopped playback on timestamp ${new Date(data.stoppedPlayback).toISOString()}`
		)

		reportPieceHasStopped(context, playoutModel, pieceInstance, data.stoppedPlayback)
	}
}

/**
 * Set the playback of a PieceInstance is confirmed to have started
 * @param context Context from the job queue
 * @param playoutModel playout model for the current playlist
 * @param pieceInstance PieceInstance to be updated
 * @param timestamp timestamp the PieceInstance started
 */
function reportPieceHasStarted(
	_context: JobContext,
	playoutModel: PlayoutModel,
	partInstance: PlayoutPartInstanceModel,
	pieceInstance: PlayoutPieceInstanceModel,
	timestamp: Time
): void {
	const timestampChanged = pieceInstance.setReportedStartedPlayback(timestamp)
	if (timestampChanged) {
		if (!playoutModel.isMultiGatewayMode) {
			pieceInstance.setPlannedStartedPlayback(timestamp)
		}

		// Update the copy in the next-part if there is one, so that the infinite has the same start after a take
		const nextPartInstance = playoutModel.nextPartInstance
		if (
			pieceInstance.pieceInstance.infinite &&
			nextPartInstance &&
			nextPartInstance.partInstance._id !== partInstance.partInstance._id
		) {
			const infiniteInstanceId = pieceInstance.pieceInstance.infinite.infiniteInstanceId
			for (const nextPieceInstance of nextPartInstance.pieceInstances) {
				if (
					!!nextPieceInstance.pieceInstance.infinite &&
					nextPieceInstance.pieceInstance.infinite.infiniteInstanceId === infiniteInstanceId
				) {
					nextPieceInstance.setReportedStartedPlayback(timestamp)

					if (!playoutModel.isMultiGatewayMode) {
						nextPieceInstance.setPlannedStartedPlayback(timestamp)
					}
				}
			}
		}

		playoutModel.queuePartInstanceTimingEvent(partInstance.partInstance._id)
	}
}

/**
 * Set the playback of a PieceInstance is confirmed to have stopped
 * @param context Context from the job queue
 * @param playoutModel playout model for the current playlist
 * @param pieceInstance PieceInstance to be updated
 * @param timestamp timestamp the PieceInstance stopped
 */
function reportPieceHasStopped(
	_context: JobContext,
	playoutModel: PlayoutModel,
	pieceInstance: PlayoutPieceInstanceModel,
	timestamp: Time
): void {
	const timestampChanged = pieceInstance.setReportedStoppedPlayback(timestamp)

	if (timestampChanged) {
		if (!playoutModel.isMultiGatewayMode) {
			pieceInstance.setPlannedStoppedPlayback(timestamp)
		}

		if (pieceInstance.pieceInstance.partInstanceId) {
			playoutModel.queuePartInstanceTimingEvent(pieceInstance.pieceInstance.partInstanceId)
		}
	}
}
