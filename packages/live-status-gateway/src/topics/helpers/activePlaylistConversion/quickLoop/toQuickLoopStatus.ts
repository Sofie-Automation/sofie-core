import type { ActivePlaylistQuickLoop, QuickLoopMarker } from '@sofie-automation/live-status-gateway-api'
import { QuickLoopMarkerType } from '@sofie-automation/live-status-gateway-api'
import { QuickLoopMarkerType as CoreQuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type {
	QuickLoopMarker as CoreQuickLoopMarker,
	QuickLoopProps,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { Logger } from 'winston'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'

type ToQuickLoopStatusProps = {
	quickLoop: QuickLoopProps | undefined
	segmentsById: Record<string, { rundownId?: unknown } | undefined>
	partsById: Record<string, { rundownId?: unknown; segmentId?: unknown } | undefined>
	logger?: Logger
}

function toMarker(
	marker: CoreQuickLoopMarker | undefined,
	segmentsById: ToQuickLoopStatusProps['segmentsById'],
	partsById: ToQuickLoopStatusProps['partsById'],
	logger?: Logger
): QuickLoopMarker | undefined {
	if (!marker) return undefined

	switch (marker.type) {
		case CoreQuickLoopMarkerType.PLAYLIST:
			return { markerType: QuickLoopMarkerType.PLAYLIST }
		case CoreQuickLoopMarkerType.RUNDOWN:
			return { markerType: QuickLoopMarkerType.RUNDOWN, rundownId: unprotectString(marker.id) }
		case CoreQuickLoopMarkerType.SEGMENT: {
			const seg = segmentsById[unprotectString(marker.id)]
			return {
				markerType: QuickLoopMarkerType.SEGMENT,
				rundownId: seg?.rundownId ? unprotectString(seg.rundownId as any) : undefined,
				segmentId: unprotectString(marker.id),
			}
		}
		case CoreQuickLoopMarkerType.PART: {
			const part = partsById[unprotectString(marker.id)]
			return {
				markerType: QuickLoopMarkerType.PART,
				rundownId: part?.rundownId ? unprotectString(part.rundownId as any) : undefined,
				segmentId: part?.segmentId ? unprotectString(part.segmentId as any) : undefined,
				partId: unprotectString(marker.id),
			}
		}
		default:
			// If corelib adds a new marker type, just omit it rather than crashing conversion
			logger?.warn('Unknown QuickLoop markerType encountered; omitting marker', {
				markerType: String((marker as any).type),
			})
			return undefined
	}
}

export function toQuickLoopStatus({
	quickLoop,
	segmentsById,
	partsById,
	logger,
}: ToQuickLoopStatusProps): ActivePlaylistQuickLoop | null {
	if (!quickLoop) return null

	return {
		locked: quickLoop.locked,
		running: quickLoop.running,
		start: toMarker(quickLoop.start, segmentsById, partsById, logger),
		end: toMarker(quickLoop.end, segmentsById, partsById, logger),
	}
}
