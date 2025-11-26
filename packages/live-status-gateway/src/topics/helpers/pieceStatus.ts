import { unprotectString } from '@sofie-automation/server-core-integration'
import type { ShowStyleBaseExt } from '../../collections/showStyleBaseHandler.js'
import type { PieceInstanceMin } from '../../collections/pieceInstancesHandler.js'
import type { PieceStatus } from '@sofie-automation/live-status-gateway-api'
import { clone } from '@sofie-automation/corelib/dist/lib'

export function toPieceStatus(
	pieceInstance: PieceInstanceMin,
	showStyleBaseExt: ShowStyleBaseExt | undefined
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
	}
}
