import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	ObserveMultiplexer,
	ObserveMultiplexerDeps,
	observeChangesViaChangeStream,
	getActiveMultiplexerCount,
} from '../observeMultiplexer'
import type { ObserveViewShape } from '@sofie-automation/corelib/dist/memoryCollection/observeView'
import { testWithAbort } from '../../../__mocks__/helpers/testWithAbort'
import { type AbortScope, createChildAbort } from '../../../lib/observerLifetime'

interface TestDoc {
	_id: any
	name?: string
	val?: number
	studioId?: string
	secret?: string
}
const id = (s: string) => protectString(s)

function makeHarness(initial: TestDoc[] = []) {
	let docs: TestDoc[] = initial.map((d) => ({ ...d }))
	const feedSubs: Array<{ onChange: (c: any) => void; onResync: () => void }> = []
	const feedStop = jest.fn()
	const deps: ObserveMultiplexerDeps<TestDoc> = {
		snapshot: jest.fn(async () => ({ docs: docs.map((d) => ({ ...d })), operationTime: undefined })),
		subscribeFeed: jest.fn((onChange, onResync) => {
			const s = { onChange, onResync }
			feedSubs.push(s)
			return {
				stop: () => {
					feedStop()
					const i = feedSubs.indexOf(s)
					if (i >= 0) feedSubs.splice(i, 1)
				},
			}
		}),
	}
	return {
		deps,
		feedStop,
		setDocs: (d: TestDoc[]) => {
			docs = d
		},
		pushChange: (c: any) => feedSubs.forEach((s) => s.onChange(c)),
		reconnect: () => feedSubs.forEach((s) => s.onResync()),
		feedSubCount: () => feedSubs.length,
	}
}

const insertEv = (doc: TestDoc) => ({ operationType: 'insert', documentKey: { _id: doc._id }, fullDocument: doc })
const updateEv = (doc: TestDoc) => ({ operationType: 'update', documentKey: { _id: doc._id }, fullDocument: doc })
const replaceEv = (doc: TestDoc) => ({ operationType: 'replace', documentKey: { _id: doc._id }, fullDocument: doc })
const updateNullEv = (docId: any) => ({ operationType: 'update', documentKey: { _id: docId }, fullDocument: null })
const deleteEv = (docId: any) => ({ operationType: 'delete', documentKey: { _id: docId } })

function changesCallbacks() {
	return { added: jest.fn(), changed: jest.fn(), removed: jest.fn() }
}

/** Subscribe an observeChanges to a multiplexer for the lifetime of the test. */
function subscribeChanges(
	signal: AbortSignal,
	m: ObserveMultiplexer<TestDoc>,
	cb: any,
	nonMutating = false
): Promise<void> {
	return m.addObserveChangesSubscriber(cb, signal, nonMutating)
}

/** As {@link subscribeChanges}, but for a full-document observe. */
function subscribeObserve(
	signal: AbortSignal,
	m: ObserveMultiplexer<TestDoc>,
	cb: any,
	nonMutating = false
): Promise<void> {
	return m.addObserveSubscriber(cb, signal, nonMutating)
}

/** Build a fresh multiplexer with a single observeChanges subscriber, for the transition-logic tests. */
async function startChanges(
	signal: AbortSignal,
	selector: any,
	projection: any,
	deps: ObserveMultiplexerDeps<TestDoc>,
	cb: ReturnType<typeof changesCallbacks>,
	nonMutating = false,
	shape?: ObserveViewShape<TestDoc>
): Promise<ObserveMultiplexer<TestDoc>> {
	const m = new ObserveMultiplexer<TestDoc>(selector, projection, shape, deps, () => undefined)
	await subscribeChanges(signal, m, cb, nonMutating)
	return m
}

/**
 * Join the shared registry for an observeChanges and return the AbortScope that tears it down.
 * The registry/ref-counting tests drive teardown via `scope.abort()` - the same signal-based
 * mechanism the public collection API wires up - rather than a returned handle.
 */
async function joinChangesFeed(
	signal: AbortSignal,
	collectionName: string,
	selector: any,
	projection: any,
	cb: any,
	makeDeps: () => ObserveMultiplexerDeps<TestDoc>,
	shape?: ObserveViewShape<TestDoc>
): Promise<AbortScope> {
	// A child of the test's signal: torn down by the test's own `.abort()`, or when the test ends. Otherwise a test
	// that throws before its manual `.abort()` would leak this subscriber into the global multiplexer registry,
	// corrupting `getActiveMultiplexerCount()` for later tests.
	const scope = createChildAbort(signal)
	await observeChangesViaChangeStream(collectionName, selector, projection, shape, cb, scope.signal, false, makeDeps)
	return scope
}

