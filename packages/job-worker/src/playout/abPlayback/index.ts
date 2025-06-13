import { ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	ABSessionAssignment,
	ABSessionAssignments,
	DBRundownPlaylist,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { endTrace, sendTrace, startTrace } from '@sofie-automation/corelib/dist/influxdb'
import { WrappedShowStyleBlueprint } from '../../blueprints/cache'
import { ReadonlyDeep } from 'type-fest'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { getCurrentTime } from '../../lib'
import { resolveAbAssignmentsFromRequests, SessionRequest } from './abPlaybackResolver'
import { calculateSessionTimeRanges } from './abPlaybackSessions'
import { applyAbPlayerObjectAssignments } from './applyAssignments'
import { AbSessionHelper } from './abSessionHelper'
import { ShowStyleContext } from '../../blueprints/context'
import { logger } from '../../logging'
import { ABPlayerDefinition, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { abPoolFilterDisabled, findPlayersInRouteSets } from './routeSetDisabling'
import type { INotification } from '../../notifications/NotificationsModel'
import { generateTranslation } from '@sofie-automation/corelib/dist/lib'

export interface ABPlaybackResult {
	assignments: Record<string, ABSessionAssignments>
	notifications: INotification[]
}
/**
 * Resolve and apply AB-playback for the given timeline
 * @param context Context of the job
 * @param abSessionHelper Helper for generation sessionId
 * @param blueprint Blueprint of the currently playing ShowStyle
 * @param showStyle The currently playing ShowStyle
 * @param playlist The currently playing Playlist
 * @param resolvedPieces All the PieceInstances on the timeline, resolved to have 'accurate' playback timings
 * @param timelineObjects The current timeline
 * @returns New AB assignments to be persisted on the playlist for the next call
 */
export function applyAbPlaybackForTimeline(
	context: JobContext,
	abSessionHelper: AbSessionHelper,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	resolvedPieces: ResolvedPieceInstance[],
	timelineObjects: OnGenerateTimelineObjExt[]
): ABPlaybackResult {
	if (!blueprint.blueprint.getAbResolverConfiguration)
		return {
			assignments: {},
			notifications: [],
		}

	const blueprintContext = new ShowStyleContext(
		{
			name: playlist.name,
			identifier: `playlistId=${playlist._id},previousPartInstance=${playlist.previousPartInfo?.partInstanceId},currentPartInstance=${playlist.currentPartInfo?.partInstanceId},nextPartInstance=${playlist.nextPartInfo?.partInstanceId}`,
		},
		context.studio,
		context.getStudioBlueprintConfig(),
		showStyle,
		context.getShowStyleBlueprintConfig(showStyle)
	)

	const previousAbSessionAssignments: Record<string, ABSessionAssignments> = playlist.assignedAbSessions || {}
	logger.silly(`ABPlayback: Starting AB playback resolver ----------------------------`)
	for (const [pool, assignments] of Object.entries<ABSessionAssignments>(previousAbSessionAssignments)) {
		for (const assignment of Object.values<ABSessionAssignment | undefined>(assignments)) {
			if (assignment) {
				logger.silly(
					`ABPlayback: Previous assignment "${pool}"-"${assignment.sessionId}" to player "${assignment.playerId}"`
				)
			}
		}
	}

	const newAbSessionsResult: Record<string, ABSessionAssignments> = {}

	const span = context.startSpan('blueprint.abPlaybackResolver')
	const influxTrace = startTrace('blueprints:abPlaybackResolver')

	const now = getCurrentTime()

	const notifications: INotification[] = []

	const abConfiguration = blueprint.blueprint.getAbResolverConfiguration(blueprintContext)
	const routeSetMembers = findPlayersInRouteSets(context.studio.routeSets)

	for (const [poolName, players] of Object.entries<ABPlayerDefinition[]>(abConfiguration.pools)) {
		// Filter out offline devices
		const filteredPlayers = abPoolFilterDisabled(poolName, players, routeSetMembers)

		const previousAssignmentMap: ReadonlyDeep<ABSessionAssignments> | undefined =
			playlist.assignedAbSessions?.[poolName]
		const sessionRequests = calculateSessionTimeRanges(
			abSessionHelper,
			resolvedPieces,
			timelineObjects,
			previousAssignmentMap,
			poolName
		)

		const assignments = resolveAbAssignmentsFromRequests(
			abConfiguration.resolverOptions,
			filteredPlayers.map((player) => player.playerId),
			sessionRequests,
			now
		)

		for (const assignment of Object.values<SessionRequest>(assignments.requests)) {
			logger.silly(
				`ABPlayback resolved session "${poolName}"-"${assignment.id}" to player "${
					assignment.playerId
				}" (${JSON.stringify(assignment)})`
			)
		}
		if (assignments.failedRequired.length > 0) {
			logger.warn(
				`ABPlayback failed to assign sessions for "${poolName}": ${JSON.stringify(assignments.failedRequired)}`
			)
			notifications.push({
				id: `failedRequired-${poolName}`,
				severity: NoteSeverity.ERROR,
				message: generateTranslation('Failed to assign players for {{count}} sessions', {
					count: assignments.failedRequired.length,
				}),
			})
		}
		if (assignments.failedOptional.length > 0) {
			logger.info(
				`ABPlayback failed to assign optional sessions for "${poolName}": ${JSON.stringify(
					assignments.failedOptional
				)}`
			)
			notifications.push({
				id: `failedOptional-${poolName}`,
				severity: NoteSeverity.WARNING,
				message: generateTranslation('Failed to assign players for {{count}} non-critical sessions', {
					count: assignments.failedOptional.length,
				}),
			})
		}

		newAbSessionsResult[poolName] = applyAbPlayerObjectAssignments(
			abSessionHelper,
			blueprintContext,
			abConfiguration,
			timelineObjects,
			previousAssignmentMap,
			assignments.requests,
			poolName
		)
	}

	sendTrace(endTrace(influxTrace))
	if (span) span.end()

	return {
		assignments: newAbSessionsResult,
		notifications,
	}
}
