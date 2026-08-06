import { CollectionChangeFeed, CHANGE_FEED_RESTART_BACKOFF_MS, ChangeStreamLike } from '../collectionChangeFeed.js'

class FakeStream implements ChangeStreamLike {
	listeners: Record<string, Array<(arg?: any) => void>> = {}
	closed = false
	on(event: any, cb: any): this {
		;(this.listeners[event] ??= []).push(cb)
		return this
	}
	emit(event: string, arg?: any): void {
		for (const cb of this.listeners[event] ?? []) cb(arg)
	}
	async close(): Promise<void> {
		this.closed = true
	}
}

describe('CollectionChangeFeed', () => {
	beforeEach(() => jest.useFakeTimers())
	afterEach(() => jest.useRealTimers())

	function setup() {
		const streams: FakeStream[] = []
		const factory = jest.fn(() => {
			const s = new FakeStream()
			streams.push(s)
			return s
		})
		const onEmpty = jest.fn()
		const feed = new CollectionChangeFeed('testColl', factory, onEmpty)
		return { feed, factory, streams, onEmpty }
	}

	test('starts the stream on the first subscriber, not before', () => {
		const { feed, factory } = setup()
		expect(factory).not.toHaveBeenCalled()
		expect(feed.isStreaming).toBe(false)

		feed.subscribe(jest.fn(), jest.fn())
		expect(factory).toHaveBeenCalledTimes(1)
		expect(feed.isStreaming).toBe(true)
	})

	test('fans change events out to all subscribers', () => {
		const { feed, streams } = setup()
		const a = jest.fn()
		const b = jest.fn()
		feed.subscribe(a, jest.fn())
		feed.subscribe(b, jest.fn())

		const change = { operationType: 'insert' } as any
		streams[0].emit('change', change)

		expect(a).toHaveBeenCalledWith(change)
		expect(b).toHaveBeenCalledWith(change)
	})

	test('a second subscriber reuses the existing stream', () => {
		const { feed, factory } = setup()
		feed.subscribe(jest.fn(), jest.fn())
		feed.subscribe(jest.fn(), jest.fn())
		expect(factory).toHaveBeenCalledTimes(1)
	})

	test('fires onResync on the first attach (so the snapshot runs after the stream is open)', () => {
		const { feed } = setup()
		const onResync = jest.fn()
		feed.subscribe(jest.fn(), onResync)
		expect(onResync).toHaveBeenCalledTimes(1)
	})

	test('restarts with backoff on error and fires onResync again', () => {
		const { feed, factory, streams } = setup()
		const onResync = jest.fn()
		feed.subscribe(jest.fn(), onResync)
		onResync.mockClear() // ignore the first-attach resync; this test is about the reconnect one

		streams[0].emit('error', new Error('boom'))
		expect(feed.isStreaming).toBe(false)
		expect(streams[0].closed).toBe(true)

		// Not restarted until the backoff elapses
		jest.advanceTimersByTime(CHANGE_FEED_RESTART_BACKOFF_MS - 1)
		expect(factory).toHaveBeenCalledTimes(1)
		expect(onResync).not.toHaveBeenCalled()

		jest.advanceTimersByTime(1)
		expect(factory).toHaveBeenCalledTimes(2)
		expect(feed.isStreaming).toBe(true)
		expect(onResync).toHaveBeenCalledTimes(1)
	})

	test('restarts on stream end the same way', () => {
		const { feed, factory, streams } = setup()
		const onResync = jest.fn()
		feed.subscribe(jest.fn(), onResync)
		onResync.mockClear() // ignore the first-attach resync

		streams[0].emit('end')
		jest.advanceTimersByTime(CHANGE_FEED_RESTART_BACKOFF_MS)
		expect(factory).toHaveBeenCalledTimes(2)
		expect(onResync).toHaveBeenCalledTimes(1)
	})

	test('last unsubscribe stops the stream and reports empty', () => {
		const { feed, streams, onEmpty } = setup()
		const h1 = feed.subscribe(jest.fn(), jest.fn())
		const h2 = feed.subscribe(jest.fn(), jest.fn())

		h1.stop()
		expect(feed.isStreaming).toBe(true)
		expect(onEmpty).not.toHaveBeenCalled()

		h2.stop()
		expect(feed.isStreaming).toBe(false)
		expect(streams[0].closed).toBe(true)
		expect(onEmpty).toHaveBeenCalledTimes(1)
		expect(feed.subscriberCount).toBe(0)
	})

	test('does not restart after the last subscriber has gone', () => {
		const { feed, factory, streams } = setup()
		const h = feed.subscribe(jest.fn(), jest.fn())
		h.stop()
		streams[0].emit('error', new Error('late')) // a late error from the closing stream
		jest.advanceTimersByTime(CHANGE_FEED_RESTART_BACKOFF_MS * 2)
		expect(factory).toHaveBeenCalledTimes(1) // never restarted
	})

	test('stop() during change fan-out is safe', () => {
		const { feed, streams } = setup()
		const second: { handle?: { stop(): void } } = {}
		const a = jest.fn(() => second.handle?.stop())
		const b = jest.fn()
		feed.subscribe(a, jest.fn())
		second.handle = feed.subscribe(b, jest.fn())

		expect(() => streams[0].emit('change', { operationType: 'insert' } as any)).not.toThrow()
		expect(a).toHaveBeenCalledTimes(1)
	})
})
