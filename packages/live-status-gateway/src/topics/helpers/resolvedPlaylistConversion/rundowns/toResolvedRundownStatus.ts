import { ResolvedPlaylistConversionContext, getOrderedSegmentsInRundown } from '../context/conversionContext.js'
import { toResolvedSegmentStatus } from '../segments/toResolvedSegmentStatus.js'
import type { ResolvedRundown } from '@sofie-automation/live-status-gateway-api'

/** Converts a rundown id into a fully expanded `ResolvedRundown` payload. */
export function toResolvedRundownStatus(ctx: ResolvedPlaylistConversionContext, rundownId: string): ResolvedRundown {
	const rundownRank = ctx.orderedRundownIds.indexOf(rundownId)
	if (rundownRank === -1) {
		throw new Error(`Rundown "${rundownId}" is not in orderedRundownIds`)
	}

	const rundown = ctx.rundownsById.get(rundownId)
	const orderedSegments = getOrderedSegmentsInRundown(ctx, rundownId)
	const rank = rundownRank

	return {
		id: rundownId,
		externalId: rundown?.externalId ?? '',
		name: rundown?.name ?? '',
		rank,
		description: rundown?.description ?? '',
		publicData: rundown?.publicData,
		segments: rundown ? orderedSegments.map((segment) => toResolvedSegmentStatus(ctx, segment, rundown)) : [],
	}
}
