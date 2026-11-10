import { protectString, ProtectedString } from '../../protectedString.js'
import { InMemoryMongoCollection } from '../InMemoryMongoCollection.js'
import { testWithAbort } from '../../__mocks__/testWithAbort.js'
import { createChildAbort } from '../../abortScope.js'

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

	testWithAbort('observeChanges runs until the signal aborts', ({ signal }) => {
		const abort = createChildAbort(signal)
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

	testWithAbort('observeChanges starts nothing when the signal is already aborted', ({ signal }) => {
		const abort = createChildAbort(signal)
		abort.abort()

		const added: string[] = []
		collection.observeChanges({ added: (docId) => void added.push(String(docId)) }, undefined, {
			signal: abort.signal,
		})

		expect(added).toEqual([])
		expect(collection.observers).toHaveLength(0)
	})

	testWithAbort('observe runs until the signal aborts', ({ signal }) => {
		const abort = createChildAbort(signal)
		const added: string[] = []

		collection.observe({ added: (doc) => void added.push(doc.name) }, undefined, { signal: abort.signal })
		expect(added).toEqual(['A'])
		expect(collection.observers).toHaveLength(1)

		abort.abort()
		expect(collection.observers).toHaveLength(0)
	})

	testWithAbort('onChange runs until the signal aborts', ({ signal }) => {
		const abort = createChildAbort(signal)
		let changes = 0

		collection.onChange(() => changes++, abort.signal)
		collection.insert(thing('B'))
		expect(changes).toBe(1)

		abort.abort()
		collection.insert(thing('C'))
		expect(changes).toBe(1)
	})

	testWithAbort('onChange registers nothing when the signal is already aborted', ({ signal }) => {
		const abort = createChildAbort(signal)
		abort.abort()

		let changes = 0
		collection.onChange(() => changes++, abort.signal)
		collection.insert(thing('B'))
		expect(changes).toBe(0)
	})

	testWithAbort('several observers on one signal are all released together', ({ signal }) => {
		const abort = createChildAbort(signal)

		collection.observeChanges({}, undefined, { signal: abort.signal })
		collection.observeChanges({}, undefined, { signal: abort.signal })
		collection.observe({}, undefined, { signal: abort.signal })
		expect(collection.observers).toHaveLength(3)

		abort.abort()
		expect(collection.observers).toHaveLength(0)
	})
})
