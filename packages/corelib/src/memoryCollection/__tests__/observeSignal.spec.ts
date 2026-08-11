import { protectString, ProtectedString } from '../../protectedString.js'
import { InMemoryMongoCollection } from '../InMemoryMongoCollection.js'

interface Thing {
	_id: ProtectedString<'ThingId'>
	name: string
}

const id = (s: string) => protectString<Thing['_id']>(s)
const thing = (s: string): Thing => ({ _id: id(s), name: s })

describe('observe with a signal', () => {
	let collection: InMemoryMongoCollection<Thing>

	beforeEach(() => {
		collection = new InMemoryMongoCollection<Thing>('things')
		collection.mockSetData([thing('A')])
	})

	test('observeChanges runs until the signal aborts', () => {
		const abort = new AbortController()
		const added: string[] = []

		const result = collection.observeChanges({ added: (docId) => void added.push(String(docId)) }, undefined, {
			signal: abort.signal,
		})

		// The signal-taking overload has nothing to return
		expect(result).toBeUndefined()
		expect(added).toEqual(['A'])
		expect(collection.observers).toHaveLength(1)

		collection.insert(thing('B'))
		expect(added).toEqual(['A', 'B'])

		abort.abort()
		expect(collection.observers).toHaveLength(0)

		collection.insert(thing('C'))
		expect(added).toEqual(['A', 'B'])
	})

	test('observeChanges starts nothing when the signal is already aborted', () => {
		const abort = new AbortController()
		abort.abort()

		const added: string[] = []
		collection.observeChanges({ added: (docId) => void added.push(String(docId)) }, undefined, {
			signal: abort.signal,
		})

		expect(added).toEqual([])
		expect(collection.observers).toHaveLength(0)
	})

	test('observe runs until the signal aborts', () => {
		const abort = new AbortController()
		const added: string[] = []

		collection.observe({ added: (doc) => void added.push(doc.name) }, undefined, { signal: abort.signal })
		expect(added).toEqual(['A'])
		expect(collection.observers).toHaveLength(1)

		abort.abort()
		expect(collection.observers).toHaveLength(0)
	})

	test('onChange runs until the signal aborts', () => {
		const abort = new AbortController()
		let changes = 0

		collection.onChange(() => changes++, abort.signal)
		collection.insert(thing('B'))
		expect(changes).toBe(1)

		abort.abort()
		collection.insert(thing('C'))
		expect(changes).toBe(1)
	})

	test('onChange registers nothing when the signal is already aborted', () => {
		const abort = new AbortController()
		abort.abort()

		let changes = 0
		collection.onChange(() => changes++, abort.signal)
		collection.insert(thing('B'))
		expect(changes).toBe(0)
	})

	test('the deprecated overloads still return a stop handle', () => {
		const handle = collection.observeChanges({})
		expect(collection.observers).toHaveLength(1)

		handle.stop()
		expect(collection.observers).toHaveLength(0)
	})

	test('several observers on one signal are all released together', () => {
		const abort = new AbortController()

		collection.observeChanges({}, undefined, { signal: abort.signal })
		collection.observeChanges({}, undefined, { signal: abort.signal })
		collection.observe({}, undefined, { signal: abort.signal })
		expect(collection.observers).toHaveLength(3)

		abort.abort()
		expect(collection.observers).toHaveLength(0)
	})
})
