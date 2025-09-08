import { MarkerPosition, compareMarkerPositions } from '@sofie-automation/corelib/dist/playout/playlist'
import { PlayoutModelReadonly } from '../PlayoutModel.js'
import {
	QuickLoopMarker,
	QuickLoopMarkerType,
	QuickLoopProps,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ForceQuickLoopAutoNext } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PlayoutPartInstanceModel } from '../PlayoutPartInstanceModel.js'
import { JobContext } from '../../../jobs/index.js'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { DEFAULT_FALLBACK_PART_DURATION } from '@sofie-automation/shared-lib/dist/core/constants'
import { getCurrentTime } from '../../../lib/index.js'

export class QuickLoopService {
	constructor(
		private readonly context: JobContext,
		private readonly playoutModel: PlayoutModelReadonly
	) {}

	isPartWithinQuickLoop(partInstanceModel: PlayoutPartInstanceModel | null): boolean | null {
		const quickLoopProps = this.playoutModel.playlist.quickLoop
		if (quickLoopProps?.start == null || quickLoopProps?.end == null) return false

		const orderedParts = this.playoutModel.getAllOrderedParts()
		const rundownIds = this.playoutModel.getRundownIds()

		const startPosition = this.findQuickLoopMarkerPosition(quickLoopProps.start, 'start', orderedParts, rundownIds)
		const endPosition = this.findQuickLoopMarkerPosition(quickLoopProps.end, 'end', orderedParts, rundownIds)

		if (this.areMarkersFlipped(startPosition, endPosition)) return null

		const partPosition = this.findPartPosition(partInstanceModel, rundownIds)
		const isPartBetweenMarkers = partPosition
			? compareMarkerPositions(startPosition, partPosition) >= 0 &&
				compareMarkerPositions(partPosition, endPosition) >= 0
			: false

		return isPartBetweenMarkers
	}

	getOverridenValues(partInstanceModel: PlayoutPartInstanceModel): Partial<DBPart> {
		let { fallbackPartDuration } = this.context.studio.settings
		const quickLoopProps = this.playoutModel.playlist.quickLoop
		const isLoopingOverriden = quickLoopProps?.forceAutoNext !== ForceQuickLoopAutoNext.DISABLED

		fallbackPartDuration = fallbackPartDuration ?? DEFAULT_FALLBACK_PART_DURATION

		let { autoNext, expectedDuration, expectedDurationWithTransition } = partInstanceModel.partInstance.part

		if (isLoopingOverriden && (expectedDuration ?? 0) < fallbackPartDuration) {
			if (quickLoopProps?.forceAutoNext === ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION) {
				expectedDuration = fallbackPartDuration
				expectedDurationWithTransition = fallbackPartDuration
			}
		}

		const tooCloseToAutonext = () => {
			const start = partInstanceModel.partInstance.timings?.plannedStartedPlayback
			if (start !== undefined && partInstanceModel.partInstance.part.expectedDuration) {
				// date.now - start = playback duration, duration + offset gives position in part
				const playbackDuration = getCurrentTime() - start

				// If there is an auto next planned
				if (partInstanceModel.partInstance.part.expectedDuration - playbackDuration < 0) {
					return true
				}
			}

			return false
		}

		autoNext = autoNext || (isLoopingOverriden && (expectedDuration ?? 0) > 0 && !tooCloseToAutonext())
		return { autoNext, expectedDuration, expectedDurationWithTransition }
	}

	getUpdatedProps(hasJustSetMarker?: 'start' | 'end'): QuickLoopProps | undefined {
		if (this.playoutModel.playlist.quickLoop == null) return undefined
		const quickLoopProps = clone(this.playoutModel.playlist.quickLoop)
		const wasLoopRunning = quickLoopProps.running

		this.resetDynamicallyInsertedPartOverrideIfNoLongerNeeded(quickLoopProps)

		// remove the marker if it no longer exists inside the rundown
		if (quickLoopProps.start && !this.doesMarkerExist(quickLoopProps.start)) delete quickLoopProps.start
		if (quickLoopProps.end && !this.doesMarkerExist(quickLoopProps.end)) delete quickLoopProps.end

		if (quickLoopProps.start == null || quickLoopProps.end == null) {
			quickLoopProps.running = false
		} else {
			const isCurrentBetweenMarkers = this.isPartWithinQuickLoop(this.playoutModel.currentPartInstance)

			if (isCurrentBetweenMarkers === null) {
				if (hasJustSetMarker === 'start') {
					delete quickLoopProps.end
				} else if (hasJustSetMarker === 'end') {
					delete quickLoopProps.start
				}
			}

			quickLoopProps.running =
				quickLoopProps.start != null && quickLoopProps.end != null && !!isCurrentBetweenMarkers
		}

		if (wasLoopRunning && !quickLoopProps.running) {
			// clears the loop markers after leaving the loop, as per the requirements, but perhaps it should be optional
			return undefined
		}

		return quickLoopProps
	}

