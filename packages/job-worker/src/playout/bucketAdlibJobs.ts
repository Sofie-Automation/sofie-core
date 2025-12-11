import { ExecuteActionResult, ExecuteBucketAdLibOrActionProps } from '@sofie-automation/corelib/dist/worker/studio'
import { JobContext } from '../jobs/index.js'
import { runJobWithPlaylistLock } from './lock.js'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { BucketId, ShowStyleBaseId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { innerStartOrQueueAdLibPiece } from './adlibUtils.js'
import { executeAdlibActionAndSaveModel } from './adlibAction.js'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { createPlayoutModelfromInitModel, loadPlayoutModelPreInit } from './model/implementation/LoadPlayoutModel.js'

/**
 * Execute an AdLib Action
 */
export async function handleExecuteBucketAdLibOrAction(
	context: JobContext,
	data: ExecuteBucketAdLibOrActionProps
): Promise<ExecuteActionResult> {
	return runJobWithPlaylistLock(context, data, async (playlist, lock) => {
		// First load the minimum amount of data required to run the executeDataStoreAction handler
		if (!playlist) throw new Error(`Job playlist "${data.playlistId}" not found `)

		if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown, undefined, 412)
		if (!playlist.currentPartInfo) throw UserError.create(UserErrorMessage.NoCurrentPart, undefined, 412)

		const initCache = await loadPlayoutModelPreInit(context, lock, playlist, false)

		const rundown = initCache.getRundown(playlist.currentPartInfo.rundownId)
		if (!rundown) throw new Error(`Current Rundown "${playlist.currentPartInfo.rundownId}" could not be found`)

		const { bucketAdLib, bucketAdLibAction } = await findBucketAdLibOrAction(
			context,
			data.bucketId,
			data.externalId,
			rundown.showStyleBaseId,
			rundown.showStyleVariantId
		)

		if (bucketAdLib) {
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}

			const playoutModel = await createPlayoutModelfromInitModel(context, initCache)

			const fullRundown = playoutModel.getRundown(rundown._id)
			if (!fullRundown) throw new Error(`Rundown "${rundown._id}" missing between caches`)

			const partInstance = playoutModel.currentPartInstance
			if (!partInstance) throw new Error(`PartInstance "${playlist.currentPartInfo.partInstanceId}" not found!`)
			await innerStartOrQueueAdLibPiece(
				context,
				playoutModel,
				fullRundown,
				!!bucketAdLib.toBeQueued,
				partInstance,
				bucketAdLib
			)
			await playoutModel.saveAllToDatabase()
			return {}
		} else if (bucketAdLibAction) {
			return await executeAdlibActionAndSaveModel(context, playlist, initCache, {
				actionDocId: bucketAdLibAction._id,
				actionId: bucketAdLibAction.actionId,
				playlistId: playlist._id,
				userData: bucketAdLibAction.userData,
				triggerMode: data.triggerMode,
			})
		}
		throw UserError.create(UserErrorMessage.AdlibNotFound)
	})
}

async function findBucketAdLibOrAction(
	context: JobContext,
	bucketId: BucketId,
	externalId: string,
	showStyleBaseId: ShowStyleBaseId,
	showStyleVariantId: ShowStyleVariantId
) {
	const [bucketAdLib, bucketAdLibAction] = await Promise.all([
		context.directCollections.BucketAdLibPieces.findOne({
			bucketId,
			externalId,
			showStyleBaseId,
			$or: [{ showStyleVariantId }, { showStyleVariantId: null }],
		}),
		context.directCollections.BucketAdLibActions.findOne({
			bucketId,
			externalId,
			showStyleBaseId,
			$or: [{ showStyleVariantId }, { showStyleVariantId: null }],
		}),
	])
	return { bucketAdLib, bucketAdLibAction }
}
