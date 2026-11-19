import {
	type DBRundownPlaylist,
	QuickLoopMarkerType,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { ForceQuickLoopAutoNext } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'

import { literal } from '@sofie-automation/corelib/dist/lib'
import { unprotectString, protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { RundownTimingCalculator, type RundownTimingContext, findPartInstancesInQuickLoop } from '../index'
import { getPlaylistTimingDiff } from '../playlistTimingState'
import {
	offsetTimerState,
	timerStateToDuration,
	type TimerState,
} from '@sofie-automation/corelib/dist/dataModel/TimerState'
import { PlaylistTimingType, type SegmentTimingInfo } from '@sofie-automation/blueprints-integration'
import type { PartId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { wrapPartToTemporaryInstance } from '@sofie-automation/corelib/dist/playout/stateCacheResolver'

const DEFAULT_DURATION = 0
const DEFAULT_NONZERO_DURATION = 4000

function makeMockPlaylist(): DBRundownPlaylist {
	return literal<DBRundownPlaylist>({
		_id: protectString('mock-playlist'),
		externalId: 'mock-playlist',
		studioId: protectString('studio0'),
		name: 'Mock Playlist',
		created: 0,
		modified: 0,
		defaultBrandingId: null,
		currentPartInfo: null,
		nextPartInfo: null,
		previousPartsInfo: [],
		timing: {
			type: PlaylistTimingType.None,
		},
		rundownIdsInOrder: [],

		tTimers: [
			{ index: 1, label: '', mode: null, state: null },
			{ index: 2, label: '', mode: null, state: null },
			{ index: 3, label: '', mode: null, state: null },
		],
	})
}

function makeMockPart(
	id: string,
	rank: number,
	rundownId: string,
	segmentId: string,
	durations: Pick<DBPart, 'displayDuration' | 'displayDurationGroup' | 'expectedDuration'>
): DBPart {
	return literal<DBPart>({
		_id: protectString(id),
		externalId: id,
		title: '',
		segmentId: protectString(segmentId),
		_rank: rank,
		rundownId: protectString(rundownId),
		...durations,
		expectedDurationWithTransition: durations.expectedDuration,
	})
}

function makeMockSegment(id: string, rank: number, rundownId: string, timing?: SegmentTimingInfo): DBSegment {
	return literal<DBSegment>({
		_id: protectString(id),
		name: 'mock-segment',
		externalId: id,
		_rank: rank,
		rundownId: protectString(rundownId),
		segmentTiming: timing,
	})
}

function convertPartsToPartInstances(parts: DBPart[]): PartInstance[] {
	return parts.map((part) => wrapPartToTemporaryInstance(protectString(''), part))
}

function getInstanceOrThrow(partInstancesMap: Map<PartId, PartInstance>, part: DBPart): PartInstance {
	const instance = partInstancesMap.get(part._id)
	if (!instance) throw new Error(`PartInstance not found for Part "${part._id}"`)
	return instance
}

/** What the tests below pin of a RundownTimingContext: the timer the part countdowns are shifts of is checked by itself */
type ExpectedTimingContext = Omit<RundownTimingContext, 'partCountdownBase'>

/**
 * Assert a full RundownTimingContext against an expected literal.
 *
 * The context carries several values twice: as a number, and as the TimerState the number is an
 * evaluation of. The tests below pin the numbers - those are the values that were verified against
 * the original client behaviour - so rather than restating each state as a literal, the states are
 * checked against their own numbers here. That is the property that has to hold anyway, and it
 * keeps the expectations readable.
 */
function expectContextToEqual(result: RundownTimingContext, expected: ExpectedTimingContext): void {
	const now = expected.currentTime ?? 0

	const {
		remainingPlaylistDurationState,
		remainingTimeOnCurrentPartState,
		remainingBudgetOnCurrentSegmentState,
		partCountdownBase,
		partCountdownOffsets,
		// These two exist for the publication rather than for any of these scenarios' expectations.
		// They are checked exhaustively against this same calculator in partTimingState.test.ts, so
		// listing them in every expectation below would be churn without added coverage.
		partDisplayDurationsNoPlayback,
		partDurationsNoPlayback,
		partCountsTowardsTiming,
		...numericResult
	} = result

	expect(numericResult).toEqual(expected)

	// they must however describe exactly the same set of parts as the rest
	expect(Object.keys(partDisplayDurationsNoPlayback ?? {})).toEqual(Object.keys(expected.partDisplayDurations ?? {}))
	expect(Object.keys(partDurationsNoPlayback ?? {})).toEqual(Object.keys(expected.partDisplayDurations ?? {}))
	expect(Object.keys(partCountsTowardsTiming ?? {})).toEqual(Object.keys(expected.partDisplayDurations ?? {}))

	const evaluate = (state: TimerState | undefined) => (state ? timerStateToDuration(state, now) : undefined)
	expect(evaluate(remainingPlaylistDurationState)).toBe(expected.remainingPlaylistDuration ?? 0)
	expect(evaluate(remainingTimeOnCurrentPartState)).toBe(expected.remainingTimeOnCurrentPart)
	expect(evaluate(remainingBudgetOnCurrentSegmentState)).toBe(expected.remainingBudgetOnCurrentSegment)

	// The published countdowns - the base shifted by each part's offset - must agree with the numbers the
	// calculator reports, for every part, in every one of these scenarios - that is what makes them the same
	// implementation rather than a second one that happens to look right
	expect(
		Object.fromEntries(
			Object.entries<number | null>(partCountdownOffsets ?? {}).map(([partId, offset]) => [
				partId,
				offset === null ? null : timerStateToDuration(offsetTimerState(partCountdownBase, offset), now),
			])
		)
	).toEqual(expected.partCountdown ?? {})
}

function makeMockPartsForQuickLoopTest() {
	const rundownId = 'rundown1'
	const segmentId1 = 'segment1'
	const segmentId2 = 'segment2'
	const segmentsMap: Map<SegmentId, DBSegment> = new Map()
	segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId))
	segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
	const parts: DBPart[] = []
	parts.push(makeMockPart('part1', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
	parts.push(makeMockPart('part2', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
	parts.push(makeMockPart('part3', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
	parts.push(makeMockPart('part4', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
	parts.push(makeMockPart('part5', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
	const partInstances = convertPartsToPartInstances(parts)
	return { parts, partInstances }
}

describe('rundown Timing Calculator', () => {
	it('Provides output for empty playlist', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		const partInstances: PartInstance[] = []
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		const result = timing.updateDurations(0, false, playlist, partInstances, segmentsMap, DEFAULT_DURATION, {})
		expectContextToEqual(
			result,
			literal<ExpectedTimingContext>({
				currentPartInstanceId: null,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 0,
				asPlayedPlaylistDuration: 0,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {},
				rundownAsPlayedDurations: {},
				partCountdown: {},
				partDisplayDurations: {},
				partDisplayStartsAt: {},
				partDurations: {},
				partExpectedDurations: {},
				partPlayed: {},
				partStartsAt: {},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 0,
				totalPlaylistDuration: 0,
				remainingTimeOnCurrentPart: undefined,
			})
		)
	})

	it('Calculates time for unplayed playlist with start time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedDuration: 40000,
		}
		const rundownId = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId))
		segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
		const parts: DBPart[] = []
		parts.push(makeMockPart('part1', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part2', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part3', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part4', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		const partInstances = convertPartsToPartInstances(parts)
		const result = timing.updateDurations(0, false, playlist, partInstances, segmentsMap, DEFAULT_DURATION, {})
		expectContextToEqual(
			result,
			literal<ExpectedTimingContext>({
				currentPartInstanceId: null,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {
					[rundownId]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId]: 4000,
				},
				partCountdown: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 0,
					part2: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 4000,
				totalPlaylistDuration: 4000,
				remainingTimeOnCurrentPart: undefined,
			})
		)
	})

	it('Calculates time for unplayed playlist with end time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedDuration: 40000,
		}
		const rundownId = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId))
		segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
		const parts: DBPart[] = []
		parts.push(makeMockPart('part1', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part2', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part3', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part4', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		const partInstances = convertPartsToPartInstances(parts)
		const result = timing.updateDurations(0, false, playlist, partInstances, segmentsMap, DEFAULT_DURATION, {})
		expectContextToEqual(
			result,
			literal<ExpectedTimingContext>({
				currentPartInstanceId: null,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {
					[rundownId]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId]: 4000,
				},
				partCountdown: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 0,
					part2: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 4000,
				totalPlaylistDuration: 4000,
				remainingTimeOnCurrentPart: undefined,
			})
		)
	})

	it('Produces timing per rundown with start time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedDuration: 40000,
		}
		const rundownId1 = 'rundown1'
		const rundownId2 = 'rundown2'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId1))
		segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId2))
		const parts: DBPart[] = []
		parts.push(makeMockPart('part1', 0, rundownId1, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part2', 0, rundownId1, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part3', 0, rundownId2, segmentId2, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part4', 0, rundownId2, segmentId2, { expectedDuration: 1000 }))
		const partInstances = convertPartsToPartInstances(parts)
		const result = timing.updateDurations(0, false, playlist, partInstances, segmentsMap, DEFAULT_DURATION, {})
		expectContextToEqual(
			result,
			literal<ExpectedTimingContext>({
				currentPartInstanceId: null,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {
					[rundownId1]: 2000,
					[rundownId2]: 2000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 2000,
					[rundownId2]: 2000,
				},
				partCountdown: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 0,
					part2: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 4000,
				totalPlaylistDuration: 4000,
				remainingTimeOnCurrentPart: undefined,
			})
		)
	})

	describe('Display duration groups', () => {
		it('Handles groups when not playing', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedDuration: 40000,
			}
			const rundownId1 = 'rundown1'
			const segmentId1 = 'segment1'
			const segmentId2 = 'segment2'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId1))
			segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId1))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('part1', 0, rundownId1, segmentId1, {
					expectedDuration: 1000,
					displayDuration: 2000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part2', 0, rundownId1, segmentId1, {
					expectedDuration: 1000,
					displayDuration: 3000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part3', 0, rundownId1, segmentId2, {
					expectedDuration: 1000,
					displayDuration: 4000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part4', 0, rundownId1, segmentId2, {
					expectedDuration: 1000,
					displayDuration: 5000,
					displayDurationGroup: 'test',
				})
			)
			const partInstances = convertPartsToPartInstances(parts)
			const result = timing.updateDurations(0, false, playlist, partInstances, segmentsMap, DEFAULT_DURATION, {})
			expectContextToEqual(
				result,
				literal<ExpectedTimingContext>({
					currentPartInstanceId: null,
					isLowResolution: false,
					asDisplayedPlaylistDuration: 4000,
					asPlayedPlaylistDuration: 4000,
					currentPartWillAutoNext: false,
					currentTime: 0,
					rundownExpectedDurations: {
						[rundownId1]: 4000,
					},
					rundownAsPlayedDurations: {
						[rundownId1]: 4000,
					},
					partCountdown: {
						part1: 0,
						part2: 2000,
						part3: 5000,
						part4: 9000,
					},
					partDisplayDurations: {
						part1: 2000,
						part2: 3000,
						part3: 4000,
						part4: 5000,
					},
					partDisplayStartsAt: {
						part1: 0,
						part2: 2000,
						part3: 5000,
						part4: 9000,
					},
					partDurations: {
						part1: 1000,
						part2: 1000,
						part3: 1000,
						part4: 1000,
					},
					partExpectedDurations: {
						part1: 1000,
						part2: 1000,
						part3: 1000,
						part4: 1000,
					},
					partPlayed: {
						part1: 0,
						part2: 0,
						part3: 0,
						part4: 0,
					},
					partStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 2000,
						part4: 3000,
					},
					partsInQuickLoop: {},
					remainingPlaylistDuration: 4000,
					totalPlaylistDuration: 4000,
					remainingTimeOnCurrentPart: undefined,
				})
			)
		})

		it('Handles groups when playing', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedDuration: 40000,
			}
			const rundownId1 = 'rundown1'
			const segmentId1 = 'segment1'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId1))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('part1', 0, rundownId1, segmentId1, {
					expectedDuration: 1000,
				})
			)
			parts.push(
				makeMockPart('part2', 0, rundownId1, segmentId1, {
					expectedDuration: 5000,
					displayDuration: 1000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part3', 0, rundownId1, segmentId1, {
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part4', 0, rundownId1, segmentId1, {
					expectedDuration: 1000,
				})
			)
			const partInstancesMap: Map<PartId, PartInstance> = new Map(
				parts.map((part) => {
					return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
				})
			)
			const partInstances = Array.from(partInstancesMap.values())
			getInstanceOrThrow(partInstancesMap, parts[0]).timings = {
				// part1
				duration: 1000,
				take: 0,
				plannedStartedPlayback: 0,
				plannedStoppedPlayback: 1000,
			}
			getInstanceOrThrow(partInstancesMap, parts[1]).timings = {
				// part2
				duration: 2000,
				take: 1000,
				plannedStartedPlayback: 1000,
				plannedStoppedPlayback: 3000,
			}
			getInstanceOrThrow(partInstancesMap, parts[2]).timings = {
				// part3
				take: 3000,
				plannedStartedPlayback: 3000,
			}
			const currentPartInstanceId = getInstanceOrThrow(partInstancesMap, parts[2])._id
			const nextPartInstanceId = getInstanceOrThrow(partInstancesMap, parts[3])._id
			playlist.currentPartInfo = {
				partInstanceId: currentPartInstanceId,
				rundownId: protectString<RundownId>(rundownId1),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			playlist.nextPartInfo = {
				partInstanceId: nextPartInstanceId,
				rundownId: protectString<RundownId>(rundownId1),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			const result = timing.updateDurations(
				3500,
				false,
				playlist,
				partInstances,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expectContextToEqual(
				result,
				literal<ExpectedTimingContext>({
					currentPartInstanceId: currentPartInstanceId,
					isLowResolution: false,
					asDisplayedPlaylistDuration: 7000,
					asPlayedPlaylistDuration: 7000,
					currentPartWillAutoNext: false,
					currentSegmentId: protectString(segmentId1),
					currentTime: 3500,
					onAirPartPlannedStart: 3000,
					// the live part (part3) started at 3000 with a group expected duration of 3000
					livePushTime: 6000,
					rundownExpectedDurations: {
						[rundownId1]: 7000,
					},
					rundownAsPlayedDurations: {
						[rundownId1]: 7000,
					},
					partCountdown: {
						part1: null,
						part2: null,
						part3: null,
						part4: 2500,
					},
					partDisplayDurations: {
						part1: 1000,
						part2: 2000,
						part3: 3000,
						part4: 1000,
					},
					partDisplayStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 3000,
						part4: 6000,
					},
					partDurations: {
						part1: 1000,
						part2: 2000,
						part3: 500,
						part4: 1000,
					},
					partExpectedDurations: {
						part1: 1000,
						part2: 5000,
						part3: 3000,
						part4: 1000,
					},
					partPlayed: {
						part1: 1000,
						part2: 2000,
						part3: 500,
						part4: 0,
					},
					partStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 3000,
						part4: 3500,
					},
					partsInQuickLoop: {},
					remainingPlaylistDuration: 3500,
					totalPlaylistDuration: 7000,
					remainingTimeOnCurrentPart: 2500,
				})
			)
		})

		it("Handles groups when playing outside of displayDurationGroup's budget", () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedDuration: 40000,
			}
			const rundownId1 = 'rundown1'
			const segmentId1 = 'segment1'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId1))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('part1', 0, rundownId1, segmentId1, {
					expectedDuration: 1000,
				})
			)
			parts.push(
				makeMockPart('part2', 0, rundownId1, segmentId1, {
					expectedDuration: 5000,
					displayDuration: 1000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part3', 0, rundownId1, segmentId1, {
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part4', 0, rundownId1, segmentId1, {
					expectedDuration: 1000,
				})
			)
			const partInstancesMap: Map<PartId, PartInstance> = new Map(
				parts.map((part) => {
					return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
				})
			)
			const partInstances = Array.from(partInstancesMap.values())
			getInstanceOrThrow(partInstancesMap, parts[0]).timings = {
				// part1
				duration: 1000,
				take: 0,
				plannedStartedPlayback: 0,
				plannedStoppedPlayback: 1000,
			}
			getInstanceOrThrow(partInstancesMap, parts[1]).timings = {
				// part2
				duration: 2000,
				take: 1000,
				plannedStartedPlayback: 1000,
				plannedStoppedPlayback: 3000,
			}
			getInstanceOrThrow(partInstancesMap, parts[2]).timings = {
				// part3
				take: 3000,
				plannedStartedPlayback: 3000,
			}
			const currentPartInstanceId = getInstanceOrThrow(partInstancesMap, parts[2])._id
			const nextPartInstanceId = getInstanceOrThrow(partInstancesMap, parts[3])._id
			playlist.currentPartInfo = {
				partInstanceId: currentPartInstanceId,
				rundownId: protectString<RundownId>(rundownId1),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			playlist.nextPartInfo = {
				partInstanceId: nextPartInstanceId,
				rundownId: protectString<RundownId>(rundownId1),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			const result = timing.updateDurations(
				10000,
				false,
				playlist,
				partInstances,

				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expectContextToEqual(
				result,
				literal<ExpectedTimingContext>({
					currentPartInstanceId: currentPartInstanceId,
					isLowResolution: false,
					asDisplayedPlaylistDuration: 11000,
					asPlayedPlaylistDuration: 11000,
					currentPartWillAutoNext: false,
					currentSegmentId: protectString(segmentId1),
					currentTime: 10000,
					onAirPartPlannedStart: 3000,
					// the live part (part3) started at 3000 with a group expected duration of 3000,
					// and has been overrunning since 6000
					livePushTime: 6000,
					rundownExpectedDurations: {
						[rundownId1]: 7000,
					},
					rundownAsPlayedDurations: {
						[rundownId1]: 11000,
					},
					partCountdown: {
						part1: null,
						part2: null,
						part3: null,
						part4: 0,
					},
					partDisplayDurations: {
						part1: 1000,
						part2: 2000,
						part3: 7000,
						part4: 1000,
					},
					partDisplayStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 3000,
						part4: 10000,
					},
					partDurations: {
						part1: 1000,
						part2: 2000,
						part3: 7000,
						part4: 1000,
					},
					partExpectedDurations: {
						part1: 1000,
						part2: 5000,
						part3: 3000,
						part4: 1000,
					},
					partPlayed: {
						part1: 1000,
						part2: 2000,
						part3: 7000,
						part4: 0,
					},
					partStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 3000,
						part4: 10000,
					},
					partsInQuickLoop: {},
					remainingPlaylistDuration: 1000,
					totalPlaylistDuration: 7000,
					remainingTimeOnCurrentPart: -4000,
				})
			)
		})
	})

	describe('Non-zero default Part duration', () => {
		it('Calculates time for unplayed playlist with start time and duration', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedDuration: 40000,
			}
			const rundownId = 'rundown1'
			const segmentId1 = 'segment1'
			const segmentId2 = 'segment2'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId))
			segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
			const parts: DBPart[] = []
			parts.push(makeMockPart('part1', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
			parts.push(makeMockPart('part2', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
			parts.push(makeMockPart('part3', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
			parts.push(makeMockPart('part4', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
			const partInstances = convertPartsToPartInstances(parts)
			const result = timing.updateDurations(
				0,
				false,
				playlist,
				partInstances,

				segmentsMap,
				DEFAULT_NONZERO_DURATION,
				{}
			)
			expectContextToEqual(
				result,
				literal<ExpectedTimingContext>({
					currentPartInstanceId: null,
					isLowResolution: false,
					asDisplayedPlaylistDuration: 4000,
					asPlayedPlaylistDuration: 4000,
					currentPartWillAutoNext: false,
					currentTime: 0,
					rundownExpectedDurations: {
						[rundownId]: 4000,
					},
					rundownAsPlayedDurations: {
						[rundownId]: 4000,
					},
					partCountdown: {
						part1: 0,
						part2: 1000,
						part3: 2000,
						part4: 3000,
					},
					partDisplayDurations: {
						part1: 4000,
						part2: 4000,
						part3: 4000,
						part4: 4000,
					},
					partDisplayStartsAt: {
						part1: 0,
						part2: 4000,
						part3: 8000,
						part4: 12000,
					},
					partDurations: {
						part1: 1000,
						part2: 1000,
						part3: 1000,
						part4: 1000,
					},
					partExpectedDurations: {
						part1: 1000,
						part2: 1000,
						part3: 1000,
						part4: 1000,
					},
					partPlayed: {
						part1: 0,
						part2: 0,
						part3: 0,
						part4: 0,
					},
					partStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 2000,
						part4: 3000,
					},
					partsInQuickLoop: {},
					remainingPlaylistDuration: 4000,
					totalPlaylistDuration: 4000,
					remainingTimeOnCurrentPart: undefined,
				})
			)
		})

		it('Handles display duration groups', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedDuration: 40000,
			}
			const rundownId1 = 'rundown1'
			const segmentId1 = 'segment1'
			const segmentId2 = 'segment2'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId1))
			segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId1))
			const parts: DBPart[] = []
			parts.push(
				makeMockPart('part1', 0, rundownId1, segmentId1, {
					expectedDuration: 1000,
					displayDuration: 2000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part2', 0, rundownId1, segmentId1, {
					expectedDuration: 1000,
					displayDuration: 3000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part3', 0, rundownId1, segmentId2, {
					expectedDuration: 1000,
					displayDuration: 4000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part4', 0, rundownId1, segmentId2, {
					expectedDuration: 1000,
					displayDuration: 5000,
					displayDurationGroup: 'test',
				})
			)
			parts.push(
				makeMockPart('part5', 0, rundownId1, segmentId2, {
					expectedDuration: 1000,
				})
			)
			const partInstances = convertPartsToPartInstances(parts)
			const result = timing.updateDurations(
				0,
				false,
				playlist,
				partInstances,

				segmentsMap,
				DEFAULT_NONZERO_DURATION,
				{}
			)
			expectContextToEqual(
				result,
				literal<ExpectedTimingContext>({
					currentPartInstanceId: null,
					isLowResolution: false,
					asDisplayedPlaylistDuration: 5000,
					asPlayedPlaylistDuration: 5000,
					currentPartWillAutoNext: false,
					currentTime: 0,
					rundownExpectedDurations: {
						[rundownId1]: 5000,
					},
					rundownAsPlayedDurations: {
						[rundownId1]: 5000,
					},
					partCountdown: {
						part1: 0,
						part2: 2000,
						part3: 5000,
						part4: 9000,
						part5: 14000,
					},
					partDisplayDurations: {
						part1: 2000,
						part2: 3000,
						part3: 4000,
						part4: 5000,
						part5: 4000,
					},
					partDisplayStartsAt: {
						part1: 0,
						part2: 2000,
						part3: 5000,
						part4: 9000,
						part5: 14000,
					},
					partDurations: {
						part1: 1000,
						part2: 1000,
						part3: 1000,
						part4: 1000,
						part5: 1000,
					},
					partExpectedDurations: {
						part1: 1000,
						part2: 1000,
						part3: 1000,
						part4: 1000,
						part5: 1000,
					},
					partPlayed: {
						part1: 0,
						part2: 0,
						part3: 0,
						part4: 0,
						part5: 0,
					},
					partStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 2000,
						part4: 3000,
						part5: 4000,
					},
					partsInQuickLoop: {},
					remainingPlaylistDuration: 5000,
					totalPlaylistDuration: 5000,
					remainingTimeOnCurrentPart: undefined,
				})
			)
		})
	})

	it('Handles budget duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedDuration: 40000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { budgetDuration: 5000 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { budgetDuration: 3000 })
		)
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				expectedDuration: 1000,
			})
		)
		parts.push(makeMockPart('part4', 0, rundownId1, segmentId2, { expectedDuration: 1000 }))
		const partInstances = convertPartsToPartInstances(parts)
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			partInstances,

			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expectContextToEqual(
			result,
			literal<ExpectedTimingContext>({
				currentPartInstanceId: null,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 8000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 8000,
				},
				partCountdown: {
					part1: 0,
					part2: 1000,
					part3: 5000,
					part4: 6000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 0,
					part2: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 8000,
				totalPlaylistDuration: 8000,
				remainingTimeOnCurrentPart: undefined,
			})
		)
	})

	it('Handles part with autonext', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedDuration: 40000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, {
				budgetDuration: 5000,
			})
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, {
				budgetDuration: 3000,
			})
		)
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				expectedDuration: 1000,
			})
		)
		parts.push(makeMockPart('part4', 0, rundownId1, segmentId2, { expectedDuration: 1000 }))
		// set autonext and create partInstances
		parts[0].autoNext = true
		const partInstance1 = wrapPartToTemporaryInstance(protectString(''), parts[0])
		partInstance1.isTemporary = false
		partInstance1.timings = {
			plannedStartedPlayback: 0,
		}
		const partInstance2 = wrapPartToTemporaryInstance(protectString(''), parts[1])
		partInstance2.isTemporary = false
		partInstance2.timings = {
			plannedStartedPlayback: 1000, // start after part1's expectedDuration
		}
		const partInstances = [partInstance1, partInstance2, ...convertPartsToPartInstances([parts[2], parts[3]])]

		// at t = 0
		const result = timing.updateDurations(0, false, playlist, partInstances, segmentsMap, DEFAULT_DURATION, {})
		expectContextToEqual(
			result,
			literal<ExpectedTimingContext>({
				currentPartInstanceId: null,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 8000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				partsInQuickLoop: {},
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 8000,
				},
				partCountdown: {
					part1: 0,
					part2: 1000,
					part3: 5000,
					part4: 6000,
				},
				partDisplayDurations: {
					part1_tmp_instance: 1000,
					part2_tmp_instance: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1_tmp_instance: 0,
					part2_tmp_instance: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1_tmp_instance: 1000,
					part2_tmp_instance: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1_tmp_instance: 1000,
					part2_tmp_instance: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1_tmp_instance: 0,
					part2_tmp_instance: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1_tmp_instance: 0,
					part2_tmp_instance: 1000,
					part3: 2000,
					part4: 3000,
				},
				remainingPlaylistDuration: 8000,
				totalPlaylistDuration: 8000,
				remainingTimeOnCurrentPart: undefined,
			})
		)
	})

	it('Handles part with postroll', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedDuration: 40000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, {
				budgetDuration: 5000,
			})
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, {
				budgetDuration: 3000,
			})
		)
		const parts: DBPart[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				expectedDuration: 2000,
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				expectedDuration: 2000,
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				expectedDuration: 1000,
			})
		)
		parts.push(makeMockPart('part4', 0, rundownId1, segmentId2, { expectedDuration: 1000 }))
		// set autonext and create partInstances
		parts[0].autoNext = true
		const partInstance1 = wrapPartToTemporaryInstance(protectString(''), parts[0])
		partInstance1.isTemporary = false
		partInstance1.timings = {
			plannedStartedPlayback: 0,
			reportedStartedPlayback: 0,
			reportedStoppedPlayback: 2000,
		}
		partInstance1.partPlayoutTimings = {
			inTransitionStart: 0,
			toPartDelay: 0,
			toPartPostroll: 500,
			fromPartRemaining: 0,
			fromPartPostroll: 0,
			fromPartKeepalive: 0,
		}
		const partInstance2 = wrapPartToTemporaryInstance(protectString(''), parts[1])
		partInstance2.isTemporary = false
		partInstance2.timings = {
			plannedStartedPlayback: 2000, // start after part1's expectedDuration
			reportedStartedPlayback: 2000,
		}
		partInstance2.partPlayoutTimings = {
			inTransitionStart: 0,
			toPartDelay: 0,
			toPartPostroll: 0,
			fromPartRemaining: 500,
			fromPartPostroll: 500,
			fromPartKeepalive: 0,
		}
		const partInstances = [partInstance1, partInstance2, ...convertPartsToPartInstances([parts[2], parts[3]])]

		// at t = 0
		const result = timing.updateDurations(3000, false, playlist, partInstances, segmentsMap, DEFAULT_DURATION, {})
		expectContextToEqual(
			result,
			literal<ExpectedTimingContext>({
				currentPartInstanceId: null,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 6000,
				asPlayedPlaylistDuration: 8000,
				currentPartWillAutoNext: false,
				currentTime: 3000,
				partsInQuickLoop: {},
				rundownExpectedDurations: {
					[rundownId1]: 6000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 8000,
				},
				partCountdown: {
					part1: 4000,
					part2: 6000,
					part3: 6000,
					part4: 7000,
				},
				partDisplayDurations: {
					part1_tmp_instance: 2000,
					part2_tmp_instance: 2000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1_tmp_instance: 0,
					part2_tmp_instance: 2000,
					part3: 4000,
					part4: 5000,
				},
				partDurations: {
					part1_tmp_instance: 2000,
					part2_tmp_instance: 2000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1_tmp_instance: 2000,
					part2_tmp_instance: 2000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1_tmp_instance: 0,
					part2_tmp_instance: 1000,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1_tmp_instance: 0,
					part2_tmp_instance: 2000,
					part3: 4000,
					part4: 5000,
				},
				remainingPlaylistDuration: 8000,
				totalPlaylistDuration: 8000,
				remainingTimeOnCurrentPart: undefined,
			})
		)
	})

	it('Passes partsInQuickLoop', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		const rundownId = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId))
		segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
		const parts: DBPart[] = []
		parts.push(makeMockPart('part1', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part2', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part3', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part4', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		const partInstances = convertPartsToPartInstances(parts)
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			partInstances,

			segmentsMap,
			DEFAULT_DURATION,
			{
				part2: true,
				part3: true,
			}
		)
		expect(result).toMatchObject(
			literal<Partial<RundownTimingContext>>({
				partsInQuickLoop: {
					part2: true,
					part3: true,
				},
			})
		)
	})

	describe("The on-air part's planned start", () => {
		const PLANNED_START = 2000

		/** Two segments of 1 s parts, with the first part taken at 1000 and planned to start at PLANNED_START */
		function calculateWithFirstPartTaken(
			now: number,
			options: {
				firstSegmentTiming?: SegmentTimingInfo
				firstPartUntimed?: boolean
				/** When the gateway reported the first segment started, if it has */
				firstSegmentStartedAt?: number
			}
		): RundownTimingContext {
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			const rundownId = 'rundown1'
			const segmentId1 = 'segment1'
			const segmentId2 = 'segment2'
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(
				protectString<SegmentId>(segmentId1),
				makeMockSegment(segmentId1, 0, rundownId, options.firstSegmentTiming)
			)
			segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 1, rundownId))
			const parts: DBPart[] = [
				{
					...makeMockPart('part1', 0, rundownId, segmentId1, { expectedDuration: 1000 }),
					untimed: options.firstPartUntimed,
				},
				makeMockPart('part2', 1, rundownId, segmentId1, { expectedDuration: 1000 }),
				makeMockPart('part3', 0, rundownId, segmentId2, { expectedDuration: 1000 }),
			]
			const partInstances = convertPartsToPartInstances(parts)
			const [onAirPartInstance, nextPartInstance] = partInstances
			onAirPartInstance.timings = { take: 1000, plannedStartedPlayback: PLANNED_START }
			playlist.currentPartInfo = {
				partInstanceId: onAirPartInstance._id,
				rundownId: protectString<RundownId>(rundownId),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			playlist.nextPartInfo = {
				partInstanceId: nextPartInstance._id,
				rundownId: protectString<RundownId>(rundownId),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}
			if (options.firstSegmentStartedAt !== undefined) {
				playlist.segmentsStartedPlayback = {
					[unprotectString(onAirPartInstance.segmentPlayoutId)]: options.firstSegmentStartedAt,
				}
			}
			return new RundownTimingCalculator().updateDurations(
				now,
				false,
				playlist,
				partInstances,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
		}

		it('is given before the planned start, as a take in a multi-gateway studio plans it', () => {
			const result = calculateWithFirstPartTaken(1500, {})

			expect(result.onAirPartPlannedStart).toBe(PLANNED_START)
		})

		it('is given once the part has started', () => {
			const result = calculateWithFirstPartTaken(2500, { firstSegmentStartedAt: PLANNED_START })

			expect(result.onAirPartPlannedStart).toBe(PLANNED_START)
		})

		it("is not given while an untimed part is on air in a segment with a budget, though the budget's countdown drives the remaining duration", () => {
			const result = calculateWithFirstPartTaken(2500, {
				firstSegmentTiming: { budgetDuration: 1500 },
				firstPartUntimed: true,
				firstSegmentStartedAt: PLANNED_START,
			})

			expect(result.remainingPlaylistDurationState).toEqual({ paused: false, zeroTime: 4500, pauseTime: 3500 })
			expect(result.onAirPartPlannedStart).toBeUndefined()
		})

		it('is not given while a part in a segment with a budget is on air', () => {
			const result = calculateWithFirstPartTaken(2500, {
				firstSegmentTiming: { budgetDuration: 1500 },
				firstSegmentStartedAt: PLANNED_START,
			})

			expect(result.onAirPartPlannedStart).toBeUndefined()
		})
	})
})

