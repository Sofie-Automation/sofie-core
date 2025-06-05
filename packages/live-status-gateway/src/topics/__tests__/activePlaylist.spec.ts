import { ActivePlaylistTopic } from '../activePlaylistTopic.js'
import {
	makeMockHandlers,
	makeMockLogger,
	makeMockSubscriber,
	makeTestPlaylist,
	makeTestShowStyleBase,
} from './utils.js'
import { ShowStyleBaseExt } from '../../collections/showStyleBaseHandler.js'
import { SelectedPartInstances } from '../../collections/partInstancesHandler.js'
import { protectString, unprotectString, unprotectStringArray } from '@sofie-automation/server-core-integration/dist'
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

function makeEmptyTestPartInstances(): SelectedPartInstances {
	return {
		previous: undefined,
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
			currentPart: null,
			nextPart: null,
			currentSegment: null,
			rundownIds: unprotectStringArray(playlist.rundownIdsInOrder),
			publicData: undefined,
			timing: {
				timingMode: ActivePlaylistTimingMode.NONE,
			},
			quickLoop: undefined,
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(
			JSON.parse(JSON.stringify(expectedStatus))
		)
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

		handlers.segmentHandler.notify({
			_id: segment1id,
		} as DBSegment)

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: ActivePlaylistEvent = {
			event: 'activePlaylist',
			name: playlist.name,
			id: unprotectString(playlist._id),
			currentPart: {
				id: 'PART_1',
				name: 'Test Part',
				segmentId: 'SEGMENT_1',
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
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(
			JSON.parse(JSON.stringify(expectedStatus))
		)
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

		handlers.segmentHandler.notify({
			_id: segment1id,
			segmentTiming: { budgetDuration: 12300, countdownType: CountdownType.SEGMENT_BUDGET_DURATION },
		} as DBSegment)

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: ActivePlaylistEvent = {
			event: 'activePlaylist',
			name: playlist.name,
			id: unprotectString(playlist._id),
			currentPart: {
				id: 'PART_1',
				name: 'Test Part',
				segmentId: 'SEGMENT_1',
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
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(
			JSON.parse(JSON.stringify(expectedStatus))
		)
	})
})
