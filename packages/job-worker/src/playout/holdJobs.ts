import { PartHoldMode } from '@sofie-automation/blueprints-integration'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { ActivateHoldProps, DeactivateHoldProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs/index.js'
import { runJobWithPlayoutModel } from './lock.js'
import { updateTimeline } from './timeline/generate.js'
import { logger } from '../logging.js'

/**
 * Activate Hold
 */
export async function handleActivateHold(context: JobContext, data: ActivateHoldProps): Promise<void> {
	if (!context.studio.settings.allowHold) {
		// Hold isn't allowed, making this a noop
		logger.debug(`Hold isn't allowed, skipping`)
		return
	}

	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart)
			if (!playlist.nextPartInfo) throw UserError.create(UserErrorMessage.HoldNeedsNextPart)

			if (playlist.holdState) throw UserError.create(UserErrorMessage.HoldAlreadyActive)
		},
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			const currentPartInstance = playoutModel.currentPartInstance
			if (!currentPartInstance)
				throw new Error(`PartInstance "${playlist.currentPartInfo?.partInstanceId}" not found!`)
			const nextPartInstance = playoutModel.nextPartInstance
			if (!nextPartInstance) throw new Error(`PartInstance "${playlist.nextPartInfo?.partInstanceId}" not found!`)

			if (
				currentPartInstance.partInstance.part.holdMode !== PartHoldMode.FROM ||
				nextPartInstance.partInstance.part.holdMode !== PartHoldMode.TO ||
				currentPartInstance.partInstance.part.segmentId !== nextPartInstance.partInstance.part.segmentId
			) {
				throw UserError.create(UserErrorMessage.HoldIncompatibleParts)
			}

			const hasDynamicallyInserted = currentPartInstance.pieceInstances.find(
				(p) =>
					!!p.pieceInstance.dynamicallyInserted &&
					// If its a continuation of an infinite adlib it is probably a graphic, so is 'fine'
					!p.pieceInstance.infinite?.fromPreviousPart &&
					!p.pieceInstance.infinite?.fromPreviousPlayhead
			)
			if (hasDynamicallyInserted) throw UserError.create(UserErrorMessage.HoldAfterAdlib)

			playoutModel.setHoldState(RundownHoldState.PENDING)

			await updateTimeline(context, playoutModel)
		}
	)
}

/**
 * Deactivate Hold
 */
export async function handleDeactivateHold(context: JobContext, data: DeactivateHoldProps): Promise<void> {
	// This should be possible even when hold is not allowed, as it is a way to get out of a stuck state

	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (playlist.holdState !== RundownHoldState.PENDING)
				throw UserError.create(UserErrorMessage.HoldNotCancelable)
		},
		async (playoutModel) => {
			playoutModel.setHoldState(RundownHoldState.NONE)

			await updateTimeline(context, playoutModel)
		}
	)
}
