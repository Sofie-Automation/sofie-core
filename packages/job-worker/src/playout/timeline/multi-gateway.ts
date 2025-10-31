import { Time } from '@sofie-automation/blueprints-integration'
import { PieceInstanceInfiniteId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDeviceType } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { TimelineObjRundown } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { normalizeArray } from '@sofie-automation/corelib/dist/lib'
import { PieceTimelineMetadata } from './pieceGroup.js'
import { StudioPlayoutModelBase } from '../../studio/model/StudioPlayoutModel.js'
import { logger } from '../../logging.js'
import { JobContext } from '../../jobs/index.js'
import { getCurrentTime } from '../../lib/index.js'
import { PlayoutModel } from '../model/PlayoutModel.js'
import { RundownTimelineTimingContext, getInfinitePartGroupId } from './rundown.js'
import { getExpectedLatency } from '@sofie-automation/corelib/dist/studio/playout'
import { getPieceControlObjectId } from '@sofie-automation/corelib/dist/playout/ids'
import { PlayoutPartInstanceModel } from '../model/PlayoutPartInstanceModel.js'
import { PlayoutPieceInstanceModel } from '../model/PlayoutPieceInstanceModel.js'

/**
 * We want it to be possible to generate a timeline without it containing any `start: 'now'`.
 * This is challenging to do while we are generating it, as the generation will take an unpredictable amount of time.
 * There are some db calls, and a call into the blueprint for `onTimelineGenerate`
 * Instead, this fixes up the timeline after we have finished generating it
 * This does introduce a risk of error when changes are made to how we generate the timeline, but that risk should be small.
 */
export function deNowifyMultiGatewayTimeline(
	context: JobContext,
	playoutModel: PlayoutModel,
	timelineObjs: TimelineObjRundown[],
	timingContext: RundownTimelineTimingContext | undefined
): void {
	if (!timingContext) return

	const timelineObjsMap = normalizeArray(timelineObjs, 'id')

	const nowOffsetLatency = calculateNowOffsetLatency(context, playoutModel)
	const targetNowTime = getCurrentTime() + (nowOffsetLatency ?? 0)

	// Replace `start: 'now'` in currentPartInstance on timeline
	const currentPartInstance = playoutModel.currentPartInstance
	if (!currentPartInstance) return

	const partGroupTimings = updatePartInstancePlannedTimes(
		targetNowTime,
		timingContext,
		playoutModel.previousPartInstance,
		currentPartInstance,
		playoutModel.nextPartInstance
	)

	const { objectsNotDeNowified } = deNowifyCurrentPieces(
		targetNowTime,
		timingContext,
		currentPartInstance,
		partGroupTimings.currentStartTime,
		timelineObjsMap
	)

	updatePlannedTimingsForPieceInstances(playoutModel, currentPartInstance, partGroupTimings, timelineObjsMap)

	// Because updatePlannedTimingsForPieceInstances changes start times of infinites, we can now run deNowifyInfinites()
	deNowifyInfinites(targetNowTime, objectsNotDeNowified, timelineObjsMap)

	for (const obj of timelineObjs) {
		if (!Array.isArray(obj.enable) && obj.enable.start === 'now') {
			logger.error(`deNowifyMultiGatewayTimeline: "${obj.id}" still set to 'now'`)
		}
	}
}

/**
 * Calculate an offset to apply to the 'now' value, to compensate for delay in playout-gateway
 * The intention is that any concrete value used instead of 'now' should still be just in the future for playout-gateway
 */
export function calculateNowOffsetLatency(
	context: JobContext,
	studioPlayoutModel: StudioPlayoutModelBase
): Time | undefined {
	/** The timestamp that "now" was set to */
	let nowOffsetLatency: Time | undefined

	if (studioPlayoutModel.isMultiGatewayMode) {
		const playoutDevices = studioPlayoutModel.peripheralDevices.filter(
			(device) => device.type === PeripheralDeviceType.PLAYOUT
		)
		const worstLatency = Math.max(0, ...playoutDevices.map((device) => getExpectedLatency(device).safe))
		/** Add a little more latency, to account for network latency variability */
		const ADD_SAFE_LATENCY = context.studio.settings.multiGatewayNowSafeLatency || 30
		nowOffsetLatency = worstLatency + ADD_SAFE_LATENCY
	}

	return nowOffsetLatency
}

