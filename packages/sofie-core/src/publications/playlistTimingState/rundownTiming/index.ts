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

import type { PartId, PartInstanceId, SegmentId, SegmentPlayoutId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { literal } from '@sofie-automation/corelib/dist/lib'
import {
	type TimerState,
	offsetTimerState,
	timerStateToDuration,
	timerStateToZeroTime,
} from '@sofie-automation/corelib/dist/dataModel/TimerState'
import { calculatePartInstanceExpectedDurationWithTransition } from '@sofie-automation/corelib/dist/playout/timings'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import {
	type DBRundownPlaylist,
	QuickLoopMarkerType,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { objectFromEntries } from '@sofie-automation/shared-lib/dist/lib/lib'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { CountdownType } from '@sofie-automation/blueprints-integration'
import type { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	isLoopRunning,
	isLoopDefined,
	isEntirePlaylistLooping,
} from '@sofie-automation/corelib/dist/playout/stateCacheResolver'

import { type CalculateTimingsPartInstance, PartDurationResolver } from './resolvePartTimings'

export type { CalculateTimingsPartInstance }

export type TimingId = string

/**
 * Calculates the timing of a Rundown playlist for the playlistTimingState publication.
 * The publication creates a new instance for every calculation.
 */
export class RundownTimingCalculator {
	private linearParts: Array<[PartId, number | null]> = []

	// we need to keep the nextSegmentId here for the brief moment when the next partinstance can't be found
	private nextSegmentId: SegmentId | undefined = undefined

	// look at the comments on RundownTimingContext to understand what these do
	// Note, that these objects are created when an instance is created and are reused by every call
	// to `updateDurations` on that instance.
	// Only the RundownTimingContext object is unique for a call to `updateDurations`.
	private partDurations: Record<TimingId, number> = {}
	private partExpectedDurations: Record<TimingId, number> = {}
	private partPlayed: Record<TimingId, number> = {}
	private partStartsAt: Record<TimingId, number> = {}
	private partDisplayStartsAt: Record<TimingId, number> = {}
	private partDisplayDurations: Record<TimingId, number> = {}
	private partDisplayDurationsNoPlayback: Record<TimingId, number> = {}
	private partDurationsNoPlayback: Record<TimingId, number> = {}
	private segmentAsPlayedDurations: Record<string, number> = {}

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
	 * @param {CalculateTimingsPartInstance[]} partInstances
	 * @param {Map<SegmentId, DBSegment>} segmentsMap
	 * @param {number} [defaultDuration]
	 * @return {*}  {RundownTimingContext}
	 * @memberof RundownTimingCalculator
	 */
	updateDurations(
		now: number,
		isLowResolution: boolean,
		playlist: DBRundownPlaylist | undefined,
		partInstances: CalculateTimingsPartInstance[],
		segmentsMap: Map<SegmentId, DBSegment>,
		/** Fallback duration for Parts that have no as-played duration of their own. */
		defaultDuration: number,
		partsInQuickLoop: Record<TimingId, boolean>
	): RundownTimingContext {
		let totalRundownDuration = 0
		let remainingRundownDuration = 0
		let asPlayedRundownDuration = 0
		let asDisplayedRundownDuration = 0
		// the "wait" for a part is defined as its asPlayedDuration or its displayDuration or its expectedDuration
		const waitPerPart: Record<string, number> = {}
		let waitAccumulator = 0
		/**
		 * The countdown until the Next part goes on air, as a state. Every part's countdown is this
		 * plus that part's static wait, so this is the only time-varying term in all of them.
		 */
		let currentRemainingState: TimerState = { paused: true, duration: 0 }
		let startsAtAccumulator = 0
		let displayStartsAtAccumulator = 0
		let segmentDisplayDuration = 0
		let segmentBudgetDurationLeft = 0
		let remainingBudgetOnCurrentSegment: undefined | number
		let remainingBudgetOnCurrentSegmentState: undefined | TimerState

		/**
		 * The single time-varying term of the playlist aggregates: the on-air part (or the on-air
		 * budgeted segment) counting down to the moment it overruns its expected duration, freezing
		 * at zero. The numeric aggregates below are evaluations of this state, and the published
		 * TimerStates are composed from it — there is deliberately no other formula involving `now`
		 * in the playlist aggregates.
		 */
		let liveCountdown: (TimerState & { paused: false; pauseTime: number }) | undefined
		/** The planned start of the on-air part, while its own countdown is `liveCountdown` */
		let onAirPartPlannedStart: number | undefined
		/**
		 * The take of the on-air part, while it waits for its start: between the take and the playout gateway's report
		 * of the start, with one playout gateway. The part starts at or after it.
		 */
		let onAirPartTakenAt: number | undefined
		/** The start and the planned end of the part that started last, other than the on-air part */
		let lastStartedPartBeforeTheOnAirPart: { start: number; plannedEnd: number } | undefined

		/** Keyed by partId, matching `partCountdown`. Rebuilt each run, so it never goes stale */
		const partCountdownOffsets: Record<TimingId, number | null> = {}
		/** What every part's countdown is a shift of; set below once the waits are known */
		let partCountdownBase: TimerState = { paused: true, duration: 0 }
		/** Rebuilt each run, so it never goes stale */
		const partCountsTowardsTiming: Record<TimingId, boolean> = {}

		const rundownExpectedDurations: Record<string, number> = {}
		const rundownAsPlayedDurations: Record<string, number> = {}

		let liveSegmentIds: { segmentId: SegmentId; segmentPlayoutId: SegmentPlayoutId } | undefined

		// The display-duration group pools only live for the length of one pass over the playout order
		const partDurationResolver = new PartDurationResolver()

		Object.keys(this.segmentAsPlayedDurations).forEach((key) => delete this.segmentAsPlayedDurations[key])
		this.untimedSegments.clear()
		this.linearParts.length = 0

		let nextAIndex = -1
		let currentAIndex = -1

		let lastSegmentIds: { segmentId: SegmentId; segmentPlayoutId: SegmentPlayoutId } | undefined = undefined

		const entirePlaylistIsLooping = isEntirePlaylistLooping(playlist)

		if (playlist) {
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
					// untimed segment: pattern is to add all segments as candidates to untimed here, then remove them once we see any timed part within it, later
					this.untimedSegments.add(partInstance.segmentId)

					if (liveSegmentIds && lastSegmentIds && lastSegmentIds.segmentId === liveSegmentIds.segmentId) {
						const liveSegment = segmentsMap.get(liveSegmentIds.segmentId)

						if (liveSegment?.segmentTiming?.countdownType === CountdownType.SEGMENT_BUDGET_DURATION) {
							const budgetDuration = liveSegment.segmentTiming.budgetDuration ?? 0
							if (budgetDuration > 0) {
								// The countdown runs from when the segment started; with no known start
								// there is nothing to count from, so it simply reads as the full budget
								const segmentStartedPlayback =
									playlist.segmentsStartedPlayback?.[
										unprotectString(liveSegmentIds.segmentPlayoutId)
									] ?? lastStartedPlayback
								remainingBudgetOnCurrentSegmentState =
									segmentStartedPlayback !== undefined
										? { paused: false, zeroTime: segmentStartedPlayback + budgetDuration }
										: { paused: true, duration: budgetDuration }
								remainingBudgetOnCurrentSegment = timerStateToDuration(
									remainingBudgetOnCurrentSegmentState,
									now
								)
							}
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

				partCountsTowardsTiming[partInstanceOrPartId] = partCounts

				const partIsUntimed = partInstance.part.untimed || false

				// untimed segment algorithm: we have considered all segments as candidates to untimed segments, and now we remove the ones that aren't (the ones that contain a timed part)
				if (!partIsUntimed) {
					this.untimedSegments.delete(partInstance.segmentId)
				}

				// expected is just a sum of expectedDurations if not using budgetDuration
				// if the Part is using budgetDuration, this budget is calculated when going through all the segments
				// in the Rundown (see further down)
				if (!segmentUsesBudget && !partIsUntimed) {
					totalRundownDuration += calculatePartInstanceExpectedDurationWithTransition(partInstance) || 0
				}

				const resolved = partDurationResolver.resolve(
					partInstance,
					partInstances[itIndex + 1],
					now,
					lastStartedPlayback,
					defaultDuration
				)
				const { memberOfDisplayDurationGroup, displayDurationFromGroup } = resolved
				const partExpectedDuration = resolved.expectedDuration
				const partDuration = resolved.duration
				const isTheOnAirPart = playlist.currentPartInfo?.partInstanceId === partInstance._id
				if (
					lastStartedPlayback !== undefined &&
					!isTheOnAirPart &&
					(lastStartedPartBeforeTheOnAirPart === undefined ||
						lastStartedPlayback > lastStartedPartBeforeTheOnAirPart.start)
				) {
					lastStartedPartBeforeTheOnAirPart = {
						start: lastStartedPlayback,
						plannedEnd: lastStartedPlayback + partExpectedDuration,
					}
				}
				const partDisplayDurationNoPlayback = resolved.displayDurationNoPlayback
				let partDisplayDuration = resolved.displayDuration
				this.partPlayed[partInstanceOrPartId] = resolved.played

				if (lastStartedPlayback && !partInstance.timings?.duration) {
					const duration = resolved.recordedDuration
					const segmentStartedPlayback =
						playlist.segmentsStartedPlayback?.[unprotectString(partInstance.segmentPlayoutId)] ??
						lastStartedPlayback

					// NOTE: displayDurationGroups are ignored here, when using budgetDuration
					// Both branches count down to a fixed moment and then hold at zero, which is the
					// `pauseTime === zeroTime` shape - the old `Math.max(0, …)` clamp expressed as a state
					if (segmentUsesBudget) {
						const budgetEndTime = segmentStartedPlayback + segmentBudget - segmentDisplayDuration
						currentRemainingState = { paused: false, zeroTime: budgetEndTime, pauseTime: budgetEndTime }
						segmentBudgetDurationLeft = 0
					} else {
						const partEndTime =
							lastStartedPlayback +
							(duration ||
								(memberOfDisplayDurationGroup
									? displayDurationFromGroup
									: calculatePartInstanceExpectedDurationWithTransition(partInstance)) ||
								0)
						currentRemainingState = { paused: false, zeroTime: partEndTime, pauseTime: partEndTime }
					}
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
							// as-played = the part's expected duration, plus however far past its
							// expected end it has overrun (i.e. max(expectedDuration, elapsed)),
							// expressed through the part's expected-end countdown state so that the
							// same state drives both this and the remaining-duration term
							const expectedEndTime = lastStartedPlayback + partExpectedDuration
							const partCountdown: TimerState = {
								paused: false,
								zeroTime: expectedEndTime,
								pauseTime: expectedEndTime,
							}
							valToAddToAsPlayedDuration =
								partExpectedDuration + (timerStateToZeroTime(partCountdown, now) - expectedEndTime)
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
					// Nothing is ticking yet, so this holds at the part's full length. Where the start is
					// already known but still in the future - the window after a take in a multi-gateway
					// studio - `resumesAt` carries it, so the countdowns are right the moment it passes
					// rather than only once this has been recomputed and republished.
					const plannedStartedPlayback = partInstance.timings?.plannedStartedPlayback
					currentRemainingState = {
						paused: true,
						duration: partDisplayDuration,
						resumesAt: plannedStartedPlayback ?? null,
					}
				}

				// Handle invalid parts by overriding the values to preset values for Invalid parts
				if (partInstance.part.invalid && !partInstance.part.gap) {
					partDisplayDuration = defaultDuration
					this.partPlayed[partInstanceOrPartId] = 0
				}

				partDurationResolver.takeFromDisplayDurationGroup(
					partInstance,
					resolved,
					partDisplayDuration,
					partCounts
				)

				this.partExpectedDurations[partInstanceOrPartId] = partExpectedDuration
				this.partStartsAt[partInstanceOrPartId] = startsAtAccumulator
				this.partDisplayStartsAt[partInstanceOrPartId] = displayStartsAtAccumulator
				this.partDurations[partInstanceOrPartId] = partDuration
				this.partDisplayDurations[partInstanceOrPartId] = partDisplayDuration
				this.partDisplayDurationsNoPlayback[partInstanceOrPartId] = partDisplayDurationNoPlayback
				this.partDurationsNoPlayback[partInstanceOrPartId] = resolved.durationNoPlayback
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
					// note: this deliberately uses the planned start rather than `lastStartedPlayback`,
					// so that it also covers a part that has been taken but has not started yet.
					// Multi-gateway studios schedule the start a little into the future, so for a
					// moment after every take the on-air part has a planned start that has not been
					// reached. Anchoring on that start keeps the playlist's projected end fixed
					// across the window, rather than letting it push along with the clock.
					const plannedStartedPlayback = partInstance.timings?.plannedStartedPlayback
					const isOnAir =
						playlist.currentPartInfo?.partInstanceId === partInstance._id &&
						plannedStartedPlayback !== undefined &&
						!partInstance.timings?.duration &&
						!partIsUntimed
					const isWaitingForItsStart =
						playlist.currentPartInfo?.partInstanceId === partInstance._id &&
						plannedStartedPlayback === undefined &&
						partInstance.timings?.reportedStartedPlayback === undefined &&
						partInstance.timings?.take !== undefined
					if (isWaitingForItsStart) onAirPartTakenAt = partInstance.timings?.take

					if (isOnAir) {
						// The on-air part's remaining time: a countdown to its expected end, freezing
						// at zero once it overruns. This is the state that makes the aggregates
						// time-varying; the numeric value is its evaluation at `now`. Before the
						// planned start this evaluates to more than the part's duration, by the
						// amount of the wait - which is what keeps the projected end fixed.
						const expectedEndTime = plannedStartedPlayback + partExpectedDuration
						liveCountdown = { paused: false, zeroTime: expectedEndTime, pauseTime: expectedEndTime }
						onAirPartPlannedStart = plannedStartedPlayback
						remainingRundownDuration += timerStateToDuration(liveCountdown, now)
					} else if (
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
			//
			// NOTE: this loop works in *offsets from the Next part's countdown* - i.e. it is the
			// arithmetic below with `currentRemaining` taken to be zero. Each part's actual countdown is
			// its offset plus `currentRemainingState`, applied in the pass that follows, so that the one
			// live term appears exactly once and every countdown is a shift of the same state.
			let localAccum = 0
			let timeTillEndLoop: undefined | number = undefined
			for (let i = 0; i < this.linearParts.length; i++) {
				if (i < nextAIndex) {
					// this is a line before next line
					localAccum = this.linearParts[i][1] || 0
					// only null the values if not looping, if looping, these will be offset by the countdown for the last part
					if (!partsInQuickLoop[unprotectString(this.linearParts[i][0])] && !entirePlaylistIsLooping) {
						this.linearParts[i][1] = null // we use null to express 'will not probably be played out, if played in order'
					}
				} else if (i === nextAIndex) {
					// this is a calculation for the next line, which is basically how much there is left of the current line
					localAccum = this.linearParts[i][1] || 0 // if there is no current line, rebase following lines to the next line
					this.linearParts[i][1] = 0
				} else {
					// these are lines after next line
					// we take whatever value this line has, subtract the value as set on the Next Part
					// (note that the Next Part value will be using currentRemaining as the countdown)
					// and add the currentRemaining countdown, since we are currentRemaining + diff between next and
					// this away from this line.
					this.linearParts[i][1] = (this.linearParts[i][1] || 0) - localAccum

					if (!partsInQuickLoop[unprotectString(this.linearParts[i][0])] && !entirePlaylistIsLooping) {
						timeTillEndLoop = timeTillEndLoop ?? this.linearParts[i][1] ?? undefined
					}
				}
			}
			// at this point the localAccumulator should be the sum of waits before the next line
			// continuation of linearParts calculations for looping playlists
			if (isLoopRunning(playlist)) {
				// we track the sum of all the "waits" that happen in the loop
				let waitInLoop = 0
				// if timeTillEndLoop was undefined then we can assume the end of the loop is the last line in the rundown
				timeTillEndLoop = timeTillEndLoop ?? waitAccumulator - localAccum
				for (let i = 0; i < nextAIndex; i++) {
					if (!partsInQuickLoop[unprotectString(this.linearParts[i][0])] && !entirePlaylistIsLooping) continue

					// this countdown is the wait until the loop ends + whatever waits occur before this part but inside the loop
					this.linearParts[i][1] = timeTillEndLoop + waitInLoop

					// add the wait from this part to the waitInLoop (the lookup here should still work by the definition of a "wait")
					waitInLoop += waitPerPart[unprotectString(this.linearParts[i][0])] ?? 0
				}
			}

			// Each part's countdown is published as one base timer shifted by an offset of the part's own, and
			// every changed offset is a part document sent to every subscriber. The offsets above count from the
			// start of the Next part (of the first part when nothing is next), so a take, which moves Next, would
			// change all of them. So the base is the live term moved to the end of the last part's wait, and each
			// offset counts back from there. A part's offset is then made of the waits from that part on, which
			// for a part at or after Next have not been played, so a take, a playback confirmation or the clock
			// mostly changes the base alone. Each countdown is the same either way: the live state, shifted by the
			// same total.
			const waitsFromNextToTheEnd = waitAccumulator - localAccum
			partCountdownBase = offsetTimerState(currentRemainingState, waitsFromNextToTheEnd)

			// Give each part its offset from the base, and take the numbers back out of the countdowns the two
			// give, as a consumer composes them, so that the numbers and the published values can never disagree
			for (const linearPart of this.linearParts) {
				const partId = unprotectString(linearPart[0])
				const offsetFromNext = linearPart[1]
				const hasCountdown = offsetFromNext !== null
				const countdownOffset = hasCountdown ? offsetFromNext - waitsFromNextToTheEnd : null
				partCountdownOffsets[partId] = countdownOffset

				const countdown = countdownOffset === null ? null : offsetTimerState(partCountdownBase, countdownOffset)
				linearPart[1] = countdown && timerStateToDuration(countdown, now)
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
					if (startedPlayback !== undefined) {
						// The on-air segment's remaining budget: a countdown to the end of the
						// budget, freezing at zero once it overruns — the same shape as the on-air
						// part countdown above, and the single source of the aggregates'
						// time-dependence when the live segment uses a budget.
						const budgetEndTime = startedPlayback + segmentBudgetDuration
						liveCountdown = { paused: false, zeroTime: budgetEndTime, pauseTime: budgetEndTime }
						// remaining = max(0, budget - elapsed)
						valToAddToRundownRemainingDuration = timerStateToDuration(liveCountdown, now)
						// as-played = budget, plus however far past the budget it has overrun
						// (i.e. max(elapsed, budget))
						valToAddToRundownAsPlayedDuration =
							segmentBudgetDuration + (timerStateToZeroTime(liveCountdown, now) - budgetEndTime)
					} else {
						valToAddToRundownRemainingDuration = segmentBudgetDuration
						valToAddToRundownAsPlayedDuration = segmentBudgetDuration
					}
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
		let remainingTimeOnCurrentPartState: TimerState | undefined = undefined
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

			// The part holds at its full duration until it starts, then counts down from there.
			// A scheduled start expresses that directly: before it the state reads as the whole
			// duration, after it as `start + duration - now`. (That is the same as the previous
			// `Math.min(start, now) + duration - now`, which is how a start in the future - every
			// multi-gateway take - was handled.)
			remainingTimeOnCurrentPartState =
				typeof lastStartedPlayback === 'number'
					? { paused: true, duration: onAirPartDuration, resumesAt: lastStartedPlayback }
					: { paused: true, duration: onAirPartDuration }
			remainingTimeOnCurrentPart = timerStateToDuration(remainingTimeOnCurrentPartState, now)

			currentPartWillAutoNext = !!(currentLivePart.autoNext && currentLivePart.expectedDuration)

			currentSegmentId = currentLivePart.segmentId
		}

		// Compose the remaining-duration TimerState from the accumulated constant terms and the
		// live countdown. The numeric remainingPlaylistDuration above is (by construction of the
		// accumulation) this state's evaluation at `now`.
		const remainingPlaylistDurationState: TimerState =
			liveCountdown && now < liveCountdown.pauseTime
				? { paused: false, zeroTime: now + remainingRundownDuration, pauseTime: liveCountdown.pauseTime }
				: { paused: true, duration: remainingRundownDuration }

		return literal<RundownTimingContext>({
			currentPartInstanceId: playlist ? (playlist.currentPartInfo?.partInstanceId ?? null) : undefined,
			currentSegmentId: currentSegmentId,
			totalPlaylistDuration: totalRundownDuration,
			remainingPlaylistDuration: remainingRundownDuration,
			remainingPlaylistDurationState,
			livePushTime: liveCountdown?.pauseTime,
			asDisplayedPlaylistDuration: asDisplayedRundownDuration,
			asPlayedPlaylistDuration: asPlayedRundownDuration,
			rundownExpectedDurations,
			rundownAsPlayedDurations,
			partCountdown: objectFromEntries(this.linearParts),
			partCountdownBase,
			partCountdownOffsets,
			partCountsTowardsTiming,
			partDurations: this.partDurations,
			partPlayed: this.partPlayed,
			partStartsAt: this.partStartsAt,
			partDisplayStartsAt: this.partDisplayStartsAt,
			partExpectedDurations: this.partExpectedDurations,
			partDisplayDurations: this.partDisplayDurations,
			partDisplayDurationsNoPlayback: this.partDisplayDurationsNoPlayback,
			partDurationsNoPlayback: this.partDurationsNoPlayback,
			currentTime: now,
			remainingTimeOnCurrentPart,
			remainingTimeOnCurrentPartState,
			onAirPartPlannedStart,
			onAirPartTakenAt,
			previousPartPlannedEnd:
				onAirPartTakenAt !== undefined &&
				lastStartedPartBeforeTheOnAirPart !== undefined &&
				lastStartedPartBeforeTheOnAirPart.start <= onAirPartTakenAt
					? lastStartedPartBeforeTheOnAirPart.plannedEnd
					: undefined,
			remainingBudgetOnCurrentSegment,
			remainingBudgetOnCurrentSegmentState,
			currentPartWillAutoNext,
			isLowResolution,
			partsInQuickLoop,
		})
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
	/**
	 * The remaining content duration as a TimerState (read via `timerStateToDuration`): counts down
	 * 1:1 while the on-air part (or segment budget) is playing, freezing once it overruns.
	 * `remainingPlaylistDuration` is this state's evaluation at `currentTime`.
	 * Read via `timerStateToZeroTime` (when playback has started, or while it counts down) it yields
	 * the estimated end.
	 */
	remainingPlaylistDurationState?: TimerState
	/**
	 * The moment the on-air part (or the on-air segment's budget) overruns its expected duration —
	 * the single piecewise breakpoint of the playlist aggregates: remaining freezes and as-played /
	 * estimated-end start pushing 1:1 with time from this point. Undefined when nothing on air is
	 * driving the aggregates.
	 */
	livePushTime?: number
	/** This is the total duration of the playlist: as planned for the unplayed (skipped & future) content, and as-run for the played-out. */
	asDisplayedPlaylistDuration?: number
	/** This is the complete duration of the playlist: as planned for the unplayed content, and as-run for the played-out, but ignoring unplayed/unplayable parts in order */
	asPlayedPlaylistDuration?: number
	/** Expected duration of each rundown in playlist (based on part expected durations) */
	rundownExpectedDurations?: Record<string, number>
	/** This is the complete duration of each rundown: as planned for the unplayed content, and as-run for the played-out, but ignoring unplayed/unplayable parts in order */
	rundownAsPlayedDurations?: Record<string, number>
	/** this is the countdown to each of the parts relative to the current on air part. This always uses PartId's as the index */
	partCountdown?: Record<string, number | null>
	/**
	 * The timer every part's countdown is a shift of: a part's countdown is
	 * `offsetTimerState(partCountdownBase, partCountdownOffsets[partId])`. It has no meaning of its own: it is
	 * the live term of the countdowns, moved to the end of the last part's wait.
	 */
	partCountdownBase: TimerState
	/**
	 * How far each part's countdown is from `partCountdownBase`, in ms: for a part at or after Next, minus the
	 * waits from the part's start to the end of the last part's wait. Also keyed by PartId; `null` means "will
	 * probably not be played out, if played in order", as in `partCountdown`.
	 */
	partCountdownOffsets?: Record<string, number | null>
	/**
	 * Whether each part contributes to the playlist and rundown totals - false for parts that will be
	 * skipped if the rundown is played in order, unless the playlist allows out-of-order timing.
	 */
	partCountsTowardsTiming?: Record<string, boolean>
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
	/** Same as partDisplayDurations, but calculated as if the part were not playing - so it does not
	 * grow while the on-air part overruns. This is the static part of the display duration.
	 */
	partDisplayDurationsNoPlayback?: Record<string, number>
	/** Same as partDurations, but calculated as if the part were not playing - so it does not grow
	 * while the on-air part overruns. This is the static part of the duration.
	 */
	partDurationsNoPlayback?: Record<string, number>
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
	/**
	 * Remaining time on the current part as a TimerState (read via `timerStateToDuration`).
	 * `remainingTimeOnCurrentPart` is this state's evaluation at `currentTime`.
	 */
	remainingTimeOnCurrentPartState?: TimerState
	/**
	 * When the on-air part starts, or started, playing as planned (its `plannedStartedPlayback`), while its
	 * own countdown drives the remaining duration: a timed part, outside a segment budget, still playing.
	 * Undefined otherwise, such as while an untimed part, or a part in a segment with a budget, is on air.
	 * A take in a multi-gateway studio sets it a little ahead, so just after a take it lies in the future.
	 */
	onAirPartPlannedStart?: number
	/**
	 * When the on-air part was taken, while it waits for the playout gateway's report of its start (with one playout
	 * gateway; in a multi-gateway studio the take plans the start instead, see `onAirPartPlannedStart`). The part starts
	 * at or after its take. Undefined once the start is known, and while no part is on air.
	 */
	onAirPartTakenAt?: number
	/**
	 * While the on-air part waits for its start (see `onAirPartTakenAt`): the planned end of the part that was on air
	 * before the take, its start plus its expected duration. Before the take, the playlist's estimated end counted that
	 * part to this end. Undefined otherwise.
	 */
	previousPartPlannedEnd?: number
	/** Remaining budget on current segment, if its countdownType === CountdownType.SEGMENT_BUDGET_DURATION, undefined otherwise */
	remainingBudgetOnCurrentSegment?: number | undefined
	/**
	 * Remaining budget on the current segment as a TimerState (read via `timerStateToDuration`).
	 * `remainingBudgetOnCurrentSegment` is this state's evaluation at `currentTime`.
	 */
	remainingBudgetOnCurrentSegmentState?: TimerState
	/** Current part will autoNext */
	currentPartWillAutoNext?: boolean
	/** Current time of this calculation */
	currentTime?: number
	/** Was this time context calculated during a high-resolution tick */
	isLowResolution: boolean
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
