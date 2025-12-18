import { UpdateTimelineAfterIngestProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs/index.js'
import { runJobWithPlaylistLock, runWithPlayoutModel } from './lock.js'
import { updateStudioTimeline, updateTimeline } from './timeline/generate.js'
import { getSystemVersion } from '../lib/index.js'
import { runJobWithStudioPlayoutModel } from '../studio/lock.js'
import { shouldUpdateStudioBaselineInner as libShouldUpdateStudioBaselineInner } from '@sofie-automation/corelib/dist/studio/baseline'
import { StudioPlayoutModel } from '../studio/model/StudioPlayoutModel.js'

/**
 * Update the timeline with a regenerated Studio Baseline
 * Has no effect if a Playlist is active
 */
export async function handleUpdateStudioBaseline(context: JobContext, _data: void): Promise<string | false> {
	return runJobWithStudioPlayoutModel(context, async (studioPlayoutModel) => {
		const activePlaylists = studioPlayoutModel.getActiveRundownPlaylists()

		if (activePlaylists.length === 0) {
			await updateStudioTimeline(context, studioPlayoutModel)
			return shouldUpdateStudioBaselineInner(context, studioPlayoutModel)
		} else {
			return shouldUpdateStudioBaselineInner(context, studioPlayoutModel)
		}
	})
}

async function shouldUpdateStudioBaselineInner(
	context: JobContext,
	playoutModel: StudioPlayoutModel
): Promise<string | false> {
	const studio = context.studio

	if (playoutModel.getActiveRundownPlaylists().length > 0) return false

	const timeline = playoutModel.timeline
	const blueprint = studio.blueprintId ? await context.directCollections.Blueprints.findOne(studio.blueprintId) : null
	if (!blueprint) return 'missingBlueprint'

	return libShouldUpdateStudioBaselineInner(getSystemVersion(), studio, timeline, blueprint)
}

/**
 * Regenerate the timeline for the specified Playlist in the Studio
 * Has no effect if specified Playlist is not active
 */
export async function handleUpdateTimelineAfterIngest(
	context: JobContext,
	data: UpdateTimelineAfterIngestProps
): Promise<void> {
	await runJobWithPlaylistLock(context, data, async (playlist, lock) => {
		if (playlist?.activationId && (playlist.currentPartInfo || playlist.nextPartInfo)) {
			// TODO - r37 added a retry mechanic to this. should that be kept?
			await runWithPlayoutModel(context, playlist, lock, null, async (playoutModel) => {
				const currentPartInstance = playoutModel.currentPartInstance
				if (
					!playoutModel.isMultiGatewayMode &&
					currentPartInstance &&
					!currentPartInstance.partInstance.timings?.reportedStartedPlayback
				) {
					// HACK: The current PartInstance doesn't have a start time yet, so we know an updateTimeline is coming as part of onPartPlaybackStarted
					// We mustn't run before that does, or we will get the timings in playout-gateway confused.
				} else {
					// It is safe enough (except adlibs) to update the timeline directly
					// If the playlist is active, then updateTimeline as lookahead could have been affected
					await updateTimeline(context, playoutModel)
				}
			})
		}
	})
}
