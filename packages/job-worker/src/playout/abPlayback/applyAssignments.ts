import {
	OnGenerateTimelineObj,
	TSR,
	ABResolverConfiguration,
	ICommonContext,
	ABTimelineLayerChangeRules,
	AbPlayerId,
} from '@sofie-automation/blueprints-integration'
import { ABSessionAssignment, ABSessionAssignments } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { logger } from '../../logging.js'
import _ from 'underscore'
import { SessionRequest } from './abPlaybackResolver.js'
import { AbSessionHelper } from './abSessionHelper.js'
import { ReadonlyDeep } from 'type-fest'

/**
 * Apply the ab assignments for a pool to the timeline
 * @param abSessionHelper Helper for generation sessionId
 * @param blueprintContext Context for blueprint functions
 * @param abConfiguration Configuration of the ab resolver
 * @param timelineObjects The current timeline to update
 * @param previousAssignmentMap Assignments from the previous run
 * @param resolvedAssignments Assignments to apply
 * @param poolName Name of the pool being processed
 * @returns Assignments that were applied to the timeline
 */
export function applyAbPlayerObjectAssignments(
	abSessionHelper: AbSessionHelper,
	blueprintContext: ICommonContext,
	abConfiguration: Pick<ABResolverConfiguration, 'timelineObjectLayerChangeRules' | 'customApplyToObject'>,
	timelineObjs: OnGenerateTimelineObjExt[],
	previousAssignmentMap: ReadonlyDeep<ABSessionAssignments> | undefined,
	resolvedAssignments: Readonly<SessionRequest[]>,
	poolName: string
): ABSessionAssignments {
	const newAssignments: ABSessionAssignments = {}
	const persistAssignment = (session: ABSessionAssignment): void => {
		// Track the assignment, so that the next onTimelineGenerate can try to reuse the same session
		if (newAssignments[session.sessionId]) {
			// TODO - warn?
		}
		newAssignments[session.sessionId] = session
	}

	// collect objects by their sessionId
	const groupedObjectsMap = new Map<string, { name: string; objs: Array<OnGenerateTimelineObjExt> }>()
	for (const obj of timelineObjs) {
		if (obj.abSessions && obj.pieceInstanceId) {
			for (const session of obj.abSessions) {
				if (session.poolName === poolName) {
					const sessionId = abSessionHelper.getTimelineObjectAbSessionId(obj, session)
					if (!sessionId) continue

					const existing = groupedObjectsMap.get(sessionId)
					if (existing) {
						existing.objs.push(obj)
					} else {
						groupedObjectsMap.set(sessionId, { name: session.sessionName, objs: [obj] })
					}
				}
			}
		}
	}

	const failedObjects: OnGenerateTimelineObj<TSR.TSRTimelineContent>[] = []
	const unexpectedSessions: string[] = []

	// Apply the known assignments
	for (const [sessionId, info] of groupedObjectsMap.entries()) {
		if (sessionId === 'undefined') continue

		const matchingAssignment = resolvedAssignments.find((req) => req.id === sessionId)

		if (matchingAssignment) {
			if (matchingAssignment.playerId !== undefined) {
				failedObjects.push(
					...updateObjectsToAbPlayer(
						blueprintContext,
						abConfiguration,
						poolName,
						matchingAssignment.playerId,
						info.objs
					)
				)
				persistAssignment({
					sessionId,
					sessionName: matchingAssignment.name,
					playerId: matchingAssignment.playerId,
					lookahead: !!matchingAssignment.lookaheadRank,
				})
			} else {
				// A warning will already have been raised about this having no player
			}
		} else {
			// This is a group that shouldn't exist, so are likely a bug. There isnt a lot we can do beyond warn about the issue
			unexpectedSessions.push(`${sessionId}(${info.objs.map((obj) => obj.id).join(',')})`)

			// If there was a previous assignment, hopefully that is better than nothing
			const prev = previousAssignmentMap?.[sessionId]
			if (prev) {
				failedObjects.push(
					...updateObjectsToAbPlayer(blueprintContext, abConfiguration, poolName, prev.playerId, info.objs)
				)
				persistAssignment({
					sessionId,
					sessionName: '?',
					playerId: prev.playerId,
					lookahead: false,
				})
			}
		}
	}

	if (failedObjects.length > 0) {
		logger.warn(`ABPlayback failed to update ${failedObjects.length} to their AB session`)
		logger.debug(`Failed objects are: ${failedObjects.map((obj) => `${obj.id}@${obj.layer}`).join(', ')}`)
	}
	if (unexpectedSessions.length > 0) {
		logger.warn(`ABPlayback found ${unexpectedSessions.length} unexpected sessions on the timeline`)
		logger.debug(`Unexpected sessions are: ${unexpectedSessions.join(', ')}`)
	}

	for (const assignment of Object.values<ABSessionAssignment | undefined>(newAssignments)) {
		if (!assignment) continue
		logger.silly(
			`ABPlayback: Assigned session "${poolName}"-"${assignment.sessionId}" (${assignment.sessionName}) to player "${assignment.playerId}" (lookahead: ${assignment.lookahead})`
		)
	}

	return newAssignments
}

