import {
	type DBRundownPlaylist,
	QuickLoopMarkerType,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { PartId, RundownPlaylistActivationId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { ForceQuickLoopAutoNext } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import { CountdownType, PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { wrapPartToTemporaryInstance } from '@sofie-automation/corelib/dist/playout/stateCacheResolver'
import { offsetTimerState, timerStateToDuration } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import { RundownTimingCalculator, findPartInstancesInQuickLoop, type RundownTimingContext } from '../index'

/**
 * Every part's countdown is the playlist's base for the part countdowns shifted by the part's own offset. These tests
 * pin which offsets a playout event changes, since each changed offset is a part document sent to every subscriber.
 *
 * The rundown is three segments, A, B and C, of four 10 s parts each: A1 to A4, B1 to B4 and C1 to C4.
 */

const RUNDOWN_ID = 'rundown0'
const PART_LENGTH = 10000
/** How long after a take a single playout gateway confirms the start */
const CONFIRMATION_DELAY = 120
/** How far ahead of a take multi-gateway mode plans the start */
const MULTI_GATEWAY_LATENCY = 2000
const DEFAULT_DURATION = 0

const SEGMENT_KEYS = ['A', 'B', 'C'] as const
type SegmentKey = (typeof SEGMENT_KEYS)[number]

interface ShowOptions {
	/** The budget of a segment, which then counts down its budget */
	budgets?: Partial<Record<SegmentKey, number>>
	/** Changes to a part, by its key: 'A2' */
	parts?: Record<string, Partial<DBPart>>
}

interface Show {
	playlist: DBRundownPlaylist
	segmentsMap: Map<SegmentId, DBSegment>
	partInstances: PartInstance[]
}

function makeShow(options: ShowOptions = {}): Show {
	const segmentsMap = new Map<SegmentId, DBSegment>()
	const parts: DBPart[] = []
	for (const [segmentRank, segmentKey] of SEGMENT_KEYS.entries()) {
		const segmentId = protectString<SegmentId>(segmentKey)
		const budgetDuration = options.budgets?.[segmentKey]
		segmentsMap.set(
			segmentId,
			literal<DBSegment>({
				_id: segmentId,
				name: segmentKey,
				externalId: segmentKey,
				_rank: segmentRank,
				rundownId: protectString(RUNDOWN_ID),
				segmentTiming:
					budgetDuration === undefined
						? undefined
						: { budgetDuration, countdownType: CountdownType.SEGMENT_BUDGET_DURATION },
			})
		)
		for (let partRank = 0; partRank < 4; partRank++) {
			const partKey = `${segmentKey}${partRank + 1}`
			const partChanges = options.parts?.[partKey]
			// no pieces, so no transition changes the length
			const expectedDuration = partChanges?.expectedDuration ?? PART_LENGTH
			parts.push(
				literal<DBPart>({
					_id: protectString(partKey),
					externalId: partKey,
					title: partKey,
					segmentId,
					_rank: partRank,
					rundownId: protectString(RUNDOWN_ID),
					...partChanges,
					expectedDuration,
					expectedDurationWithTransition: expectedDuration,
				})
			)
		}
	}

	const playlist = literal<DBRundownPlaylist>({
		_id: protectString('playlist0'),
		externalId: 'playlist0',
		studioId: protectString('studio0'),
		name: 'Playlist',
		created: 0,
		modified: 0,
		activationId: protectString<RundownPlaylistActivationId>('activation0'),
		defaultBrandingId: null,
		currentPartInfo: null,
		nextPartInfo: null,
		previousPartsInfo: [],
		timing: { type: PlaylistTimingType.None },
		rundownIdsInOrder: [protectString(RUNDOWN_ID)],
		tTimers: [
			{ index: 1, label: '', mode: null, state: null },
			{ index: 2, label: '', mode: null, state: null },
			{ index: 3, label: '', mode: null, state: null },
		],
	})

	// Every part is given a PartInstance of its own, so that playout can be written on it
	const partInstances = parts.map((part) => {
		const partInstance = wrapPartToTemporaryInstance(protectString('activation0'), part)
		return { ...partInstance, _id: protectString(`${part._id}_instance`), isTemporary: false }
	})

	return { playlist, segmentsMap, partInstances }
}

function partInstanceOf(show: Show, partKey: string): PartInstance {
	const partInstance = show.partInstances.find((candidate) => candidate.part._id === protectString(partKey))
	if (!partInstance) throw new Error(`No PartInstance of part ${partKey}`)
	return partInstance
}

function selected(partInstance: PartInstance): DBRundownPlaylist['currentPartInfo'] {
	return {
		partInstanceId: partInstance._id,
		rundownId: partInstance.rundownId,
		manuallySelected: false,
		consumesQueuedSegmentId: false,
	}
}

/** The part after this one in the playout order, if any */
function partAfter(show: Show, partInstance: PartInstance): PartInstance | undefined {
	return show.partInstances[show.partInstances.indexOf(partInstance) + 1]
}

/**
 * The part is on air and has started at `start`, as confirmed; the parts before it played back to back for their
 * planned lengths, up to that start, and the part after it is next
 */
function onAirSince(partKey: string, start: number, show: Show): Show {
	const result = structuredClone(show)
	const onAir = partInstanceOf(result, partKey)
	const onAirIndex = result.partInstances.indexOf(onAir)

	let partStart = start
	for (let index = onAirIndex - 1; index >= 0; index--) {
		const played = result.partInstances[index]
		const playedLength = played.part.expectedDuration ?? 0
		partStart -= playedLength
		played.timings = {
			take: partStart,
			plannedStartedPlayback: partStart,
			plannedStoppedPlayback: partStart + playedLength,
			duration: playedLength,
		}
	}
	onAir.timings = { take: start, plannedStartedPlayback: start }

	result.playlist.currentPartInfo = selected(onAir)
	const next = partAfter(result, onAir)
	result.playlist.nextPartInfo = next ? selected(next) : null
	return result
}

/** A take of the next part with one playout gateway: until the gateway confirms the start, the part before it plays on */
function takenAt(takeTime: number, show: Show): Show {
	const result = structuredClone(show)
	const takenId = result.playlist.nextPartInfo?.partInstanceId
	const taken = result.partInstances.find((partInstance) => partInstance._id === takenId)
	if (!taken) throw new Error('There is no next part to take')

	taken.timings = { take: takeTime }
	result.playlist.currentPartInfo = selected(taken)
	const next = partAfter(result, taken)
	result.playlist.nextPartInfo = next ? selected(next) : null
	return result
}

/** The on-air part, and the part before it in the playout order */
function takenAndPrevious(show: Show): { taken: PartInstance; previous: PartInstance } {
	const taken = show.partInstances.find(
		(partInstance) => partInstance._id === show.playlist.currentPartInfo?.partInstanceId
	)
	if (!taken) throw new Error('There is no taken part')
	const previous = show.partInstances[show.partInstances.indexOf(taken) - 1]
	if (!previous) throw new Error('The taken part is the first part')
	return { taken, previous }
}

/** The playout gateway confirms the start of the taken part: the part before it stops there */
function confirmedAt(time: number, show: Show): Show {
	const result = structuredClone(show)
	const { taken, previous } = takenAndPrevious(result)

	taken.timings = { ...taken.timings, plannedStartedPlayback: time }
	const previousStart = previous.timings?.plannedStartedPlayback ?? time
	previous.timings = { ...previous.timings, plannedStoppedPlayback: time, duration: time - previousStart }
	return result
}

/**
 * A take of the next part in multi-gateway mode: the take plans its start a moment ahead, and the stop of the part
 * before it there
 */
function takenInMultiGatewayModeAt(takeTime: number, show: Show): Show {
	const result = takenAt(takeTime, show)
	const plannedStart = takeTime + MULTI_GATEWAY_LATENCY
	const { taken, previous } = takenAndPrevious(result)

	taken.timings = { ...taken.timings, plannedStartedPlayback: plannedStart }
	const previousStart = previous.timings?.plannedStartedPlayback ?? plannedStart
	previous.timings = {
		...previous.timings,
		plannedStoppedPlayback: plannedStart,
		duration: plannedStart - previousStart,
	}
	return result
}

/** Parts that were never played, as a set-next past them leaves them: Parts without a PartInstance */
function notPlayed(partKeys: string[], show: Show): Show {
	const result = structuredClone(show)
	result.partInstances = result.partInstances.map((partInstance) =>
		partKeys.includes(String(partInstance.part._id))
			? wrapPartToTemporaryInstance(protectString('activation0'), partInstance.part)
			: partInstance
	)
	return result
}

/** A part's planned length changed by an edit */
function lengthened(partKey: string, by: number, show: Show): Show {
	const result = structuredClone(show)
	const partInstance = partInstanceOf(result, partKey)
	const expectedDuration = (partInstance.part.expectedDuration ?? 0) + by
	partInstance.part = { ...partInstance.part, expectedDuration, expectedDurationWithTransition: expectedDuration }
	return result
}

function calculate(show: Show, now: number): RundownTimingContext {
	return new RundownTimingCalculator().updateDurations(
		now,
		false,
		show.playlist,
		show.partInstances,
		show.segmentsMap,
		DEFAULT_DURATION,
		findPartInstancesInQuickLoop(show.playlist, show.partInstances)
	)
}

function offsetsAt(show: Show, now: number): Record<string, number | null> {
	return calculate(show, now).partCountdownOffsets ?? {}
}

/**
 * The parts whose offset differs between the two, with how much it moved: 'B2 -5000', or 'A3 -100000 -> none' when it
 * has none any more
 */
function offsetChanges(before: Record<string, number | null>, after: Record<string, number | null>): string[] {
	const describe = (offset: number | null | undefined) => (typeof offset === 'number' ? String(offset) : 'none')
	return Object.keys({ ...before, ...after })
		.filter((partId) => before[partId] !== after[partId])
		.map((partId) => {
			const offsetBefore = before[partId]
			const offsetAfter = after[partId]
			const isMove = typeof offsetBefore === 'number' && typeof offsetAfter === 'number'
			return isMove
				? `${partId} ${offsetAfter - offsetBefore > 0 ? '+' : ''}${offsetAfter - offsetBefore}`
				: `${partId} ${describe(offsetBefore)} -> ${describe(offsetAfter)}`
		})
}

const SHOW_START = 100000

describe('part countdown offsets', () => {
	it("give each part's countdown, at every instant, as the calculator works it out", () => {
		const atTheTake = takenAt(SHOW_START + 15000, onAirSince('A2', SHOW_START, makeShow()))
		const published = calculate(atTheTake, SHOW_START + 15000)

		for (const now of [SHOW_START + 15000, SHOW_START + 15100, SHOW_START + 60000]) {
			const countdowns = Object.fromEntries(
				Object.entries<number | null>(published.partCountdownOffsets ?? {}).map(([partId, offset]) => [
					partId,
					offset === null
						? null
						: timerStateToDuration(offsetTimerState(published.partCountdownBase, offset), now),
				])
			)
			expect({ now, countdowns }).toEqual({ now, countdowns: calculate(atTheTake, now).partCountdown })
		}
	})

	describe('with one playout gateway', () => {
		const onAir = onAirSince('A2', SHOW_START, makeShow())
		const take = SHOW_START + 15000
		const taken = takenAt(take, onAir)
		const confirmed = confirmedAt(take + CONFIRMATION_DELAY, taken)

		it('a take within a segment changes only the offset of the part it takes, which has none any more', () => {
			expect(offsetChanges(offsetsAt(onAir, take), offsetsAt(taken, take))).toEqual(['A3 -100000 -> none'])
		})

		it('its playback confirmation changes no offset', () => {
			expect(offsetChanges(offsetsAt(taken, take), offsetsAt(confirmed, take + CONFIRMATION_DELAY))).toEqual([])
		})

		it('the clock changes no offset, also once the on-air part overruns', () => {
			const confirmation = take + CONFIRMATION_DELAY
			expect(
				offsetChanges(offsetsAt(confirmed, confirmation), offsetsAt(confirmed, confirmation + 60000))
			).toEqual([])
		})

		it('a take into the next segment changes only the offset of the part it takes', () => {
			const onAirLastOfA = onAirSince('A4', SHOW_START, makeShow())
			const takenFirstOfB = takenAt(take, onAirLastOfA)

			expect(offsetChanges(offsetsAt(onAirLastOfA, take), offsetsAt(takenFirstOfB, take))).toEqual([
				'B1 -80000 -> none',
			])
			expect(
				offsetChanges(
					offsetsAt(takenFirstOfB, take),
					offsetsAt(confirmedAt(take + CONFIRMATION_DELAY, takenFirstOfB), take + CONFIRMATION_DELAY)
				)
			).toEqual([])
		})

		it('in multi-gateway mode, a take changes only the offset of the part it takes, and its start none', () => {
			const takenInMultiGatewayMode = takenInMultiGatewayModeAt(take, onAir)

			expect(offsetChanges(offsetsAt(onAir, take), offsetsAt(takenInMultiGatewayMode, take))).toEqual([
				'A3 -100000 -> none',
			])
			expect(
				offsetChanges(
					offsetsAt(takenInMultiGatewayMode, take),
					offsetsAt(takenInMultiGatewayMode, take + MULTI_GATEWAY_LATENCY + 1000)
				)
			).toEqual([])
		})

		it('with nothing next, every part counts from the end, so the take of the last part and its confirmation change them all', () => {
			const onAirC3 = onAirSince('C3', SHOW_START, makeShow())
			const takenLast = takenAt(take, onAirC3)
			const confirmation = take + CONFIRMATION_DELAY

			// every part but the last now has an offset, counted from the first part
			expect(offsetChanges(offsetsAt(onAirC3, take), offsetsAt(takenLast, take))).toEqual([
				'A1 none -> -120000',
				'A2 none -> -110000',
				'A3 none -> -100000',
				'A4 none -> -90000',
				'B1 none -> -80000',
				'B2 none -> -70000',
				'B3 none -> -60000',
				'B4 none -> -50000',
				'C1 none -> -40000',
				'C2 none -> -30000',
				'C3 none -> -20000',
			])
			// C3 played 15.12 s, not its planned 10 s, which every offset before C4 counts
			expect(
				offsetChanges(offsetsAt(takenLast, take), offsetsAt(confirmedAt(confirmation, takenLast), confirmation))
			).toEqual([
				'A1 -5120',
				'A2 -5120',
				'A3 -5120',
				'A4 -5120',
				'B1 -5120',
				'B2 -5120',
				'B3 -5120',
				'B4 -5120',
				'C1 -5120',
				'C2 -5120',
				'C3 -5120',
			])
		})

		it('an edit of a later part moves the offsets from Next up to that part by as much, and no others', () => {
			const edited = lengthened('B2', 5000, confirmed)
			const now = take + 1000

			expect(offsetChanges(offsetsAt(confirmed, now), offsetsAt(edited, now))).toEqual([
				'A4 -5000',
				'B1 -5000',
				'B2 -5000',
			])
		})
	})

	describe('with a segment budget', () => {
		const budgetedB = makeShow({ budgets: { B: 30000 } })
		const take = SHOW_START + 15000

		it('a take within the segment changes only the offset of the part it takes, at the take and at the confirmation', () => {
			const onAir = onAirSince('B1', SHOW_START, budgetedB)
			const taken = takenAt(take, onAir)
			const confirmed = confirmedAt(take + CONFIRMATION_DELAY, taken)

			expect(offsetChanges(offsetsAt(onAir, take), offsetsAt(taken, take))).toEqual(['B2 -40000 -> none'])
			expect(offsetChanges(offsetsAt(taken, take), offsetsAt(confirmed, take + CONFIRMATION_DELAY))).toEqual([])
		})

		it('a take into the segment changes the offsets of its parts after Next once, at the confirmation', () => {
			const onAir = onAirSince('A4', SHOW_START, budgetedB)
			const taken = takenAt(take, onAir)
			const confirmed = confirmedAt(take + CONFIRMATION_DELAY, taken)

			expect(offsetChanges(offsetsAt(onAir, take), offsetsAt(taken, take))).toEqual(['B1 -70000 -> none'])
			// Until the start of B1 is confirmed, the parts of B wait for what is left of the budget after the parts
			// before them. From the start on, the budget counts down by itself, and they wait for none of it; B4
			// already waited for none
			expect(offsetChanges(offsetsAt(taken, take), offsetsAt(confirmed, take + CONFIRMATION_DELAY))).toEqual([
				'B2 +20000',
				'B3 +10000',
			])
		})

		it('in multi-gateway mode, a take within the segment changes the offsets of the parts left in it, and again once the start passes', () => {
			const onAir = onAirSince('B1', SHOW_START, budgetedB)
			const taken = takenInMultiGatewayModeAt(take, onAir)
			const plannedStart = take + MULTI_GATEWAY_LATENCY

			// The take gives B1 its played length, 17 s of the 30 s budget, and B2 has not started, so the budget
			// stops counting down by itself: B2 waits 10 s of it, and B3 the 3 s left. Once B2 starts, the budget
			// counts down by itself again
			expect(offsetChanges(offsetsAt(onAir, take), offsetsAt(taken, take))).toEqual([
				'B2 -40000 -> none',
				'B3 -3000',
			])
			expect(offsetChanges(offsetsAt(taken, take), offsetsAt(taken, plannedStart))).toEqual(['B3 +3000'])
		})
	})

	describe('in a display-duration group', () => {
		// A1 brings 30 s to the group and is drawn for 10 s, A2 is drawn for 10 s, and A3 has what is left
		const grouped = makeShow({
			parts: {
				A1: { displayDurationGroup: 'group', displayDuration: 10000, expectedDuration: 30000 },
				A2: { displayDurationGroup: 'group', displayDuration: 10000, expectedDuration: 0 },
				A3: { displayDurationGroup: 'group', expectedDuration: 0 },
			},
		})
		const take = SHOW_START + 5000
		const onAir = onAirSince('A1', SHOW_START, grouped)
		const taken = takenAt(take, onAir)

		it('a take changes the offsets of the later members, as the part before it stops counting towards the group', () => {
			// A1 no longer counts, and has no played length yet, so it takes nothing from the group: A3 has 10 s more
			expect(offsetChanges(offsetsAt(onAir, take), offsetsAt(taken, take))).toEqual([
				'A2 -110000 -> none',
				'A3 -10000',
			])
		})

		it('its confirmation changes them again, as the part before it takes its played length from the group', () => {
			const confirmation = take + CONFIRMATION_DELAY
			expect(
				offsetChanges(offsetsAt(taken, take), offsetsAt(confirmedAt(confirmation, taken), confirmation))
			).toEqual(['A3 +5120'])
		})

		it('the clock changes them while the on-air member overruns, as it takes more from the group', () => {
			// A1 has run 30 s, which takes the whole group: A3 has nothing left, and A2 no longer waits for it
			expect(offsetChanges(offsetsAt(onAir, SHOW_START + 1000), offsetsAt(onAir, SHOW_START + 30000))).toEqual([
				'A2 +10000',
				'A3 +10000',
			])
		})
	})

	describe('with a loop that is defined but not running', () => {
		// A3 and A4 are in the loop, and were skipped: B1 was set as next after A2
		const looped = makeShow()
		looped.playlist.quickLoop = {
			start: { type: QuickLoopMarkerType.PART, id: protectString<PartId>('A3') },
			end: { type: QuickLoopMarkerType.PART, id: protectString<PartId>('A4') },
			locked: false,
			running: false,
			forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
		}
		const take = SHOW_START + 15000
		const onAir = notPlayed(['A3', 'A4'], onAirSince('B1', SHOW_START, looped))
		const taken = takenAt(take, onAir)

		it("a take moves the offsets of the loop's parts behind Next, which count from Next", () => {
			expect(offsetChanges(offsetsAt(onAir, take), offsetsAt(taken, take))).toEqual([
				'A3 +10000',
				'A4 +10000',
				'B2 -70000 -> none',
			])
		})

		it('its confirmation does not', () => {
			const confirmation = take + CONFIRMATION_DELAY
			expect(
				offsetChanges(offsetsAt(taken, take), offsetsAt(confirmedAt(confirmation, taken), confirmation))
			).toEqual([])
		})
	})
})