describe('ObserveMultiplexer transition logic', () => {
	testWithAbort('initial snapshot fires added for each matching doc (fields minus _id)', async ({ signal }) => {
		const h = makeHarness([
			{ _id: id('A'), name: 'a', val: 1 },
			{ _id: id('B'), name: 'b', val: 2 },
		])
		const cb = changesCallbacks()
		await startChanges(signal, {}, undefined, h.deps, cb)

		expect(cb.added).toHaveBeenCalledTimes(2)
		expect(cb.added).toHaveBeenCalledWith(id('A'), { name: 'a', val: 1 })
		expect(cb.added).toHaveBeenCalledWith(id('B'), { name: 'b', val: 2 })
	})

	testWithAbort('insert matching → added; insert non-matching → nothing', async ({ signal }) => {
		const h = makeHarness([])
		const cb = changesCallbacks()
		const m = await startChanges(signal, { studioId: 's1' }, undefined, h.deps, cb)

		h.pushChange(insertEv({ _id: id('A'), studioId: 's1', val: 1 }))
		h.pushChange(insertEv({ _id: id('B'), studioId: 's2', val: 2 }))
		await m._flushForTests()

		expect(cb.added).toHaveBeenCalledTimes(1)
		expect(cb.added).toHaveBeenCalledWith(id('A'), { studioId: 's1', val: 1 })
	})

	testWithAbort('update of an in-projection field → changed with exact delta', async ({ signal }) => {
		const h = makeHarness([{ _id: id('A'), name: 'a', val: 1 }])
		const cb = changesCallbacks()
		const m = await startChanges(signal, {}, { name: 1, val: 1 }, h.deps, cb)
		cb.added.mockClear()

		h.pushChange(updateEv({ _id: id('A'), name: 'a', val: 2 }))
		await m._flushForTests()

		expect(cb.changed).toHaveBeenCalledTimes(1)
		expect(cb.changed).toHaveBeenCalledWith(id('A'), { val: 2 })
	})

	testWithAbort('update of an out-of-projection field → no emit', async ({ signal }) => {
		const h = makeHarness([{ _id: id('A'), name: 'a', val: 1, secret: 'x' }])
		const cb = changesCallbacks()
		const m = await startChanges(signal, {}, { name: 1, val: 1 }, h.deps, cb)
		cb.added.mockClear()

		h.pushChange(updateEv({ _id: id('A'), name: 'a', val: 1, secret: 'y' }))
		await m._flushForTests()

		expect(cb.changed).not.toHaveBeenCalled()
	})

	testWithAbort('cleared field → changed with {field: undefined}', async ({ signal }) => {
		const h = makeHarness([{ _id: id('A'), name: 'a', val: 1 }])
		const cb = changesCallbacks()
		const m = await startChanges(signal, {}, undefined, h.deps, cb)
		cb.added.mockClear()

		h.pushChange(updateEv({ _id: id('A'), name: 'a' })) // val removed
		await m._flushForTests()

		expect(cb.changed).toHaveBeenCalledWith(id('A'), { val: undefined })
	})

	testWithAbort('replace is diffed like an update', async ({ signal }) => {
		const h = makeHarness([{ _id: id('A'), name: 'a', val: 1 }])
		const cb = changesCallbacks()
		const m = await startChanges(signal, {}, undefined, h.deps, cb)
		cb.added.mockClear()

		h.pushChange(replaceEv({ _id: id('A'), name: 'b', val: 1 }))
		await m._flushForTests()

		expect(cb.changed).toHaveBeenCalledWith(id('A'), { name: 'b' })
	})

	testWithAbort('no-op update (no delta) → no emit', async ({ signal }) => {
		const h = makeHarness([{ _id: id('A'), name: 'a', val: 1 }])
		const cb = changesCallbacks()
		const m = await startChanges(signal, {}, undefined, h.deps, cb)
		cb.added.mockClear()

		h.pushChange(updateEv({ _id: id('A'), name: 'a', val: 1 }))
		await m._flushForTests()

		expect(cb.changed).not.toHaveBeenCalled()
	})

	testWithAbort('doc entering the selector → added', async ({ signal }) => {
		const h = makeHarness([])
		const cb = changesCallbacks()
		const m = await startChanges(signal, { studioId: 's1' }, undefined, h.deps, cb)

		h.pushChange(insertEv({ _id: id('A'), studioId: 's2' })) // not matching yet
		h.pushChange(updateEv({ _id: id('A'), studioId: 's1' })) // now matches
		await m._flushForTests()

		expect(cb.added).toHaveBeenCalledTimes(1)
		expect(cb.added).toHaveBeenCalledWith(id('A'), { studioId: 's1' })
	})

	testWithAbort('doc leaving the selector → removed', async ({ signal }) => {
		const h = makeHarness([{ _id: id('A'), studioId: 's1' }])
		const cb = changesCallbacks()
		const m = await startChanges(signal, { studioId: 's1' }, undefined, h.deps, cb)
		cb.added.mockClear()

		h.pushChange(updateEv({ _id: id('A'), studioId: 's2' })) // no longer matches
		await m._flushForTests()

		expect(cb.removed).toHaveBeenCalledTimes(1)
		expect(cb.removed).toHaveBeenCalledWith(id('A'))
		expect(cb.changed).not.toHaveBeenCalled()
	})

	testWithAbort('delete of a published doc → removed; delete of unknown → nothing', async ({ signal }) => {
		const h = makeHarness([{ _id: id('A') }])
		const cb = changesCallbacks()
		const m = await startChanges(signal, {}, undefined, h.deps, cb)
		cb.added.mockClear()

		h.pushChange(deleteEv(id('A')))
		h.pushChange(deleteEv(id('Z')))
		await m._flushForTests()

		expect(cb.removed).toHaveBeenCalledTimes(1)
		expect(cb.removed).toHaveBeenCalledWith(id('A'))
	})

	testWithAbort('null fullDocument (deleted between event and lookup) → removed-by-id', async ({ signal }) => {
		const h = makeHarness([{ _id: id('A') }])
		const cb = changesCallbacks()
		const m = await startChanges(signal, {}, undefined, h.deps, cb)
		cb.added.mockClear()

		h.pushChange(updateNullEv(id('A')))
		await m._flushForTests()

		expect(cb.removed).toHaveBeenCalledWith(id('A'))
	})
})