interface PartGroupTimings {
	currentStartTime: number
	currentEndTime: number | undefined
	nextStartTime: number | undefined
}

/**
 * Update the `plannedStartedPlayback` and `plannedStoppedPlayback` for the PartInstances on the timeline,
 * returning the chosen start times for each PartInstance
 */
function updatePartInstancePlannedTimes(
	targetNowTime: number,
	timingContext: RundownTimelineTimingContext,
	previousPartInstance: PlayoutPartInstanceModel | null,
	currentPartInstance: PlayoutPartInstanceModel,
	nextPartInstance: PlayoutPartInstanceModel | null
): PartGroupTimings {
	let currentPartGroupStartTime: number
	if (!currentPartInstance.partInstance.timings?.plannedStartedPlayback) {
		// Looks like the part is just being taken
		currentPartInstance.setPlannedStartedPlayback(targetNowTime)

		// Reflect this in the timeline
		timingContext.currentPartGroup.enable.start = targetNowTime
		currentPartGroupStartTime = targetNowTime
	} else {
		currentPartGroupStartTime = currentPartInstance.partInstance.timings.plannedStartedPlayback
	}

	// Also mark the previous as ended
	if (previousPartInstance) {
		const previousPartEndTime = currentPartGroupStartTime + (timingContext.previousPartOverlap ?? 0)
		previousPartInstance.setPlannedStoppedPlayback(previousPartEndTime)
	}

	const currentPartGroupEndTime = timingContext.currentPartDuration
		? currentPartGroupStartTime + timingContext.currentPartDuration
		: undefined

	let nextPartGroupStartTime: number | undefined
	if (nextPartInstance && timingContext.nextPartGroup && currentPartGroupEndTime) {
		// Auto-next has been setup, make sure the start of the nexted group is planned and correct

		// Calculate the new start time for the auto-nexted group
		nextPartGroupStartTime = currentPartGroupEndTime - (timingContext.nextPartOverlap ?? 0)

		timingContext.nextPartGroup.enable.start = nextPartGroupStartTime

		nextPartInstance.setPlannedStartedPlayback(nextPartGroupStartTime)
	} else if (nextPartInstance) {
		// Make sure the next partInstance doesnt have a start time
		nextPartInstance.setPlannedStartedPlayback(undefined)
	}

	return {
		currentStartTime: currentPartGroupStartTime,
		currentEndTime: currentPartGroupEndTime,
		nextStartTime: nextPartGroupStartTime,
	}
}

/**
 * Replace the `now` time in any timeline objects in freshly-placed infinites.
 *
 * This is effectively only needed when a new item has been placed on the timeline just now and changes made by
 * `updatePlannedTimingsForPieceInstances` haven't been taken into account when generating the timeline. On the next
 * regeneration, items will already use the timestamps persited by `updatePlannedTimingsForPieceInstances` and will not
 * be included in `infiniteObjs`.
 */
function deNowifyInfinites(
	targetNowTime: number,
	/** A list of objects that need to be updated */
	infiniteObjs: TimelineObjRundown[],
	timelineObjsMap: Record<string, TimelineObjRundown>
) {
	/**
	 * Recursively look up the absolute starttime of a timeline object
	 * taking into account its parent's times.
	 * Note: This only supports timeline objects that have absolute enable.start times.
	 */
	const getStartTime = (obj: TimelineObjRundown): number | undefined => {
		if (Array.isArray(obj.enable)) return undefined

		const myStartTime = typeof obj.enable.start === 'number' ? obj.enable.start : undefined

		if (!obj.inGroup) return myStartTime

		if (myStartTime === undefined) return undefined

		const parentObject = timelineObjsMap[obj.inGroup]
		if (!parentObject) return undefined

		const parentStartTime = getStartTime(parentObject)
		if (parentStartTime === undefined) return undefined

		return parentStartTime + myStartTime
	}

	for (const obj of infiniteObjs) {
		if (Array.isArray(obj.enable) || obj.enable.start !== 'now') continue

		if (!obj.inGroup) {
			obj.enable = { start: targetNowTime }
			continue
		}

		const parentObject = timelineObjsMap[obj.inGroup]
		if (!parentObject) {
			logger.error(`deNowifyInfinites: Parent obj "${obj.inGroup}" not found of object "${obj.id}"`)
			continue
		}

		const parentStartTime = getStartTime(parentObject)
		if (parentStartTime === undefined) {
			logger.error(
				`deNowifyInfinites: Unable to derive an absolute start time of parent "${obj.inGroup}" for object "${obj.id}"`
			)
			continue
		}

		obj.enable = { start: targetNowTime - parentStartTime }
		logger.silly(
			`deNowifyInfinites: Setting "${obj.id}" enable.start = ${JSON.stringify(obj.enable.start)}, ${targetNowTime} ${parentStartTime} parentObject: "${parentObject.id}"`
		)
	}
}
/**
 * Replace the `now` time in any Pieces on the timeline from the current Part with concrete start times
 * @returns a list of object that couldn't be updated at this time.
 */
