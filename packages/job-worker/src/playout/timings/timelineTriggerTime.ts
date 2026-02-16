import { PartInstanceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnTimelineTriggerTimeProps } from '@sofie-automation/corelib/dist/worker/studio'
import { logger } from '../../logging.js'
import { JobContext } from '../../jobs/index.js'
import { runJobWithPlaylistLock } from '../lock.js'
import { applyToArray, normalizeArrayToMap } from '@sofie-automation/corelib/dist/lib'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { runJobWithStudioPlayoutModel } from '../../studio/lock.js'
import { StudioPlayoutModel } from '../../studio/model/StudioPlayoutModel.js'
import { PieceTimelineMetadata } from '../timeline/pieceGroup.js'
import { deserializeTimelineBlob } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { ReadonlyDeep } from 'type-fest'
import { AnyBulkWriteOperation } from 'mongodb'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'

/**
 * Called from Playout-gateway when the trigger-time of a timeline object has updated
 * ( typically when using the "now"-feature )
 */
export async function handleTimelineTriggerTime(context: JobContext, data: OnTimelineTriggerTimeProps): Promise<void> {
	if (data.results.length > 0) {
		await runJobWithStudioPlayoutModel(context, async (studioCache) => {
			const activePlaylists = studioCache.getActiveRundownPlaylists()

			if (studioCache.isMultiGatewayMode) {
				logger.warn(`Ignoring timelineTriggerTime call for studio not using now times`)
				return
			}

			if (activePlaylists.length === 1) {
				// If there is a playlist active, this needs to be done inside the playlistLock
				const activePlaylist = activePlaylists[0]
				const playlistId = activePlaylist._id
				await runJobWithPlaylistLock(context, { playlistId }, async () => {
					const rundownIDs = (
						await context.directCollections.Rundowns.findFetch({ playlistId }, { projection: { _id: 1 } })
					).map((r) => r._id)
					const partInstanceIDs = [activePlaylist.currentPartInfo?.partInstanceId].filter(
						(id): id is PartInstanceId => id !== null
					)

					// We only need the PieceInstances and PartInstances, so load just them
					const [pieceInstances, partInstances] = await Promise.all([
						context.directCollections.PieceInstances.findFetch({
							rundownId: { $in: rundownIDs },
							partInstanceId: {
								$in: partInstanceIDs,
							},
						}),
						context.directCollections.PartInstances.findFetch(
							{
								rundownId: { $in: rundownIDs },
								_id: {
									$in: partInstanceIDs,
								},
							},
							{
								projection: {
									_id: 1,
									partPlayoutTimings: 1,
								},
							}
						) as Promise<Array<Pick<DBPartInstance, '_id' | 'partPlayoutTimings'>>>,
					])
					const pieceInstancesMap = normalizeArrayToMap(pieceInstances, '_id')
					const partInstanceMap = normalizeArrayToMap(partInstances, '_id')

					// Take ownership of the playlist in the db, so that we can mutate the timeline and piece instances
					const changes = timelineTriggerTimeInner(
						studioCache,
						data.results,
						partInstanceMap,
						pieceInstancesMap,
						activePlaylist
					)

					await writePieceInstanceChangesToMongo(context, changes)
				})
			} else {
				// No playlist is active. no extra lock needed
				timelineTriggerTimeInner(studioCache, data.results, undefined, undefined, undefined)
			}
		})
	}
}

async function writePieceInstanceChangesToMongo(context: JobContext, changes: PieceInstancesChanges): Promise<void> {
	const updates: AnyBulkWriteOperation<PieceInstance>[] = []
	for (const [pieceInstanceId, newTime] of changes.setStartTime.entries()) {
		updates.push({
			updateOne: {
				filter: {
					_id: pieceInstanceId,
				},
				update: {
					$set: {
						'piece.enable.start': newTime,
					},
				},
			},
		})
	}

	if (changes.removeIds.length) {
		updates.push({
			deleteMany: {
				filter: {
					_id: { $in: changes.removeIds as any },
				},
			},
		})
	}

	await context.directCollections.PieceInstances.bulkWrite(updates)
}