describe('ObserveMultiplexer snapshot-vs-stream race', () => {
	testWithAbort(
		'events arriving before a subscriber goes live are folded into its replay (no dup, latest state)',
		async ({ signal }) => {
			const h = makeHarness([{ _id: id('A'), val: 1 }])
			const m = new ObserveMultiplexer<TestDoc>({}, undefined, undefined, h.deps, () => undefined)

			// This event is enqueued after the initial #sync but before the subscriber's replay
			h.pushChange(updateEv({ _id: id('A'), val: 2 }))

			const cb = changesCallbacks()
			await subscribeChanges(signal, m, cb)

			expect(cb.added).toHaveBeenCalledTimes(1)
			expect(cb.added).toHaveBeenCalledWith(id('A'), { val: 2 }) // latest, not val:1
			expect(cb.changed).not.toHaveBeenCalled() // subscriber wasn't live for the update
		}
	)
})

describe('ObserveMultiplexer reconnect resync', () => {
	testWithAbort('on reconnect, re-snapshots and emits only the net delta', async ({ signal }) => {
		const h = makeHarness([
			{ _id: id('A'), val: 1 },
			{ _id: id('B'), val: 1 },
		])
		const cb = changesCallbacks()
		const m = await startChanges(signal, {}, undefined, h.deps, cb)
		cb.added.mockClear()

		// While "disconnected" the DB changed: A updated, B deleted, C added
		h.setDocs([
			{ _id: id('A'), val: 2 },
			{ _id: id('C'), val: 9 },
		])
		h.reconnect()
		await m._flushForTests()

		expect(cb.changed).toHaveBeenCalledWith(id('A'), { val: 2 })
		expect(cb.removed).toHaveBeenCalledWith(id('B'))
		expect(cb.added).toHaveBeenCalledWith(id('C'), { val: 9 })
		expect(cb.added).toHaveBeenCalledTimes(1)
	})
})

describe('ObserveMultiplexer observe (full-document) subscribers', () => {
	testWithAbort('added(doc), changed(newDoc, oldDoc), removed(doc)', async ({ signal }) => {
		const h = makeHarness([{ _id: id('A'), val: 1 }])
		const m = new ObserveMultiplexer<TestDoc>({}, undefined, undefined, h.deps, () => undefined)
		const cb = { added: jest.fn(), changed: jest.fn(), removed: jest.fn() }
		await subscribeObserve(signal, m, cb)

		expect(cb.added).toHaveBeenCalledWith({ _id: id('A'), val: 1 })

		h.pushChange(updateEv({ _id: id('A'), val: 2 }))
		await m._flushForTests()
		expect(cb.changed).toHaveBeenCalledWith({ _id: id('A'), val: 2 }, { _id: id('A'), val: 1 })

		h.pushChange(deleteEv(id('A')))
		await m._flushForTests()
		expect(cb.removed).toHaveBeenCalledWith({ _id: id('A'), val: 2 })
	})
})

