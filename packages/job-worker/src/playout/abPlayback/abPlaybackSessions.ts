import { OnGenerateTimelineObj, TSR } from '@sofie-automation/blueprints-integration'
import { ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ABSessionAssignments } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import _ from 'underscore'
import { SessionRequest } from './abPlaybackResolver.js'
import { AbSessionHelper } from './abSessionHelper.js'
import { ReadonlyDeep } from 'type-fest'

/**
 * Calculate all of the AB-playback sessions currently on the timeline
 * @param abSessionHelper Helper for generation sessionId
 * @param resolvedPieces All the PieceInstances on the timeline, resolved to have 'accurate' playback timings
 * @param timelineObjects The timeline to check for lookahead sessions
 * @param previousAssignmentMap Assignments from the previous run
 * @param poolName Name of the pool being processed
 * @returns All the requested sessions with time windows
 */
export function calculateSessionTimeRanges(
	abSessionHelper: AbSessionHelper,
	resolvedPieces: ResolvedPieceInstance[],
	timelineObjects: OnGenerateTimelineObjExt[],
	previousAssignmentMap: ReadonlyDeep<ABSessionAssignments> | undefined,
	poolName: string
): SessionRequest[] {
	const sessionRequests: { [sessionId: string]: SessionRequest | undefined } = {}
	for (const p of resolvedPieces) {
		const abSessions = p.instance.piece.abSessions
		if (!abSessions) continue

		const start = p.resolvedStart
		const duration = p.resolvedDuration
		const end = duration !== undefined ? start + duration : undefined

		// Track the range of each session
		for (const session of abSessions) {
			if (session.poolName !== poolName) continue

			const sessionId = abSessionHelper.getPieceABSessionId(p.instance, session)

			// Note: multiple generated sessionIds for a single piece will not work as there will not be enough info to assign objects to different players. TODO is this still true?
			const val = sessionRequests[sessionId]
			if (val) {
				// This session is already known, so extend the session to cover all the pieces
				sessionRequests[sessionId] = {
					id: sessionId,
					name: session.sessionName,
					start: Math.min(val.start, start),
					end: val.end === undefined || end === undefined ? undefined : Math.max(val.end, end),
					optional: val.optional && (session.optional ?? false),
					lookaheadRank: undefined,
					playerId: previousAssignmentMap?.[sessionId]?.playerId, // Persist previous assignments
					pieceNames: [...(val.pieceNames || []), p.instance.piece.name],
				}
			} else {
				// New session
				sessionRequests[sessionId] = {
					id: sessionId,
					name: session.sessionName,
					start,
					end,
					optional: session.optional ?? false,
					lookaheadRank: undefined,
					playerId: previousAssignmentMap?.[sessionId]?.playerId, // Persist previous assignments
					pieceNames: [p.instance.piece.name],
				}
			}
		}
	}

	const result = _.compact(Object.values<SessionRequest | undefined>(sessionRequests))

	// Include lookaheads, as they dont have pieces
	const groupedLookaheadMap = new Map<
		string,
		{ name: string; objs: Array<OnGenerateTimelineObj<TSR.TSRTimelineContent>> }
	>()
	for (const obj of timelineObjects) {
		if (
			!!obj.isLookahead &&
			!Array.isArray(obj.enable) &&
			obj.enable.duration === undefined &&
			obj.enable.end === undefined &&
			obj.abSessions &&
			obj.pieceInstanceId
		) {
			for (const session of obj.abSessions) {
				if (session.poolName === poolName) {
					const sessionId = abSessionHelper.getTimelineObjectAbSessionId(obj, session)
					if (!sessionId) continue

					const existing = groupedLookaheadMap.get(sessionId)
					if (existing) {
						existing.objs.push(obj)
					} else {
						groupedLookaheadMap.set(sessionId, { name: session.sessionName, objs: [obj] })
					}
				}
			}
		}
	}

	const groupedLookahead = Array.from(groupedLookaheadMap.entries()).map(([id, info]) => ({ id, ...info }))
	const sortedLookaheadGroups = _.sortBy(groupedLookahead, (grp) => {
		// Find the highest priority of the objects
		const r = _.max(_.pluck(grp.objs, 'priority')) || -900
		// Invert the sort (to get descending)
		return -r
	})
	sortedLookaheadGroups.forEach((grp, i) => {
		if (!sessionRequests[grp.id]) {
			result.push({
				id: grp.id,
				name: grp.name,
				start: Number.MAX_SAFE_INTEGER, // Distant future
				end: undefined,
				lookaheadRank: i + 1, // This is so that we can easily work out which to use first
				playerId: previousAssignmentMap?.[grp.id]?.playerId,
				pieceNames: [],
			})
		}
	})

	return result
}
