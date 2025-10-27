import { ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	ABSessionAssignment,
	ABSessionAssignments,
	DBRundownPlaylist,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { endTrace, sendTrace, startTrace } from '@sofie-automation/corelib/dist/influxdb'
import { WrappedShowStyleBlueprint } from '../../blueprints/cache.js'
import { ReadonlyDeep } from 'type-fest'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { getCurrentTime } from '../../lib/index.js'
import { resolveAbAssignmentsFromRequests, SessionRequest } from './abPlaybackResolver.js'
import { calculateSessionTimeRanges } from './abPlaybackSessions.js'
import { applyAbPlayerObjectAssignments } from './applyAssignments.js'
import { AbSessionHelper } from './abSessionHelper.js'
import { ShowStyleContext } from '../../blueprints/context/index.js'
import { logger } from '../../logging.js'
import { ABPlayerDefinition, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { abPoolFilterDisabled, findPlayersInRouteSets } from './routeSetDisabling.js'
import type { INotification } from '../../notifications/NotificationsModel.js'
import { generateTranslation } from '@sofie-automation/corelib/dist/lib'
import _ from 'underscore'

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
					`ABPlayback: Previous assignment "${pool}"-"${assignment.sessionId}" (${assignment.sessionName}) to player "${assignment.playerId}"`
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
				`ABPlayback resolved session "${poolName}"-"${assignment.id}" (${assignment.name}) to player "${
					assignment.playerId
				}" (${JSON.stringify(assignment)})`
			)
		}
		for (const failedSession of assignments.failedRequired) {
			const uniqueNames = _.uniq(failedSession.pieceNames).join(', ')
			logger.warn(
				`ABPlayback failed to assign session for "${poolName}"-"${failedSession.id}" (${failedSession.name}): ${uniqueNames}`
			)

			// Ignore lookahead
			if (failedSession.pieceNames.length === 0) continue

			notifications.push({
				id: `failedRequired-${poolName}`,
				severity: NoteSeverity.ERROR,
				message: generateTranslation('Failed to assign AB player for {{pieceNames}}', {
					pieceNames: uniqueNames,
				}),
			})
		}

		for (const failedSession of assignments.failedOptional) {
			const uniqueNames = _.uniq(failedSession.pieceNames).join(', ')
			logger.info(
				`ABPlayback failed to assign optional session for "${poolName}"-"${failedSession.id}" (${failedSession.name}): ${uniqueNames}`
			)

			// Ignore lookahead
			if (failedSession.pieceNames.length === 0) continue

			notifications.push({
				id: `failedRequired-${poolName}`,
				severity: NoteSeverity.WARNING,
				message: generateTranslation('Failed to assign non-critical AB player for {{pieceNames}}', {
					pieceNames: uniqueNames,
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
