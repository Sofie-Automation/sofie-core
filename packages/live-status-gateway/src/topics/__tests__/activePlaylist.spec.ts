import { ActivePlaylistTopic } from '../activePlaylistTopic.js'
import {
	makeMockHandlers,
	makeMockLogger,
	makeMockSubscriber,
	makeTestPlaylist,
	makeTestShowStyleBase,
	makeTestTimingStates,
	constantMs,
} from './utils.js'
import { ShowStyleBaseExt } from '../../collections/showStyleBaseHandler.js'
import { SelectedPartInstances } from '../../collections/partInstancesHandler.js'
import { protectString, unprotectString, unprotectStringArray } from '@sofie-automation/server-core-integration'
import { PartialDeep } from 'type-fest'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { CountdownType } from '@sofie-automation/blueprints-integration'
import {
	ActivePlaylistEvent,
	ActivePlaylistTimingMode,
	SegmentCountdownType,
} from '@sofie-automation/live-status-gateway-api'

const DEFAULT_UNCONFIGURED_T_TIMERS: ActivePlaylistEvent['tTimers'] = [
	{ index: 1, label: '', configured: false, mode: null, state: null, projected: null, anchorPartId: null },
	{ index: 2, label: '', configured: false, mode: null, state: null, projected: null, anchorPartId: null },
	{ index: 3, label: '', configured: false, mode: null, state: null, projected: null, anchorPartId: null },
]

function makeEmptyTestPartInstances(): SelectedPartInstances {
	return {
		previous: [],
		current: undefined,
		firstInSegmentPlayout: undefined,
		inCurrentSegment: [],
		next: undefined,
	}
}

