/**
 * A GENERAL COMMENT ON THIS MODULE
 * ==
 *
 * During the lifecycle of a Rundown, it, along with all of it's Parts & PartInstances undergoes thousands of mutations
 * on it's timing properties. Because of that, it's very difficult to accurately simulate what's going on in one for the
 * purposes of automated testing. It also means that debugging any bugs here is very time consuming and difficult.
 *
 * Please be very cautious when introducing changes here and make sure to try and exhaustively explain any changes made
 * here by answering both How and Why of a particular change, since it may not be clearly evident to the next person,
 * without knowing what particular case you are trying to solve.
 */

import { PartId, PartInstanceId, SegmentId, SegmentPlayoutId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { PlaylistTiming } from '@sofie-automation/corelib/dist/playout/rundownTiming'
import { calculatePartInstanceExpectedDurationWithTransition } from '@sofie-automation/corelib/dist/playout/timings'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBRundownPlaylist, QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { objectFromEntries } from '@sofie-automation/shared-lib/dist/lib/lib'
import { getCurrentTime } from './systemTime.js'
import { Settings } from '../lib/Settings.js'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { CountdownType } from '@sofie-automation/blueprints-integration'
import { isLoopDefined, isEntirePlaylistLooping, isLoopRunning } from '../lib/RundownResolver.js'

// Minimum duration that a part can be assigned. Used by gap parts to allow them to "compress" to indicate time running out.
const MINIMAL_NONZERO_DURATION = 1

interface BreakProps {
	rundownsBeforeNextBreak: Rundown[]
	breakIsLastRundown: boolean
}

type CalculateTimingsPartInstance = Pick<
	PartInstance,
	'_id' | 'isTemporary' | 'segmentId' | 'segmentPlayoutId' | 'orphaned' | 'timings' | 'part'
>

export type TimingId = string

/**
 * This is a class for calculating timings in a Rundown playlist used by RundownTimingProvider.
 *
 * @export
 * @class RundownTimingCalculator
 */
export class RundownTimingCalculator {
	private linearParts: Array<[PartId, number | null]> = []

	// we need to keep the nextSegmentId here for the brief moment when the next partinstance can't be found
	private nextSegmentId: SegmentId | undefined = undefined

	// look at the comments on RundownTimingContext to understand what these do
	// Note, that these objects are created when an instance is created and are reused for the lifetime
	// of the component. This is to avoid GC running all the time on discarded objects.
	// Only the RundownTimingContext object is unique for a call to `updateDurations`.
	private partDurations: Record<TimingId, number> = {}
	private partExpectedDurations: Record<TimingId, number> = {}
	private partPlayed: Record<TimingId, number> = {}
	private partStartsAt: Record<TimingId, number> = {}
	private partDisplayStartsAt: Record<TimingId, number> = {}
	private partDisplayDurations: Record<TimingId, number> = {}
	private partDisplayDurationsNoPlayback: Record<TimingId, number> = {}
	private displayDurationGroups: Record<string, number> = {}
	private segmentAsPlayedDurations: Record<string, number> = {}
	private breakProps: {
		props: BreakProps | undefined
		state: string | undefined
	} = { props: undefined, state: undefined }
	/**
	 * Segment is untimed if all of it's Parts are set to `untimed`
	 */
	private untimedSegments: Set<SegmentId> = new Set()

	/**
	 * Returns a RundownTimingContext for a given point in time.
	 *
	 * @param {number} now
	 * @param {boolean} isLowResolution
	 * @param {(DBRundownPlaylist | undefined)} playlist
	 * @param {Rundown[]} rundowns
	 * @param {(Rundown | undefined)} currentRundown
	 * @param {CalculateTimingsPartInstance[]} partInstances
	 * @param {Map<PartId, CalculateTimingsPartInstance>} partInstancesMap
	 * @param {number} [defaultDuration]
	 * @return {*}  {RundownTimingContext}
	 * @memberof RundownTimingCalculator
	 */
	updateDurations(
		now: number,
		isLowResolution: boolean,
		playlist: DBRundownPlaylist | undefined,
		rundowns: Rundown[],
		currentRundown: Rundown | undefined,
		partInstances: CalculateTimingsPartInstance[],
		partInstancesMap: Map<PartId, CalculateTimingsPartInstance>,
		segmentsMap: Map<SegmentId, DBSegment>,
		/** Fallback duration for Parts that have no as-played duration of their own. */
		defaultDuration: number = Settings.defaultDisplayDuration,
		partsInQuickLoop: Record<TimingId, boolean>
	): RundownTimingContext {
		let totalRundownDuration = 0
		let remainingRundownDuration = 0
		let asPlayedRundownDuration = 0
		let asDisplayedRundownDuration = 0
		// the "wait" for a part is defined as its asPlayedDuration or its displayDuration or its expectedDuration
		const waitPerPart: Record<string, number> = {}
		let waitAccumulator = 0
		let currentRemaining = 0
		let startsAtAccumulator = 0
		let displayStartsAtAccumulator = 0
		let segmentDisplayDuration = 0
		let segmentBudgetDurationLeft = 0
		let remainingBudgetOnCurrentSegment: undefined | number

		const rundownExpectedDurations: Record<string, number> = {}
		const rundownAsPlayedDurations: Record<string, number> = {}

		let rundownsBeforeNextBreak: Rundown[] | undefined
		let breakIsLastRundown: boolean | undefined
		let liveSegmentIds: { segmentId: SegmentId; segmentPlayoutId: SegmentPlayoutId } | undefined

		Object.keys(this.displayDurationGroups).forEach((key) => delete this.displayDurationGroups[key])
		Object.keys(this.segmentAsPlayedDurations).forEach((key) => delete this.segmentAsPlayedDurations[key])
		this.untimedSegments.clear()
		this.linearParts.length = 0

		let nextAIndex = -1
		let currentAIndex = -1

		let lastSegmentIds: { segmentId: SegmentId; segmentPlayoutId: SegmentPlayoutId } | undefined = undefined
		let nextRundownAnchor: number | undefined = undefined

		if (playlist) {
			const breakProps = currentRundown ? this.getRundownsBeforeNextBreak(rundowns, currentRundown) : undefined

			if (breakProps) {
				rundownsBeforeNextBreak = breakProps.rundownsBeforeNextBreak
				breakIsLastRundown = breakProps.breakIsLastRundown
			}

			if (!playlist.nextPartInfo) {
				this.nextSegmentId = undefined
			}

			partInstances.forEach((partInstance, itIndex) => {
				const partId = partInstance.part._id
				const partInstanceId = !partInstance.isTemporary ? partInstance._id : null
				const partInstanceOrPartId = unprotectString(partInstanceId ?? partId)
				const partsSegment = segmentsMap.get(partInstance.segmentId)
				const segmentBudget = partsSegment?.segmentTiming?.budgetDuration
				const segmentUsesBudget = segmentBudget !== undefined
				// note: lastStartedPlayback that lies in the future means it hasn't started yet (like from autonext)
				const lastStartedPlayback =
					(partInstance.timings?.plannedStartedPlayback ?? 0) <= now
						? partInstance.timings?.plannedStartedPlayback
						: undefined

				if (!lastSegmentIds || partInstance.segmentId !== lastSegmentIds.segmentId) {
					this.untimedSegments.add(partInstance.segmentId)
					if (liveSegmentIds && lastSegmentIds && lastSegmentIds.segmentId === liveSegmentIds.segmentId) {
						const liveSegment = segmentsMap.get(liveSegmentIds.segmentId)

						if (liveSegment?.segmentTiming?.countdownType === CountdownType.SEGMENT_BUDGET_DURATION) {
							remainingBudgetOnCurrentSegment =
								(playlist.segmentsStartedPlayback?.[unprotectString(liveSegmentIds.segmentPlayoutId)] ??
									lastStartedPlayback ??
									now) +
								(liveSegment.segmentTiming.budgetDuration ?? 0) -
								now
						}
					}
					segmentDisplayDuration = 0
					if (segmentBudgetDurationLeft > 0) {
						waitAccumulator += segmentBudgetDurationLeft
					}
					segmentBudgetDurationLeft = segmentBudget ?? 0
					lastSegmentIds = {
						segmentId: partInstance.segmentId,
						segmentPlayoutId: partInstance.segmentPlayoutId,
					}
				}

				// add piece to accumulator
				const aIndex = this.linearParts.push([partId, waitAccumulator]) - 1

				// if this is next Part, clear previous countdowns and clear accumulator
				if (playlist.nextPartInfo?.partInstanceId === partInstance._id) {
					nextAIndex = aIndex
					this.nextSegmentId = partInstance.segmentId
				} else if (playlist.currentPartInfo?.partInstanceId === partInstance._id) {
					currentAIndex = aIndex
					liveSegmentIds = {
						segmentId: partInstance.segmentId,
						segmentPlayoutId: partInstance.segmentPlayoutId,
					}
				}

				const partCounts =
					playlist.outOfOrderTiming ||
					!playlist.activationId ||
					(itIndex >= currentAIndex && currentAIndex >= 0) ||
					(itIndex >= nextAIndex && nextAIndex >= 0 && currentAIndex === -1)

				const partIsUntimed = partInstance.part.untimed || false

				if (!partIsUntimed) {
					this.untimedSegments.delete(partInstance.segmentId)
				}

				// expected is just a sum of expectedDurations if not using budgetDuration
				// if the Part is using budgetDuration, this budget is calculated when going through all the segments
				// in the Rundown (see further down)
				if (!segmentUsesBudget && !partIsUntimed) {
					totalRundownDuration += calculatePartInstanceExpectedDurationWithTransition(partInstance) || 0
				}

				const playOffset = partInstance.timings?.playOffset || 0

				let partDuration = 0
				let partExpectedDuration = 0
				let partDisplayDuration = 0
				let partDisplayDurationNoPlayback = 0

				let displayDurationFromGroup = 0

				partExpectedDuration =
					calculatePartInstanceExpectedDurationWithTransition(partInstance) ||
					partInstance.timings?.duration ||
					0

				// Display Duration groups are groups of two or more Parts, where some of them have an
				// expectedDuration and some have 0.
				// Then, some of them will have a displayDuration. The expectedDurations are pooled together, the parts with
				// display durations will take up that much time in the Rundown. The left-over time from the display duration group
				// will be used by Parts without expectedDurations.
				let memberOfDisplayDurationGroup = false
				// using a separate displayDurationGroup processing flag simplifies implementation
				if (
					partInstance.part.displayDurationGroup &&
					// either this is not the first element of the displayDurationGroup
					(this.displayDurationGroups[partInstance.part.displayDurationGroup] !== undefined ||
						// or there is a following member of this displayDurationGroup
						(partInstances[itIndex + 1] &&
							partInstances[itIndex + 1].part.displayDurationGroup ===
								partInstance.part.displayDurationGroup)) &&
					!partInstance.part.floated &&
					!partIsUntimed
				) {
					this.displayDurationGroups[partInstance.part.displayDurationGroup] =
						(this.displayDurationGroups[partInstance.part.displayDurationGroup] || 0) +
						(calculatePartInstanceExpectedDurationWithTransition(partInstance) || 0)
					displayDurationFromGroup =
						partInstance.part.displayDuration ||
						Math.max(
							0,
							this.displayDurationGroups[partInstance.part.displayDurationGroup],
							partInstance.part.gap ? MINIMAL_NONZERO_DURATION : defaultDuration
						)
					partExpectedDuration =
						partExpectedDuration || this.displayDurationGroups[partInstance.part.displayDurationGroup] || 0
					memberOfDisplayDurationGroup = true
				}

				// This is where we actually calculate all the various variants of duration of a part
				if (lastStartedPlayback && !partInstance.timings?.duration) {
					// if duration isn't available, check if `plannedStoppedPlayback` has already been set and use the difference
					// between startedPlayback and plannedStoppedPlayback as the duration
					const duration =
						partInstance.timings?.duration ||
						(partInstance.timings?.plannedStoppedPlayback
							? lastStartedPlayback - partInstance.timings?.plannedStoppedPlayback
							: undefined)
					partDuration =
						Math.max(
							duration || calculatePartInstanceExpectedDurationWithTransition(partInstance) || 0,
							now - lastStartedPlayback
						) - playOffset
					// because displayDurationGroups have no actual timing on them, we need to have a copy of the
					// partDisplayDuration, but calculated as if it's not playing, so that the countdown can be
					// calculated
					partDisplayDurationNoPlayback =
						duration ||
						(memberOfDisplayDurationGroup
							? displayDurationFromGroup
							: calculatePartInstanceExpectedDurationWithTransition(partInstance)) ||
						defaultDuration
					partDisplayDuration = Math.max(partDisplayDurationNoPlayback, now - lastStartedPlayback)
					this.partPlayed[partInstanceOrPartId] = now - lastStartedPlayback
					const segmentStartedPlayback =
						playlist.segmentsStartedPlayback?.[unprotectString(partInstance.segmentPlayoutId)] ??
						lastStartedPlayback

					// NOTE: displayDurationGroups are ignored here, when using budgetDuration
					if (segmentUsesBudget) {
						currentRemaining = Math.max(
							0,
							segmentBudget - segmentDisplayDuration - (now - segmentStartedPlayback)
						)
						segmentBudgetDurationLeft = 0
					} else {
						currentRemaining = Math.max(
							0,
							(duration ||
								(memberOfDisplayDurationGroup
									? displayDurationFromGroup
									: calculatePartInstanceExpectedDurationWithTransition(partInstance)) ||
								0) -
								(now - lastStartedPlayback)
						)
					}
				} else {
					partDuration =
						(partInstance.timings?.duration ||
							calculatePartInstanceExpectedDurationWithTransition(partInstance) ||
							0) - playOffset
					partDisplayDurationNoPlayback = Math.max(
						0,
						(partInstance.timings?.duration && partInstance.timings?.duration + playOffset) ||
							displayDurationFromGroup ||
							ensureMinimumDefaultDurationIfNotAuto(
								partInstance,
								calculatePartInstanceExpectedDurationWithTransition(partInstance),
								defaultDuration
							)
					)
					partDisplayDuration = partDisplayDurationNoPlayback
					this.partPlayed[partInstanceOrPartId] = (partInstance.timings?.duration || 0) - playOffset
				}

				// asPlayed is the actual duration so far and expected durations in unplayed lines.
				// If item is onAir right now, it's duration is counted as expected duration or current
				// playback duration whichever is larger.
				// Parts that are Untimed are ignored always.
				// Parts that don't count are ignored, unless they are being played or have been played.
				if (!partIsUntimed) {
					if (!segmentUsesBudget) {
						let valToAddToAsPlayedDuration = 0

						if (lastStartedPlayback && !partInstance.timings?.duration) {
							valToAddToAsPlayedDuration = Math.max(partExpectedDuration, now - lastStartedPlayback)
						} else if (partInstance.timings?.duration) {
							valToAddToAsPlayedDuration = partInstance.timings.duration
						} else if (partCounts) {
							valToAddToAsPlayedDuration =
								calculatePartInstanceExpectedDurationWithTransition(partInstance) || 0
						}

						asPlayedRundownDuration += valToAddToAsPlayedDuration
						if (!rundownAsPlayedDurations[unprotectString(partInstance.part.rundownId)]) {
							rundownAsPlayedDurations[unprotectString(partInstance.part.rundownId)] =
								valToAddToAsPlayedDuration
						} else {
							rundownAsPlayedDurations[unprotectString(partInstance.part.rundownId)] +=
								valToAddToAsPlayedDuration
						}
					} else {
						let valToAddToAsPlayedDuration = 0
						if (partInstance.timings?.duration) {
							valToAddToAsPlayedDuration = partInstance.timings?.duration
						} else if (lastStartedPlayback && !partInstance.timings?.duration) {
							valToAddToAsPlayedDuration =
								Math.min(
									partInstance.timings?.reportedStoppedPlayback || Number.POSITIVE_INFINITY,
									now
								) - lastStartedPlayback
						}
						this.segmentAsPlayedDurations[unprotectString(partInstance.segmentId)] =
							(this.segmentAsPlayedDurations[unprotectString(partInstance.segmentId)] || 0) +
							valToAddToAsPlayedDuration
					}
				}

				// asDisplayed is the actual duration so far and expected durations in unplayed lines
				// If item is onAir right now, it's duration is counted as expected duration or current
				// playback duration whichever is larger.
				// All parts are counted.
				if (lastStartedPlayback && !partInstance.timings?.duration) {
					asDisplayedRundownDuration += Math.max(
						memberOfDisplayDurationGroup
							? Math.max(
									partExpectedDuration,
									calculatePartInstanceExpectedDurationWithTransition(partInstance) || 0
								)
							: calculatePartInstanceExpectedDurationWithTransition(partInstance) || 0,
						now - lastStartedPlayback
					)
				} else {
					asDisplayedRundownDuration +=
						partInstance.timings?.duration ||
						calculatePartInstanceExpectedDurationWithTransition(partInstance) ||
						0
				}

				// the part is the current part but has not yet started playback
				if (playlist.currentPartInfo?.partInstanceId === partInstance._id && !lastStartedPlayback) {
					currentRemaining = partDisplayDuration
				}

				// Handle invalid parts by overriding the values to preset values for Invalid parts
				if (partInstance.part.invalid && !partInstance.part.gap) {
					partDisplayDuration = defaultDuration
					this.partPlayed[partInstanceOrPartId] = 0
				}

				if (
					memberOfDisplayDurationGroup &&
					partInstance.part.displayDurationGroup &&
					!partInstance.part.floated &&
					!partInstance.part.invalid &&
					!partIsUntimed &&
					(partInstance.timings?.duration || partInstance.timings?.plannedStoppedPlayback || partCounts)
				) {
					this.displayDurationGroups[partInstance.part.displayDurationGroup] =
						this.displayDurationGroups[partInstance.part.displayDurationGroup] - partDisplayDuration
				}

				this.partExpectedDurations[partInstanceOrPartId] = partExpectedDuration
				this.partStartsAt[partInstanceOrPartId] = startsAtAccumulator
				this.partDisplayStartsAt[partInstanceOrPartId] = displayStartsAtAccumulator
				this.partDurations[partInstanceOrPartId] = partDuration
				this.partDisplayDurations[partInstanceOrPartId] = partDisplayDuration
				this.partDisplayDurationsNoPlayback[partInstanceOrPartId] = partDisplayDurationNoPlayback
				startsAtAccumulator += this.partDurations[partInstanceOrPartId]
				displayStartsAtAccumulator += this.partDisplayDurations[partInstanceOrPartId]

				// waitAccumulator is used to calculate the countdowns for Parts relative to the current Part
				// always add the full duration, in case by some manual intervention this segment should play twice
				let waitDuration = 0
				if (memberOfDisplayDurationGroup) {
					waitDuration =
						partInstance.timings?.duration ||
						partDisplayDuration ||
						calculatePartInstanceExpectedDurationWithTransition(partInstance) ||
						0
				} else {
					waitDuration =
						partInstance.timings?.duration ||
						calculatePartInstanceExpectedDurationWithTransition(partInstance) ||
						0
				}
				if (segmentUsesBudget) {
					const wait = Math.min(waitDuration, Math.max(segmentBudgetDurationLeft, 0))
					waitAccumulator += wait
					segmentBudgetDurationLeft -= waitDuration
					waitPerPart[unprotectString(partId)] = wait + Math.max(0, segmentBudgetDurationLeft)
				} else {
					waitAccumulator += waitDuration
					waitPerPart[unprotectString(partId)] = waitDuration
				}

				// remaining is the sum of unplayed lines + whatever is left of the current segment
				// if outOfOrderTiming is true, count parts before current part towards remaining rundown duration
				// if false (default), past unplayed parts will not count towards remaining time
				// If SegmentUsesBudget, these values are set when iterating over all Segments, see below.
				if (!segmentUsesBudget) {
					if (
						typeof lastStartedPlayback !== 'number' &&
						!partInstance.part.floated &&
						partCounts &&
						!partIsUntimed
					) {
						// this needs to use partInstance.part.expectedDuration as opposed to partExpectedDuration, because
						// partExpectedDuration is affected by displayGroups, and if it hasn't played yet then it shouldn't
						// add any duration to the "remaining" time pool
						remainingRundownDuration +=
							calculatePartInstanceExpectedDurationWithTransition(partInstance) || 0
						// item is onAir right now, and it's is currently shorter than expectedDuration
					} else if (
						lastStartedPlayback &&
						!partInstance.timings?.duration &&
						playlist.currentPartInfo?.partInstanceId === partInstance._id &&
						lastStartedPlayback + partExpectedDuration > now &&
						!partIsUntimed
					) {
						remainingRundownDuration += Math.max(0, partExpectedDuration - (now - lastStartedPlayback))
					}
				}

				if (!rundownExpectedDurations[unprotectString(partInstance.part.rundownId)]) {
					rundownExpectedDurations[unprotectString(partInstance.part.rundownId)] =
						partInstance.part.expectedDuration ?? 0
				} else {
					rundownExpectedDurations[unprotectString(partInstance.part.rundownId)] +=
						partInstance.part.expectedDuration ?? 0
				}
			})

			// This is where the waitAccumulator-generated data in the linearSegLines is used to calculate the countdowns.
			// at this point the "waitAccumulator" should be the total sum of all the "waits" in the rundown
			let localAccum = 0
			let timeTillEndLoop: undefined | number = undefined
			for (let i = 0; i < this.linearParts.length; i++) {
				if (i < nextAIndex) {
					// this is a line before next line
					localAccum = this.linearParts[i][1] || 0
					// only null the values if not looping, if looping, these will be offset by the countdown for the last part
					if (!partsInQuickLoop[unprotectString(this.linearParts[i][0])]) {
						this.linearParts[i][1] = null // we use null to express 'will not probably be played out, if played in order'
					}
				} else if (i === currentAIndex) {
					if (nextRundownAnchor === undefined) {
						nextRundownAnchor = getSegmentRundownAnchorFromPart(
							this.linearParts[i][0],
							partInstancesMap,
							segmentsMap,
							now
						)
					}
				} else if (i === nextAIndex) {
					// this is a calculation for the next line, which is basically how much there is left of the current line
					localAccum = this.linearParts[i][1] || 0 // if there is no current line, rebase following lines to the next line
					this.linearParts[i][1] = currentRemaining
					if (nextRundownAnchor === undefined) {
						nextRundownAnchor = getSegmentRundownAnchorFromPart(
							this.linearParts[i][0],
							partInstancesMap,
							segmentsMap,
							now
						)
					}
				} else {
					// these are lines after next line
					// we take whatever value this line has, subtract the value as set on the Next Part
					// (note that the Next Part value will be using currentRemaining as the countdown)
					// and add the currentRemaining countdown, since we are currentRemaining + diff between next and
					// this away from this line.
					this.linearParts[i][1] = (this.linearParts[i][1] || 0) - localAccum + currentRemaining

					if (!partsInQuickLoop[unprotectString(this.linearParts[i][0])]) {
						timeTillEndLoop = timeTillEndLoop ?? this.linearParts[i][1] ?? undefined
					}

					if (nextRundownAnchor === undefined) {
						nextRundownAnchor = getSegmentRundownAnchorFromPart(
							this.linearParts[i][0],
							partInstancesMap,
							segmentsMap,
							now
						)
					}
				}
			}
			// at this point the localAccumulator should be the sum of waits before the next line
			// continuation of linearParts calculations for looping playlists
			if (isLoopRunning(playlist)) {
				// we track the sum of all the "waits" that happen in the loop
				let waitInLoop = 0
				// if timeTillEndLoop was undefined then we can assume the end of the loop is the last line in the rundown
				timeTillEndLoop = timeTillEndLoop ?? waitAccumulator - localAccum + currentRemaining
				for (let i = 0; i < nextAIndex; i++) {
					if (!partsInQuickLoop[unprotectString(this.linearParts[i][0])]) continue

					// this countdown is the wait until the loop ends + whatever waits occur before this part but inside the loop
					this.linearParts[i][1] = timeTillEndLoop + waitInLoop

					// add the wait from this part to the waitInLoop (the lookup here should still work by the definition of a "wait")
					waitInLoop += waitPerPart[unprotectString(this.linearParts[i][0])] ?? 0

					if (nextRundownAnchor === undefined) {
						nextRundownAnchor = getSegmentRundownAnchorFromPart(
							this.linearParts[i][0],
							partInstancesMap,
							segmentsMap,
							now
						)
					}
				}
			}

			// For the sake of Segment Budget Durations, we need to now iterate over all Segments
			let nextSegmentIndex = -1
			let itIndex = -1
			for (const segment of segmentsMap.values()) {
				itIndex++
				if (segment._id === this.nextSegmentId) {
					nextSegmentIndex = itIndex
				}
				const segmentBudgetDuration = segment.segmentTiming?.budgetDuration

				// If all of the Parts in a Segment are untimed, do not consider the Segment for
				// Playlist Remaining and As-Played durations.
				if (segmentBudgetDuration === undefined || this.untimedSegments.has(segment._id)) continue

				totalRundownDuration += segmentBudgetDuration

				let valToAddToRundownAsPlayedDuration = 0
				let valToAddToRundownRemainingDuration = 0
				if (liveSegmentIds && segment._id === liveSegmentIds.segmentId) {
					const startedPlayback =
						playlist.segmentsStartedPlayback?.[unprotectString(liveSegmentIds.segmentPlayoutId)]
					valToAddToRundownRemainingDuration = Math.max(
						0,
						segmentBudgetDuration - (startedPlayback ? now - startedPlayback : 0)
					)
					valToAddToRundownAsPlayedDuration = Math.max(
						startedPlayback ? now - startedPlayback : 0,
						segmentBudgetDuration
					)
				} else if (!playlist.activationId || (nextSegmentIndex >= 0 && itIndex >= nextSegmentIndex)) {
					valToAddToRundownAsPlayedDuration = segmentBudgetDuration
					valToAddToRundownRemainingDuration = segmentBudgetDuration
				} else {
					valToAddToRundownAsPlayedDuration = this.segmentAsPlayedDurations[unprotectString(segment._id)] || 0
				}
				remainingRundownDuration += valToAddToRundownRemainingDuration
				asPlayedRundownDuration += valToAddToRundownAsPlayedDuration
				rundownAsPlayedDurations[unprotectString(segment.rundownId)] =
					(rundownAsPlayedDurations[unprotectString(segment.rundownId)] ?? 0) +
					valToAddToRundownAsPlayedDuration
			}
		}

		let remainingTimeOnCurrentPart: number | undefined = undefined
		let currentPartWillAutoNext = false
		let currentSegmentId: SegmentId | null | undefined
		if (currentAIndex >= 0) {
			const currentLivePartInstance = partInstances[currentAIndex]
			const currentLivePart = currentLivePartInstance.part

			const lastStartedPlayback = currentLivePartInstance.timings?.plannedStartedPlayback

			let onAirPartDuration =
				currentLivePartInstance.timings?.duration ||
				calculatePartInstanceExpectedDurationWithTransition(currentLivePartInstance) ||
				0
			if (
				currentLivePart.displayDurationGroup &&
				(currentLivePart.expectedDuration === undefined || currentLivePart.expectedDuration === 0)
			) {
				onAirPartDuration =
					getPartInstanceTimingValue(this.partDisplayDurationsNoPlayback, currentLivePartInstance) ??
					onAirPartDuration
			}

			remainingTimeOnCurrentPart =
				typeof lastStartedPlayback === 'number'
					? Math.min(lastStartedPlayback, now) + onAirPartDuration - now
					: onAirPartDuration

			currentPartWillAutoNext = !!(currentLivePart.autoNext && currentLivePart.expectedDuration)

			currentSegmentId = currentLivePart.segmentId
		}

		return literal<RundownTimingContext>({
			currentPartInstanceId: playlist ? (playlist.currentPartInfo?.partInstanceId ?? null) : undefined,
			currentSegmentId: currentSegmentId,
			totalPlaylistDuration: totalRundownDuration,
			remainingPlaylistDuration: remainingRundownDuration,
			asDisplayedPlaylistDuration: asDisplayedRundownDuration,
			asPlayedPlaylistDuration: asPlayedRundownDuration,
			rundownExpectedDurations,
			rundownAsPlayedDurations,
			partCountdown: objectFromEntries(this.linearParts),
			partDurations: this.partDurations,
			partPlayed: this.partPlayed,
			partStartsAt: this.partStartsAt,
			partDisplayStartsAt: this.partDisplayStartsAt,
			partExpectedDurations: this.partExpectedDurations,
			partDisplayDurations: this.partDisplayDurations,
			currentTime: now,
			remainingTimeOnCurrentPart,
			remainingBudgetOnCurrentSegment,
			currentPartWillAutoNext,
			rundownsBeforeNextBreak,
			breakIsLastRundown,
			isLowResolution,
			nextRundownAnchor,
			partsInQuickLoop,
		})
	}

	private getRundownsBeforeNextBreak(
		orderedRundowns: Rundown[],
		currentRundown: Rundown | undefined
	): BreakProps | undefined {
		const currentState = orderedRundowns.map((r) => r.endOfRundownIsShowBreak ?? '_').join('')
		if (this.breakProps.state !== currentState) {
			this.recalculateBreaks(orderedRundowns, currentRundown)
		}

		this.breakProps.state = currentState
		return this.breakProps.props
	}

	private recalculateBreaks(orderedRundowns: Rundown[], currentRundown: Rundown | undefined) {
		if (!currentRundown) {
			this.breakProps.props = undefined
			return
		}

		const currentRundownIndex = orderedRundowns.findIndex((r) => r._id === currentRundown._id)

		if (currentRundownIndex === -1) {
			this.breakProps.props = undefined
			return
		}

		const nextBreakIndex = orderedRundowns.findIndex((rundown, index) => {
			if (index < currentRundownIndex) {
				return false
			}

			return rundown.endOfRundownIsShowBreak === true
		})

		this.breakProps.props = {
			rundownsBeforeNextBreak: orderedRundowns.slice(currentRundownIndex, nextBreakIndex + 1),
			breakIsLastRundown: nextBreakIndex === orderedRundowns.length - 1,
		}
	}
}

export interface RundownTimingContext {
	/** This stores the part instance that was active when this timing information was generated. */
	currentPartInstanceId?: PartInstanceId | null
	/** This stores the id of the segment that was active when this timing information was generated. */
	currentSegmentId?: SegmentId | null
	/** This is the total duration of the playlist as planned (using expectedDurations). */
	totalPlaylistDuration?: number
	/** This is the content remaining to be played in the playlist (based on the expectedDurations).  */
	remainingPlaylistDuration?: number
	/** This is the total duration of the playlist: as planned for the unplayed (skipped & future) content, and as-run for the played-out. */
	asDisplayedPlaylistDuration?: number
	/** This is the complete duration of the playlist: as planned for the unplayed content, and as-run for the played-out, but ignoring unplayed/unplayable parts in order */
	asPlayedPlaylistDuration?: number
	/** Expected duration of each rundown in playlist (based on part expected durations) */
	rundownExpectedDurations?: Record<string, number>
	/** This is the complete duration of each rundown: as planned for the unplayed content, and as-run for the played-out, but ignoring unplayed/unplayable parts in order */
	rundownAsPlayedDurations?: Record<string, number>
	/** this is the countdown to each of the parts relative to the current on air part. This allways uses PartId's as the index */
	partCountdown?: Record<string, number | null>
	/** The calculated durations of each of the Parts: as-planned/as-run depending on state. */
	partDurations?: Record<string, number>
	/** Whether a Part (or Part Instance) is within the QuickLoop */
	partsInQuickLoop?: Record<string, boolean>
	/** The offset of each of the Parts from the beginning of the Playlist. */
	partStartsAt?: Record<string, number>
	/** Same as partStartsAt, but will include display duration overrides
	 *  (such as minimal display width for an Part, etc.).
	 */
	partDisplayStartsAt?: Record<string, number>
	/** Same as partDurations, but will include display duration overrides
	 * (such as minimal display width for an Part, etc.).
	 */
	partDisplayDurations?: Record<string, number>
	/** As-played durations of each part. Will be 0, if not yet played.
	 * Will be counted from start to now if currently playing.
	 */
	partPlayed?: Record<string, number>
	/** Expected durations of each of the parts or the as-played duration,
	 * if the Part does not have an expected duration.
	 */
	partExpectedDurations?: Record<string, number>
	/** Remaining time on current part */
	remainingTimeOnCurrentPart?: number
	/** Remaining budget on current segment, if its countdownType === CountdownType.SEGMENT_BUDGET_DURATION, undefined otherwise */
	remainingBudgetOnCurrentSegment?: number | undefined
	/** Current part will autoNext */
	currentPartWillAutoNext?: boolean
	/** Current time of this calculation */
	currentTime?: number
	/** Rundowns between current rundown and rundown with next break (inclusive of both). Undefined if there's no break in the future. */
	rundownsBeforeNextBreak?: Rundown[]
	/** Whether the next break is also the last */
	breakIsLastRundown?: boolean
	/** Was this time context calculated during a high-resolution tick */
	isLowResolution: boolean
	/** The next (absolute) anchor time in the rundown, if any. */
	nextRundownAnchor?: number
}

/**
 * Computes the actual (as-played fallbacking to expected) duration of a segment, consisting of given parts
 * @export
 * @param  {RundownTimingContext} timingDurations The timing durations calculated for the Rundown
 * @param  {Array<string>} partIds The IDs of parts that are members of the segment
 * @return number
 */
export function computeSegmentDuration(
	timingDurations: RundownTimingContext,
	partIds: PartId[],
	display?: boolean
): number {
	const partDurations = timingDurations.partDurations

	if (partDurations === undefined) return 0

	return partIds.reduce((memo, partId) => {
		const pId = unprotectString(partId)
		let partDuration = 0
		if (partDurations && partDurations[pId] !== undefined) {
			partDuration = partDurations[pId]
		}
		if (!partDuration && display) {
			partDuration = Settings.defaultDisplayDuration
		}
		return memo + partDuration
	}, 0)
}

export function getPartInstanceTimingId(
	partInstance: Pick<PartInstance, '_id' | 'isTemporary'> & { part: Pick<DBPart, '_id'> }
): TimingId {
	return !partInstance.isTemporary ? unprotectString(partInstance._id) : unprotectString(partInstance.part._id)
}

/**
 * Get a timing value from a timing context map for a given (temporary) PartInstance. Will return `null` if not found.
 */
export function getPartInstanceTimingValue(
	values: Record<string, number> | undefined,
	partInstance: Pick<PartInstance, '_id' | 'isTemporary'> & { part: Pick<DBPart, '_id'> }
): number | null {
	if (!values) return null
	if (partInstance.isTemporary) {
		return values[unprotectString(partInstance.part._id)] ?? null
	}
	return values[unprotectString(partInstance._id)] ?? values[unprotectString(partInstance.part._id)] ?? null
}

export function getPlaylistTimingDiff(
	playlist: Pick<DBRundownPlaylist, 'timing' | 'startedPlayback' | 'activationId'>,
	timingContext: RundownTimingContext
): number | undefined {
	const { timing, startedPlayback, activationId } = playlist
	const active = !!activationId
	const currentTime = timingContext.currentTime || getCurrentTime()
	let frontAnchor: number = currentTime
	let backAnchor: number = currentTime
	if (PlaylistTiming.isPlaylistTimingForwardTime(timing)) {
		const backAnchorTimeWithoutBreaks =
			timing.expectedEnd ??
			(startedPlayback ?? Math.max(timing.expectedStart, currentTime)) +
				(timing.expectedDuration ?? timingContext.totalPlaylistDuration ?? 0)
		backAnchor = timingContext.nextRundownAnchor ?? backAnchorTimeWithoutBreaks
		frontAnchor = Math.max(currentTime, playlist.startedPlayback ?? Math.max(timing.expectedStart, currentTime))
	} else if (PlaylistTiming.isPlaylistTimingBackTime(timing)) {
		backAnchor = timingContext.nextRundownAnchor ?? timing.expectedEnd
	}

	let diff = PlaylistTiming.isPlaylistTimingNone(timing)
		? (timingContext.asPlayedPlaylistDuration || 0) -
			(timing.expectedDuration ?? timingContext.totalPlaylistDuration ?? 0)
		: frontAnchor + (timingContext.remainingPlaylistDuration || 0) - backAnchor

	// handle special cases

	// the rundown has been played out and now has been deactivated
	if (!active && startedPlayback) {
		if (PlaylistTiming.isPlaylistTimingForwardTime(timing)) {
			// we want to know how heavy/light we were compared to the original plan
			diff =
				(timingContext.asPlayedPlaylistDuration || 0) -
				(timing.expectedDuration ?? timingContext.totalPlaylistDuration ?? 0)

			if (timing.expectedEnd) {
				diff = startedPlayback + (timingContext.asPlayedPlaylistDuration || 0) - timing.expectedEnd
			}
		} else if (PlaylistTiming.isPlaylistTimingNone(timing)) {
			//  we want to know how heavy/light we were compared to the original plan
			diff =
				(timingContext.asPlayedPlaylistDuration || 0) -
				(timing.expectedDuration ?? timingContext.totalPlaylistDuration ?? 0)
		} else if (PlaylistTiming.isPlaylistTimingBackTime(timing)) {
			// we want to see how late we've ended compared to the expectedEnd
			diff = startedPlayback + (timingContext.asPlayedPlaylistDuration || 0) - timing.expectedEnd
		}
	}

	return diff
}

function ensureMinimumDefaultDurationIfNotAuto(
	partInstance: CalculateTimingsPartInstance,
	incomingDuration: number | undefined,
	defaultDuration: number
): number {
	if (incomingDuration === undefined || !Number.isFinite(incomingDuration)) return defaultDuration

	if (partInstance.part.autoNext) return incomingDuration

	return Math.max(incomingDuration, defaultDuration)
}

/**
 * Gets the next soonest valid rundown anchor from a Part's Segment.
 *
 * Specifically, it returns the start anchor if present and if the start anchor's time has not already passed.
 * Else, it returns the end anchor if present.
 * Else, returns undefined.
 */
function getSegmentRundownAnchorFromPart(
	partId: PartId,
	partInstancesMap: Map<PartId, CalculateTimingsPartInstance>,
	segmentsMap: Map<SegmentId, DBSegment>,
	now: number
): number | undefined {
	let nextRundownAnchor: number | undefined = undefined

	const part = partInstancesMap.get(partId)
	const segment = part?.segmentId ? segmentsMap.get(part.segmentId) : null
	if (!segment) return nextRundownAnchor

	const startTime = segment.segmentTiming?.expectedStart ?? null
	if (startTime && startTime > now) {
		nextRundownAnchor = startTime
	} else {
		const endTime = segment.segmentTiming?.expectedEnd ?? null
		if (endTime) {
			nextRundownAnchor = endTime
		}
	}

	return nextRundownAnchor
}

export type MinimalPartInstance = Pick<
	PartInstance,
	| '_id'
	| 'isTemporary'
	| 'rundownId'
	| 'segmentId'
	| 'segmentPlayoutId'
	| 'takeCount'
	| 'part'
	| 'timings'
	| 'orphaned'
>

export function findPartInstancesInQuickLoop(
	playlist: DBRundownPlaylist,
	sortedPartInstances: MinimalPartInstance[]
): Record<TimingId, boolean> {
	if (!isLoopDefined(playlist) || isEntirePlaylistLooping(playlist)) {
		return {}
	}

	const partsInQuickLoop: Record<TimingId, boolean> = {}
	let isInQuickLoop = playlist.quickLoop?.start?.type === QuickLoopMarkerType.PLAYLIST
	let previousPartInstance: MinimalPartInstance | undefined = undefined
	for (const partInstance of sortedPartInstances) {
		if (
			previousPartInstance &&
			((playlist.quickLoop?.end?.type === QuickLoopMarkerType.PART &&
				playlist.quickLoop.end.id === previousPartInstance.part._id) ||
				(playlist.quickLoop?.end?.type === QuickLoopMarkerType.SEGMENT &&
					playlist.quickLoop.end.id === previousPartInstance.segmentId) ||
				(playlist.quickLoop?.end?.type === QuickLoopMarkerType.RUNDOWN &&
					playlist.quickLoop.end.id === previousPartInstance.rundownId))
		) {
			isInQuickLoop = false
			if (
				playlist.quickLoop.start?.type !== QuickLoopMarkerType.PART ||
				playlist.quickLoop.start?.id !== playlist.quickLoop.end?.id
			) {
				// when looping over a single part we need to include the three instances of that part shown at once, otherwise, we can break
				break
			}
		}
		if (
			!isInQuickLoop &&
			((playlist.quickLoop?.start?.type === QuickLoopMarkerType.PART &&
				playlist.quickLoop.start.id === partInstance.part._id) ||
				(playlist.quickLoop?.start?.type === QuickLoopMarkerType.SEGMENT &&
					playlist.quickLoop.start.id === partInstance.segmentId) ||
				(playlist.quickLoop?.start?.type === QuickLoopMarkerType.RUNDOWN &&
					playlist.quickLoop.start.id === partInstance.rundownId))
		) {
			isInQuickLoop = true
		}
		if (isInQuickLoop) {
			partsInQuickLoop[getPartInstanceTimingId(partInstance)] = true
		}
		previousPartInstance = partInstance
	}
	return partsInQuickLoop
}