describe('ObserveMultiplexer nonMutatingCallbacks', () => {
	testWithAbort('clones per subscriber by default; shares the object when nonMutating', async ({ signal }) => {
		const h = makeHarness([])
		const m = new ObserveMultiplexer<TestDoc>({}, undefined, undefined, h.deps, () => undefined)

		const captured: Record<string, any> = {}
		const cbDefault = { added: jest.fn((_id, f) => (captured.def = f)), changed: jest.fn(), removed: jest.fn() }
		const cbNon = { added: jest.fn((_id, f) => (captured.non = f)), changed: jest.fn(), removed: jest.fn() }
		await subscribeChanges(signal, m, cbDefault)
		await subscribeChanges(signal, m, cbNon, true)

		h.pushChange(insertEv({ _id: id('B'), val: 5 }))
		await m._flushForTests()

		// The default subscriber gets a clone, the nonMutating one the shared object → distinct references
		expect(captured.def).not.toBe(captured.non)
		expect(captured.def).toEqual({ val: 5 })
		expect(captured.non).toEqual({ val: 5 })
	})
})

describe('ObserveMultiplexer dedup registry', () => {
	testWithAbort(
		'identical args share one multiplexer/snapshot; both get events; ref-counted teardown',
		async ({ signal }) => {
			const h = makeHarness([{ _id: id('A'), val: 1 }])
			const deps = h.deps
			const cb1 = changesCallbacks()
			const cb2 = changesCallbacks()

			const sub1 = await joinChangesFeed(signal, 'coll', {}, undefined, cb1 as any, () => deps)
			const sub2 = await joinChangesFeed(signal, 'coll', {}, undefined, cb2 as any, () => deps)

			expect(getActiveMultiplexerCount()).toBe(1)
			expect(deps.snapshot).toHaveBeenCalledTimes(1) // shared snapshot
			expect(h.feedSubCount()).toBe(1) // shared feed subscription
			expect(cb1.added).toHaveBeenCalledWith(id('A'), { val: 1 })
			expect(cb2.added).toHaveBeenCalledWith(id('A'), { val: 1 }) // new subscriber replayed current state

			// a live event reaches both
			h.pushChange(insertEv({ _id: id('B'), val: 2 }))
			// allow the queued event to process: a throwaway subscriber whose replay drains the queue, then abort it
			;(await joinChangesFeed(signal, 'coll', {}, undefined, changesCallbacks() as any, () => deps)).abort()
			expect(cb1.added).toHaveBeenCalledWith(id('B'), { val: 2 })
			expect(cb2.added).toHaveBeenCalledWith(id('B'), { val: 2 })

			sub1.abort()
			expect(getActiveMultiplexerCount()).toBe(1) // still one subscriber
			sub2.abort()
			expect(getActiveMultiplexerCount()).toBe(0) // last one gone → torn down
		}
	)

	testWithAbort('different selectors → different multiplexers', async ({ signal }) => {
		const h = makeHarness([])
		const subA = await joinChangesFeed(
			signal,
			'coll',
			{ studioId: 's1' },
			undefined,
			changesCallbacks() as any,
			() => h.deps
		)
		const subB = await joinChangesFeed(
			signal,
			'coll',
			{ studioId: 's2' },
			undefined,
			changesCallbacks() as any,
			() => h.deps
		)
		expect(getActiveMultiplexerCount()).toBe(2)
		subA.abort()
		subB.abort()
	})

	testWithAbort(
		'same selector+projection but different window (limit) → different multiplexers',
		async ({ signal }) => {
			const h = makeHarness([])
			const base = getActiveMultiplexerCount()
			const sub1 = await joinChangesFeed(signal, 'coll', {}, undefined, changesCallbacks() as any, () => h.deps, {
				limit: 10,
			})
			const sub2 = await joinChangesFeed(signal, 'coll', {}, undefined, changesCallbacks() as any, () => h.deps, {
				limit: 20,
			})
			// Different published windows must NOT be merged onto one multiplexer.
			expect(getActiveMultiplexerCount()).toBe(base + 2)
			sub1.abort()
			sub2.abort()
			expect(getActiveMultiplexerCount()).toBe(base)
		}
	)

	testWithAbort('selectors equal up to key order share one multiplexer (canonical key)', async ({ signal }) => {
		const h = makeHarness([])
		const base = getActiveMultiplexerCount()
		const sub1 = await joinChangesFeed(
			signal,
			'coll',
			{ studioId: 's1', val: 1 },
			undefined,
			changesCallbacks() as any,
			() => h.deps
		)
		const sub2 = await joinChangesFeed(
			signal,
			'coll',
			{ val: 1, studioId: 's1' },
			undefined,
			changesCallbacks() as any,
			() => h.deps
		)
		expect(getActiveMultiplexerCount()).toBe(base + 1) // shared despite differing key order
		sub1.abort()
		sub2.abort()
		expect(getActiveMultiplexerCount()).toBe(base)
	})

	testWithAbort('a subscriber joining as the last existing one leaves is not orphaned', async ({ signal }) => {
		const h = makeHarness([{ _id: id('A'), val: 1 }])
		const deps = h.deps

		// One established subscriber holding the (shared) multiplexer.
		const sub1 = await joinChangesFeed(signal, 'coll', {}, undefined, changesCallbacks() as any, () => deps)
		expect(getActiveMultiplexerCount()).toBe(1)

		// A second subscriber joins the same multiplexer - its replay is now queued. BEFORE that replay runs,
		// the first subscriber leaves, dropping the live count to zero. The multiplexer must not tear itself
		// down: doing so would orphan the newcomer on a dead, deregistered multiplexer (it would never receive
		// its initial snapshot nor any future event, yet its observe promise still resolves).
		const cb2 = changesCallbacks()
		const ctrl2 = createChildAbort(signal)
		const joining = observeChangesViaChangeStream(
			'coll',
			{},
			undefined,
			undefined,
			cb2 as any,
			// Also torn down by the shared per-test signal (afterEach) if the test throws before its manual abort.
			AbortSignal.any([ctrl2.signal, signal]),
			false,
			() => deps
		)
		sub1.abort()
		await joining

		expect(getActiveMultiplexerCount()).toBe(1) // kept alive by the newcomer
		expect(cb2.added).toHaveBeenCalledWith(id('A'), { val: 1 }) // newcomer got its initial snapshot

		ctrl2.abort()
		expect(getActiveMultiplexerCount()).toBe(0) // now genuinely empty -> torn down
	})

	testWithAbort('projections equal up to key order share one multiplexer', async ({ signal }) => {
		const h = makeHarness([])
		const base = getActiveMultiplexerCount()
		const sub1 = await joinChangesFeed(
			signal,
			'coll',
			{},
			{ name: 1, val: 1 },
			changesCallbacks() as any,
			() => h.deps
		)
		const sub2 = await joinChangesFeed(
			signal,
			'coll',
			{},
			{ val: 1, name: 1 },
			changesCallbacks() as any,
			() => h.deps
		)
		expect(getActiveMultiplexerCount()).toBe(base + 1)
		sub1.abort()
		sub2.abort()
		expect(getActiveMultiplexerCount()).toBe(base)
	})

	testWithAbort('a failed initial snapshot rejects and leaves nothing running', async ({ signal }) => {
		// The caller must not have to abort to release a partially-started observer: rejecting means the
		// subscriber is already deregistered, which drops the multiplexer and closes its feed.
		const h = makeHarness([])
		const snapshotFailed = new Error('snapshot failed')
		h.deps.snapshot = jest.fn(async () => {
			throw snapshotFailed
		})

		const base = getActiveMultiplexerCount()

		await expect(
			joinChangesFeed(signal, 'coll_snapshot_fails', {}, undefined, changesCallbacks() as any, () => h.deps)
		).rejects.toBe(snapshotFailed)

		expect(getActiveMultiplexerCount()).toBe(base)
		expect(h.feedStop).toHaveBeenCalledTimes(1)
		expect(h.feedSubCount()).toBe(0)
	})

	testWithAbort(
		'selectors that collide under a lossy stringify stay separate (injective key)',
		async ({ signal }) => {
			// `{ a:'1', b:'2' }` and `{ a:'1,b=2' }` both reduce to "a=1,b=2" under corelib's `stringifyObjects`;
			// the canonical dedup key must keep them on separate multiplexers.
			const h = makeHarness([])
			const base = getActiveMultiplexerCount()
			const subA = await joinChangesFeed(
				signal,
				'coll',
				{ a: '1', b: '2' } as any,
				undefined,
				changesCallbacks() as any,
				() => h.deps
			)
			const subB = await joinChangesFeed(
				signal,
				'coll',
				{ a: '1,b=2' } as any,
				undefined,
				changesCallbacks() as any,
				() => h.deps
			)
			expect(getActiveMultiplexerCount()).toBe(base + 2)
			subA.abort()
			subB.abort()
			expect(getActiveMultiplexerCount()).toBe(base)
		}
	)
})
