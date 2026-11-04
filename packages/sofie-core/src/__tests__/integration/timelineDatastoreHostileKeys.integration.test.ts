/**
 * Adversarial test for TimelineDatastore values containing field names with `.` or a leading `$`.
 *
 * Blueprints may store any value in the datastore (`setTimelineDatastoreValue(key, value: any, mode)`), and
 * unlike timeline objects (stored as a serialised `timelineBlob`) the value is written to MongoDB as-is. This
 * pushes hostile values through the full production path, against a real MongoDB, and asserts the value
 * survives every hop unchanged:
 *
 *   job-worker setTimelineDatastoreValue -> MongoDB -> change-stream ObserveMultiplexer (publication)
 *   -> DDP wire encoding (server EJSON.stringify) -> DDP wire decoding (gateway EJSON.parse)
 *
 * plus job-worker's cleanTimelineDatastore removing such documents.
 */
import { MongoClient, Collection } from 'mongodb'
import EJSON from 'ejson'
import { DatastorePersistenceMode } from '@sofie-automation/shared-lib/dist/core/model/TimelineDatastore'
import { serializeTimelineBlob } from '@sofie-automation/shared-lib/dist/core/model/Timeline'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { wrapMongoCollection } from '@sofie-automation/job-worker/dist/db/collection'
import {
	cleanTimelineDatastore,
	getDatastoreId,
	setTimelineDatastoreValue,
} from '@sofie-automation/job-worker/dist/playout/datastore'
import { encodeMessage } from '../../ddp-server/wireCodec'
import { connectSharedMongoClient, freshCollection } from './_integrationDb'
import { waitFor, newSink, makeMultiplexer, subscribeChanges } from './_observeHelpers'

const studioId = protectString<any>('studio0')

/** The minimal slice of JobContext that the datastore functions touch */
function makeJobContext(collection: Collection<any>): any {
	return {
		studioId,
		directCollections: { TimelineDatastores: wrapMongoCollection(collection, false) },
	}
}

/** Values whose field names Mongo, Meteor-style DDP or EJSON may treat specially */
const hostileValues: Array<[string, unknown]> = [
	['dotted field name', { 'a.b': 1 }],
	['field name that is only a dot', { '.': 1 }],
	['leading and trailing dots', { '.a': 1, 'b.': 2 }],
	['dotted field colliding with a nested path', { 'a.b': 1, a: { b: 2 } }],
	['nested dotted field name', { x: { 'y.z': 1 } }],
	['dotted field name inside an array', [{ 'a.b': 1 }]],
	['$-prefixed field name', { $foo: 1 }],
	['field name that is only $', { $: 1 }],
	['nested $-prefixed field name', { x: { $foo: 1 } }],
	['mongo update operator lookalike', { $set: { a: 1 } }],
	['mongo query operator lookalike', { $where: 'sleep(1000)', $gt: 1 }],
	['$-prefixed field name inside an array', [{ $foo: 1 }]],
	['EJSON $date lookalike', { $date: 0 }],
	['EJSON $binary lookalike', { $binary: 'AAAA' }],
	['EJSON $type lookalike (unknown type)', { $type: 'nope', $value: 1 }],
	['EJSON $escape lookalike', { $escape: { a: 1 } }],
	['EJSON $InfNaN lookalike', { $InfNaN: 1 }],
	['EJSON $regexp lookalike', { $regexp: 'a', $flags: '' }],
	['dotted and $ field names combined', { '$a.b': { 'c.$d': 1 } }],
]

/** Datastore keys (not the value) containing `.` and `$`. The key is only ever stored as a string value. */
const hostileKeys = ['foo.bar', '$foo', '.', '$', 'a.$b']

/** Simulate one hop over the DDP wire: server encodes, gateway (server-core-integration) decodes */
function overTheWire(fields: Record<string, unknown>): Record<string, unknown> | undefined {
	const encoded = encodeMessage({ msg: 'added', collection: 'timelineDatastore', id: 'x', fields })
	return (EJSON.parse(encoded) as any).fields
}

