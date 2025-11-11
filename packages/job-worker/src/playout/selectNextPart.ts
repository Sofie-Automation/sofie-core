import { DBPart, isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { JobContext } from '../jobs/index.js'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBRundownPlaylist, QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ForceQuickLoopAutoNext } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { PlayoutSegmentModel } from './model/PlayoutSegmentModel.js'

/**
 * This wraps a Part which has been selected to be next, to include some additional data about that choice
 */
export interface SelectNextPartResult {
	/**
	 * The Part selected to be nexted
	 */
	part: ReadonlyDeep<DBPart>

	/**
	 * The index of the Part in the provided list of all sorted Parts
	 */
	index: number

	/**
	 * Whether this Part consumes the `queuedSegmentId` property on the rundown.
	 * If true, when this PartInstance is taken, the `queuedSegmentId` property on the Playlist will be cleared
	 */
	consumesQueuedSegmentId: boolean
}

/**
 * Select the Part in the Playlist which should be set as next
 */

export function selectNextPart(
	context: JobContext,
	rundownPlaylist: Pick<DBRundownPlaylist, 'queuedSegmentId' | 'quickLoop'>,
	previousPartInstance: ReadonlyDeep<DBPartInstance> | null,
	currentlySelectedPartInstance: ReadonlyDeep<DBPartInstance> | null,
	segments: readonly PlayoutSegmentModel[],
	parts0: ReadonlyDeep<DBPart>[],
	options: { ignoreUnplayable: boolean; ignoreQuickLoop: boolean }
): SelectNextPartResult | null {
	const span = context.startSpan('selectNextPart')

	// In the parts array, insert currentlySelectedPartInstance over its part, as it is already nexted, so wont change unless necessary
	const parts = currentlySelectedPartInstance
		? parts0.map((p) => (p._id === currentlySelectedPartInstance.part._id ? currentlySelectedPartInstance.part : p))
		: parts0

	/**
	 * Iterates over all the parts and searches for the first one to be playable
	 * @param offset the index from where to start the search
	 * @param condition whether the part will be returned
	 * @param length the maximum index or where to stop the search
	 */
	const findFirstPlayablePart = (
		offset: number,
		condition?: (part: ReadonlyDeep<DBPart>) => boolean,
		length?: number
	): SelectNextPartResult | undefined => {
		// Filter to after and find the first playabale
		for (let index = offset; index < (length || parts.length); index++) {
			const part = parts[index]
			if (options.ignoreUnplayable && !isPartPlayable(part)) {
				continue
			}
			if (
				!options.ignoreQuickLoop &&
				rundownPlaylist.quickLoop?.running &&
				context.studio.settings.forceQuickLoopAutoNext === ForceQuickLoopAutoNext.ENABLED_WHEN_VALID_DURATION &&
				!isPartPlayableInQuickLoop(part)
			) {
				continue
			}
			if (condition && !condition(part)) {
				continue
			}
			return { part, index, consumesQueuedSegmentId: false }
		}
		return undefined
	}

	const findQuickLoopStartPart = (length: number): SelectNextPartResult | undefined => {
		if (rundownPlaylist.quickLoop?.start?.type === QuickLoopMarkerType.PART) {
			const startPartId = rundownPlaylist.quickLoop.start.id
			return findFirstPlayablePart(0, (part) => part._id === startPartId, length)
		}
		if (rundownPlaylist.quickLoop?.start?.type === QuickLoopMarkerType.SEGMENT) {
			const startSegmentId = rundownPlaylist.quickLoop.start.id
			return findFirstPlayablePart(0, (part) => part.segmentId === startSegmentId, length)
		}
		if (rundownPlaylist.quickLoop?.start?.type === QuickLoopMarkerType.PLAYLIST) {
			return findFirstPlayablePart(0, undefined, length)
		}
		return undefined
	}

	if (!options.ignoreQuickLoop && rundownPlaylist.quickLoop?.running && previousPartInstance) {
		const currentIndex = parts.findIndex((p) => p._id === previousPartInstance.part._id)
		if (
			rundownPlaylist.quickLoop?.end?.type === QuickLoopMarkerType.PART &&
			(previousPartInstance.part._id === rundownPlaylist.quickLoop.end.id ||
				previousPartInstance.part._id === rundownPlaylist.quickLoop.end.overridenId)
		) {
			return findQuickLoopStartPart(currentIndex + 1) ?? null
		} else if (
			rundownPlaylist.quickLoop?.end?.type === QuickLoopMarkerType.SEGMENT &&
			previousPartInstance.part.segmentId === rundownPlaylist.quickLoop.end.id
		) {
			const nextPlayablePart = findFirstPlayablePart(
				currentIndex + 1,
				(part) => part.segmentId === previousPartInstance.part.segmentId
			)
			if (!nextPlayablePart) {
				return findQuickLoopStartPart(currentIndex + 1) ?? null
			}
		}
	}

	let searchFromIndex = 0
	if (previousPartInstance) {
		const currentIndex = parts.findIndex((p) => p._id === previousPartInstance.part._id)
		if (currentIndex !== -1) {
			// Start looking at the next part
			searchFromIndex = currentIndex + 1
		} else {
			const segmentStarts = new Map<SegmentId, number>()
			parts.forEach((p, i) => {
				if (!segmentStarts.has(p.segmentId)) {
					segmentStarts.set(p.segmentId, i)
				}
			})

			// Look for other parts in the segment to reference
			const segmentStartIndex = segmentStarts.get(previousPartInstance.segmentId)
			if (segmentStartIndex !== undefined) {
				let nextInSegmentIndex: number | undefined
				for (let i = segmentStartIndex; i < parts.length; i++) {
					const part = parts[i]
					if (part.segmentId !== previousPartInstance.segmentId) break
					if (part._rank <= previousPartInstance.part._rank) {
						nextInSegmentIndex = i + 1
					}
				}

				searchFromIndex = nextInSegmentIndex ?? segmentStartIndex
			} else {
				// If we didn't find the segment in the list of parts, then look for segments after this one.
				const segmentIndex = segments.findIndex((s) => s.segment._id === previousPartInstance.segmentId)
				let followingSegmentStart: number | undefined
				if (segmentIndex !== -1) {
					// Find the first segment with parts that lies after this
					for (let i = segmentIndex + 1; i < segments.length; i++) {
						const segmentStart = segmentStarts.get(segments[i].segment._id)
						if (segmentStart !== undefined) {
							followingSegmentStart = segmentStart
							break
						}
					}

					// Either there is a segment after, or we are at the end of the rundown
					searchFromIndex = followingSegmentStart ?? parts.length + 1
				} else {
					// Somehow we cannot place the segment, so the start of the playlist is better than nothing
				}
			}
		}
	}

	// Filter to after and find the first playabale
	let nextPart = findFirstPlayablePart(searchFromIndex)

	if (rundownPlaylist.queuedSegmentId) {
		// No previous part, or segment has changed
		if (!previousPartInstance || !nextPart || previousPartInstance.segmentId !== nextPart.part.segmentId) {
			// Find first in segment
			const newSegmentPart = findFirstPlayablePart(
				0,
				(part) => part.segmentId === rundownPlaylist.queuedSegmentId
			)
			if (newSegmentPart) {
				// If matched matched, otherwise leave on auto
				nextPart = {
					...newSegmentPart,
					consumesQueuedSegmentId: true,
				}
			}
		}
	}

	if (
		!options.ignoreQuickLoop &&
		rundownPlaylist.quickLoop?.end?.type === QuickLoopMarkerType.PLAYLIST &&
		!nextPart &&
		previousPartInstance
	) {
		nextPart = findQuickLoopStartPart(searchFromIndex - 1)
	}

	if (span) span.end()
	return nextPart ?? null
}

function isPartPlayableInQuickLoop(part: ReadonlyDeep<DBPart>): boolean {
	return (part.expectedDuration ?? 0) > 0
}
