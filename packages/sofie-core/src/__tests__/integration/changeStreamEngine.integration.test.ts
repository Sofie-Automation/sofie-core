/**
 * Integration tests for the change-stream observe engine against a REAL MongoDB.
 *
 * Moved out of `server/collections/changeStream/__tests__/` into the shared `integration` jest project:
 * instead of booting its own `MongoMemoryReplSet` per file, it connects to the single replica set started
 * once by `__mocks__/integration-global-setup.js` (change streams require a replica set). Run via
 * `yarn unit:integration`.
 */
import { MongoClient, ChangeStreamDocument } from 'mongodb'
import {
	CollectionChangeFeed,
	createCollectionChangeStream,
	ChangeStreamLike,
} from '../../collections/changeStream/collectionChangeFeed'
import { ObserveMultiplexer, ObserveMultiplexerDeps } from '../../collections/changeStream/observeMultiplexer'
import { connectSharedMongoClient, freshCollection } from './_integrationDb'
import { TestDoc, id, waitFor, newSink, makeMultiplexer, subscribeChanges } from './_observeHelpers'

describe('change-stream engine (integration)', () => {
	let client: MongoClient

	// Every observe in a test shares this one signal; afterEach aborts it (and beforeEach makes a fresh one),
	// which cascades to stopping the underlying change feed (otherwise a closed client would restart-loop forever).
	// Future: once we are using vitest, we can use the signal vitest provides, to ensure cleanup happens promptly during a timeout
	let observers: AbortController

	beforeAll(async () => {
		client = await connectSharedMongoClient()
	}, 120000)

	beforeEach(() => {
		observers = new AbortController()
	})

	afterEach(() => {
		observers.abort()
	})

	afterAll(async () => {
		await client?.close()
	})

	test('initial snapshot, insert, update, delete', async () => {
		const collection = await freshCollection<TestDoc>(client, [{ _id: id('A'), name: 'a', val: 1 }])
		const sink = newSink()
		const m = makeMultiplexer(client, collection, {}, undefined)
		await subscribeChanges(m, sink, observers.signal)

		expect(sink.added).toEqual([[id('A'), { name: 'a', val: 1 }]])

		await collection.insertOne({ _id: id('B'), name: 'b', val: 2 } as any)
		await waitFor(() => sink.added.length === 2)
		expect(sink.added[1]).toEqual([id('B'), { name: 'b', val: 2 }])

		await collection.updateOne({ _id: id('A') }, { $set: { val: 9 } })
		await waitFor(() => sink.changed.length === 1)
		expect(sink.changed[0]).toEqual([id('A'), { val: 9 }])

		await collection.deleteOne({ _id: id('B') })
		await waitFor(() => sink.removed.length === 1)
		expect(sink.removed[0]).toEqual(id('B'))
	})

	test('selector enter/leave and projection', async () => {
		const collection = await freshCollection<TestDoc>(client)
		const sink = newSink()
		const m = makeMultiplexer(client, collection, { studioId: 's1' }, { studioId: 1, val: 1 })
		await subscribeChanges(m, sink, observers.signal)

		// insert outside selector → nothing; then move it in → added
		await collection.insertOne({ _id: id('X'), studioId: 's2', val: 1, name: 'secret' } as any)
		await collection.updateOne({ _id: id('X') }, { $set: { studioId: 's1' } })
		await waitFor(() => sink.added.length === 1)
		// projection: only studioId + val (and _id stripped from fields), NOT name
		expect(sink.added[0]).toEqual([id('X'), { studioId: 's1', val: 1 }])

		// change a non-projected field → no emit; change a projected one → emit
		await collection.updateOne({ _id: id('X') }, { $set: { name: 'other' } })
		await collection.updateOne({ _id: id('X') }, { $set: { val: 5 } })
		await waitFor(() => sink.changed.length === 1)
		expect(sink.changed[0]).toEqual([id('X'), { val: 5 }])

		// move out of selector → removed
		await collection.updateOne({ _id: id('X') }, { $set: { studioId: 's3' } })
		await waitFor(() => sink.removed.length === 1)
		expect(sink.removed[0]).toEqual(id('X'))
	})

	test('two observers with identical args share one change stream', async () => {
		const collection = await freshCollection<TestDoc>(client, [{ _id: id('A'), val: 1 }])
		let watchCount = 0

		const feed = new CollectionChangeFeed(
			collection.collectionName,
			() => {
				watchCount++
				return createCollectionChangeStream(client, client.db(), collection.collectionName)
			},
			() => undefined
		)
		const deps: ObserveMultiplexerDeps<TestDoc> = {
			snapshot: async () => ({
				docs: (await collection.find({}).toArray()) as unknown as TestDoc[],
				operationTime: undefined,
			}),
			subscribeFeed: (onChange, onReconnect) =>
				feed.subscribe(onChange as (c: ChangeStreamDocument<any>) => void, onReconnect),
		}
		const m = new ObserveMultiplexer<TestDoc>({}, undefined, undefined, deps, () => undefined)

		const a: any[] = []
		const b: any[] = []
		await m.addObserveChangesSubscriber(
			{ added: (i: any) => a.push(i), changed: () => 0, removed: () => 0 } as any,
			observers.signal,
			false
		)
		await m.addObserveChangesSubscriber(
			{ added: (i: any) => b.push(i), changed: () => 0, removed: () => 0 } as any,
			observers.signal,
			false
		)

		await collection.insertOne({ _id: id('C'), val: 3 } as any)
		await waitFor(() => a.length === 2 && b.length === 2)

		expect(watchCount).toBe(1) // one shared change stream
		expect(a).toEqual([id('A'), id('C')])
		expect(b).toEqual([id('A'), id('C')])
	})

	test('observe() delivers full documents on add/change/remove', async () => {
		const collection = await freshCollection<TestDoc>(client, [{ _id: id('A'), val: 1 }])
		const added: any[] = []
		const changed: Array<[any, any]> = []
		const removed: any[] = []
		const m = makeMultiplexer(client, collection, {}, undefined)
		await m.addObserveSubscriber(
			{
				added: (d: any) => added.push(d),
				changed: (n: any, o: any) => changed.push([n, o]),
				removed: (d: any) => removed.push(d),
			} as any,
			observers.signal,
			false
		)

		expect(added[0]).toEqual({ _id: id('A'), val: 1 })

		await collection.updateOne({ _id: id('A') }, { $set: { val: 2 } })
		await waitFor(
			() => changed.length === 1,
			undefined,
			() => `1 changed, got ${changed.length}: ${JSON.stringify(changed)} (added ${JSON.stringify(added)})`
		)
		expect(changed[0]).toEqual([
			{ _id: id('A'), val: 2 },
			{ _id: id('A'), val: 1 },
		])

		await collection.deleteOne({ _id: id('A') })
		await waitFor(
			() => removed.length === 1,
			undefined,
			() => `1 removed, got ${removed.length}: ${JSON.stringify(removed)}`
		)
		expect(removed[0]).toEqual({ _id: id('A'), val: 2 })
	})

	test('a replaceOne is observed as a changed transition', async () => {
		const collection = await freshCollection<TestDoc>(client, [{ _id: id('A'), name: 'a', val: 1 }])
		const sink = newSink()
		const m = makeMultiplexer(client, collection, {}, undefined)
		await subscribeChanges(m, sink, observers.signal)
		expect(sink.added).toEqual([[id('A'), { name: 'a', val: 1 }]])

		await collection.replaceOne({ _id: id('A') }, { name: 'b', val: 1 } as any)
		await waitFor(() => sink.changed.length === 1)
		expect(sink.changed[0]).toEqual([id('A'), { name: 'b' }])
	})

	test('recovers writes made while the change stream is down (reconnect re-sync)', async () => {
		const collection = await freshCollection<TestDoc>(client, [{ _id: id('A'), val: 1 }])
		const sink = newSink()

		// A controllable stream: it wraps the REAL change stream, but lets the test inject a synthetic
		// 'error' to force the feed to drop + reconnect (rather than waiting for a real network failure).
		let errorListeners: Array<(e: Error) => void> = []
		const feed = new CollectionChangeFeed(
			collection.collectionName,
			async () => {
				const real = await createCollectionChangeStream(client, client.db(), collection.collectionName)
				const listeners: Array<(e: Error) => void> = []
				errorListeners = listeners
				const wrapper: ChangeStreamLike = {
					on(event: any, cb: any) {
						if (event === 'error') listeners.push(cb)
						return (real as any).on(event, cb)
					},
					close: () => (real as any).close(),
				}
				return wrapper
			},
			() => undefined
		)
		const deps: ObserveMultiplexerDeps<TestDoc> = {
			snapshot: async () => ({
				docs: (await collection.find({}).toArray()) as unknown as TestDoc[],
				operationTime: undefined,
			}),
			subscribeFeed: (onChange, onReconnect) =>
				feed.subscribe(onChange as (c: ChangeStreamDocument<any>) => void, onReconnect),
		}
		const m = new ObserveMultiplexer<TestDoc>({}, undefined, undefined, deps, () => undefined)
		await m.addObserveChangesSubscriber(
			{
				added: (i: any, f: any) => sink.added.push([i, f]),
				changed: (i: any, f: any) => sink.changed.push([i, f]),
				removed: (i: any) => sink.removed.push(i),
			} as any,
			observers.signal,
			false
		)

		// Wait for the initial snapshot AND for the stream to be attached (so we can drop it).
		await waitFor(() => sink.added.length === 1 && errorListeners.length > 0)

		// Drop the stream, then mutate the DB while it is "down": update A, insert B.
		errorListeners.forEach((cb) => cb(new Error('simulated change-stream drop')))
		await collection.updateOne({ _id: id('A') }, { $set: { val: 2 } })
		await collection.insertOne({ _id: id('B'), val: 3 } as any)

		// After the restart backoff the feed reconnects → onReconnect → a re-snapshot recovers the gap
		// writes (the new stream starts after them, so it cannot replay them - only the re-sync catches them).
		await waitFor(() => sink.changed.length === 1 && sink.added.length === 2, 20000)
		expect(sink.changed[0]).toEqual([id('A'), { val: 2 }])
		expect(sink.added[1]).toEqual([id('B'), { val: 3 }])
	}, 30000)
})
