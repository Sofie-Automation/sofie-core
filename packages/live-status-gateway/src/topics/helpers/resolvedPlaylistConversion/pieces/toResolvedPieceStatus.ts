import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { PieceExtended } from '@sofie-automation/corelib/dist/dataModel/Piece'
import type { AbSessionAssignment, ResolvedPiece } from '@sofie-automation/live-status-gateway-api'

export function toResolvedPieceStatus(pieceExtended: PieceExtended): ResolvedPiece {
	const piece = pieceExtended
	const instance = piece.instance
	const basePiece = instance?.piece ?? {}
	const startMs = getStartMs(piece, basePiece)
	const durationMs = getDurationMs(piece, instance, startMs, basePiece)
	const createdByAdLib = !!instance?.dynamicallyInserted
	const abSessions = toAbSessions(basePiece)

	return {
		id: unprotectString(basePiece._id),
		instanceId: unprotectString(instance?._id),
		createdByAdLib,
		externalId: basePiece.externalId ?? '',
		name: basePiece.name ?? '',
		priority: instance?.priority ?? 0,
		sourceLayerId: basePiece.sourceLayerId ?? '',
		outputLayerId: basePiece.outputLayerId ?? '',
		publicData: basePiece.publicData,
		timing: {
			startMs,
			durationMs,
			prerollMs: basePiece.prerollDuration,
		},
		tags: basePiece.tags ? [...basePiece.tags] : [],
		abSessions,
	}
}

function getStartMs(
	piece: PieceExtended,
	basePiece: NonNullable<PieceExtended['instance']>['piece'] | Record<string, never>
) {
	if (typeof piece.renderedInPoint === 'number') return piece.renderedInPoint
	if (typeof basePiece?.enable?.start === 'number') return basePiece.enable.start
	return undefined
}

function getDurationMs(
	piece: PieceExtended,
	instance: PieceExtended['instance'],
	startMs: number | undefined,
	basePiece: NonNullable<PieceExtended['instance']>['piece'] | Record<string, never>
) {
	if (typeof piece.renderedDuration === 'number') return piece.renderedDuration

	const durationFromEnable = typeof basePiece?.enable?.duration === 'number' ? basePiece.enable.duration : undefined
	const durationFromUserDuration =
		typeof instance?.userDuration?.endRelativeToPart === 'number' && typeof startMs === 'number'
			? Math.max(0, instance.userDuration.endRelativeToPart - startMs)
			: undefined
	const durationFromResolvedEndCap =
		typeof instance?.resolvedEndCap === 'number' && typeof startMs === 'number'
			? Math.max(0, instance.resolvedEndCap - startMs)
			: undefined

	return durationFromUserDuration ?? durationFromResolvedEndCap ?? durationFromEnable
}

function toAbSessions(basePiece: NonNullable<PieceExtended['instance']>['piece'] | Record<string, never>) {
	if (!Array.isArray(basePiece.abSessions)) return undefined

	return basePiece.abSessions
		.filter(
			(s): s is AbSessionAssignment =>
				!!s && typeof s.poolName === 'string' && typeof s.sessionName === 'string' && 'playerId' in s
		)
		.map((s) => ({ poolName: s.poolName, sessionName: s.sessionName, playerId: s.playerId }))
}
