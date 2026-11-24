import { calculatePartInstanceExpectedDurationWithTransition } from '@sofie-automation/corelib/dist/playout/timings'
import type { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'

// Minimum duration that a part can be assigned. Used by gap parts to allow them to "compress" to indicate time running out.
const MINIMAL_NONZERO_DURATION = 1

export type CalculateTimingsPartInstance = Pick<
	PartInstance,
	'_id' | 'isTemporary' | 'segmentId' | 'segmentPlayoutId' | 'orphaned' | 'timings' | 'part'
>

/**
 * The duration cascade for a single Part, resolved.
 *
 * Every value here is the product of the same set of fallbacks: the recorded duration where the
 * Part has played, the expected duration (with transition) where it has not, the Part's share of
 * its display-duration group's pool where it has no expected duration of its own, and finally the
 * Studio's default duration. Consumers should not need to know any of that - they take the value
 * they want from here.
 */
export interface ResolvedPartDurations {
	/** `expectedDurationWithTransition`, falling back to the recorded duration and then to the display-duration group's pool */
	expectedDuration: number

	/** As-played where known, else as-planned, grown to the elapsed time while on air, less any play offset */
	duration: number

	/** The duration the Part would have if it were not playing. Only differs from `duration` while on air and overrunning */
	durationNoPlayback: number

	/** The display duration, grown to the elapsed time while the Part is on air */
	displayDuration: number

	/** The display duration the Part would have if it were not playing. Only differs from `displayDuration` while on air and overrunning */
	displayDurationNoPlayback: number

	/** How much of the Part has been played, less any play offset */
	played: number

	/**
	 * The recorded duration of the Part, if it has one and is still on air.
	 * Exposed only because the remaining-time calculation falls back differently to the display durations.
	 */
	recordedDuration: number | undefined

	/** Whether this Part draws its display duration from a display-duration group */
	memberOfDisplayDurationGroup: boolean

	/** The duration this Part claims from its display-duration group's pool. 0 when it is not in one */
	displayDurationFromGroup: number
}

/**
 * Resolves the duration cascade for Parts, one at a time, in playout order.
 *
 * This is stateful because display-duration groups are: a group is a shared pool of expected
 * duration that its members draw from in order, and members are matched to each other by adjacency
 * in the playout order. A Part in a group therefore cannot be resolved in isolation - it has to be
 * resolved after its predecessors - which is why this is an object walked over the ordered list
 * rather than a pure function of a single Part.
 *
 * Use one instance per pass over the playout order, and discard it afterwards.
 */
export class PartDurationResolver {
	readonly #displayDurationGroups: Record<string, number> = {}

	/**
	 * Resolve the durations for one Part. Must be called in playout order.
	 *
	 * @param partInstance the Part being resolved
	 * @param nextPartInstance the Part immediately following it in playout order, used to detect the first member of a display-duration group
	 * @param now
	 * @param lastStartedPlayback when this Part started playing, or `undefined` if it has not started. Note that a `plannedStartedPlayback` in the future counts as not started
	 * @param defaultDuration the Studio's default part duration
	 */
	resolve(
		partInstance: CalculateTimingsPartInstance,
		nextPartInstance: CalculateTimingsPartInstance | undefined,
		now: number,
		lastStartedPlayback: number | undefined,
		defaultDuration: number
	): ResolvedPartDurations {
		const partIsUntimed = partInstance.part.untimed || false
		const playOffset = partInstance.timings?.playOffset || 0

		let partExpectedDuration =
			calculatePartInstanceExpectedDurationWithTransition(partInstance) || partInstance.timings?.duration || 0

		// Display Duration groups are groups of two or more Parts, where some of them have an
		// expectedDuration and some have 0.
		// Then, some of them will have a displayDuration. The expectedDurations are pooled together, the parts with
		// display durations will take up that much time in the Rundown. The left-over time from the display duration group
		// will be used by Parts without expectedDurations.
		let displayDurationFromGroup = 0
		let memberOfDisplayDurationGroup = false
		// using a separate displayDurationGroup processing flag simplifies implementation
		const displayDurationGroup = partInstance.part.displayDurationGroup
		if (
			displayDurationGroup &&
			// either this is not the first element of the displayDurationGroup
			(this.#displayDurationGroups[displayDurationGroup] !== undefined ||
				// or there is a following member of this displayDurationGroup
				nextPartInstance?.part.displayDurationGroup === displayDurationGroup) &&
			!partInstance.part.floated &&
			!partIsUntimed
		) {
			this.#displayDurationGroups[displayDurationGroup] =
				(this.#displayDurationGroups[displayDurationGroup] || 0) +
				(calculatePartInstanceExpectedDurationWithTransition(partInstance) || 0)
			displayDurationFromGroup =
				partInstance.part.displayDuration ||
				Math.max(
					0,
					this.#displayDurationGroups[displayDurationGroup],
					partInstance.part.gap ? MINIMAL_NONZERO_DURATION : defaultDuration
				)
			partExpectedDuration = partExpectedDuration || this.#displayDurationGroups[displayDurationGroup] || 0
			memberOfDisplayDurationGroup = true
		}

		// This is where we actually calculate all the various variants of duration of a part
		let partDuration: number
		let partDurationNoPlayback: number
		let partDisplayDuration: number
		let partDisplayDurationNoPlayback: number
		let partPlayed: number
		let recordedDuration: number | undefined
		if (lastStartedPlayback && !partInstance.timings?.duration) {
			// if duration isn't available, check if `plannedStoppedPlayback` has already been set and use the difference
			// between startedPlayback and plannedStoppedPlayback as the duration
			recordedDuration =
				partInstance.timings?.duration ||
				(partInstance.timings?.plannedStoppedPlayback
					? lastStartedPlayback - partInstance.timings?.plannedStoppedPlayback
					: undefined)
			// the as-planned duration this part grows away from once it overruns
			partDurationNoPlayback =
				(recordedDuration || calculatePartInstanceExpectedDurationWithTransition(partInstance) || 0) -
				playOffset
			partDuration = Math.max(partDurationNoPlayback + playOffset, now - lastStartedPlayback) - playOffset
			// because displayDurationGroups have no actual timing on them, we need to have a copy of the
			// partDisplayDuration, but calculated as if it's not playing, so that the countdown can be
			// calculated
			partDisplayDurationNoPlayback =
				recordedDuration ||
				(memberOfDisplayDurationGroup
					? displayDurationFromGroup
					: calculatePartInstanceExpectedDurationWithTransition(partInstance)) ||
				defaultDuration
			partDisplayDuration = Math.max(partDisplayDurationNoPlayback, now - lastStartedPlayback)
			partPlayed = now - lastStartedPlayback
		} else {
			recordedDuration = undefined
			partDuration =
				(partInstance.timings?.duration ||
					calculatePartInstanceExpectedDurationWithTransition(partInstance) ||
					0) - playOffset
			partDurationNoPlayback = partDuration
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
			partPlayed = (partInstance.timings?.duration || 0) - playOffset
		}

		return {
			expectedDuration: partExpectedDuration,
			duration: partDuration,
			durationNoPlayback: partDurationNoPlayback,
			displayDuration: partDisplayDuration,
			displayDurationNoPlayback: partDisplayDurationNoPlayback,
			played: partPlayed,
			recordedDuration,
			memberOfDisplayDurationGroup,
			displayDurationFromGroup,
		}
	}

	/**
	 * Remove what a Part ended up taking from its display-duration group's pool, leaving the rest for
	 * the Parts that follow it in the group.
	 *
	 * This is separate from {@link resolve} because the caller may override the display duration
	 * between the two - an invalid Part takes the default duration from the pool, not the duration it
	 * resolved to.
	 *
	 * @param partDisplayDuration the display duration the Part ended up with, after any overrides
	 * @param partCounts whether the Part counts towards the timing at all
	 */
	takeFromDisplayDurationGroup(
		partInstance: CalculateTimingsPartInstance,
		resolved: ResolvedPartDurations,
		partDisplayDuration: number,
		partCounts: boolean
	): void {
		const displayDurationGroup = partInstance.part.displayDurationGroup
		if (
			resolved.memberOfDisplayDurationGroup &&
			displayDurationGroup &&
			!partInstance.part.floated &&
			!partInstance.part.invalid &&
			!partInstance.part.untimed &&
			(partInstance.timings?.duration || partInstance.timings?.plannedStoppedPlayback || partCounts)
		) {
			this.#displayDurationGroups[displayDurationGroup] =
				this.#displayDurationGroups[displayDurationGroup] - partDisplayDuration
		}
	}
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
