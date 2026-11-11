/**
 * Documents why documents published to the UI must not contain field names with `.`, `\0` or a leading `$`.
 *
 * MongoDB stores such field names (nested inside a document) and the server publishes them unchanged. But the
 * UI's minimongo (`assertHasValidFieldNames` in `../minimongo/local_collection.js`) refuses them when a DDP
 * `added` or `changed` message is applied:
 *
 * 1. The document never appears in the UI: the client store throws a `MinimongoError`.
 * 2. Worse, `Connection._performWrites` applies a whole flush of buffered DDP messages, for every collection,
 *    without catching errors. When a document is refused, the rest of that flush is lost, so documents in other
 *    collections that were in the same flush never reach that client either (until it reconnects). The real
 *    connection logs and swallows the error, so nothing visibly crashes; the data is just missing.
 *
 * TimelineDatastore values are arbitrary blueprint objects, so job-worker rejects such field names when they are
 * set (`assertValidTimelineDatastoreValue` in `packages/job-worker/src/playout/datastore.ts`). The sofie-core
 * `timelineDatastoreHostileKeys.integration.test.ts` shows that they then never get stored or published.
 *
 * These tests drive the real client-side DDP store (`Connection._performWrites` -> `Mongo.Collection` store ->
 * minimongo) and pin down the behaviour above. If they start failing because minimongo accepts such field
 * names, the restriction in job-worker can be reconsidered.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
// Loading the DDP client opens a default connection, so stub out the socket underneath it
jest.mock('../socket-stream-client', () => ({
	ClientStream: class {
		on() {}
		send() {}
		reconnect() {}
		disconnect() {}
	},
}))

// The global setup mocks `meteor/mongo`, so load the real implementations explicitly
const { Mongo } = jest.requireActual('../mongo/index.js')
const { Connection } = jest.requireActual('../ddp/common/livedata_connection.js')

/** A stand-in for a DDP Connection: just enough for Mongo.Collection to register a store, and for _performWrites */
function makeConnection() {
	const stores: Record<string, any> = {}
	const connection = {
		_stores: stores,
		_resetStores: false,
		_updatesForUnknownStores: {},
		_runAfterUpdateCallbacks: () => undefined,
		registerStore(name: string, store: any) {
			stores[name] = store
			return true
		},
		/** Apply one buffered batch of DDP data messages, exactly as the real connection does */
		performWrites(updates: Record<string, any[]>) {
			Connection.prototype._performWrites.call(connection, updates)
		},
	}
	return connection
}

function added(collection: string, id: string, fields: Record<string, unknown>) {
	return { msg: 'added', collection, id, fields }
}
function changed(collection: string, id: string, fields: Record<string, unknown>) {
	return { msg: 'changed', collection, id, fields }
}

const hostileValues: Array<[string, unknown, string]> = [
	['dotted field name', { 'a.b': 1 }, "Key a.b must not contain '.'"],
	['field name that is only a dot', { '.': 1 }, "Key . must not contain '.'"],
	['nested dotted field name', { x: { 'y.z': 1 } }, "Key y.z must not contain '.'"],
	['dotted field name inside an array', [{ 'a.b': 1 }], "Key a.b must not contain '.'"],
	['$-prefixed field name', { $foo: 1 }, "Key $foo must not start with '$'"],
	['nested $-prefixed field name', { x: { $foo: 1 } }, "Key $foo must not start with '$'"],
	['mongo update operator lookalike', { $set: { a: 1 } }, "Key $set must not start with '$'"],
	['$-prefixed field name inside an array', [{ $foo: 1 }], "Key $foo must not start with '$'"],
	['field name with a null byte', { 'a\0b': 1 }, 'must not contain null bytes'],
]

const safeValues: Array<[string, unknown]> = [
	['string', 'hello.world'],
	['string starting with $', '$foo'],
	['number', 42],
	['plain object', { a: { b: 1 } }],
	['field name with $ in the middle', { a$b: 1 }],
]

describe('client DDP store: field names with `.`, `\\0` or a leading `$`', () => {
	let n = 0
	const uniqueName = (base: string) => `${base}_${n++}`

	describe.each(safeValues)('control: %s value', (_name, value) => {
		test('is accepted on added and changed', () => {
			const connection = makeConnection()
			const name = uniqueName('timelineDatastore')
			const collection = new Mongo.Collection(name, { connection })

			connection.performWrites({ [name]: [added(name, 'doc0', { key: 'k', value: 0 })] })
			connection.performWrites({ [name]: [changed(name, 'doc0', { value })] })

			expect(collection.findOne('doc0')?.value).toEqual(value)
		})
	})

	describe.each(hostileValues)('%s', (_name, value, error) => {
		test('is refused when added', () => {
			const connection = makeConnection()
			const name = uniqueName('timelineDatastore')
			const collection = new Mongo.Collection(name, { connection })

			expect(() => connection.performWrites({ [name]: [added(name, 'doc0', { key: 'k', value })] })).toThrow(
				error
			)
			expect(collection.findOne('doc0')).toBeUndefined()
		})

		test('is refused when changed, keeping the old value', () => {
			const connection = makeConnection()
			const name = uniqueName('timelineDatastore')
			const collection = new Mongo.Collection(name, { connection })

			connection.performWrites({ [name]: [added(name, 'doc0', { key: 'k', value: 0 })] })
			expect(() => connection.performWrites({ [name]: [changed(name, 'doc0', { value })] })).toThrow(error)

			expect(collection.findOne('doc0')?.value).toBe(0)
		})

		test.each([
			['before', false, ['r0', 'r1', 'r2']],
			['after', true, ['r2']],
		])(
			'loses the updates to another collection that come %s it in the same batch',
			(_order, hostileFirst, expectedSeen) => {
				const connection = makeConnection()
				const datastoreName = uniqueName('timelineDatastore')
				const otherName = uniqueName('rundowns')
				new Mongo.Collection(datastoreName, { connection })
				const other = new Mongo.Collection(otherName, { connection })

				// A reactive observer on the other collection, like a UI component would have
				const seen: string[] = []
				other.find({}).observeChanges({ added: (id: string) => seen.push(id) })

				// One flush of buffered writes, containing several updates for the other collection as well as the
				// hostile datastore document
				const otherUpdates = [added(otherName, 'r0', { name: 'a' }), added(otherName, 'r1', { name: 'b' })]
				const datastoreUpdates = [added(datastoreName, 'doc0', { key: 'k', value })]
				expect(() =>
					connection.performWrites(
						hostileFirst
							? { [datastoreName]: datastoreUpdates, [otherName]: otherUpdates }
							: { [otherName]: otherUpdates, [datastoreName]: datastoreUpdates }
					)
				).toThrow(error)

				// Later, unrelated updates for the other collection still arrive, but anything after the refused
				// document in the failed batch is gone
				connection.performWrites({ [otherName]: [added(otherName, 'r2', { name: 'c' })] })

				expect(seen).toEqual(expectedSeen)
				expect(
					other
						.find({})
						.fetch()
						.map((d: any) => d._id)
				).toEqual(expectedSeen)
			}
		)
	})
})
