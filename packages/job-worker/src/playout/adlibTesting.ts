import { SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { ActivateAdlibTestingProps } from '@sofie-automation/corelib/dist/worker/studio'
import { getCurrentTime } from '../lib/index.js'
import { JobContext } from '../jobs/index.js'
import { runJobWithPlayoutModel } from './lock.js'
import { performTakeToNextedPart } from './take.js'
import { PlayoutModel } from './model/PlayoutModel.js'
import { PlayoutPartInstanceModel } from './model/PlayoutPartInstanceModel.js'

export async function handleActivateAdlibTesting(context: JobContext, data: ActivateAdlibTestingProps): Promise<void> {
	if (!context.studio.settings.allowAdlibTestingSegment)
		throw UserError.create(UserErrorMessage.AdlibTestingNotAllowed)

	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

			if (playlist.currentPartInfo) throw UserError.create(UserErrorMessage.RundownAlreadyActive)
		},
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (!playlist.activationId) throw new Error(`Playlist has no activationId!`)

			const rundown = playoutModel.getRundown(data.rundownId)
			if (!rundown) throw new Error(`Rundown "${data.rundownId}" not found!`)

			// Create the segment
			rundown.insertAdlibTestingSegment()

			// Create the first PartInstance for the segment
			const newPartInstance = playoutModel.createAdlibTestingPartInstance(rundown, {
				_id: getRandomId(),
				_rank: 0,
				externalId: '',
				title: 'Adlib Testing',
				expectedDuration: 0,
				expectedDurationWithTransition: 0, // Filled in later
				untimed: true,
			})

			// Set the part as next
			playoutModel.setPartInstanceAsNext(newPartInstance, true, false)

			// Take into the newly created Part
			await performTakeToNextedPart(context, playoutModel, getCurrentTime())
		}
	)
}

/**
 * Validate and cleanup a PartInstance being added to a ADLIB_TESTING segment.
 * If PartInstance is not in the AdlibTesting segment, do nothing
 */
export function validateAdlibTestingPartInstanceProperties(
	_context: JobContext,
	playoutModel: PlayoutModel,
	partInstance: PlayoutPartInstanceModel
): void {
	const rundown = playoutModel.getRundown(partInstance.partInstance.rundownId)
	if (!rundown)
		throw new Error(
			`Failed to find Rundown "${partInstance.partInstance.rundownId}" for PartInstance "${partInstance.partInstance._id}"`
		)

	const segment = rundown.getSegment(partInstance.partInstance.segmentId)
	if (!segment)
		throw new Error(
			`Failed to find Segment "${partInstance.partInstance.segmentId}" for PartInstance "${partInstance.partInstance._id}"`
		)

	// Check if this applies
	if (segment.segment.orphaned !== SegmentOrphanedReason.ADLIB_TESTING) return

	partInstance.validateAdlibTestingSegmentProperties()
}
