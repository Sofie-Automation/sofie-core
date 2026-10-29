import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { PartId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { sortPartInstancesInSortedSegments } from '@sofie-automation/corelib/dist/playout/playlist'
import {
	wrapPartToTemporaryInstance,
	deduplicatePartInstancesForQuickLoop,
} from '@sofie-automation/corelib/dist/playout/stateCacheResolver'
import { findPartInstancesInQuickLoop, type MinimalPartInstance, type TimingId } from './index'

export interface PreparedTimingPartInstances {
	/** All Parts of the playlist as PartInstances (temporary ones for the unplayed), in playout order */
	partInstances: MinimalPartInstance[]
	/** Which Parts/PartInstances are within the QuickLoop */
	partsInQuickLoop: Record<TimingId, boolean>
}

/**
 * Prepare the PartInstances array (and QuickLoop lookup) that the RundownTimingCalculator operates
 * on, from the raw collection documents: overlay the active PartInstances over the Parts (wrapping
 * Parts without an instance as temporary instances), sort into playout order, and deduplicate for
 * a running QuickLoop.
 *
 * Used by the playlistTimingState publication. The web UI calculates no timing of its own.
 *
 * @param playlist The playlist
 * @param sortedSegments Segments of the playlist, in playout order (see `sortSegmentsInRundowns`)
 * @param unorderedParts All (non-orphaned) Parts of the playlist
 * @param activePartInstances The non-reset PartInstances of the playlist, sorted by takeCount
 */
export function prepareTimingPartInstances(
	playlist: DBRundownPlaylist,
	sortedSegments: Array<Pick<DBSegment, '_id'>>,
	unorderedParts: DBPart[],
	activePartInstances: MinimalPartInstance[]
): PreparedTimingPartInstances {
	const currentPartInstance = findPartInstanceById(activePartInstances, playlist.currentPartInfo?.partInstanceId)

	const allPartIds: Set<PartId> = new Set()
	for (const partInstance of activePartInstances) {
		allPartIds.add(partInstance.part._id)
	}

	let partInstances: MinimalPartInstance[] = [...activePartInstances]

	for (const part of unorderedParts) {
		if (allPartIds.has(part._id)) continue
		partInstances.push(wrapPartToTemporaryInstance(playlist.activationId ?? protectString(''), part))
	}

	partInstances = sortPartInstancesInSortedSegments(partInstances, sortedSegments)

	partInstances = deduplicatePartInstancesForQuickLoop(playlist, partInstances, currentPartInstance)

	const partsInQuickLoop = findPartInstancesInQuickLoop(playlist, partInstances)

	return { partInstances, partsInQuickLoop }
}

function findPartInstanceById(
	activePartInstances: MinimalPartInstance[],
	partInstanceId: PartInstanceId | undefined
): MinimalPartInstance | undefined {
	if (partInstanceId === undefined) return undefined
	// the activePartInstances are usually sorted ascending by takeCount, so it makes sense to start
	// at the end of the array, since that's where the latest PartInstances generally will be
	for (let i = activePartInstances.length - 1; i >= 0; i--) {
		const partInstance = activePartInstances[i]
		if (partInstance._id === partInstanceId) return partInstance
	}
	return undefined
}
