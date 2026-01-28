import { unprotectString } from '@sofie-automation/server-core-integration'
import type { ShowStyleBaseExt } from '../../collections/showStyleBaseHandler.js'
import type { PieceInstanceMin } from '../../collections/pieceInstancesHandler.js'
import type { AbSessionAssignment, PieceStatus } from '@sofie-automation/live-status-gateway-api'
import { clone } from '@sofie-automation/corelib/dist/lib'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import type { PickKeys } from '@sofie-automation/shared-lib/dist/lib/types'

const _PLAYLIST_AB_SESSION_KEYS = ['assignedAbSessions', 'trackedAbSessions'] as const
type PlaylistAbSessions = PickKeys<DBRundownPlaylist, typeof _PLAYLIST_AB_SESSION_KEYS>

export function toPieceStatus(
	pieceInstance: PieceInstanceMin,
	showStyleBaseExt: ShowStyleBaseExt | undefined,
	playlist?: PlaylistAbSessions
): PieceStatus {
	const sourceLayerName = showStyleBaseExt?.sourceLayerNamesById.get(pieceInstance.piece.sourceLayerId)
	const outputLayerName = showStyleBaseExt?.outputLayerNamesById.get(pieceInstance.piece.outputLayerId)

	return {
		id: unprotectString(pieceInstance._id),
		name: pieceInstance.piece.name,
		sourceLayer: sourceLayerName ?? 'invalid',
		outputLayer: outputLayerName ?? 'invalid',
		tags: clone<string[] | undefined>(pieceInstance.piece.tags),
		publicData: pieceInstance.piece.publicData,
		abSessions: getAbSessions(pieceInstance, playlist),
	}
}

function getAbSessions(pieceInstance: PieceInstanceMin, playlist?: PlaylistAbSessions) {
	if (!pieceInstance.piece.abSessions || !playlist?.trackedAbSessions || !playlist?.assignedAbSessions) {
		return []
	}

	const abSessions: AbSessionAssignment[] = []

	for (const session of pieceInstance.piece.abSessions) {
		const trackedSession = playlist.trackedAbSessions.find(
			(s) => s.name === `${session.poolName}_${session.sessionName}`
		)

		if (trackedSession) {
			const poolAssignments = playlist.assignedAbSessions[session.poolName]
			const assignment = poolAssignments?.[trackedSession.id]

			if (assignment) {
				abSessions.push({
					poolName: session.poolName,
					sessionName: session.sessionName,
					playerId: assignment.playerId,
				})
			}
		}
	}

	return abSessions
}
