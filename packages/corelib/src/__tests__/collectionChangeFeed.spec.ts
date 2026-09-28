import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
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
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	function setup() {
		const streams: FakeStream[] = []
		const factory = vi.fn(() => {
			const s = new FakeStream()
			streams.push(s)
			return s
		})
		const onEmpty = vi.fn()
		const feed = new CollectionChangeFeed('testColl', factory, onEmpty)
		return { feed, factory, streams, onEmpty }
	}

	test('starts the stream on the first subscriber, not before', () => {
		const { feed, factory } = setup()
		expect(factory).not.toHaveBeenCalled()
		expect(feed.isStreaming).toBe(false)

		feed.subscribe(vi.fn(), vi.fn())
		expect(factory).toHaveBeenCalledTimes(1)
		expect(feed.isStreaming).toBe(true)
	})

	test('fans change events out to all subscribers', () => {
		const { feed, streams } = setup()
		const a = vi.fn()
		const b = vi.fn()
		feed.subscribe(a, vi.fn())
		feed.subscribe(b, vi.fn())

		const change = { operationType: 'insert' } as any
		streams[0].emit('change', change)

		expect(a).toHaveBeenCalledWith(change)
		expect(b).toHaveBeenCalledWith(change)
	})

	test('a second subscriber reuses the existing stream', () => {
		const { feed, factory } = setup()
		feed.subscribe(vi.fn(), vi.fn())
		feed.subscribe(vi.fn(), vi.fn())
		expect(factory).toHaveBeenCalledTimes(1)
	})

	test('fires onResync on the first attach (so the snapshot runs after the stream is open)', () => {
		const { feed } = setup()
		const onResync = vi.fn()
		feed.subscribe(vi.fn(), onResync)
		expect(onResync).toHaveBeenCalledTimes(1)
	})

	test('restarts with backoff on error and fires onResync again', () => {
		const { feed, factory, streams } = setup()
		const onResync = vi.fn()
		feed.subscribe(vi.fn(), onResync)
		onResync.mockClear() // ignore the first-attach resync; this test is about the reconnect one

		streams[0].emit('error', new Error('boom'))
		expect(feed.isStreaming).toBe(false)
		expect(streams[0].closed).toBe(true)

		// Not restarted until the backoff elapses
		vi.advanceTimersByTime(CHANGE_FEED_RESTART_BACKOFF_MS - 1)
		expect(factory).toHaveBeenCalledTimes(1)
		expect(onResync).not.toHaveBeenCalled()

		vi.advanceTimersByTime(1)
		expect(factory).toHaveBeenCalledTimes(2)
		expect(feed.isStreaming).toBe(true)
		expect(onResync).toHaveBeenCalledTimes(1)
	})

	test('restarts on stream end the same way', () => {
		const { feed, factory, streams } = setup()
		const onResync = vi.fn()
		feed.subscribe(vi.fn(), onResync)
		onResync.mockClear() // ignore the first-attach resync

		streams[0].emit('end')
		vi.advanceTimersByTime(CHANGE_FEED_RESTART_BACKOFF_MS)
		expect(factory).toHaveBeenCalledTimes(2)
		expect(onResync).toHaveBeenCalledTimes(1)
	})

	test('last unsubscribe stops the stream and reports empty', () => {
		const { feed, streams, onEmpty } = setup()
		const h1 = feed.subscribe(vi.fn(), vi.fn())
		const h2 = feed.subscribe(vi.fn(), vi.fn())

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
		const h = feed.subscribe(vi.fn(), vi.fn())
		h.stop()
		streams[0].emit('error', new Error('late')) // a late error from the closing stream
		vi.advanceTimersByTime(CHANGE_FEED_RESTART_BACKOFF_MS * 2)
		expect(factory).toHaveBeenCalledTimes(1) // never restarted
	})

	test('stop() during change fan-out is safe', () => {
		const { feed, streams } = setup()
		const second: { handle?: { stop(): void } } = {}
		const a = vi.fn(() => second.handle?.stop())
		const b = vi.fn()
		feed.subscribe(a, vi.fn())
		second.handle = feed.subscribe(b, vi.fn())

		expect(() => streams[0].emit('change', { operationType: 'insert' } as any)).not.toThrow()
		expect(a).toHaveBeenCalledTimes(1)
	})
})