function deNowifyCurrentPieces(
	targetNowTime: number,
	timingContext: RundownTimelineTimingContext,
	currentPartInstance: PlayoutPartInstanceModel,
	currentPartGroupStartTime: number,
	timelineObjsMap: Record<string, TimelineObjRundown>
): { objectsNotDeNowified: TimelineObjRundown[] } {
	const objectsNotDeNowified: TimelineObjRundown[] = []
	// The relative time for 'now' to be resolved to, inside of the part group
	const nowInPart = targetNowTime - currentPartGroupStartTime
	const nowInPartWithoutPreroll = nowInPart - (currentPartInstance.partInstance.partPlayoutTimings?.toPartDelay ?? 0)

	// Ensure any pieces in the currentPartInstance have their now replaced
	for (const pieceInstance of currentPartInstance.pieceInstances) {
		if (pieceInstance.pieceInstance.piece.enable.start === 'now') {
			pieceInstance.updatePieceProps({
				enable: {
					...pieceInstance.pieceInstance.piece.enable,
					start: nowInPartWithoutPreroll,
				},
			})
		}
	}

	// Pieces without concrete times will add some special 'now' objects to the timeline that they can reference
	// Make sure that the all have concrete times attached
	for (const obj of Object.values<TimelineObjRundown>(timelineObjsMap)) {
		const objMetadata = obj.metaData as Partial<PieceTimelineMetadata> | undefined
		if (objMetadata?.isPieceTimeline && !Array.isArray(obj.enable) && obj.enable.start === 'now') {
			if (obj.inGroup === timingContext.currentPartGroup.id) {
				obj.enable = { ...obj.enable, start: nowInPart }
			} else if (!obj.inGroup) {
				obj.enable = { ...obj.enable, start: targetNowTime }
			} else {
				objectsNotDeNowified.push(obj)
			}
		}
	}

	// Ensure any pieces with an unconfirmed userDuration is confirmed
	for (const pieceInstance of currentPartInstance.pieceInstances) {
		if (
			pieceInstance.pieceInstance.userDuration &&
			'endRelativeToNow' in pieceInstance.pieceInstance.userDuration
		) {
			const relativeToNow = pieceInstance.pieceInstance.userDuration.endRelativeToNow
			const endRelativeToPart = relativeToNow + nowInPart
			pieceInstance.setDuration({ endRelativeToPart })

			// Update the piece control obj
			const controlObj = timelineObjsMap[getPieceControlObjectId(pieceInstance.pieceInstance)]
			if (controlObj && !Array.isArray(controlObj.enable) && controlObj.enable.end === 'now') {
				controlObj.enable.end = endRelativeToPart
			}

			// If the piece is an infinite, there may be a now in the parent group
			const infiniteGroup = timelineObjsMap[getInfinitePartGroupId(pieceInstance.pieceInstance._id)]
			if (infiniteGroup && !Array.isArray(infiniteGroup.enable) && infiniteGroup.enable.end === 'now') {
				infiniteGroup.enable.end = targetNowTime + relativeToNow
			}
		}
	}
	return { objectsNotDeNowified }
}