	getUpdatedPropsBySettingAMarker(type: 'start' | 'end', marker: QuickLoopMarker | null): QuickLoopProps | undefined {
		if (this.playoutModel.playlist.quickLoop?.locked) {
			throw new Error('Looping is locked')
		}
		const quickLoopProps = {
			running: false,
			locked: false,
			...clone(this.playoutModel.playlist.quickLoop),
			forceAutoNext: this.context.studio.settings.forceQuickLoopAutoNext ?? ForceQuickLoopAutoNext.DISABLED,
		}
		if (type === 'start') {
			if (marker == null) {
				delete quickLoopProps.start
			} else {
				quickLoopProps.start = marker
			}
		} else {
			if (marker == null) {
				delete quickLoopProps.end
			} else {
				quickLoopProps.end = marker
			}
		}

		return quickLoopProps
	}

	getUpdatedPropsByClearingMarkers(): QuickLoopProps | undefined {
		if (!this.playoutModel.playlist.quickLoop || this.playoutModel.playlist.quickLoop.locked) return undefined

		const quickLoopProps = clone(this.playoutModel.playlist.quickLoop)
		delete quickLoopProps.start
		delete quickLoopProps.end
		quickLoopProps.running = false

		return quickLoopProps
	}

	getSegmentsBetweenMarkers(startMarker: QuickLoopMarker, endMarker: QuickLoopMarker): SegmentId[] {
		// note - this function could be refactored to call getPartsBetweenMarkers instead but it will be less efficient
		const segments = this.playoutModel.getAllOrderedSegments()
		const segmentIds: SegmentId[] = []

		let passedStart = false
		let seenLastRundown = false

		for (const s of segments) {
			if (
				(!passedStart &&
					((startMarker.type === QuickLoopMarkerType.PART && s.getPart(startMarker.id)) ||
						(startMarker.type === QuickLoopMarkerType.SEGMENT && s.segment._id === startMarker.id) ||
						(startMarker.type === QuickLoopMarkerType.RUNDOWN &&
							s.segment.rundownId === startMarker.id))) ||
				startMarker.type === QuickLoopMarkerType.PLAYLIST
			) {
				// the start marker is inside this segment, is this segment, or this is the first segment that is in the loop
				// segments from here on are included in the loop
				passedStart = true
			}

			if (endMarker.type === QuickLoopMarkerType.RUNDOWN) {
				// last rundown needs to be inclusive so we need to break once the rundownId is not equal to segment's rundownId
				if (s.segment.rundownId === endMarker.id) {
					if (!passedStart) {
						// we hit the end before the start so quit now:
						break
					}
					seenLastRundown = true
				} else if (seenLastRundown) {
					// we have passed the last rundown
					break
				}
			}

			if (passedStart) {
				// passed the start but we have not seen the end yet
				segmentIds.push(s.segment._id)
			}

			if (
				(endMarker.type === QuickLoopMarkerType.PART && s.getPart(endMarker.id)) ||
				(endMarker.type === QuickLoopMarkerType.SEGMENT && s.segment._id === endMarker.id)
			) {
				// the endMarker is in this segment or this segment is the end marker
				break
			}
		}

		return segmentIds
	}

