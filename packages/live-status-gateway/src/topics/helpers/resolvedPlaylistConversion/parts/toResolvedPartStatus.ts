import { toResolvedPieceStatus } from '../pieces/toResolvedPieceStatus.js'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { ResolvedPlaylistConversionContext } from '../context/conversionContext.js'
import type { PartExtended } from '@sofie-automation/corelib/dist/dataModel/Part'
import { ResolvedPart, ResolvedPartState } from '@sofie-automation/live-status-gateway-api'

/** Converts a resolved `PartExtended` model into the gateway API `ResolvedPart` shape. */
export function toResolvedPartStatus(ctx: ResolvedPlaylistConversionContext, partExtended: PartExtended): ResolvedPart {
	const part = partExtended
	const instance = part.instance
	const basePart = instance?.part ?? {}

	const instanceId = instance?._id ? unprotectString(instance._id) : ''
	let state: ResolvedPartState | undefined
	if (ctx.playlist.currentPartInfo?.partInstanceId && instance?._id === ctx.playlist.currentPartInfo.partInstanceId) {
		state = ResolvedPartState.CURRENT
	} else if (
		ctx.playlist.nextPartInfo?.partInstanceId &&
		instance?._id === ctx.playlist.nextPartInfo.partInstanceId
	) {
		state = ResolvedPartState.NEXT
	}

	const timings = instance?.timings ?? {}
	const createdByAdLib = instance?.orphaned === 'adlib-part'

	return {
		id: unprotectString(part.partId ?? basePart._id),
		instanceId,
		createdByAdLib: createdByAdLib,
		externalId: basePart.externalId ?? '',
		name: basePart.title ?? '',
		rank: basePart._rank ?? 0,
		autoNext: !!basePart.autoNext,
		state,
		publicData: basePart.publicData,
		timing: {
			startMs: part.startsAt ?? 0,
			durationMs: part.renderedDuration ?? 0,
			plannedStartedPlayback: timings.plannedStartedPlayback ?? 0,
			reportedStartedPlayback: timings.reportedStartedPlayback ?? 0,
			playOffset: timings.playOffset ?? 0,
			setAsNext: timings.setAsNext ?? 0,
			take: timings.take ?? 0,
		},
		pieces: part.pieces?.map((piece) => toResolvedPieceStatus(piece)) ?? [],
	}
}
