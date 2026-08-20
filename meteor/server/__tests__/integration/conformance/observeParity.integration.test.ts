/**
 * observe/observeChanges parity (Part 3): assert the in-memory mock ({@link WrappedMockCollection}, driven by
 * corelib's ObserveView) and the real change-stream multiplexer emit the same add/change/remove sequences for
 * the same mutation scripts.
 *
 * Both sides run under REAL timers: the mock delivers via `Meteor.defer` (a real `setTimeout(0)`) and the real
 * side via change streams, so each is flushed with `waitFor`. We compare the final, id-sorted set of events
 * after both have reached the expected counts (delivery order across documents is not guaranteed).
 */
import { MongoClient, Collection } from 'mongodb'
import { MongoFieldSpecifier, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { createMockCollection } from '../../../collections/implementations/mock'
import { connectSharedMongoClient, freshCollection } from '../_integrationDb'
import { TestDoc, id, waitFor, newSink, Sink, makeMultiplexer, subscribeChanges } from '../_observeHelpers'

type Step =
	| { op: 'insert'; doc: TestDoc }
	| { op: 'update'; selector: MongoQuery<TestDoc>; modifier: any; multi?: boolean }
	| { op: 'replace'; doc: TestDoc }
	| { op: 'remove'; selector: MongoQuery<TestDoc> }

interface Script {
	name: string
	seed: TestDoc[]
	selector: MongoQuery<TestDoc>
	projection?: MongoFieldSpecifier<TestDoc>
	steps: Step[]
	expected: { added: number; changed: number; removed: number }
}

const settle = () => new Promise((r) => setTimeout(r, 50))

function normalizeSink(s: Sink) {
	const byId = (arr: Array<[any, any]>) => [...arr].sort((a, b) => String(a[0]).localeCompare(String(b[0])))
	return {
		added: byId(s.added),
		changed: byId(s.changed),
		removed: [...s.removed].sort((a, b) => String(a).localeCompare(String(b))),
	}
}

async function waitForCounts(sink: Sink, expected: Script['expected']): Promise<void> {
	await waitFor(
		() =>
			sink.added.length === expected.added &&
			sink.changed.length === expected.changed &&
			sink.removed.length === expected.removed,
		undefined,
		() =>
			`added/changed/removed ${expected.added}/${expected.changed}/${expected.removed}, got ` +
			`${sink.added.length}/${sink.changed.length}/${sink.removed.length}` +
			` :: added=${JSON.stringify(sink.added)} changed=${JSON.stringify(sink.changed)} removed=${JSON.stringify(
				sink.removed
			)}`
	)
	await settle() // give any (erroneous) extra events a chance to arrive, so the comparison catches them
}

async function runMock(script: Script): Promise<Sink> {
	const col = createMockCollection<TestDoc>('obs_mock')
	col.asyncBulkWriteDelay = 0
	col.mockCollection.mockSetData(script.seed) // seed without firing observe events
	const sink = newSink()
	const handle = await col.observeChanges(
		script.selector,
		{
			added: (i, f) => {
				sink.added.push([i, f])
			},
			changed: (i, f) => {
				sink.changed.push([i, f])
			},
			removed: (i) => {
				sink.removed.push(i)
			},
		},
		script.projection ? { projection: script.projection } : undefined
	)
	try {
		for (const step of script.steps) {
			if (step.op === 'insert') await col.insertAsync(step.doc)
			else if (step.op === 'update') await col.updateAsync(step.selector, step.modifier, { multi: step.multi })
			else if (step.op === 'replace') await col.replaceAsync(step.doc)
			else await col.removeAsync(step.selector)
		}
		await waitForCounts(sink, script.expected)
		return sink
	} finally {
		// Always stop the observer, even if a step or the wait throws, so callbacks don't leak into later tests.
		handle.stop()
	}
}

async function runReal(client: MongoClient, script: Script): Promise<Sink> {
	const collection: Collection<any> = await freshCollection<TestDoc>(client, script.seed)
	const sink = newSink()
	const abort = new AbortController()
	const m = makeMultiplexer(client, collection, script.selector, script.projection)
	try {
		await subscribeChanges(m, sink, abort.signal)
		for (const step of script.steps) {
			if (step.op === 'insert') await collection.insertOne(step.doc as any)
			else if (step.op === 'update') {
				if (step.multi) await collection.updateMany(step.selector as any, step.modifier)
				else await collection.updateOne(step.selector as any, step.modifier)
			} else if (step.op === 'replace') {
				await collection.replaceOne({ _id: step.doc._id } as any, step.doc as any)
			} else {
				await collection.deleteMany(step.selector as any)
			}
		}
		await waitForCounts(sink, script.expected)
		return sink
	} finally {
		abort.abort()
	}
}

const scripts: Script[] = [
	{
		name: 'snapshot + insert + update + delete',
		seed: [{ _id: id('A'), name: 'a', val: 1 }],
		selector: {},
		steps: [
			{ op: 'insert', doc: { _id: id('B'), name: 'b', val: 2 } },
			{ op: 'update', selector: { _id: id('A') }, modifier: { $set: { val: 9 } } },
			{ op: 'remove', selector: { _id: id('B') } },
		],
		expected: { added: 2, changed: 1, removed: 1 },
	},
	{
		name: 'selector enter/leave with projection',
		seed: [],
		selector: { studioId: 's1' },
		projection: { studioId: 1, val: 1 },
		steps: [
			{ op: 'insert', doc: { _id: id('X'), studioId: 's2', val: 1, name: 'secret' } },
			{ op: 'update', selector: { _id: id('X') }, modifier: { $set: { studioId: 's1' } } }, // enter → added
			{ op: 'update', selector: { _id: id('X') }, modifier: { $set: { name: 'other' } } }, // non-projected → no event
			{ op: 'update', selector: { _id: id('X') }, modifier: { $set: { val: 5 } } }, // projected → changed
			{ op: 'update', selector: { _id: id('X') }, modifier: { $set: { studioId: 's3' } } }, // leave → removed
		],
		expected: { added: 1, changed: 1, removed: 1 },
	},
	{
		name: 'replace is observed as a changed transition',
		seed: [{ _id: id('A'), name: 'a', val: 1 }],
		selector: {},
		steps: [{ op: 'replace', doc: { _id: id('A'), name: 'b', val: 1 } }],
		expected: { added: 1, changed: 1, removed: 0 },
	},
	{
		name: 'multi update emits a changed per matching doc',
		seed: [
			{ _id: id('A'), studioId: 's1', val: 1 },
			{ _id: id('B'), studioId: 's1', val: 1 },
		],
		selector: { studioId: 's1' },
		steps: [{ op: 'update', selector: { studioId: 's1' }, modifier: { $set: { val: 2 } }, multi: true }],
		expected: { added: 2, changed: 2, removed: 0 },
	},
]

describe('observeChanges parity: mock vs real change stream', () => {
	let client: MongoClient
	beforeAll(async () => {
		client = await connectSharedMongoClient()
	}, 120000)
	afterAll(async () => {
		await client?.close()
	})

	// No explicit timeout: the project default leaves `waitFor` room to report which counts it was
	// still waiting for, rather than jest cutting the test off first with a bare "Exceeded timeout"
	test.each(scripts.map((s) => [s.name, s] as const))('%s', async (_name, script) => {
		const mock = await runMock(script)
		const real = await runReal(client, script)
		expect(normalizeSink(mock)).toEqual(normalizeSink(real))
	})

	test('observe() delivers identical full-document transitions', async () => {
		// Mock side
		const col = createMockCollection<TestDoc>('obs_mock_full')
		col.mockCollection.mockSetData([{ _id: id('A'), val: 1 }])
		const mockEvents: any[] = []
		const mockHandle = await col.observe(
			{},
			{
				added: (d) => {
					mockEvents.push(['added', d])
				},
				changed: (n, o) => {
					mockEvents.push(['changed', n, o])
				},
				removed: (d) => {
					mockEvents.push(['removed', d])
				},
			}
		)
		try {
			await col.updateAsync({ _id: id('A') }, { $set: { val: 2 } })
			await col.removeAsync({ _id: id('A') })
			await waitFor(() => mockEvents.length === 3)
		} finally {
			// Always stop the mock observer, even if a write or the wait throws, so it doesn't leak into later tests.
			mockHandle.stop()
		}

		// Real side
		const collection = await freshCollection<TestDoc>(client, [{ _id: id('A'), val: 1 }])
		const realEvents: any[] = []
		const m = makeMultiplexer(client, collection, {}, undefined)
		const abort = new AbortController()
		try {
			await m.addObserveSubscriber(
				{
					added: (d: any) => realEvents.push(['added', d]),
					changed: (n: any, o: any) => realEvents.push(['changed', n, o]),
					removed: (d: any) => realEvents.push(['removed', d]),
				} as any,
				abort.signal,
				false
			)
			await collection.updateOne({ _id: id('A') }, { $set: { val: 2 } })
			await collection.deleteOne({ _id: id('A') })
			await waitFor(() => realEvents.length === 3)
		} finally {
			abort.abort()
		}

		expect(mockEvents).toEqual(realEvents)
	})
})