describe('getPlaylistTimingDiff', () => {
	function makeTimingContext(
		fields: Omit<RundownTimingContext, 'isLowResolution' | 'partCountdownBase'>
	): RundownTimingContext {
		return {
			isLowResolution: false,
			// the over/under does not read the part countdowns
			partCountdownBase: { paused: true, duration: 0 },
			...fields,
		}
	}

	describe('ForwardTime', () => {
		it('is on schedule before playback, before the planned start', () => {
			const playlist = makeMockPlaylist()
			playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 10000,
				expectedDuration: 40000,
			}
			const context = makeTimingContext({
				currentTime: 5000,
				totalPlaylistDuration: 40000,
				remainingPlaylistDuration: 40000,
				asPlayedPlaylistDuration: 40000,
			})
			// frontAnchor = expectedStart, backAnchor = expectedStart + expectedDuration
			expect(getPlaylistTimingDiff(playlist, context, 5000)).toBe(0)
		})

		it('goes over when the playlist did not start on time', () => {
			const playlist = makeMockPlaylist()
			playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 10000,
				expectedDuration: 40000,
				expectedEnd: 50000,
			}
			const context = makeTimingContext({
				currentTime: 15000,
				totalPlaylistDuration: 40000,
				remainingPlaylistDuration: 40000,
				asPlayedPlaylistDuration: 40000,
			})
			// frontAnchor pushes with now, backAnchor is fixed by expectedEnd
			expect(getPlaylistTimingDiff(playlist, context, 15000)).toBe(5000)
		})

		it('tracks the remaining duration against the expected end during playback', () => {
			const playlist = makeMockPlaylist()
			playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 10000,
				expectedEnd: 50000,
			}
			playlist.activationId = protectString('active')
			playlist.startedPlayback = 10000
			const context = makeTimingContext({
				currentTime: 30000,
				totalPlaylistDuration: 40000,
				remainingPlaylistDuration: 25000,
				asPlayedPlaylistDuration: 30000,
			})
			// now + remaining = 55000 vs expectedEnd = 50000 => 5000 over
			expect(getPlaylistTimingDiff(playlist, context, 30000)).toBe(5000)
		})

		it('compares as-played against the expected end once deactivated after playout', () => {
			const playlist = makeMockPlaylist()
			playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 10000,
				expectedEnd: 50000,
			}
			playlist.activationId = undefined
			playlist.startedPlayback = 10000
			const context = makeTimingContext({
				currentTime: 100000,
				totalPlaylistDuration: 40000,
				remainingPlaylistDuration: 0,
				asPlayedPlaylistDuration: 45000,
			})
			// startedPlayback + asPlayed = 55000 vs expectedEnd = 50000 => 5000 over
			expect(getPlaylistTimingDiff(playlist, context, 100000)).toBe(5000)
		})

		it('compares as-played against the plan once deactivated after playout, when there is no expected end', () => {
			const playlist = makeMockPlaylist()
			playlist.timing = {
				type: PlaylistTimingType.ForwardTime,
				expectedStart: 10000,
				expectedDuration: 40000,
			}
			playlist.activationId = undefined
			playlist.startedPlayback = 10000
			const context = makeTimingContext({
				currentTime: 100000,
				totalPlaylistDuration: 40000,
				remainingPlaylistDuration: 0,
				asPlayedPlaylistDuration: 36000,
			})
			expect(getPlaylistTimingDiff(playlist, context, 100000)).toBe(-4000)
		})
	})

	describe('BackTime', () => {
		it('counts down to the expected end', () => {
			const playlist = makeMockPlaylist()
			playlist.timing = {
				type: PlaylistTimingType.BackTime,
				expectedEnd: 50000,
			}
			playlist.activationId = protectString('active')
			playlist.startedPlayback = 10000
			const context = makeTimingContext({
				currentTime: 30000,
				totalPlaylistDuration: 40000,
				remainingPlaylistDuration: 15000,
				asPlayedPlaylistDuration: 30000,
			})
			// now + remaining = 45000 vs expectedEnd = 50000 => 5000 under
			expect(getPlaylistTimingDiff(playlist, context, 30000)).toBe(-5000)
		})
	})

	describe('None', () => {
		it('compares as-played against the expected duration', () => {
			const playlist = makeMockPlaylist()
			playlist.timing = {
				type: PlaylistTimingType.None,
				expectedDuration: 40000,
			}
			playlist.activationId = protectString('active')
			playlist.startedPlayback = 10000
			const context = makeTimingContext({
				currentTime: 30000,
				totalPlaylistDuration: 41000,
				remainingPlaylistDuration: 15000,
				asPlayedPlaylistDuration: 42000,
			})
			expect(getPlaylistTimingDiff(playlist, context, 30000)).toBe(2000)
		})

		it('falls back to the total playlist duration when there is no expected duration', () => {
			const playlist = makeMockPlaylist()
			playlist.timing = {
				type: PlaylistTimingType.None,
			}
			playlist.activationId = protectString('active')
			playlist.startedPlayback = 10000
			const context = makeTimingContext({
				currentTime: 30000,
				totalPlaylistDuration: 41000,
				remainingPlaylistDuration: 15000,
				asPlayedPlaylistDuration: 42000,
			})
			expect(getPlaylistTimingDiff(playlist, context, 30000)).toBe(1000)
		})

		it('keeps comparing as-played against the plan once deactivated after playout', () => {
			const playlist = makeMockPlaylist()
			playlist.timing = {
				type: PlaylistTimingType.None,
				expectedDuration: 40000,
			}
			playlist.activationId = undefined
			playlist.startedPlayback = 10000
			const context = makeTimingContext({
				currentTime: 100000,
				totalPlaylistDuration: 41000,
				remainingPlaylistDuration: 0,
				asPlayedPlaylistDuration: 38000,
			})
			expect(getPlaylistTimingDiff(playlist, context, 100000)).toBe(-2000)
		})
	})

	describe('Duration', () => {
		it('compares as-played against the expected duration', () => {
			const playlist = makeMockPlaylist()
			playlist.timing = {
				type: PlaylistTimingType.Duration,
				expectedDuration: 40000,
			}
			playlist.activationId = protectString('active')
			playlist.startedPlayback = 10000
			const context = makeTimingContext({
				currentTime: 30000,
				totalPlaylistDuration: 41000,
				remainingPlaylistDuration: 15000,
				asPlayedPlaylistDuration: 43000,
			})
			expect(getPlaylistTimingDiff(playlist, context, 30000)).toBe(3000)
		})

		it('keeps comparing as-played against the plan once deactivated after playout', () => {
			const playlist = makeMockPlaylist()
			playlist.timing = {
				type: PlaylistTimingType.Duration,
				expectedDuration: 40000,
			}
			playlist.activationId = undefined
			playlist.startedPlayback = 10000
			const context = makeTimingContext({
				currentTime: 100000,
				totalPlaylistDuration: 41000,
				remainingPlaylistDuration: 0,
				asPlayedPlaylistDuration: 39000,
			})
			expect(getPlaylistTimingDiff(playlist, context, 100000)).toBe(-1000)
		})
	})

	it('uses the fallback time when the timing context has no currentTime', () => {
		const playlist = makeMockPlaylist()
		playlist.timing = {
			type: PlaylistTimingType.BackTime,
			expectedEnd: 50000,
		}
		playlist.activationId = protectString('active')
		playlist.startedPlayback = 10000
		const context = makeTimingContext({
			totalPlaylistDuration: 40000,
			remainingPlaylistDuration: 15000,
			asPlayedPlaylistDuration: 30000,
		})
		expect(getPlaylistTimingDiff(playlist, context, 30000)).toBe(-5000)
	})
})

