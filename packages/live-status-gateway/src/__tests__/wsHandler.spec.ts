import type { WebSocket } from 'ws'
import type { PongEvent, SegmentsEvent } from '@sofie-automation/live-status-gateway-api'
import { WebSocketTopicBase } from '../wsHandler.js'
import { makeMockLogger, makeMockSubscriber } from '../topics/__tests__/utils.js'

/** A topic whose message is a segments event for the playlist id it holds */
class TestTopic extends WebSocketTopicBase {
	playlistId = 'PLAYLIST_1'

	constructor() {
		super('test', makeMockLogger())
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		const message: SegmentsEvent = { event: 'segments', rundownPlaylistId: this.playlistId, segments: [] }
		this.sendMessage(subscribers, message)
	}

	sendToAll(): void {
		this.sendStatusToAll()
	}
}

function messagesSentTo(subscriber: ReturnType<typeof makeMockSubscriber>): unknown[] {
	return subscriber.send.mock.calls.map((call) => JSON.parse(call[0] as string))
}

function segmentsEventFor(playlistId: string): SegmentsEvent {
	return { event: 'segments', rundownPlaylistId: playlistId, segments: [] }
}

describe('WebSocketTopicBase', () => {
	it('does not send a message to all subscribers again when it has not changed', () => {
		const topic = new TestTopic()
		const subscriber = makeMockSubscriber()
		topic.addSubscriber(subscriber)
		subscriber.send.mockClear()

		topic.playlistId = 'PLAYLIST_2'
		topic.sendToAll()
		topic.sendToAll()

		expect(messagesSentTo(subscriber)).toEqual([segmentsEventFor('PLAYLIST_2')])
	})

	it('sends a changed message to all subscribers', () => {
		const topic = new TestTopic()
		const subscriber = makeMockSubscriber()
		topic.addSubscriber(subscriber)
		subscriber.send.mockClear()

		topic.playlistId = 'PLAYLIST_2'
		topic.sendToAll()
		topic.playlistId = 'PLAYLIST_3'
		topic.sendToAll()

		expect(messagesSentTo(subscriber)).toEqual([segmentsEventFor('PLAYLIST_2'), segmentsEventFor('PLAYLIST_3')])
	})

	it('sends the current message to a new subscriber, also when the others have it already', () => {
		const topic = new TestTopic()
		const firstSubscriber = makeMockSubscriber()
		topic.addSubscriber(firstSubscriber)
		topic.sendToAll()

		const newSubscriber = makeMockSubscriber()
		topic.addSubscriber(newSubscriber)

		expect(messagesSentTo(newSubscriber)).toEqual([segmentsEventFor('PLAYLIST_1')])
	})

	it('after a subscriber joins, sends the next message to all subscribers, also when it equals the last one sent to all', () => {
		const topic = new TestTopic()
		const firstSubscriber = makeMockSubscriber()
		topic.addSubscriber(firstSubscriber)
		topic.sendToAll()

		// The new subscriber joins while the topic holds a message the first subscriber has not received
		topic.playlistId = 'PLAYLIST_2'
		const newSubscriber = makeMockSubscriber()
		topic.addSubscriber(newSubscriber)

		// The topic is back at the message the first subscriber has, which the new subscriber has not received
		topic.playlistId = 'PLAYLIST_1'
		topic.sendToAll()

		expect(messagesSentTo(newSubscriber)).toEqual([segmentsEventFor('PLAYLIST_2'), segmentsEventFor('PLAYLIST_1')])
	})

	it('always sends a message to one recipient, also when it equals the previous one', () => {
		const topic = new TestTopic()
		const subscriber = makeMockSubscriber()
		const pong: PongEvent = { event: 'pong', reqid: 1 }

		topic.sendMessage(subscriber, pong)
		topic.sendMessage(subscriber, pong)

		expect(messagesSentTo(subscriber)).toEqual([pong, pong])
	})
})
