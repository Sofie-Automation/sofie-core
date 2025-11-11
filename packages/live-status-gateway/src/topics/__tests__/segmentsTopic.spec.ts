import { SegmentsTopic } from '../segmentsTopic.js'
import { protectString, unprotectString } from '@sofie-automation/server-core-integration'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { makeMockHandlers, makeMockLogger, makeMockSubscriber, makeTestPlaylist } from './utils.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { SegmentsEvent } from '@sofie-automation/live-status-gateway-api'

const RUNDOWN_1_ID = 'RUNDOWN_1'
const RUNDOWN_2_ID = 'RUNDOWN_2'
const THROTTLE_PERIOD_MS = 205

function makeTestSegment(id: string, rank: number, rundownId: string, segmentProps?: Partial<DBSegment>): DBSegment {
	return {
		_id: protectString(id),
		externalId: `NCS_SEGMENT_${id}`,
		name: `Segment ${id}`,
		_rank: rank,
		rundownId: protectString(rundownId),
		...segmentProps,
	}
}

function makeTestPart(
	id: string,
	rank: number,
	rundownId: string,
	segmentId: string,
	partProps?: Partial<DBPart>
): DBPart {
	return {
		_id: protectString(id),
		externalId: `NCS_PART_${id}`,
		title: `Part ${id}`,
		_rank: rank,
		rundownId: protectString(rundownId),
		segmentId: protectString(segmentId),
		expectedDurationWithTransition: undefined,
		...partProps,
	}
}

