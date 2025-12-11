import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import {
	DBRundownPlaylist,
	QuickLoopMarker,
	QuickLoopMarkerType,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ForceQuickLoopAutoNext } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import { MarkerPosition, compareMarkerPositions } from '@sofie-automation/corelib/dist/playout/playlist'
import { ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { DEFAULT_FALLBACK_PART_DURATION } from '@sofie-automation/shared-lib/dist/core/constants'
import { getCurrentTime } from '../../lib/lib'
import { generateTranslation } from '@sofie-automation/corelib/dist/lib'
import { IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { ReactiveCacheCollection } from './ReactiveCacheCollection'

export function findPartPosition(
	part: DBPart,
	segmentRanks: Record<string, number>,
	rundownRanks: Record<string, number>
): MarkerPosition {
	return {
		rundownRank: rundownRanks[part.rundownId as unknown as string] ?? 0,
		segmentRank: segmentRanks[part.segmentId as unknown as string] ?? 0,
		partRank: part._rank,
	}
}

export function stringsToIndexLookup(strings: string[]): Record<string, number> {
	return strings.reduce(
		(result, str, index) => {
			result[str] = index
			return result
		},
		{} as Record<string, number>
	)
}

export function extractRanks(docs: { _id: ProtectedString<any>; _rank: number }[]): Record<string, number> {
	return docs.reduce(
		(result, doc) => {
			result[doc._id as unknown as string] = doc._rank
			return result
		},
		{} as Record<string, number>
	)
}

export function modifyPartForQuickLoop(
	part: DBPart,
	segmentRanks: Record<string, number>,
	rundownRanks: Record<string, number>,
	playlist: Pick<DBRundownPlaylist, 'quickLoop'>,
	studioSettings: IStudioSettings,
	quickLoopStartPosition: MarkerPosition | undefined,
	quickLoopEndPosition: MarkerPosition | undefined,
	canSetAutoNext = () => true
): void {
	const partPosition = findPartPosition(part, segmentRanks, rundownRanks)
	const isLoopDefined = quickLoopStartPosition && quickLoopEndPosition
	const isLoopingOverriden =
		isLoopDefined &&
		playlist.quickLoop?.forceAutoNext !== ForceQuickLoopAutoNext.DISABLED &&
		compareMarkerPositions(quickLoopStartPosition, partPosition) >= 0 &&
		compareMarkerPositions(partPosition, quickLoopEndPosition) >= 0

	const fallbackPartDuration = studioSettings.fallbackPartDuration ?? DEFAULT_FALLBACK_PART_DURATION

	if (isLoopingOverriden && (part.expectedDuration ?? 0) < fallbackPartDuration) {
		if (playlist.quickLoop?.forceAutoNext === ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION) {
			part.expectedDuration = fallbackPartDuration
			part.expectedDurationWithTransition = fallbackPartDuration
		} else if (playlist.quickLoop?.forceAutoNext === ForceQuickLoopAutoNext.ENABLED_WHEN_VALID_DURATION) {
			part.invalid = true
			part.invalidReason = {
				message: generateTranslation('Part duration is 0.'),
			}
		}
	}
	if (!canSetAutoNext()) return
	part.autoNext = part.autoNext || (isLoopingOverriden && (part.expectedDuration ?? 0) > 0)
}

export function modifyPartInstanceForQuickLoop(
	partInstance: Omit<DBPartInstance, 'part.privateData'>,
	segmentRanks: Record<string, number>,
	rundownRanks: Record<string, number>,
	playlist: Pick<DBRundownPlaylist, 'quickLoop'>,
	studioSettings: IStudioSettings,
	quickLoopStartPosition: MarkerPosition | undefined,
	quickLoopEndPosition: MarkerPosition | undefined
): void {
	// note that the logic for when a part does not do autonext in quickloop should reflect the logic in the QuickLoopService in job worker
	const canAutoNext = () => {
		const start = partInstance.timings?.plannedStartedPlayback
		if (start !== undefined && partInstance.part.expectedDuration) {
			// date.now - start = playback duration, duration + offset gives position in part
			const playbackDuration = getCurrentTime() - start

			// If there is an auto next planned soon or was in the past
			if (partInstance.part.expectedDuration - playbackDuration < 0) {
				return false
			}
		}

		return true
	}

	modifyPartForQuickLoop(
		partInstance.part,
		segmentRanks,
		rundownRanks,
		playlist,
		studioSettings,
		quickLoopStartPosition,
		quickLoopEndPosition,
		canAutoNext // do not adjust the part instance if we have passed the time where we can still enable auto next
	)
}

export function findMarkerPosition(
	marker: QuickLoopMarker,
	fallback: number,
	contentCache: {
		segments: ReadonlyObjectDeep<ReactiveCacheCollection<Pick<DBSegment, '_id' | '_rank' | 'rundownId'>>>
		parts: ReadonlyObjectDeep<ReactiveCacheCollection<Pick<DBPart, '_id' | '_rank' | 'segmentId'>>>
		partInstances?: ReadonlyObjectDeep<ReactiveCacheCollection<DBPartInstance>>
	},
	rundownRanks: Record<string, number>
): MarkerPosition {
	const part =
		marker.type === QuickLoopMarkerType.PART
			? (contentCache.partInstances?.findOne({ 'part._id': marker.id })?.part ??
				contentCache.parts?.findOne(marker.id))
			: undefined
	const partRank = part?._rank ?? fallback

	const segmentId = marker.type === QuickLoopMarkerType.SEGMENT ? marker.id : part?.segmentId
	const segment = segmentId && contentCache.segments.findOne(segmentId)
	const segmentRank = segment?._rank ?? fallback

	const rundownId = marker.type === QuickLoopMarkerType.RUNDOWN ? marker.id : segment?.rundownId
	let rundownRank = rundownId ? rundownRanks[unprotectString(rundownId)] : fallback

	if (marker.type === QuickLoopMarkerType.PLAYLIST) rundownRank = fallback

	return {
		rundownRank: rundownRank,
		segmentRank: segmentRank,
		partRank: partRank,
	}
}