interface PieceInstancesChanges {
	removeIds: PieceInstanceId[]
	setStartTime: Map<PieceInstanceId, number>
}

function timelineTriggerTimeInner(
	studioPlayoutModel: StudioPlayoutModel,
	results: OnTimelineTriggerTimeProps['results'],
	partInstances: Map<PartInstanceId, Pick<DBPartInstance, '_id' | 'partPlayoutTimings'>> | undefined,
	pieceInstances: Map<PieceInstanceId, PieceInstance> | undefined,
	activePlaylist: ReadonlyDeep<DBRundownPlaylist> | undefined
) {
	let lastTakeTime: number | undefined

	const changes: PieceInstancesChanges = {
		removeIds: [],
		setStartTime: new Map(),
	}

	// ------------------------------
	const timeline = studioPlayoutModel.timeline
	if (timeline) {
		const timelineObjs = deserializeTimelineBlob(timeline.timelineBlob)
		let tlChanged = false

		for (const o of results) {
			logger.debug(`Timeline: Setting time: "${o.id}": ${o.time}`)

			const obj = timelineObjs.find((tlo) => tlo.id === o.id)
			if (obj) {
				applyToArray(obj.enable, (enable) => {
					if (enable.start === 'now') {
						enable.start = o.time
						enable.setFromNow = true

						tlChanged = true
					}
				})

				// TODO - we should do the same for the partInstance.
				// Or should we not update the now for them at all? as we should be getting the onPartPlaybackStarted immediately after

				const objPieceInstanceId = (obj.metaData as Partial<PieceTimelineMetadata> | undefined)
					?.triggerPieceInstanceId
				if (objPieceInstanceId && activePlaylist && pieceInstances && partInstances) {
					logger.debug('Update PieceInstance: ', {
						pieceId: objPieceInstanceId,
						time: new Date(o.time).toTimeString(),
					})

					const pieceInstance = pieceInstances.get(objPieceInstanceId)
					if (
						pieceInstance &&
						pieceInstance.dynamicallyInserted !== undefined &&
						pieceInstance.piece.enable.start === 'now'
					) {
						const partPrerollDuration =
							partInstances.get(pieceInstance.partInstanceId)?.partPlayoutTimings?.toPartDelay ?? 0

						const adjustedStartTime = o.time - partPrerollDuration
						pieceInstance.piece.enable.start = adjustedStartTime
						changes.setStartTime.set(pieceInstance._id, adjustedStartTime)

						const takeTime = pieceInstance.dynamicallyInserted
						lastTakeTime = lastTakeTime === undefined ? takeTime : Math.max(lastTakeTime, takeTime)
					}
				}
			}
		}

		if (lastTakeTime !== undefined && activePlaylist?.currentPartInfo && pieceInstances) {
			// We updated some pieceInstance from now, so lets ensure any earlier adlibs do not still have a now
			for (const piece of pieceInstances.values()) {
				if (
					piece.partInstanceId === activePlaylist.currentPartInfo.partInstanceId &&
					!piece.disabled &&
					piece.dynamicallyInserted !== undefined &&
					piece.dynamicallyInserted <= lastTakeTime &&
					piece.piece.enable.start === 'now'
				) {
					// Delete the instance which has no duration
					changes.removeIds.push(piece._id)
					pieceInstances.delete(piece._id)
				}
			}
		}
		if (tlChanged) {
			const timelineHash = studioPlayoutModel.setTimeline(
				timelineObjs,
				timeline.generationVersions,
				timeline.regenerateTimelineToken
			).timelineHash

			logger.verbose(`timelineTriggerTime: Updated Timeline, hash: "${timelineHash}"`)
		}
	}

	return changes
}
