import { ResolvedPlaylistConversionContext, getOrderedSegmentsInRundown } from '../context/conversionContext.js'
import { toResolvedSegmentStatus } from '../segments/toResolvedSegmentStatus.js'
import type { ResolvedRundown } from '@sofie-automation/live-status-gateway-api'

/** Converts a rundown id into a fully expanded `ResolvedRundown` payload. */
export function toResolvedRundownStatus(ctx: ResolvedPlaylistConversionContext, rundownId: string): ResolvedRundown {
	const rundown = ctx.rundownsById.get(String(rundownId))
	const orderedSegments = getOrderedSegmentsInRundown(ctx, rundownId)
	const rank = Math.max(0, ctx.orderedRundownIds.indexOf(String(rundownId)))

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