function updateObjectsToAbPlayer(
	context: ICommonContext,
	abConfiguration: Pick<ABResolverConfiguration, 'timelineObjectLayerChangeRules' | 'customApplyToObject'>,
	poolName: string,
	playerId: AbPlayerId,
	objs: OnGenerateTimelineObj<TSR.TSRTimelineContent>[]
): OnGenerateTimelineObj<TSR.TSRTimelineContent>[] {
	const failedObjects: OnGenerateTimelineObj<TSR.TSRTimelineContent>[] = []

	for (const obj of objs) {
		const updatedKeyframes = applyUpdateToKeyframes(poolName, playerId, obj)

		const updatedLayer = applylayerMoveRule(abConfiguration.timelineObjectLayerChangeRules, poolName, playerId, obj)

		const updatedCustom = abConfiguration.customApplyToObject?.(context, poolName, playerId, obj)

		if (!updatedKeyframes && !updatedLayer && !updatedCustom) {
			failedObjects.push(obj)
		}
	}

	return failedObjects
}

function applyUpdateToKeyframes(
	poolName: string,
	playerId: AbPlayerId,
	obj: OnGenerateTimelineObj<TSR.TSRTimelineContent>
): boolean {
	if (!obj.keyframes) return false

	let updated = false

	obj.keyframes = _.compact(
		obj.keyframes.map((kf) => {
			// Preserve all non-ab keyframes
			if (!kf.abSession) return kf
			// Preserve from other ab pools
			if (kf.abSession.poolName !== poolName) return kf

			if (kf.abSession.playerId === playerId) {
				// Make sure any ab keyframe is active
				kf.disabled = false
				updated = true
				return kf
			} else {
				// Remove the keyframes for other players in the pool
				return undefined
			}
		})
	)

	return updated
}

function applylayerMoveRule(
	timelineObjectLayerChangeRules: ABTimelineLayerChangeRules | undefined,
	poolName: string,
	playerId: AbPlayerId,
	obj: OnGenerateTimelineObj<TSR.TSRTimelineContent>
): boolean {
	const ruleId = obj.isLookahead ? obj.lookaheadForLayer || obj.layer : obj.layer
	if (!ruleId) return false

	const moveRule = timelineObjectLayerChangeRules?.[ruleId]
	if (!moveRule || !moveRule.acceptedPoolNames.includes(poolName)) return false

	if (obj.isLookahead && moveRule.allowsLookahead && obj.lookaheadForLayer) {
		// This works on the assumption that layer will contain lookaheadForLayer, but not the exact syntax.
		// Hopefully this will be durable to any potential future core changes
		const newLayer = moveRule.newLayerName(playerId)
		obj.layer = (obj.layer + '').replace(obj.lookaheadForLayer + '', newLayer)
		obj.lookaheadForLayer = newLayer

		return true
	} else if (!obj.isLookahead || (obj.isLookahead && !obj.lookaheadForLayer)) {
		obj.layer = moveRule.newLayerName(playerId)
		return true
	}

	return false
}