describe('findPartInstancesInQuickLoop', () => {
	it('Returns no parts when QuickLoop is not defined', () => {
		const { partInstances } = makeMockPartsForQuickLoopTest()
		const playlist = makeMockPlaylist()

		const result = findPartInstancesInQuickLoop(playlist, partInstances)

		expect(result).toEqual({})
	})

	it('Returns parts between QuickLoop Part Markers when loop is not running', () => {
		const { parts, partInstances } = makeMockPartsForQuickLoopTest()

		const playlist = makeMockPlaylist()
		playlist.quickLoop = {
			start: {
				type: QuickLoopMarkerType.PART,
				id: parts[1]._id,
			},
			end: {
				type: QuickLoopMarkerType.PART,
				id: parts[3]._id,
			},
			running: false,
			forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
			locked: false,
		}

		const result = findPartInstancesInQuickLoop(playlist, partInstances)

		expect(result).toEqual({
			[unprotectString(parts[1]._id)]: true,
			[unprotectString(parts[2]._id)]: true,
			[unprotectString(parts[3]._id)]: true,
		})
	})

	it('Returns parts between QuickLoop Part Markers when loop is running', () => {
		const { parts, partInstances } = makeMockPartsForQuickLoopTest()

		const playlist = makeMockPlaylist()
		playlist.quickLoop = {
			start: {
				type: QuickLoopMarkerType.PART,
				id: parts[1]._id,
			},
			end: {
				type: QuickLoopMarkerType.PART,
				id: parts[3]._id,
			},
			running: true,
			forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
			locked: false,
		}

		const result = findPartInstancesInQuickLoop(playlist, partInstances)

		expect(result).toEqual({
			[unprotectString(parts[1]._id)]: true,
			[unprotectString(parts[2]._id)]: true,
			[unprotectString(parts[3]._id)]: true,
		})
	})

	it('Returns no parts when the entire Playlist is looping', () => {
		// this may need to change if setting other than Part markers is allowed by the users
		const { partInstances } = makeMockPartsForQuickLoopTest()

		const playlist = makeMockPlaylist()
		playlist.quickLoop = {
			start: {
				type: QuickLoopMarkerType.PLAYLIST,
			},
			end: {
				type: QuickLoopMarkerType.PLAYLIST,
			},
			running: false,
			forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
			locked: false,
		}

		const result = findPartInstancesInQuickLoop(playlist, partInstances)

		expect(result).toEqual({})
	})

	it('Returns no parts when QuickLoop Part Markers are in the wrong order', () => {
		const { parts, partInstances } = makeMockPartsForQuickLoopTest()

		const playlist = makeMockPlaylist()
		playlist.quickLoop = {
			start: {
				type: QuickLoopMarkerType.PART,
				id: parts[3]._id,
			},
			end: {
				type: QuickLoopMarkerType.PART,
				id: parts[1]._id,
			},
			running: false,
			forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
			locked: false,
		}

		const result = findPartInstancesInQuickLoop(playlist, partInstances)

		expect(result).toEqual({})
	})

	it('Returns no parts when QuickLoop End Marker is not defined', () => {
		const { parts, partInstances } = makeMockPartsForQuickLoopTest()

		const playlist = makeMockPlaylist()
		playlist.quickLoop = {
			start: {
				type: QuickLoopMarkerType.PART,
				id: parts[3]._id,
			},
			running: false,
			forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
			locked: false,
		}

		const result = findPartInstancesInQuickLoop(playlist, partInstances)

		expect(result).toEqual({})
	})
})
