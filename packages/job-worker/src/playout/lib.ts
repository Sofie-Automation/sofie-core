import { TimelineObjGeneric } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { applyToArray, clone } from '@sofie-automation/corelib/dist/lib'
import { TSR, IRundownActivationContextState } from '@sofie-automation/blueprints-integration'
import { JobContext } from '../jobs/index.js'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PlayoutModel } from './model/PlayoutModel.js'
import { logger } from '../logging.js'
import { MongoQuery } from '../db/index.js'
import { mongoWhere } from '@sofie-automation/corelib/dist/mongo'
import { setNextPart } from './setNext.js'
import { selectNextPart } from './selectNextPart.js'
import { StudioPlayoutModel } from '../studio/model/StudioPlayoutModel.js'
import { runJobWithPlayoutModel } from './lock.js'
import { updateTimeline, updateStudioTimeline } from './timeline/generate.js'

/**
 * Reset the rundownPlaylist (all of the rundowns within the playlist):
 * Remove all dynamically inserted/updated pieces, parts, timings etc..
 */
export async function resetRundownPlaylist(context: JobContext, playoutModel: PlayoutModel): Promise<void> {
	logger.info('resetRundownPlaylist ' + playoutModel.playlist._id)
	// Remove all dunamically inserted pieces (adlibs etc)
	// const rundownIds = new Set((playoutModel.getRundownIds()))

	playoutModel.resetPlaylist(!!playoutModel.playlist.activationId)

	playoutModel.removeAllRehearsalPartInstances()
	resetPartInstancesWithPieceInstances(context, playoutModel)

	// Remove the AdlibTesting segment
	for (const rundown of playoutModel.rundowns) {
		rundown.removeAdlibTestingSegment()
	}

	if (playoutModel.playlist.activationId) {
		// put the first on queue:
		const firstPart = selectNextPart(
			context,
			playoutModel.playlist,
			null,
			null,
			playoutModel.getAllOrderedSegments(),
			playoutModel.getAllOrderedParts(),
			{ ignoreUnplayable: true, ignoreQuickLoop: false }
		)
		await setNextPart(context, playoutModel, firstPart, false)
	} else {
		await setNextPart(context, playoutModel, null, false)
	}
}

/**
 * Reset selected or all partInstances with their pieceInstances
 * @param playoutModel
 * @param selector if not provided, all partInstances will be reset
 */
export function resetPartInstancesWithPieceInstances(
	context: JobContext,
	playoutModel: PlayoutModel,
	selector?: MongoQuery<DBPartInstance>
): void {
	const partInstanceIdsToReset: PartInstanceId[] = []
	for (const partInstance of playoutModel.loadedPartInstances) {
		if (!partInstance.partInstance.reset && (!selector || mongoWhere(partInstance.partInstance, selector))) {
			partInstance.markAsReset()
			partInstanceIdsToReset.push(partInstance.partInstance._id)
		}
	}

	// Defer ones which arent loaded
	playoutModel.deferAfterSave(async (playoutModel) => {
		const rundownIds = playoutModel.getRundownIds()
		const partInstanceIdsInModel = playoutModel.loadedPartInstances.map((p) => p.partInstance._id)

		// Find all the partInstances which are not loaded, but should be reset
		const resetInDb = await context.directCollections.PartInstances.findFetch(
			{
				$and: [
					selector ?? {},
					{
						// Not any which are in the model, as they have already been done if needed
						_id: { $nin: partInstanceIdsInModel },
						rundownId: { $in: rundownIds },
						reset: { $ne: true },
					},
				],
			},
			{ projection: { _id: 1 } }
		).then((ps) => ps.map((p) => p._id))

		// Do the reset
		const allToReset = [...resetInDb, ...partInstanceIdsToReset]
		await Promise.all([
			resetInDb.length
				? context.directCollections.PartInstances.update(
						{
							_id: { $in: resetInDb },
							rundownId: { $in: rundownIds },
							reset: { $ne: true },
						},
						{
							$set: {
								reset: true,
							},
						}
					)
				: undefined,
			allToReset.length
				? context.directCollections.PieceInstances.update(
						{
							partInstanceId: { $in: allToReset },
							rundownId: { $in: rundownIds },
							reset: { $ne: true },
						},
						{
							$set: {
								reset: true,
							},
						}
					)
				: undefined,
			allToReset.length > 0
				? context.directCollections.Notifications.remove({
						'relatedTo.studioId': context.studioId,
						'relatedTo.rundownId': { $in: rundownIds },
						'relatedTo.partInstanceId': { $in: allToReset },
					})
				: undefined,
		])
	})
}

export function substituteObjectIds(
	rawEnable: TSR.Timeline.TimelineEnable | TSR.Timeline.TimelineEnable[],
	idMap: { [oldId: string]: string | undefined }
): TSR.Timeline.TimelineEnable | TSR.Timeline.TimelineEnable[] {
	const replaceIds = (str: string) => {
		return str.replace(/#([\w]+)/g, (m) => {
			const id = m.slice(1)
			return `#${idMap[id] ?? id}`
		})
	}

	const enable = clone<TSR.Timeline.TimelineEnable | TSR.Timeline.TimelineEnable[]>(rawEnable)
	applyToArray(enable, (enable0) => {
		for (const key0 in enable0) {
			const key = key0 as keyof TSR.Timeline.TimelineEnable
			const oldVal = enable0[key]
			if (typeof oldVal === 'string') {
				enable0[key] = replaceIds(oldVal)
			}
		}
	})

	return enable
}
export function prefixSingleObjectId<T extends TimelineObjGeneric>(obj: T, prefix: string): string {
	return prefix + (obj.originalId ?? obj.id)
}
export function prefixAllObjectIds<T extends TimelineObjGeneric>(objList: T[], prefix: string): T[] {
	const idMap: { [oldId: string]: string | undefined } = {}
	for (const obj of objList) {
		idMap[obj.id] = prefixSingleObjectId(obj, prefix)
	}

	return objList.map((rawObj) => {
		const obj = clone(rawObj)

		if (!obj.originalId) obj.originalId = obj.id
		obj.id = prefixSingleObjectId(obj, prefix)
		obj.enable = substituteObjectIds(obj.enable, idMap)

		if (typeof obj.inGroup === 'string') {
			obj.inGroup = idMap[obj.inGroup] || obj.inGroup
		}

		// make sure any keyframes are unique
		if (obj.keyframes) {
			for (const kf of obj.keyframes) {
				kf.id = `${kf.id}_${obj.id}`
			}
		}

		return obj
	})
}

export async function updateTimelineFromStudioPlayoutModel(
	context: JobContext,
	studioPlayoutModel: StudioPlayoutModel
): Promise<void> {
	const activePlaylists = studioPlayoutModel.getActiveRundownPlaylists()
	if (activePlaylists.length > 1) {
		throw new Error(`Too many active playlists`)
	} else if (activePlaylists.length > 0) {
		const playlist = activePlaylists[0]

		await runJobWithPlayoutModel(context, { playlistId: playlist._id }, null, async (playoutModel) => {
			await updateTimeline(context, playoutModel)
		})
	} else {
		await updateStudioTimeline(context, studioPlayoutModel)
	}
}
export function getActivationContextState(playoutModel: PlayoutModel): IRundownActivationContextState {
	return {
		active: playoutModel.playlist.activationId ? true : false,
		rehearsal: playoutModel.playlist.rehearsal ? true : false,
		resetTime: playoutModel.playlist.resetTime,
	}
}
