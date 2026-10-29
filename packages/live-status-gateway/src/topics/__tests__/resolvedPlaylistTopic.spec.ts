import { ResolvedPlaylistTopic } from '../resolvedPlaylistTopic.js'
import { protectString } from '@sofie-automation/server-core-integration'
import type { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import type { ResolvedPart, ResolvedPlaylistEvent } from '@sofie-automation/live-status-gateway-api'
import type { MockProxy } from 'jest-mock-extended'
import type { WebSocket } from 'ws'
import type { ShowStyleBaseExt } from '../../collections/showStyleBaseHandler.js'
import type { CollectionHandlers } from '../../liveStatusServer.js'
import type { PlaylistTimingStates } from '../../collections/playlistTimingStatesHandler.js'
import {
	constantMs,
	makeMockHandlers,
	makeMockLogger,
	makeMockSubscriber,
	makeTestParts,
	makeTestPlaylist,
	makeTestTimingStates,
} from './utils.js'

/** Just past the topic's throttle period of 100 ms */
const THROTTLE_PERIOD_MS = 105

const RUNDOWN_1_ID = 'RUNDOWN_1'
const SHOW_STYLE_BASE_ID = 'SHOW_STYLE_BASE_1'

function makeTestRundown(): DBRundown {
	return {
		_id: protectString(RUNDOWN_1_ID),
		externalId: 'NCS_RUNDOWN_1',
		name: 'Rundown 1',
		showStyleBaseId: protectString(SHOW_STYLE_BASE_ID),
	} as DBRundown
}

/** The segment of the part from makeTestParts */
function makeTestSegment(): DBSegment {
	return {
		_id: protectString('segment0'),
		externalId: 'NCS_SEGMENT_0',
		name: 'Segment 0',
		_rank: 0,
		rundownId: protectString(RUNDOWN_1_ID),
	}
}

/** A show style without layers, as the part under test has no pieces */
function makeTestShowStyleBaseWithoutLayers(): ShowStyleBaseExt {
	return {
		_id: protectString(SHOW_STYLE_BASE_ID),
		sourceLayers: {},
		outputLayers: {},
		sourceLayerNamesById: new Map(),
		outputLayerNamesById: new Map(),
	} as unknown as ShowStyleBaseExt
}

/** A topic that holds a playlist with one rundown, one segment and one part, and one subscriber */
function makeTopicWithOnePart(): { handlers: CollectionHandlers; subscriber: MockProxy<WebSocket> } {
	const handlers = makeMockHandlers()
	const topic = new ResolvedPlaylistTopic(makeMockLogger(), handlers)

	handlers.playlistHandler.notify(makeTestPlaylist())
	handlers.showStyleBaseHandler.notify(makeTestShowStyleBaseWithoutLayers())
	handlers.rundownsHandler.notify([makeTestRundown()])
	handlers.segmentsHandler.notify([makeTestSegment()])
	handlers.partsHandler.notify(makeTestParts())
	jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

	const subscriber = makeMockSubscriber()
	topic.addSubscriber(subscriber)

	return { handlers, subscriber }
}

/**
 * The timing of the part from makeTestParts, as Sofie publishes it: its countdown is the playlist's base for the part
 * countdowns, shifted by the part's offset of 30 s before the end of the last part
 */
function makeTestTimingStatesOfOnePart(partCountdownBase: TimerState): PlaylistTimingStates {
	return makeTestTimingStates({
		playlist: { partCountdownBase },
		segments: {
			segment0: {
				parts: {
					part0: {
						expectedDuration: constantMs(1000),
						displayDuration: constantMs(3000),
						isInQuickLoop: true,
						countsTowardsTiming: true,
						countdownOffset: -30000,
					},
				},
			},
		},
	})
}

function partInLastMessage(subscriber: MockProxy<WebSocket>): ResolvedPart {
	const lastCall = subscriber.send.mock.calls[subscriber.send.mock.calls.length - 1]
	const lastMessage = JSON.parse(lastCall[0] as string) as ResolvedPlaylistEvent
	return lastMessage.rundowns[0].segments[0].parts[0]
}

describe('ResolvedPlaylistTopic', () => {
	beforeEach(() => {
		jest.useFakeTimers()
	})
	afterEach(() => {
		jest.useRealTimers()
	})

	it('sends zeros in each part rundown timing while the timing has not arrived', () => {
		const { subscriber } = makeTopicWithOnePart()

		const part = partInLastMessage(subscriber)

		expect(part.id).toBe('part0')
		expect(part.rundownTiming).toEqual({
			expectedDurationMs: 0,
			displayDurationMs: 0,
			isInQuickLoop: false,
			countsTowardsTiming: false,
		})
	})

	it('sends each part rundown timing as Sofie published it', () => {
		const { handlers, subscriber } = makeTopicWithOnePart()

		handlers.playlistTimingStatesHandler.notify(
			makeTestTimingStatesOfOnePart({ paused: false, zeroTime: 1600000100000 })
		)
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		const part = partInLastMessage(subscriber)

		expect(part.id).toBe('part0')
		expect(part.rundownTiming).toEqual({
			expectedDurationMs: 1000,
			displayDurationMs: 3000,
			isInQuickLoop: true,
			countsTowardsTiming: true,
			countdown: { paused: false, zeroTime: 1600000070000 },
		})
	})

	it("sends each part's new countdown when only the playlist's base for the part countdowns changes", () => {
		const { handlers, subscriber } = makeTopicWithOnePart()
		handlers.playlistTimingStatesHandler.notify(makeTestTimingStatesOfOnePart({ paused: true, duration: 60000 }))
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)
		expect(partInLastMessage(subscriber).rundownTiming?.countdown).toEqual({ paused: true, duration: 30000 })

		// a take: the base starts running, and the part's own document is the same
		handlers.playlistTimingStatesHandler.notify(
			makeTestTimingStatesOfOnePart({ paused: false, zeroTime: 1600000100000 })
		)
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		expect(partInLastMessage(subscriber).rundownTiming?.countdown).toEqual({
			paused: false,
			zeroTime: 1600000070000,
		})
	})

	it('does not send the message again when a timing update leaves it unchanged', () => {
		const { handlers, subscriber } = makeTopicWithOnePart()
		const partCountdownBase: TimerState = { paused: false, zeroTime: 1600000100000 }
		handlers.playlistTimingStatesHandler.notify(makeTestTimingStatesOfOnePart(partCountdownBase))
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)
		subscriber.send.mockClear()

		// Sofie publishes the same timing again, as new documents with the same values
		handlers.playlistTimingStatesHandler.notify(makeTestTimingStatesOfOnePart({ ...partCountdownBase }))
		jest.advanceTimersByTime(THROTTLE_PERIOD_MS)

		expect(subscriber.send.mock.calls).toEqual([])
	})
})
