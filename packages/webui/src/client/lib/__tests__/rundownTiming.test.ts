import { DBRundownPlaylist, QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ForceQuickLoopAutoNext } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import { PartInstance, wrapPartToTemporaryInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { literal, protectString, unprotectString } from '../tempLib.js'
import { RundownTimingCalculator, RundownTimingContext, findPartInstancesInQuickLoop } from '../rundownTiming.js'
import { PlaylistTimingType, SegmentTimingInfo } from '@sofie-automation/blueprints-integration'
import { PartId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'

const DEFAULT_DURATION = 0
const DEFAULT_NONZERO_DURATION = 4000

function makeMockPlaylist(): DBRundownPlaylist {
	return literal<DBRundownPlaylist>({
		_id: protectString('mock-playlist'),
		externalId: 'mock-playlist',
		organizationId: protectString('test'),
		studioId: protectString('studio0'),
		name: 'Mock Playlist',
		created: 0,
		modified: 0,
		currentPartInfo: null,
		nextPartInfo: null,
		previousPartInfo: null,
		timing: {
			type: PlaylistTimingType.None,
		},
		rundownIdsInOrder: [],
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

function makeMockRundown(id: string, playlist: DBRundownPlaylist) {
	playlist.rundownIdsInOrder.push(protectString(id))
	return literal<DBRundown>({
		_id: protectString(id),
		externalId: id,
		timing: {
			type: 'none' as any,
		},
		studioId: protectString('studio0'),
		showStyleBaseId: protectString(''),
		showStyleVariantId: protectString('variant0'),
		created: 0,
		modified: 0,
		importVersions: {} as any,
		name: 'test',
		source: {
			type: 'nrcs',
			peripheralDeviceId: protectString(''),
			nrcsName: 'mockNRCS',
		},
		organizationId: protectString(''),
		playlistId: playlist._id,
	})
}

function convertPartsToPartInstances(parts: DBPart[]): PartInstance[] {
	return parts.map((part) => wrapPartToTemporaryInstance(protectString(''), part))
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
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			[],
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
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
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
			})
		)
	})

	it('Calculates time for unplayed playlist with start time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
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
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
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
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
			})
		)
	})

	it('Calculates time for unplayed playlist with end time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
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
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
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
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
			})
		)
	})

	it('Produces timing per rundown with start time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
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
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown1 = makeMockRundown(rundownId1, playlist)
		const rundown2 = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown1, rundown2]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
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
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
			})
		)
	})

	describe('Display duration groups', () => {
		it('Handles groups when not playing', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
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
			const partInstancesMap: Map<PartId, PartInstance> = new Map()
			const rundown = makeMockRundown(rundownId1, playlist)
			const rundowns = [rundown]
			const result = timing.updateDurations(
				0,
				false,
				playlist,
				rundowns,
				undefined,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
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
					breakIsLastRundown: undefined,
					remainingTimeOnCurrentPart: undefined,
					rundownsBeforeNextBreak: undefined,
				})
			)
		})

		it('Handles groups when playing', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
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
			partInstancesMap.get(parts[0]._id)!.timings = {
				// part1
				duration: 1000,
				take: 0,
				plannedStartedPlayback: 0,
				plannedStoppedPlayback: 1000,
			}
			partInstancesMap.get(parts[1]._id)!.timings = {
				// part2
				duration: 2000,
				take: 1000,
				plannedStartedPlayback: 1000,
				plannedStoppedPlayback: 3000,
			}
			partInstancesMap.get(parts[2]._id)!.timings = {
				// part3
				take: 3000,
				plannedStartedPlayback: 3000,
			}
			const currentPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
			const nextPartInstanceId = partInstancesMap.get(parts[3]._id)!._id
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
			const rundown = makeMockRundown(rundownId1, playlist)
			const rundowns = [rundown]
			const result = timing.updateDurations(
				3500,
				false,
				playlist,
				rundowns,
				rundown,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId: currentPartInstanceId,
					isLowResolution: false,
					asDisplayedPlaylistDuration: 7000,
					asPlayedPlaylistDuration: 7000,
					currentPartWillAutoNext: false,
					currentSegmentId: protectString(segmentId1),
					currentTime: 3500,
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
					breakIsLastRundown: false,
					remainingTimeOnCurrentPart: 2500,
					rundownsBeforeNextBreak: [],
					nextRundownAnchor: undefined,
				})
			)
		})

		it("Handles groups when playing outside of displayDurationGroup's budget", () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
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
			partInstancesMap.get(parts[0]._id)!.timings = {
				// part1
				duration: 1000,
				take: 0,
				plannedStartedPlayback: 0,
				plannedStoppedPlayback: 1000,
			}
			partInstancesMap.get(parts[1]._id)!.timings = {
				// part2
				duration: 2000,
				take: 1000,
				plannedStartedPlayback: 1000,
				plannedStoppedPlayback: 3000,
			}
			partInstancesMap.get(parts[2]._id)!.timings = {
				// part3
				take: 3000,
				plannedStartedPlayback: 3000,
			}
			const currentPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
			const nextPartInstanceId = partInstancesMap.get(parts[3]._id)!._id
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
			const rundown = makeMockRundown(rundownId1, playlist)
			const rundowns = [rundown]
			const result = timing.updateDurations(
				10000,
				false,
				playlist,
				rundowns,
				rundown,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId: currentPartInstanceId,
					isLowResolution: false,
					asDisplayedPlaylistDuration: 11000,
					asPlayedPlaylistDuration: 11000,
					currentPartWillAutoNext: false,
					currentSegmentId: protectString(segmentId1),
					currentTime: 10000,
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
					breakIsLastRundown: false,
					remainingTimeOnCurrentPart: -4000,
					rundownsBeforeNextBreak: [],
					nextRundownAnchor: undefined,
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
				expectedStart: 0,
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
			const partInstancesMap: Map<PartId, PartInstance> = new Map()
			const rundown = makeMockRundown(rundownId, playlist)
			const rundowns = [rundown]
			const result = timing.updateDurations(
				0,
				false,
				playlist,
				rundowns,
				undefined,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_NONZERO_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
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
					breakIsLastRundown: undefined,
					remainingTimeOnCurrentPart: undefined,
					rundownsBeforeNextBreak: undefined,
				})
			)
		})

		it('Handles display duration groups', () => {
			const timing = new RundownTimingCalculator()
			const playlist: DBRundownPlaylist = makeMockPlaylist()
			playlist.timing = {
				type: 'forward-time' as any,
				expectedStart: 0,
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
			const partInstancesMap: Map<PartId, PartInstance> = new Map()
			const rundown = makeMockRundown(rundownId1, playlist)
			const rundowns = [rundown]
			const result = timing.updateDurations(
				0,
				false,
				playlist,
				rundowns,
				undefined,
				partInstances,
				partInstancesMap,
				segmentsMap,
				DEFAULT_NONZERO_DURATION,
				{}
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
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
					breakIsLastRundown: undefined,
					remainingTimeOnCurrentPart: undefined,
					rundownsBeforeNextBreak: undefined,
				})
			)
		})
	})

	it('Handles budget duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
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
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
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
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
			})
		)
	})

	it('Handles part with autonext', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
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
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		// at t = 0
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
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
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
			})
		)
	})

	it('Handles part with postroll', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
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
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		// at t = 0
		const result = timing.updateDurations(
			3000,
			false,
			playlist,
			rundowns,
			undefined,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
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
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
			})
		)
	})

	it('Back-time: Can find the next expectedStart rundown anchor when it is in a future segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'back-time' as any,
			expectedDuration: 4000,
			expectedEnd: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 4000 })
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
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		const partInstances = Array.from(partInstancesMap.values())
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			take: 1000,
			plannedStartedPlayback: 1000,
		}
		const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
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
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			1500,
			false,
			playlist,
			rundowns,
			rundown,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentSegmentId: protectString(segmentId1),
				currentTime: 1500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 4000,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: 500,
					part4: 1500,
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
					part1: 1000,
					part2: 500,
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
				remainingPlaylistDuration: 2500,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: 500,
				rundownsBeforeNextBreak: [],
				nextRundownAnchor: 2000,
			})
		)
	})

	it('Back-time: Can find the next expectedEnd rundown anchor when it is a future segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'back-time' as any,
			expectedDuration: 4000,
			expectedEnd: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 4000 })
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
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		const partInstances = Array.from(partInstancesMap.values())
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			take: 1000,
			plannedStartedPlayback: 1000,
		}
		const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
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
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			3500,
			false,
			playlist,
			rundowns,
			rundown,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 5500,
				asPlayedPlaylistDuration: 5500,
				currentPartWillAutoNext: false,
				currentSegmentId: protectString(segmentId1),
				currentTime: 3500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 5500,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: 0,
					part4: 1000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 2500,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 3500,
					part4: 4500,
				},
				partDurations: {
					part1: 1000,
					part2: 2500,
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
					part1: 1000,
					part2: 2500,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 3500,
					part4: 4500,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 2000,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: -1500,
				rundownsBeforeNextBreak: [],
				nextRundownAnchor: 4000,
			})
		)
	})

	it('Back-time: Can find the next expectedEnd rundown anchor when it is the current segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'back-time' as any,
			expectedDuration: 4000,
			expectedEnd: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 3000 })
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
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		const partInstances = Array.from(partInstancesMap.values())
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			duration: 1000,
			take: 1000,
			plannedStartedPlayback: 1000,
			plannedStoppedPlayback: 2000,
		}
		partInstancesMap.get(parts[2]._id)!.timings = {
			take: 2000,
			plannedStartedPlayback: 2000,
		}
		const currentPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[3]._id)!._id
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
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			2500,
			false,
			playlist,
			rundowns,
			rundown,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentSegmentId: protectString(segmentId2),
				currentTime: 2500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 4000,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: null,
					part4: 500,
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
					part1: 1000,
					part2: 1000,
					part3: 500,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 1500,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: 500,
				rundownsBeforeNextBreak: [],
				nextRundownAnchor: 3000,
			})
		)
	})

	it('Forward-time: Can find the next expectedStart rundown anchor when it is in a future segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 4000 })
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
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			take: 1000,
			plannedStartedPlayback: 1000,
		}
		const partInstances = Array.from(partInstancesMap.values())
		const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
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
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			1500,
			false,
			playlist,
			rundowns,
			rundown,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentSegmentId: protectString(segmentId1),
				currentTime: 1500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 4000,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: 500,
					part4: 1500,
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
					part1: 1000,
					part2: 500,
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
				remainingPlaylistDuration: 2500,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: 500,
				rundownsBeforeNextBreak: [],
				nextRundownAnchor: 2000,
			})
		)
	})

	it('Forward-time: Can find the next expectedEnd rundown anchor when it is a future segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 4000 })
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
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		const partInstances = Array.from(partInstancesMap.values())
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			take: 1000,
			plannedStartedPlayback: 1000,
		}
		const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
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
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			3500,
			false,
			playlist,
			rundowns,
			rundown,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 5500,
				asPlayedPlaylistDuration: 5500,
				currentPartWillAutoNext: false,
				currentSegmentId: protectString(segmentId1),
				currentTime: 3500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 5500,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: 0,
					part4: 1000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 2500,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 3500,
					part4: 4500,
				},
				partDurations: {
					part1: 1000,
					part2: 2500,
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
					part1: 1000,
					part2: 2500,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 3500,
					part4: 4500,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 2000,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: -1500,
				rundownsBeforeNextBreak: [],
				nextRundownAnchor: 4000,
			})
		)
	})

	it('Forward-time: Can find the next expectedEnd rundown anchor when it is the current segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: DBRundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedEnd: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 3000 })
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
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			duration: 1000,
			take: 1000,
			plannedStartedPlayback: 1000,
			plannedStoppedPlayback: 2000,
		}
		partInstancesMap.get(parts[2]._id)!.timings = {
			take: 2000,
			plannedStartedPlayback: 2000,
		}
		const partInstances = Array.from(partInstancesMap.values())
		const currentPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[3]._id)!._id
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
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			2500,
			false,
			playlist,
			rundowns,
			rundown,
			partInstances,
			partInstancesMap,
			segmentsMap,
			DEFAULT_DURATION,
			{}
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentSegmentId: protectString(segmentId2),
				currentTime: 2500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 4000,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: null,
					part4: 500,
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
					part1: 1000,
					part2: 1000,
					part3: 500,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partsInQuickLoop: {},
				remainingPlaylistDuration: 1500,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: 500,
				rundownsBeforeNextBreak: [],
				nextRundownAnchor: 3000,
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
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			partInstances,
			partInstancesMap,
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