describe('ActivePlaylistTopic', () => {
	it('notifies subscribers', async () => {
		const handlers = makeMockHandlers()
		const topic = new ActivePlaylistTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		handlers.playlistHandler.notify(playlist)

		const testShowStyleBase = makeTestShowStyleBase()
		handlers.showStyleBaseHandler.notify(testShowStyleBase as ShowStyleBaseExt)

		const testPartInstancesMap = makeEmptyTestPartInstances()
		handlers.partInstancesHandler.notify(testPartInstancesMap)

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: ActivePlaylistEvent = {
			event: 'activePlaylist',
			name: playlist.name,
			id: unprotectString(playlist._id),
			externalId: 'NCS_PLAYLIST_1',
			currentPart: null,
			nextPart: null,
			currentSegment: null,
			rundownIds: unprotectStringArray(playlist.rundownIdsInOrder),
			publicData: undefined,
			timing: {
				timingMode: ActivePlaylistTimingMode.NONE,
			},
			quickLoop: undefined,
			tTimers: DEFAULT_UNCONFIGURED_T_TIMERS,
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(
			JSON.parse(JSON.stringify(expectedStatus))
		)
	})

	it('forwards the playlist timers of the active playlist unevaluated', async () => {
		const handlers = makeMockHandlers()
		const topic = new ActivePlaylistTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		handlers.playlistHandler.notify(playlist)
		handlers.showStyleBaseHandler.notify(makeTestShowStyleBase() as ShowStyleBaseExt)
		handlers.partInstancesHandler.notify(makeEmptyTestPartInstances())

		const remainingDuration = { paused: false, zeroTime: 1600000180000, pauseTime: 1600000070000 } as const
		const estimatedEnd = { paused: false, zeroTime: 1600000200000, pauseTime: 1600000070000 } as const
		const overUnder = { paused: true, duration: -12000, resumesAt: 1600000070000 } as const
		handlers.playlistTimingStatesHandler.notify(
			makeTestTimingStates({
				playlist: { playlistId: playlist._id, remainingDuration, estimatedEnd, overUnder },
			})
		)

		topic.addSubscriber(mockSubscriber)

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		const status = JSON.parse(mockSubscriber.send.mock.calls[0][0] as string) as ActivePlaylistEvent
		expect(status.timing).toEqual({
			timingMode: ActivePlaylistTimingMode.NONE,
			remainingDuration,
			estimatedEnd,
			timeInHand: overUnder,
		})
	})

	it("does not report another playlist's timers as the active playlist's", async () => {
		const handlers = makeMockHandlers()
		const topic = new ActivePlaylistTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		handlers.playlistHandler.notify(playlist)
		handlers.showStyleBaseHandler.notify(makeTestShowStyleBase() as ShowStyleBaseExt)
		handlers.partInstancesHandler.notify(makeEmptyTestPartInstances())

		// still held from before a switch of playlist, until the new subscription delivers
		handlers.playlistTimingStatesHandler.notify(
			makeTestTimingStates({
				playlist: {
					playlistId: protectString('PREVIOUS_PLAYLIST'),
					remainingDuration: constantMs(60000),
					overUnder: constantMs(5000),
				},
			})
		)

		topic.addSubscriber(mockSubscriber)

		const status = JSON.parse(mockSubscriber.send.mock.calls[0][0] as string) as ActivePlaylistEvent
		expect(status.timing).toEqual({
			timingMode: ActivePlaylistTimingMode.NONE,
			remainingDuration: null,
			estimatedEnd: null,
			timeInHand: null,
		})
	})

	it('sends the playlist timers as null when no playlist is active', async () => {
		const handlers = makeMockHandlers()
		const topic = new ActivePlaylistTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const inactivePlaylist = makeTestPlaylist()
		handlers.playlistHandler.notify(inactivePlaylist)
		handlers.partInstancesHandler.notify(makeEmptyTestPartInstances())

		topic.addSubscriber(mockSubscriber)

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		const status = JSON.parse(mockSubscriber.send.mock.calls[0][0] as string) as ActivePlaylistEvent
		expect(status.id).toBeNull()
		expect(status.timing).toEqual({
			timingMode: ActivePlaylistTimingMode.NONE,
			remainingDuration: null,
			estimatedEnd: null,
			timeInHand: null,
		})
	})

	it('provides segment and part', async () => {
		const handlers = makeMockHandlers()
		const topic = new ActivePlaylistTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const currentPartInstanceId = 'CURRENT_PART_INSTANCE_ID'

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		playlist.currentPartInfo = {
			consumesQueuedSegmentId: false,
			manuallySelected: false,
			partInstanceId: protectString(currentPartInstanceId),
			rundownId: playlist.rundownIdsInOrder[0],
		}
		handlers.playlistHandler.notify(playlist)

		const testShowStyleBase = makeTestShowStyleBase()
		const segment1id = protectString('SEGMENT_1')
		handlers.showStyleBaseHandler.notify(testShowStyleBase as ShowStyleBaseExt)
		const part1: Partial<DBPart> = {
			_id: protectString('PART_1'),
			title: 'Test Part',
			segmentId: segment1id,
			expectedDurationWithTransition: 10000,
			expectedDuration: 10000,
			publicData: { b: 'c' },
		}
		const testPartInstances: PartialDeep<SelectedPartInstances> = {
			current: {
				_id: currentPartInstanceId,
				part: part1,
				timings: { plannedStartedPlayback: 1600000060000 },
				segmentId: segment1id,
			},
			firstInSegmentPlayout: {},
			inCurrentSegment: [
				literal<PartialDeep<DBPartInstance>>({
					_id: protectString(currentPartInstanceId),
					part: part1,
					timings: { plannedStartedPlayback: 1600000060000 },
				}),
			] as DBPartInstance[],
		}
		handlers.partInstancesHandler.notify(testPartInstances as SelectedPartInstances)

		handlers.partsHandler.notify([part1] as DBPart[])

		// Sofie resolves the durations and publishes them; the gateway does no timing arithmetic
		handlers.playlistTimingStatesHandler.notify(
			makeTestTimingStates({
				playlist: {
					playlistId: playlist._id,
					remainingOnCurrentPart: { paused: true, duration: 10000, resumesAt: 1600000060000 },
				},
				segments: {
					SEGMENT_1: {
						plannedDuration: constantMs(10000),
						remaining: { paused: true, duration: 10000, resumesAt: 1600000060000 },
						parts: { PART_1: { expectedDuration: constantMs(10000) } },
					},
				},
			})
		)

		handlers.segmentHandler.notify({
			_id: segment1id,
		} as DBSegment)

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: ActivePlaylistEvent = {
			event: 'activePlaylist',
			name: playlist.name,
			id: unprotectString(playlist._id),
			externalId: 'NCS_PLAYLIST_1',
			currentPart: {
				id: 'PART_1',
				name: 'Test Part',
				segmentId: 'SEGMENT_1',
				createdByAdLib: false,
				timing: { startTime: 1600000060000, expectedDurationMs: 10000, projectedEndTime: 1600000070000 },
				pieces: [],
				autoNext: undefined,
				publicData: { b: 'c' },
			},
			nextPart: null,
			currentSegment: {
				id: 'SEGMENT_1',
				timing: {
					expectedDurationMs: 10000,
					projectedEndTime: 1600000070000,
				},
				parts: [
					{
						id: 'PART_1',
						name: 'Test Part',
						createdByAdLib: false,
						timing: {
							expectedDurationMs: 10000,
						},
						autoNext: undefined,
					},
				],
			},
			rundownIds: unprotectStringArray(playlist.rundownIdsInOrder),
			publicData: { a: 'b' },
			timing: {
				timingMode: ActivePlaylistTimingMode.NONE,
			},
			quickLoop: undefined,
			tTimers: DEFAULT_UNCONFIGURED_T_TIMERS,
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(
			JSON.parse(JSON.stringify(expectedStatus))
		)
	})

	it('marks adlib-created parts in active playlist status', async () => {
		const handlers = makeMockHandlers()
		const topic = new ActivePlaylistTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const currentPartInstanceId = 'CURRENT_PART_INSTANCE_ID'
		const nextPartInstanceId = 'NEXT_PART_INSTANCE_ID'

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		playlist.currentPartInfo = {
			consumesQueuedSegmentId: false,
			manuallySelected: false,
			partInstanceId: protectString(currentPartInstanceId),
			rundownId: playlist.rundownIdsInOrder[0],
		}
		playlist.nextPartInfo = {
			consumesQueuedSegmentId: false,
			manuallySelected: false,
			partInstanceId: protectString(nextPartInstanceId),
			rundownId: playlist.rundownIdsInOrder[0],
		}
		handlers.playlistHandler.notify(playlist)

		const testShowStyleBase = makeTestShowStyleBase()
		handlers.showStyleBaseHandler.notify(testShowStyleBase as ShowStyleBaseExt)

		const segment1id = protectString('SEGMENT_1')
		const currentPart: Partial<DBPart> = {
			_id: protectString('PART_1'),
			title: 'Current AdLib Part',
			segmentId: segment1id,
			expectedDurationWithTransition: 10000,
			expectedDuration: 10000,
		}
		const nextPart: Partial<DBPart> = {
			_id: protectString('PART_2'),
			title: 'Next AdLib Part',
			segmentId: segment1id,
			expectedDurationWithTransition: 8000,
			expectedDuration: 8000,
		}
		const testPartInstances: PartialDeep<SelectedPartInstances> = {
			current: {
				_id: currentPartInstanceId,
				part: currentPart,
				segmentId: segment1id,
				orphaned: 'adlib-part',
			},
			next: {
				_id: nextPartInstanceId,
				part: nextPart,
				segmentId: segment1id,
				orphaned: 'adlib-part',
			},
			firstInSegmentPlayout: {},
			inCurrentSegment: [
				literal<PartialDeep<DBPartInstance>>({
					_id: protectString(currentPartInstanceId),
					part: currentPart,
					segmentId: segment1id,
					orphaned: 'adlib-part',
				}),
			] as DBPartInstance[],
		}
		handlers.partInstancesHandler.notify(testPartInstances as SelectedPartInstances)
		handlers.partsHandler.notify([currentPart as DBPart, nextPart as DBPart])
		handlers.segmentHandler.notify({
			_id: segment1id,
		} as DBSegment)

		topic.addSubscriber(mockSubscriber)

		const sentStatus = JSON.parse(mockSubscriber.send.mock.calls[0][0] as string) as ActivePlaylistEvent
		expect(sentStatus.currentPart?.createdByAdLib).toBe(true)
		expect(sentStatus.nextPart?.createdByAdLib).toBe(true)
		expect(sentStatus.currentSegment?.parts[0].createdByAdLib).toBe(true)
	})

	it('provides segment and part with segment timing', async () => {
		const handlers = makeMockHandlers()
		const topic = new ActivePlaylistTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const currentPartInstanceId = 'CURRENT_PART_INSTANCE_ID'

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		playlist.currentPartInfo = {
			consumesQueuedSegmentId: false,
			manuallySelected: false,
			partInstanceId: protectString(currentPartInstanceId),
			rundownId: playlist.rundownIdsInOrder[0],
		}
		handlers.playlistHandler.notify(playlist)

		const testShowStyleBase = makeTestShowStyleBase()
		handlers.showStyleBaseHandler.notify(testShowStyleBase as ShowStyleBaseExt)

		const segment1id = protectString('SEGMENT_1')
		const part1: Partial<DBPart> = {
			_id: protectString('PART_1'),
			title: 'Test Part',
			segmentId: protectString('SEGMENT_1'),
			expectedDurationWithTransition: 10000,
			expectedDuration: 10000,
			publicData: { b: 'c' },
		}
		const currentPartInstance = {
			_id: currentPartInstanceId,
			part: part1,
			timings: { plannedStartedPlayback: 1600000060000 },
			segmentId: segment1id,
		}
		const testPartInstances: PartialDeep<SelectedPartInstances> = {
			current: currentPartInstance,
			firstInSegmentPlayout: currentPartInstance,
			inCurrentSegment: [
				literal<PartialDeep<DBPartInstance>>({
					_id: protectString(currentPartInstanceId),
					part: part1,
					timings: { plannedStartedPlayback: 1600000060000 },
				}),
			] as DBPartInstance[],
		}
		handlers.partInstancesHandler.notify(testPartInstances as SelectedPartInstances)

		handlers.partsHandler.notify([part1] as DBPart[])

		// Sofie resolves the durations and publishes them; the gateway does no timing arithmetic
		handlers.playlistTimingStatesHandler.notify(
			makeTestTimingStates({
				playlist: {
					playlistId: playlist._id,
					remainingOnCurrentPart: { paused: true, duration: 10000, resumesAt: 1600000060000 },
				},
				segments: {
					SEGMENT_1: {
						plannedDuration: constantMs(12300),
						remaining: { paused: true, duration: 12300, resumesAt: 1600000060000 },
						parts: { PART_1: { expectedDuration: constantMs(10000) } },
					},
				},
			})
		)

		handlers.segmentHandler.notify({
			_id: segment1id,
			segmentTiming: { budgetDuration: 12300, countdownType: CountdownType.SEGMENT_BUDGET_DURATION },
		} as DBSegment)

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: ActivePlaylistEvent = {
			event: 'activePlaylist',
			name: playlist.name,
			id: unprotectString(playlist._id),
			externalId: 'NCS_PLAYLIST_1',
			currentPart: {
				id: 'PART_1',
				name: 'Test Part',
				segmentId: 'SEGMENT_1',
				createdByAdLib: false,
				timing: { startTime: 1600000060000, expectedDurationMs: 10000, projectedEndTime: 1600000070000 },
				pieces: [],
				autoNext: undefined,
				publicData: { b: 'c' },
			},
			nextPart: null,
			currentSegment: {
				id: 'SEGMENT_1',
				timing: {
					expectedDurationMs: 10000,
					budgetDurationMs: 12300,
					projectedEndTime: 1600000072300,
					countdownType: SegmentCountdownType.SEGMENT_BUDGET_DURATION,
				},
				parts: [
					{
						id: 'PART_1',
						name: 'Test Part',
						createdByAdLib: false,
						timing: {
							expectedDurationMs: 10000,
						},
						autoNext: undefined,
					},
				],
			},
			rundownIds: unprotectStringArray(playlist.rundownIdsInOrder),
			publicData: { a: 'b' },
			timing: {
				timingMode: ActivePlaylistTimingMode.NONE,
			},
			quickLoop: undefined,
			tTimers: DEFAULT_UNCONFIGURED_T_TIMERS,
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(
			JSON.parse(JSON.stringify(expectedStatus))
		)
	})

	it("does not take the current part's projected end from another playlist's timing", async () => {
		const handlers = makeMockHandlers()
		const topic = new ActivePlaylistTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const currentPartInstanceId = 'CURRENT_PART_INSTANCE_ID'
		const startTime = 1600000060000

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		playlist.currentPartInfo = {
			consumesQueuedSegmentId: false,
			manuallySelected: false,
			partInstanceId: protectString(currentPartInstanceId),
			rundownId: playlist.rundownIdsInOrder[0],
		}
		handlers.playlistHandler.notify(playlist)
		handlers.showStyleBaseHandler.notify(makeTestShowStyleBase() as ShowStyleBaseExt)

		const segment1id = protectString('SEGMENT_1')
		const part1: Partial<DBPart> = {
			_id: protectString('PART_1'),
			title: 'Test Part',
			segmentId: segment1id,
			expectedDurationWithTransition: 10000,
			expectedDuration: 10000,
		}
		const currentPartInstance = {
			_id: currentPartInstanceId,
			part: part1,
			timings: { plannedStartedPlayback: startTime },
			segmentId: segment1id,
		}
		const testPartInstances: PartialDeep<SelectedPartInstances> = {
			current: currentPartInstance,
			firstInSegmentPlayout: currentPartInstance,
			inCurrentSegment: [
				literal<PartialDeep<DBPartInstance>>({
					_id: protectString(currentPartInstanceId),
					part: part1,
					timings: { plannedStartedPlayback: startTime },
				}),
			] as DBPartInstance[],
		}
		handlers.partInstancesHandler.notify(testPartInstances as SelectedPartInstances)
		handlers.partsHandler.notify([part1] as DBPart[])
		handlers.segmentHandler.notify({ _id: segment1id } as DBSegment)

		// still held from before a switch of playlist, until the new subscription delivers
		const previousPlaylistPartEnd = 1600000095000
		handlers.playlistTimingStatesHandler.notify(
			makeTestTimingStates({
				playlist: {
					playlistId: protectString('PREVIOUS_PLAYLIST'),
					currentPartInstanceId: protectString('PREVIOUS_PART_INSTANCE_ID'),
					remainingOnCurrentPart: { paused: false, zeroTime: previousPlaylistPartEnd },
				},
			})
		)

		topic.addSubscriber(mockSubscriber)

		const status = JSON.parse(mockSubscriber.send.mock.calls[0][0] as string) as ActivePlaylistEvent
		// Nothing is published for this playlist yet, so the part has only its own start to go by
		const expectedDurationMs = 0
		expect(status.currentPart?.timing).toEqual({
			startTime,
			expectedDurationMs,
			projectedEndTime: startTime + expectedDurationMs,
		})
	})

	describe('between the take of a part and its start', () => {
		// In multi-gateway mode Sofie schedules the start of a taken part a moment after the take
		const plannedStart = 1600000060000
		const messageSentAt = plannedStart - 1000

		beforeEach(() => {
			jest.useFakeTimers({ now: messageSentAt })
		})
		afterEach(() => {
			jest.useRealTimers()
		})

		it('projects the end of the part from its planned start', async () => {
			const handlers = makeMockHandlers()
			const topic = new ActivePlaylistTopic(makeMockLogger(), handlers)
			const mockSubscriber = makeMockSubscriber()

			const currentPartInstanceId = 'CURRENT_PART_INSTANCE_ID'

			const playlist = makeTestPlaylist()
			playlist.activationId = protectString('somethingRandom')
			playlist.currentPartInfo = {
				consumesQueuedSegmentId: false,
				manuallySelected: false,
				partInstanceId: protectString(currentPartInstanceId),
				rundownId: playlist.rundownIdsInOrder[0],
			}
			handlers.playlistHandler.notify(playlist)
			handlers.showStyleBaseHandler.notify(makeTestShowStyleBase() as ShowStyleBaseExt)

			const segment1id = protectString('SEGMENT_1')
			const part1: Partial<DBPart> = {
				_id: protectString('PART_1'),
				title: 'Test Part',
				segmentId: segment1id,
				expectedDurationWithTransition: 10000,
				expectedDuration: 10000,
			}
			const currentPartInstance = {
				_id: currentPartInstanceId,
				part: part1,
				timings: { plannedStartedPlayback: plannedStart },
				segmentId: segment1id,
			}
			const testPartInstances: PartialDeep<SelectedPartInstances> = {
				current: currentPartInstance,
				firstInSegmentPlayout: currentPartInstance,
				inCurrentSegment: [
					literal<PartialDeep<DBPartInstance>>({
						_id: protectString(currentPartInstanceId),
						part: part1,
						timings: { plannedStartedPlayback: plannedStart },
					}),
				] as DBPartInstance[],
			}
			handlers.partInstancesHandler.notify(testPartInstances as SelectedPartInstances)
			handlers.partsHandler.notify([part1] as DBPart[])
			handlers.segmentHandler.notify({ _id: segment1id } as DBSegment)

			// The On Air countdown holds at the part's length until the planned start, and counts down from then
			const expectedDurationMs = 10000
			handlers.playlistTimingStatesHandler.notify(
				makeTestTimingStates({
					playlist: {
						playlistId: playlist._id,
						currentPartInstanceId: protectString(currentPartInstanceId),
						remainingOnCurrentPart: { paused: true, duration: expectedDurationMs, resumesAt: plannedStart },
					},
					segments: {
						SEGMENT_1: { parts: { PART_1: { expectedDuration: constantMs(expectedDurationMs) } } },
					},
				})
			)

			topic.addSubscriber(mockSubscriber)

			const status = JSON.parse(mockSubscriber.send.mock.calls[0][0] as string) as ActivePlaylistEvent
			expect(status.currentPart?.timing).toEqual({
				startTime: plannedStart,
				expectedDurationMs,
				projectedEndTime: plannedStart + expectedDurationMs,
			})
		})
	})

	it('maps a configured t-timer', async () => {
		const handlers = makeMockHandlers()
		const topic = new ActivePlaylistTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		playlist.tTimers = [
			{
				index: 1,
				label: 'Segment Timer',
				mode: { type: 'countdown', duration: 120000, stopAtZero: true },
				state: { paused: false, zeroTime: 1706371920000, pauseTime: null },
				projectedState: undefined,
				anchorPartId: undefined,
			},
			{ index: 2, label: '', mode: null, state: null },
			{ index: 3, label: '', mode: null, state: null },
		] as any
		handlers.playlistHandler.notify(playlist)

		const testShowStyleBase = makeTestShowStyleBase()
		handlers.showStyleBaseHandler.notify(testShowStyleBase as ShowStyleBaseExt)

		const testPartInstancesMap = makeEmptyTestPartInstances()
		handlers.partInstancesHandler.notify(testPartInstancesMap)

		topic.addSubscriber(mockSubscriber)

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		const emitted = JSON.parse(mockSubscriber.send.mock.calls[0][0] as string) as ActivePlaylistEvent
		expect(emitted.tTimers[0]).toMatchObject({
			index: 1,
			label: 'Segment Timer',
			configured: true,
			mode: { type: 'countdown', duration: 120000, stopAtZero: true },
			state: { paused: false, zeroTime: 1706371920000, pauseTime: null },
			projected: null,
			anchorPartId: null,
		})
		expect(emitted.tTimers[1]).toMatchObject({
			index: 2,
			label: '',
			configured: false,
			mode: null,
			state: null,
		})
	})
})
