import { PartTimingsTopic } from '../partTimingsTopic.js'
import { protectString } from '@sofie-automation/server-core-integration'
import type { PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import type { PartTimingsEvent } from '@sofie-automation/live-status-gateway-api'
import type { MockProxy } from 'jest-mock-extended'
import type { WebSocket } from 'ws'
import type { CollectionHandlers } from '../../liveStatusServer.js'
import type { PlaylistTimingStates } from '../../collections/playlistTimingStatesHandler.js'
import {
	makeMockHandlers,
	makeMockLogger,
	makeMockSubscriber,
	makeTestPlaylist,
	makeTestTimingStates,
} from './utils.js'

/** Just past the topic's throttle period of 100 ms */
const THROTTLE_PERIOD_MS = 105

/** A topic that holds the active playlist, and one subscriber */
function makeTopic(): { handlers: CollectionHandlers; subscriber: MockProxy<WebSocket> } {
	const handlers = makeMockHandlers()
	const topic = new PartTimingsTopic(makeMockLogger(), handlers)

	handlers.playlistHandler.notify(makeTestPlaylist())
	jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

	const subscriber = makeMockSubscriber()
	topic.addSubscriber(subscriber)

	return { handlers, subscriber }
}

/**
 * The timing of two parts as Sofie publishes it, with part0 on air and part1 after it: the countdown of part1 is
 * the playlist's base for the part countdowns, shifted by its offset of 30 s
 */
function makeTestTimingStatesOfTwoParts(
	partCountdownBase: TimerState,
	currentPartInstanceId = protectString<PartInstanceId>('partInstance0')
): PlaylistTimingStates {
	return makeTestTimingStates({
		playlist: { partCountdownBase, currentPartInstanceId },
		segments: {
			segment0: {
				parts: {
					// published out of order, as documents have no order of their own
					part1: {
						rank: 1,
						expectedDuration: 1000,
						displayDuration: 3000,
						isInQuickLoop: true,
						countsTowardsTiming: true,
						countdownOffset: -30000,
					},
					part0: {
						rank: 0,
						partInstanceId: currentPartInstanceId,
						expectedDuration: 2000,
						displayDuration: 2000,
						isInQuickLoop: false,
						countsTowardsTiming: true,
						played: { paused: false, zeroTime: 1600000060000 },
					},
				},
			},
		},
	})
}

function lastMessage(subscriber: MockProxy<WebSocket>): PartTimingsEvent {
	const lastCall = subscriber.send.mock.calls[subscriber.send.mock.calls.length - 1]
	return JSON.parse(lastCall[0] as string) as PartTimingsEvent
}

describe('PartTimingsTopic', () => {
	beforeEach(() => {
		jest.useFakeTimers()
	})
	afterEach(() => {
		jest.useRealTimers()
	})

	it('sends no parts while the timing has not arrived', () => {
		const { subscriber } = makeTopic()

		expect(lastMessage(subscriber)).toEqual({
			event: 'partTimings',
			rundownPlaylistId: 'PLAYLIST_1',
			currentPartInstanceId: null,
			parts: [],
		})
	})

	it("sends each part's timing as Sofie published it, in Sofie's order", () => {
		const { handlers, subscriber } = makeTopic()

		handlers.playlistTimingStatesHandler.notify(
			makeTestTimingStatesOfTwoParts({ paused: false, zeroTime: 1600000100000 })
		)
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		expect(lastMessage(subscriber)).toEqual({
			event: 'partTimings',
			rundownPlaylistId: 'PLAYLIST_1',
			currentPartInstanceId: 'partInstance0',
			parts: [
				{
					id: 'part0',
					instanceId: 'partInstance0',
					segmentId: 'segment0',
					rank: 0,
					expectedDurationMs: 2000,
					displayDurationMs: 2000,
					isInQuickLoop: false,
					countsTowardsTiming: true,
					played: { paused: false, zeroTime: 1600000060000 },
				},
				{
					id: 'part1',
					instanceId: null,
					segmentId: 'segment0',
					rank: 1,
					expectedDurationMs: 1000,
					displayDurationMs: 3000,
					isInQuickLoop: true,
					countsTowardsTiming: true,
					countdown: { paused: false, zeroTime: 1600000070000 },
				},
			],
		})
	})

	it("sends each part's new countdown when only the playlist's base for the part countdowns changes", () => {
		const { handlers, subscriber } = makeTopic()
		handlers.playlistTimingStatesHandler.notify(makeTestTimingStatesOfTwoParts({ paused: true, duration: 60000 }))
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)
		expect(lastMessage(subscriber).parts[1].countdown).toEqual({ paused: true, duration: 30000 })

		// the base starts running, and the part's own document is the same
		handlers.playlistTimingStatesHandler.notify(
			makeTestTimingStatesOfTwoParts({ paused: false, zeroTime: 1600000100000 })
		)
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		expect(lastMessage(subscriber).parts[1].countdown).toEqual({ paused: false, zeroTime: 1600000070000 })
	})

	it('says which part instance the timing treats as on air, so that a consumer can tell when it is behind a take', () => {
		const { handlers, subscriber } = makeTopic()
		const base: TimerState = { paused: false, zeroTime: 1600000100000 }
		handlers.playlistTimingStatesHandler.notify(makeTestTimingStatesOfTwoParts(base))
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)
		expect(lastMessage(subscriber).currentPartInstanceId).toBe('partInstance0')

		// Sofie has timed the take of the next part
		handlers.playlistTimingStatesHandler.notify(
			makeTestTimingStatesOfTwoParts(base, protectString<PartInstanceId>('partInstance1'))
		)
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		expect(lastMessage(subscriber).currentPartInstanceId).toBe('partInstance1')
	})

	it('sends no timing of another playlist, still held after a switch of playlist', () => {
		const { handlers, subscriber } = makeTopic()
		handlers.playlistTimingStatesHandler.notify(
			makeTestTimingStatesOfTwoParts({ paused: false, zeroTime: 1600000100000 })
		)
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		handlers.playlistHandler.notify(makeTestPlaylist('PLAYLIST_2'))
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		expect(lastMessage(subscriber)).toEqual({
			event: 'partTimings',
			rundownPlaylistId: 'PLAYLIST_2',
			currentPartInstanceId: null,
			parts: [],
		})
	})

	it('does not send the message again when a timing update leaves it unchanged', () => {
		const { handlers, subscriber } = makeTopic()
		const partCountdownBase: TimerState = { paused: false, zeroTime: 1600000100000 }
		handlers.playlistTimingStatesHandler.notify(makeTestTimingStatesOfTwoParts(partCountdownBase))
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)
		subscriber.send.mockClear()

		// Sofie publishes the same timing again, as new documents with the same values
		handlers.playlistTimingStatesHandler.notify(makeTestTimingStatesOfTwoParts({ ...partCountdownBase }))
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		expect(subscriber.send.mock.calls).toEqual([])
	})
})
