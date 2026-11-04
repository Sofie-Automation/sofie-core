/**
 * Adversarial test for documents published to the UI containing field names with `.` or a leading `$`.
 *
 * TimelineDatastore values are written by blueprints as arbitrary objects and published as-is (see the
 * sofie-core `timelineDatastoreHostileKeys.integration.test.ts`, which shows they survive MongoDB, the
 * publication and the DDP wire). This drives the real client-side DDP store (`Connection._performWrites` ->
 * `Mongo.Collection` store -> minimongo) with such documents, to see what happens when they reach the UI.
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

const hostileValues: Array<[string, unknown]> = [
	['dotted field name', { 'a.b': 1 }],
	['field name that is only a dot', { '.': 1 }],
	['nested dotted field name', { x: { 'y.z': 1 } }],
	['dotted field name inside an array', [{ 'a.b': 1 }]],
	['$-prefixed field name', { $foo: 1 }],
	['nested $-prefixed field name', { x: { $foo: 1 } }],
	['mongo update operator lookalike', { $set: { a: 1 } }],
	['$-prefixed field name inside an array', [{ $foo: 1 }]],
]

const safeValues: Array<[string, unknown]> = [
	['string', 'hello.world'],
	['string starting with $', '$foo'],
	['number', 42],
	['plain object', { a: { b: 1 } }],
]

describe('client DDP store: hostile field names', () => {
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

	describe.each(hostileValues)('%s', (_name, value) => {
		test('is accepted when added', () => {
			const connection = makeConnection()
			const name = uniqueName('timelineDatastore')
			const collection = new Mongo.Collection(name, { connection })

			connection.performWrites({ [name]: [added(name, 'doc0', { key: 'k', value })] })

			expect(collection.findOne('doc0')?.value).toEqual(value)
		})

		test('is accepted when changed', () => {
			const connection = makeConnection()
			const name = uniqueName('timelineDatastore')
			const collection = new Mongo.Collection(name, { connection })

			connection.performWrites({ [name]: [added(name, 'doc0', { key: 'k', value: 0 })] })
			connection.performWrites({ [name]: [changed(name, 'doc0', { value })] })

			expect(collection.findOne('doc0')?.value).toEqual(value)
		})

		test.each([
			['before', false],
			['after', true],
		])('does not break another collection updated %s it in the same batch', (_order, hostileFirst) => {
			const connection = makeConnection()
			const datastoreName = uniqueName('timelineDatastore')
			const otherName = uniqueName('rundowns')
			new Mongo.Collection(datastoreName, { connection })
			const other = new Mongo.Collection(otherName, { connection })

			// A reactive observer on the other collection, like a UI component would have
			const seen: string[] = []
			other.find({}).observeChanges({ added: (id: string) => seen.push(id) })

			// One flush of buffered writes, containing several updates for the other collection (so its
			// observers are paused for the batch) as well as the hostile datastore document
			const otherUpdates = [added(otherName, 'r0', { name: 'a' }), added(otherName, 'r1', { name: 'b' })]
			const datastoreUpdates = [added(datastoreName, 'doc0', { key: 'k', value })]
			let thrown: unknown
			try {
				connection.performWrites(
					hostileFirst
						? { [datastoreName]: datastoreUpdates, [otherName]: otherUpdates }
						: { [otherName]: otherUpdates, [datastoreName]: datastoreUpdates }
				)
			} catch (e) {
				thrown = e
			}

			// Later, unrelated updates for the other collection must still reach the UI
			connection.performWrites({ [otherName]: [added(otherName, 'r2', { name: 'c' })] })

			expect({ thrown, seen }).toEqual({ thrown: undefined, seen: ['r0', 'r1', 'r2'] })
		})
	})
})