describe('SegmentsTopic', () => {
	beforeEach(() => {
		jest.useFakeTimers()
	})
	afterEach(() => {
		jest.useRealTimers()
	})

	it('notifies added subscribers immediately', async () => {
		const handlers = makeMockHandlers()
		const topic = new SegmentsTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: SegmentsEvent = {
			event: 'segments',
			rundownPlaylistId: null,
			segments: [],
		}
		expect(mockSubscriber.send.mock.calls).toEqual([[JSON.stringify(expectedStatus)]])
		mockSubscriber.send.mockClear()
	})

	it('notifies subscribers when playlist changes from null', async () => {
		const handlers = makeMockHandlers()
		const topic = new SegmentsTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		topic.addSubscriber(mockSubscriber)
		mockSubscriber.send.mockClear()

		const testPlaylist = makeTestPlaylist()
		handlers.playlistHandler.notify(testPlaylist)

		const expectedStatus: SegmentsEvent = {
			event: 'segments',
			rundownPlaylistId: unprotectString(testPlaylist._id),
			segments: [],
		}
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)
		expect(mockSubscriber.send.mock.calls).toEqual([[JSON.stringify(expectedStatus)]])
	})

	it('notifies subscribers when playlist id changes', async () => {
		const handlers = makeMockHandlers()
		const topic = new SegmentsTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const testPlaylist = makeTestPlaylist()
		handlers.playlistHandler.notify(testPlaylist)

		topic.addSubscriber(mockSubscriber)
		mockSubscriber.send.mockClear()

		const testPlaylist2 = makeTestPlaylist('PLAYLIST_2')
		handlers.playlistHandler.notify(testPlaylist2)
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		const expectedStatus2: SegmentsEvent = {
			event: 'segments',
			rundownPlaylistId: unprotectString(testPlaylist2._id),
			segments: [],
		}
		expect(mockSubscriber.send.mock.calls).toEqual([[JSON.stringify(expectedStatus2)]])
	})

	it('notifies subscribers when segments change', async () => {
		const handlers = makeMockHandlers()
		const topic = new SegmentsTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const testPlaylist = makeTestPlaylist()
		handlers.playlistHandler.notify(testPlaylist)

		topic.addSubscriber(mockSubscriber)
		mockSubscriber.send.mockClear()

		handlers.segmentsHandler.notify([
			makeTestSegment('2_1', 1, RUNDOWN_2_ID),
			makeTestSegment('2_2', 2, RUNDOWN_2_ID),
			makeTestSegment('1_2', 2, RUNDOWN_1_ID),
			makeTestSegment('1_1', 1, RUNDOWN_1_ID),
		])
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		const expectedStatus: SegmentsEvent = {
			event: 'segments',
			rundownPlaylistId: unprotectString(testPlaylist._id),
			segments: [
				{
					id: '1_1',
					rundownId: RUNDOWN_1_ID,
					name: 'Segment 1_1',
					timing: { expectedDurationMs: 0 },
					publicData: undefined,
				},
				{
					id: '1_2',
					rundownId: RUNDOWN_1_ID,
					name: 'Segment 1_2',
					timing: { expectedDurationMs: 0 },
					publicData: undefined,
				},
				{
					id: '2_1',
					rundownId: RUNDOWN_2_ID,
					name: 'Segment 2_1',
					timing: { expectedDurationMs: 0 },
					publicData: undefined,
				},
				{
					id: '2_2',
					rundownId: RUNDOWN_2_ID,
					name: 'Segment 2_2',
					timing: { expectedDurationMs: 0 },
					publicData: undefined,
				},
			],
		}
		expect(mockSubscriber.send.mock.calls).toEqual([[JSON.stringify(expectedStatus)]])
	})

	it('notifies subscribers when rundown order changes', async () => {
		const handlers = makeMockHandlers()
		const topic = new SegmentsTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const testPlaylist = makeTestPlaylist()
		handlers.playlistHandler.notify(testPlaylist)
		handlers.segmentsHandler.notify([
			makeTestSegment('2_1', 1, RUNDOWN_2_ID),
			makeTestSegment('2_2', 2, RUNDOWN_2_ID),
			makeTestSegment('1_2', 2, RUNDOWN_1_ID),
			makeTestSegment('1_1', 1, RUNDOWN_1_ID),
		])

		topic.addSubscriber(mockSubscriber)
		mockSubscriber.send.mockClear()

		const testPlaylist2 = makeTestPlaylist()
		testPlaylist2.rundownIdsInOrder = [protectString(RUNDOWN_2_ID), protectString(RUNDOWN_1_ID)]
		handlers.playlistHandler.notify(testPlaylist2)
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		const expectedStatus: SegmentsEvent = {
			event: 'segments',
			rundownPlaylistId: unprotectString(testPlaylist._id),
			segments: [
				{
					id: '2_1',
					rundownId: RUNDOWN_2_ID,
					name: 'Segment 2_1',
					timing: { expectedDurationMs: 0 },
					publicData: undefined,
				},
				{
					id: '2_2',
					rundownId: RUNDOWN_2_ID,
					name: 'Segment 2_2',
					timing: { expectedDurationMs: 0 },
					publicData: undefined,
				},
				{
					id: '1_1',
					rundownId: RUNDOWN_1_ID,
					name: 'Segment 1_1',
					timing: { expectedDurationMs: 0 },
					publicData: undefined,
				},
				{
					id: '1_2',
					rundownId: RUNDOWN_1_ID,
					name: 'Segment 1_2',
					timing: { expectedDurationMs: 0 },
					publicData: undefined,
				},
			],
		}
		expect(mockSubscriber.send.mock.calls).toEqual([[JSON.stringify(expectedStatus)]])
	})

	it('exposes budgetDuration', async () => {
		const handlers = makeMockHandlers()
		const topic = new SegmentsTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const testPlaylist = makeTestPlaylist()
		handlers.playlistHandler.notify(testPlaylist)

		topic.addSubscriber(mockSubscriber)
		mockSubscriber.send.mockClear()

		const segment_1_1_id = '1_1'
		const segment_1_2_id = '1_2'
		const segment_2_2_id = '2_2'
		handlers.segmentsHandler.notify([
			makeTestSegment('2_1', 1, RUNDOWN_2_ID),
			makeTestSegment(segment_2_2_id, 2, RUNDOWN_2_ID, { segmentTiming: { budgetDuration: 51000 } }),
			makeTestSegment(segment_1_2_id, 2, RUNDOWN_1_ID, { segmentTiming: { budgetDuration: 15000 } }),
			makeTestSegment(segment_1_1_id, 1, RUNDOWN_1_ID, { segmentTiming: { budgetDuration: 5000 } }),
		])
		mockSubscriber.send.mockClear()
		handlers.partsHandler.notify([
			makeTestPart('1_2_1', 1, RUNDOWN_1_ID, segment_1_2_id),
			makeTestPart('2_2_1', 1, RUNDOWN_1_ID, segment_2_2_id),
			makeTestPart('1_2_2', 2, RUNDOWN_1_ID, segment_1_2_id),
			makeTestPart('1_1_2', 2, RUNDOWN_1_ID, segment_1_1_id),
			makeTestPart('1_1_1', 1, RUNDOWN_1_ID, segment_1_1_id),
			makeTestPart('2_2_2', 2, RUNDOWN_1_ID, segment_2_2_id),
			makeTestPart('1_1_2', 2, RUNDOWN_1_ID, segment_1_1_id),
		])
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		const expectedStatus: SegmentsEvent = {
			event: 'segments',
			rundownPlaylistId: unprotectString(testPlaylist._id),
			segments: [
				{
					id: '1_1',
					rundownId: RUNDOWN_1_ID,
					name: 'Segment 1_1',
					timing: { expectedDurationMs: 0, budgetDurationMs: 5000 },
					publicData: undefined,
				},
				{
					id: '1_2',
					rundownId: RUNDOWN_1_ID,
					name: 'Segment 1_2',
					timing: { expectedDurationMs: 0, budgetDurationMs: 15000 },
					publicData: undefined,
				},
				{
					id: '2_1',
					rundownId: RUNDOWN_2_ID,
					name: 'Segment 2_1',
					timing: { expectedDurationMs: 0 },
					publicData: undefined,
				},
				{
					id: '2_2',
					rundownId: RUNDOWN_2_ID,
					name: 'Segment 2_2',
					timing: { expectedDurationMs: 0, budgetDurationMs: 51000 },
					publicData: undefined,
				},
			],
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toEqual(
			JSON.parse(JSON.stringify(expectedStatus))
		)
	})

	it('exposes expectedDuration', async () => {
		const handlers = makeMockHandlers()
		const topic = new SegmentsTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const testPlaylist = makeTestPlaylist()
		handlers.playlistHandler.notify(testPlaylist)

		topic.addSubscriber(mockSubscriber)
		mockSubscriber.send.mockClear()

		const segment_1_1_id = '1_1'
		const segment_1_2_id = '1_2'
		const segment_2_2_id = '2_2'
		handlers.segmentsHandler.notify([
			makeTestSegment('2_1', 1, RUNDOWN_2_ID),
			makeTestSegment(segment_2_2_id, 2, RUNDOWN_2_ID),
			makeTestSegment(segment_1_2_id, 2, RUNDOWN_1_ID),
			makeTestSegment(segment_1_1_id, 1, RUNDOWN_1_ID),
		])
		mockSubscriber.send.mockClear()
		handlers.partsHandler.notify([
			makeTestPart('1_2_1', 1, RUNDOWN_1_ID, segment_1_2_id, {
				expectedDurationWithTransition: 10000,
			}),
			makeTestPart('2_2_1', 1, RUNDOWN_1_ID, segment_2_2_id, {
				expectedDurationWithTransition: 40000,
			}),
			makeTestPart('1_2_2', 2, RUNDOWN_1_ID, segment_1_2_id, {
				expectedDurationWithTransition: 5000,
			}),
			makeTestPart('1_1_2', 2, RUNDOWN_1_ID, segment_1_1_id, {
				expectedDurationWithTransition: 1000,
			}),
			makeTestPart('1_1_1', 1, RUNDOWN_1_ID, segment_1_1_id, {
				expectedDurationWithTransition: 3000,
			}),
			makeTestPart('2_2_2', 2, RUNDOWN_1_ID, segment_2_2_id, {
				expectedDurationWithTransition: 11000,
			}),
			makeTestPart('1_1_2', 2, RUNDOWN_1_ID, segment_1_1_id, {
				expectedDurationWithTransition: 1000,
			}),
		])
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		const expectedStatus: SegmentsEvent = {
			event: 'segments',
			rundownPlaylistId: unprotectString(testPlaylist._id),
			segments: [
				{
					id: '1_1',
					rundownId: RUNDOWN_1_ID,
					name: 'Segment 1_1',
					timing: { expectedDurationMs: 5000 },
					publicData: undefined,
				},
				{
					id: '1_2',
					rundownId: RUNDOWN_1_ID,
					name: 'Segment 1_2',
					timing: { expectedDurationMs: 15000 },
					publicData: undefined,
				},
				{
					id: '2_1',
					rundownId: RUNDOWN_2_ID,
					name: 'Segment 2_1',
					timing: { expectedDurationMs: 0 },
					publicData: undefined,
				},
				{
					id: '2_2',
					rundownId: RUNDOWN_2_ID,
					name: 'Segment 2_2',
					timing: { expectedDurationMs: 51000 },
					publicData: undefined,
				},
			],
		}
		expect(mockSubscriber.send.mock.calls).toEqual([[JSON.stringify(expectedStatus)]])
	})

	it('includes segment identifier', async () => {
		const handlers = makeMockHandlers()
		const topic = new SegmentsTopic(makeMockLogger(), handlers)
		const mockSubscriber = makeMockSubscriber()

		const testPlaylist = makeTestPlaylist()
		handlers.playlistHandler.notify(testPlaylist)
		handlers.segmentsHandler.notify([
			{ ...makeTestSegment('1_2', 2, RUNDOWN_1_ID), identifier: 'SomeIdentifier' },
			makeTestSegment('1_1', 1, RUNDOWN_1_ID),
		])

		topic.addSubscriber(mockSubscriber)
		mockSubscriber.send.mockClear()

		const testPlaylist2 = makeTestPlaylist()
		testPlaylist2.rundownIdsInOrder = [protectString(RUNDOWN_2_ID), protectString(RUNDOWN_1_ID)]
		handlers.playlistHandler.notify(testPlaylist2)
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		const expectedStatus: SegmentsEvent = {
			event: 'segments',
			rundownPlaylistId: unprotectString(testPlaylist._id),
			segments: [
				{ id: '1_1', rundownId: RUNDOWN_1_ID, name: 'Segment 1_1' },
				{ id: '1_2', rundownId: RUNDOWN_1_ID, name: 'Segment 1_2', identifier: 'SomeIdentifier' },
			],
		} as SegmentsEvent
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(
			JSON.parse(JSON.stringify(expectedStatus))
		)
	})
})