function updatePlannedTimingsForPieceInstances(
	playoutModel: PlayoutModel,
	currentPartInstance: PlayoutPartInstanceModel,
	partGroupTimings: PartGroupTimings,
	timelineObjsMap: Record<string, TimelineObjRundown>
) {
	const existingInfiniteTimings = new Map<PieceInstanceInfiniteId, Time>()
	const previousPartInstance = playoutModel.previousPartInstance
	if (previousPartInstance) {
		const pieceInstances = previousPartInstance.pieceInstances
		for (const pieceInstance of pieceInstances) {
			// Track the timings for the infinites
			const plannedStartedPlayback = pieceInstance.pieceInstance.plannedStartedPlayback
			if (pieceInstance.pieceInstance.infinite && plannedStartedPlayback) {
				existingInfiniteTimings.set(
					pieceInstance.pieceInstance.infinite.infiniteInstanceId,
					plannedStartedPlayback
				)
			}
		}
	}

	// Ensure any pieces have up to date timings
	for (const pieceInstance of currentPartInstance.pieceInstances) {
		setPlannedTimingsOnPieceInstance(
			pieceInstance,
			partGroupTimings.currentStartTime,
			partGroupTimings.currentEndTime
		)
		preserveOrTrackInfiniteTimings(existingInfiniteTimings, timelineObjsMap, pieceInstance)
	}

	const nextPartInstance = playoutModel.nextPartInstance
	if (nextPartInstance && partGroupTimings.nextStartTime) {
		const nextPartGroupStartTime0 = partGroupTimings.nextStartTime
		for (const pieceInstance of nextPartInstance.pieceInstances) {
			setPlannedTimingsOnPieceInstance(pieceInstance, nextPartGroupStartTime0, undefined)
			preserveOrTrackInfiniteTimings(existingInfiniteTimings, timelineObjsMap, pieceInstance)
		}
	}
}

function setPlannedTimingsOnPieceInstance(
	pieceInstance: PlayoutPieceInstanceModel,
	partPlannedStart: Time,
	partPlannedEnd: Time | undefined
): void {
	if (
		pieceInstance.pieceInstance.infinite &&
		pieceInstance.pieceInstance.infinite.infiniteInstanceIndex > 0 &&
		pieceInstance.pieceInstance.plannedStartedPlayback
	) {
		// If not the start of an infinite chain, then the plannedStartedPlayback flows differently
		return
	}

	if (typeof pieceInstance.pieceInstance.piece.enable.start === 'number') {
		const plannedStart =
			(pieceInstance.pieceInstance.piece.enable.isAbsolute ? 0 : partPlannedStart) +
			pieceInstance.pieceInstance.piece.enable.start
		pieceInstance.setPlannedStartedPlayback(plannedStart)

		const userDurationEnd =
			pieceInstance.pieceInstance.userDuration && 'endRelativeToPart' in pieceInstance.pieceInstance.userDuration
				? pieceInstance.pieceInstance.userDuration.endRelativeToPart
				: null

		let plannedEnd: number | undefined = userDurationEnd ?? undefined
		if (plannedEnd === undefined) {
			if (pieceInstance.pieceInstance.piece.enable.duration !== undefined) {
				plannedEnd = plannedStart + pieceInstance.pieceInstance.piece.enable.duration
			} else if (!pieceInstance.pieceInstance.piece.enable.isAbsolute) {
				plannedEnd = partPlannedEnd
			}
		}

		pieceInstance.setPlannedStoppedPlayback(plannedEnd)
	}
}

function preserveOrTrackInfiniteTimings(
	existingInfiniteTimings: Map<PieceInstanceInfiniteId, Time>,
	timelineObjsMap: Record<string, TimelineObjRundown>,
	pieceInstance: PlayoutPieceInstanceModel
): void {
	if (!pieceInstance.pieceInstance.infinite) return

	const plannedStartedPlayback = existingInfiniteTimings.get(pieceInstance.pieceInstance.infinite.infiniteInstanceId)
	if (plannedStartedPlayback) {
		// Found a value from the previousPartInstance, lets preserve it
		pieceInstance.setPlannedStartedPlayback(plannedStartedPlayback)
	} else {
		const plannedStartedPlayback = pieceInstance.pieceInstance.plannedStartedPlayback
		if (plannedStartedPlayback) {
			existingInfiniteTimings.set(pieceInstance.pieceInstance.infinite.infiniteInstanceId, plannedStartedPlayback)
		}
	}

	// Update the timeline group
	const startedPlayback = plannedStartedPlayback ?? pieceInstance.pieceInstance.plannedStartedPlayback
	if (startedPlayback) {
		const infinitePartGroupId = getInfinitePartGroupId(pieceInstance.pieceInstance._id)
		const infinitePartGroupObj = timelineObjsMap[infinitePartGroupId]
		if (
			infinitePartGroupObj &&
			!Array.isArray(infinitePartGroupObj.enable) &&
			typeof infinitePartGroupObj.enable.start === 'string'
		) {
			infinitePartGroupObj.enable.start = startedPlayback
		}
	}
}