	getPartsBetweenMarkers(
		startMarker: QuickLoopMarker,
		endMarker: QuickLoopMarker
	): { parts: PartId[]; segments: SegmentId[] } {
		const parts = this.playoutModel.getAllOrderedParts()
		const segmentIds: SegmentId[] = []
		const partIds: PartId[] = []

		let passedStart = false
		let seenLastRundown = false
		let seenLastSegment = false

		for (const p of parts) {
			if (
				!passedStart &&
				((startMarker.type === QuickLoopMarkerType.PART && p._id === startMarker.id) ||
					(startMarker.type === QuickLoopMarkerType.SEGMENT && p.segmentId === startMarker.id) ||
					(startMarker.type === QuickLoopMarkerType.RUNDOWN && p.rundownId === startMarker.id) ||
					startMarker.type === QuickLoopMarkerType.PLAYLIST)
			) {
				// the start marker is this part, this is the first part in the loop, or this is the first segment that is in the loop
				// segments from here on are included in the loop
				passedStart = true
			}

			if (endMarker.type === QuickLoopMarkerType.RUNDOWN) {
				// last rundown needs to be inclusive so we need to break once the rundownId is not equal to segment's rundownId
				if (p.rundownId === endMarker.id) {
					if (!passedStart) {
						// we hit the end before the start so quit now:
						break
					}
					seenLastRundown = true
				} else if (seenLastRundown) {
					// we have passed the last rundown
					break
				}
			} else if (endMarker.type === QuickLoopMarkerType.SEGMENT) {
				// last segment needs to be inclusive so we need to break once the segmentId changes but not before
				if (p.segmentId === endMarker.id) {
					if (!passedStart) {
						// we hit the end before the start so quit now:
						break
					}
					seenLastSegment = true
				} else if (seenLastSegment) {
					// we have passed the last rundown
					break
				}
			}

			if (passedStart) {
				if (segmentIds.slice(-1)[0] !== p.segmentId) segmentIds.push(p.segmentId)
				partIds.push(p._id)
			}

			if (endMarker.type === QuickLoopMarkerType.PART && p._id === endMarker.id) {
				// the endMarker is this part so we can quit now
				break
			}
		}

		return { parts: partIds, segments: segmentIds }
	}

	private areMarkersFlipped(startPosition: MarkerPosition, endPosition: MarkerPosition) {
		return compareMarkerPositions(startPosition, endPosition) < 0
	}

	private resetDynamicallyInsertedPartOverrideIfNoLongerNeeded(quickLoopProps: QuickLoopProps) {
		const endMarker = quickLoopProps.end
		if (
			endMarker?.type === QuickLoopMarkerType.PART &&
			endMarker.overridenId &&
			endMarker.id !== this.playoutModel.currentPartInstance?.partInstance.part._id &&
			endMarker.id !== this.playoutModel.nextPartInstance?.partInstance.part._id
		) {
			endMarker.id = endMarker.overridenId
			delete endMarker.overridenId
		}
	}

	private findQuickLoopMarkerPosition(
		marker: QuickLoopMarker,
		type: 'start' | 'end',
		orderedParts: ReadonlyObjectDeep<DBPart>[],
		rundownIds: RundownId[]
	): MarkerPosition {
		let part: ReadonlyObjectDeep<DBPart> | undefined
		let segment: ReadonlyObjectDeep<DBSegment> | undefined
		let rundownRank
		if (marker.type === QuickLoopMarkerType.PART) {
			const partId = marker.id
			const partIndex = orderedParts.findIndex((part) => part._id === partId)
			part = orderedParts[partIndex]
		}
		if (marker.type === QuickLoopMarkerType.SEGMENT) {
			segment = this.playoutModel.findSegment(marker.id)?.segment
		} else if (part != null) {
			segment = this.playoutModel.findSegment(part.segmentId)?.segment
		}
		if (marker.type === QuickLoopMarkerType.RUNDOWN) {
			rundownRank = rundownIds.findIndex((id) => id === marker.id)
		} else if (part ?? segment != null) {
			rundownRank = rundownIds.findIndex((id) => id === (part ?? segment)?.rundownId)
		}
		const fallback = type === 'start' ? -Infinity : Infinity
		return {
			partRank: part?._rank ?? fallback,
			segmentRank: segment?._rank ?? fallback,
			rundownRank: rundownRank ?? fallback,
		}
	}

	/**
	 * Check whether the thing a marker references still exists within the playlist
	 * @param marker Marker to find
	 */
	private doesMarkerExist(marker: QuickLoopMarker) {
		let found = false

		if (marker.type === QuickLoopMarkerType.PART) {
			found = !!this.playoutModel.findPart(marker.id)
		} else if (marker.type === QuickLoopMarkerType.SEGMENT) {
			found = !!this.playoutModel.findSegment(marker.id)
		} else if (marker.type === QuickLoopMarkerType.RUNDOWN) {
			found = !!this.playoutModel.getRundown(marker.id)
		} else {
			// we can't lose the playlist so that marker is always valid
			found = true
		}

		return found
	}

	private findPartPosition(
		partInstance: PlayoutPartInstanceModel | null,
		rundownIds: RundownId[]
	): MarkerPosition | undefined {
		if (partInstance == null) return undefined
		const currentSegment = this.playoutModel.findSegment(partInstance.partInstance.segmentId)?.segment
		const currentRundownIndex = rundownIds.findIndex((id) => id === partInstance.partInstance.rundownId)

		return {
			partRank: partInstance.partInstance.part._rank,
			segmentRank: currentSegment?._rank ?? 0,
			rundownRank: currentRundownIndex ?? 0,
		}
	}
}
