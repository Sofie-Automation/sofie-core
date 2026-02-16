import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import {
	SetNextPartProps,
	MoveNextPartProps,
	SetNextSegmentProps,
	QueueNextSegmentProps,
	QueueNextSegmentResult,
} from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs/index.js'
import { runJobWithPlayoutModel } from './lock.js'
import { setNextPartFromPart, setNextSegment, queueNextSegment } from './setNext.js'
import { selectNewPartWithOffsets } from './moveNextPart.js'
import { updateTimeline } from './timeline/generate.js'
import { PlayoutSegmentModel } from './model/PlayoutSegmentModel.js'
import { ReadonlyDeep } from 'type-fest'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'

/**
 * Set the next Part to a specified id
 */
export async function handleSetNextPart(context: JobContext, data: SetNextPartProps): Promise<void> {
	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)
			if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) {
				throw UserError.create(UserErrorMessage.DuringHold, undefined, 412)
			}
		},
		async (playoutModel) => {
			const playlist = playoutModel.playlist

			let nextPartOrInstance: ReadonlyDeep<DBPart> | DBPartInstance | undefined
			let nextPartId: PartId | undefined

			if (data.nextPartInstanceId) {
				// Fetch the part instance
				const nextPartInstance = await context.directCollections.PartInstances.findOne({
					_id: data.nextPartInstanceId,
				})
				if (!nextPartInstance) throw UserError.create(UserErrorMessage.PartNotFound, undefined, 404)

				// Determine if we need the part itself or can use the instance (We can't reuse the currently playing instance)
				if (
					!playlist.nextPartInfo?.partInstanceId ||
					!playlist.currentPartInfo?.partInstanceId ||
					playlist.currentPartInfo?.partInstanceId === data.nextPartInstanceId
				) {
					nextPartId = nextPartInstance.part._id
				} else {
					nextPartOrInstance = nextPartInstance
				}
			} else if (data.nextPartId) {
				nextPartId = data.nextPartId
			}

			// If we have a nextPartId, resolve the actual part
			if (nextPartId) {
				const nextPart = playoutModel.findPart(nextPartId)
				if (!nextPart) throw UserError.create(UserErrorMessage.PartNotFound, undefined, 404)
				if (!isPartPlayable(nextPart)) throw UserError.create(UserErrorMessage.PartNotPlayable, undefined, 412)
				nextPartOrInstance = nextPart
			}

			if (nextPartOrInstance) {
				await setNextPartFromPart(
					context,
					playoutModel,
					nextPartOrInstance,
					data.setManually ?? false,
					data.nextTimeOffset
				)
			}

			await updateTimeline(context, playoutModel)
		}
	)
}

/**
 * Move which Part is nexted by a Part(horizontal) or Segment (vertical) delta
 */
export async function handleMoveNextPart(context: JobContext, data: MoveNextPartProps): Promise<PartId | null> {
	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			if (!data.partDelta && !data.segmentDelta)
				throw new Error(`rundownMoveNext: invalid delta: (${data.partDelta}, ${data.segmentDelta})`)

			const playlist = playoutModel.playlist

			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold, undefined, 412)
			}

			if (!playlist.nextPartInfo && !playlist.currentPartInfo) {
				throw UserError.create(UserErrorMessage.NoCurrentOrNextPart, undefined, 412)
			}
		},
		async (playoutModel) => {
			const selectedPart = selectNewPartWithOffsets(
				context,
				playoutModel,
				data.partDelta,
				data.segmentDelta,
				data.ignoreQuickLoop
			)
			if (!selectedPart) return null

			await setNextPartFromPart(context, playoutModel, selectedPart, true)
			await updateTimeline(context, playoutModel)

			return selectedPart._id
		}
	)
}

/**
 * Set the next part to the first part of a Segment with given id
 */
export async function handleSetNextSegment(context: JobContext, data: SetNextSegmentProps): Promise<PartId> {
	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)

			if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) {
				throw UserError.create(UserErrorMessage.DuringHold, undefined, 412)
			}
		},
		async (playoutModel) => {
			const nextSegment = playoutModel.findSegment(data.nextSegmentId)
			if (!nextSegment) throw new Error(`Segment "${data.nextSegmentId}" not found!`)

			const nextedPartId = await setNextSegment(context, playoutModel, nextSegment)

			// Update any future lookaheads
			await updateTimeline(context, playoutModel)

			return nextedPartId
		}
	)
}

/**
 * Set the next part to the first part of a given Segment to a specified id
 */
export async function handleQueueNextSegment(
	context: JobContext,
	data: QueueNextSegmentProps
): Promise<QueueNextSegmentResult> {
	return runJobWithPlayoutModel(
		context,
		data,
		async (playoutModel) => {
			const playlist = playoutModel.playlist
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)

			if (playlist.holdState && playlist.holdState !== RundownHoldState.COMPLETE) {
				throw UserError.create(UserErrorMessage.DuringHold, undefined, 412)
			}
		},
		async (playoutModel) => {
			let queuedSegment: ReadonlyDeep<PlayoutSegmentModel> | null = null
			if (data.queuedSegmentId) {
				queuedSegment = playoutModel.findSegment(data.queuedSegmentId) ?? null
				if (!queuedSegment) throw new Error(`Segment "${data.queuedSegmentId}" not found!`)
			}

			const result = await queueNextSegment(context, playoutModel, queuedSegment)

			// Update any future lookaheads
			await updateTimeline(context, playoutModel)

			return result
		}
	)
}