describe('TimelineDatastore: hostile field names in values', () => {
	let client: MongoClient
	beforeAll(async () => {
		client = await connectSharedMongoClient()
	}, 120000)
	afterAll(async () => {
		await client?.close()
	})

	describe.each(hostileValues)('%s', (_name, value) => {
		const key = 'myKey'
		const docId = getDatastoreId(studioId, key)

		test('is stored and read back unchanged (insert, then replace)', async () => {
			const collection = await freshCollection<any>(client)
			const context = makeJobContext(collection)

			// first write upserts a new document
			await setTimelineDatastoreValue(context, key, value, DatastorePersistenceMode.Temporary)
			expect((await collection.findOne({ _id: docId }))?.value).toEqual(value)

			// second write replaces an existing document
			await setTimelineDatastoreValue(context, key, 'placeholder', DatastorePersistenceMode.Temporary)
			await setTimelineDatastoreValue(context, key, value, DatastorePersistenceMode.Temporary)
			expect((await collection.findOne({ _id: docId }))?.value).toEqual(value)
		})

		test('is published unchanged through the change-stream observer', async () => {
			const collection = await freshCollection<any>(client)
			const context = makeJobContext(collection)

			// The publication `timelineDatastoreForDevice` uses `{ studioId }` with `fields: {}`
			const multiplexer = makeMultiplexer(client, collection, { studioId }, {})
			const sink = newSink()
			const abort = new AbortController()
			try {
				await subscribeChanges(multiplexer, sink, abort.signal)

				// insert -> `added` from the change stream
				await setTimelineDatastoreValue(context, key, value, DatastorePersistenceMode.Temporary)
				await waitFor(
					() => sink.added.length === 1,
					undefined,
					() => JSON.stringify(sink)
				)
				expect(sink.added[0][1].value).toEqual(value)

				// replace -> `changed` from the change stream
				await setTimelineDatastoreValue(context, key, 'placeholder', DatastorePersistenceMode.Temporary)
				await setTimelineDatastoreValue(context, key, value, DatastorePersistenceMode.Temporary)
				await waitFor(
					() => sink.changed.length === 2,
					undefined,
					() => JSON.stringify(sink)
				)
				expect(sink.changed[1][1].value).toEqual(value)
			} finally {
				abort.abort()
			}

			// A late subscriber gets the document from the initial snapshot instead
			const lateMultiplexer = makeMultiplexer(client, collection, { studioId }, {})
			const lateSink = newSink()
			const lateAbort = new AbortController()
			try {
				await subscribeChanges(lateMultiplexer, lateSink, lateAbort.signal)
				await waitFor(
					() => lateSink.added.length === 1,
					undefined,
					() => JSON.stringify(lateSink)
				)
				expect(lateSink.added[0][1].value).toEqual(value)
			} finally {
				lateAbort.abort()
			}
		})

		test('survives the DDP wire to the playout gateway unchanged', () => {
			const fields = { studioId, key, value, modified: 1, mode: DatastorePersistenceMode.Temporary }
			expect(overTheWire(fields)?.value).toEqual(value)
		})

		test('is removed by cleanTimelineDatastore when unreferenced', async () => {
			const collection = await freshCollection<any>(client)
			const context = makeJobContext(collection)

			await setTimelineDatastoreValue(context, key, value, DatastorePersistenceMode.Temporary)
			await setTimelineDatastoreValue(context, 'kept', value, DatastorePersistenceMode.indefinite)

			await cleanTimelineDatastore(context, { timeline: { timelineBlob: serializeTimelineBlob([]) } } as any)

			const remaining = await collection.find({}).toArray()
			expect(remaining.map((d) => d.key)).toEqual(['kept'])
			expect(remaining[0].value).toEqual(value)
		})
	})

	describe.each(hostileKeys)('datastore key %j', (key) => {
		test('is stored, published and sent over the wire unchanged', async () => {
			const collection = await freshCollection<any>(client)
			const context = makeJobContext(collection)

			await setTimelineDatastoreValue(context, key, 42, DatastorePersistenceMode.Temporary)
			const doc = await collection.findOne({ _id: getDatastoreId(studioId, key) })
			expect(doc?.key).toBe(key)

			const multiplexer = makeMultiplexer(client, collection, { studioId }, {})
			const sink = newSink()
			const abort = new AbortController()
			try {
				await subscribeChanges(multiplexer, sink, abort.signal)
				await waitFor(
					() => sink.added.length === 1,
					undefined,
					() => JSON.stringify(sink)
				)
				expect(sink.added[0][1].key).toBe(key)
				expect(overTheWire(sink.added[0][1])).toMatchObject({ key, value: 42 })
			} finally {
				abort.abort()
			}
		})
	})
})
