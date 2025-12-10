import { selectNextPart } from '../playout/selectNextPart.js'
import { PlayoutModel } from '../playout/model/PlayoutModel.js'
import { JobContext } from '../jobs/index.js'
import { setNextPart } from '../playout/setNext.js'
import { isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'

/**
 * Make sure that the nextPartInstance for the current Playlist is still correct
 * This will often change the nextPartInstance
 * @param context Context of the job being run
 * @param playoutModel Playout Model to operate on
 * @returns Whether the timeline should be updated following this operation
 */
export async function ensureNextPartIsValid(context: JobContext, playoutModel: PlayoutModel): Promise<boolean> {
	const span = context.startSpan('api.ingest.ensureNextPartIsValid')

	// Ensure the next-id is still valid
	const playlist = playoutModel.playlist
	if (!playlist?.activationId) {
		span?.end()
		return false
	}

	const currentPartInstance = playoutModel.currentPartInstance
	const nextPartInstance = playoutModel.nextPartInstance

	if (
		playlist.nextPartInfo?.manuallySelected &&
		nextPartInstance &&
		isPartPlayable(nextPartInstance.partInstance.part) &&
		nextPartInstance.partInstance.orphaned !== 'deleted'
	) {
		// Manual next part is almost always valid. This includes orphaned (adlib-part) partinstances
		span?.end()
		return false
	}

	// If we are close to an autonext, then leave it to avoid glitches
	if (currentPartInstance?.isTooCloseToAutonext(false) && nextPartInstance) {
		span?.end()
		return false
	}

	const orderedSegments = playoutModel.getAllOrderedSegments()
	const orderedParts = playoutModel.getAllOrderedParts()

	if (!nextPartInstance || nextPartInstance.partInstance.orphaned === 'deleted') {
		// Don't have a nextPart or it has been deleted, so autoselect something
		const newNextPart = selectNextPart(
			context,
			playlist,
			currentPartInstance?.partInstance ?? null,
			nextPartInstance?.partInstance ?? null,
			orderedSegments,
			orderedParts,
			{ ignoreUnplayable: true, ignoreQuickLoop: false }
		)

		if (!newNextPart && !playoutModel.playlist.nextPartInfo) {
			// No currently nexted part, and nothing was selected, so nothing to update
			span?.end()
			return false
		}

		await setNextPart(context, playoutModel, newNextPart ?? null, false)

		span?.end()
		return true
	} else if (currentPartInstance && nextPartInstance) {
		// Check if the part is the same
		const newNextPart = selectNextPart(
			context,
			playlist,
			currentPartInstance.partInstance,
			nextPartInstance.partInstance,
			orderedSegments,
			orderedParts,
			{ ignoreUnplayable: true, ignoreQuickLoop: false }
		)

		if (
			// Nothing should be nexted
			!newNextPart ||
			// The nexted-part should be different to what is selected
			newNextPart.part._id !== nextPartInstance.partInstance.part._id ||
			// The nexted-part Instance is no longer playable
			!isPartPlayable(nextPartInstance.partInstance.part)
		) {
			// The 'new' next part is before the current next, so move the next point
			await setNextPart(context, playoutModel, newNextPart ?? null, false)

			span?.end()
			return true
		}
	}

	span?.end()
	return false
}
