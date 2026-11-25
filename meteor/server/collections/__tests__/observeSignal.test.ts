/**
 * The signal-taking observe overloads on the collection layer: the signal defines the observer's
 * lifetime, and aborting it - including while setup is still in flight - leaves nothing running.
 */
import { protectString, ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { createMockCollection, WrappedMockCollection } from '../implementations/mock'

interface TestDoc {
	_id: ProtectedString<'TestDoc'>
	name: string
}

const id = (s: string) => protectString<TestDoc['_id']>(s)

/** The mock delivers observe callbacks via `setImmediate`, so flush a tick before asserting on them */
const flushCallbacks = async () => new Promise((resolve) => setImmediate(resolve))

describe('collection observe with a signal', () => {
	let collection: WrappedMockCollection<TestDoc>

	beforeEach(async () => {
		collection = createMockCollection<TestDoc>('observeSignalTest')
		collection.asyncBulkWriteDelay = 0
		collection.mockCollection.mockSetData([{ _id: id('A'), name: 'a' }])
	})

	function liveObserverCount(): number {
		return collection.mockCollection.observers.length
	}

	describe('observeChanges', () => {
		test('runs until the signal aborts', async () => {
			const abort = new AbortController()
			const added: string[] = []

			const result = await collection.observeChanges(
				{},
				{ added: (docId) => void added.push(String(docId)) },
				{ signal: abort.signal }
			)

			// The signal-taking overload resolves with nothing to stop
			expect(result).toBeUndefined()
			expect(liveObserverCount()).toBe(1)

			await flushCallbacks()
			expect(added).toEqual(['A'])

			abort.abort()
			expect(liveObserverCount()).toBe(0)
		})

		test('starts nothing when the signal is already aborted', async () => {
			const abort = new AbortController()
			abort.abort()

			const added: string[] = []
			await collection.observeChanges(
				{},
				{ added: (docId) => void added.push(String(docId)) },
				{
					signal: abort.signal,
				}
			)

			await flushCallbacks()
			expect(added).toEqual([])
			expect(liveObserverCount()).toBe(0)
		})

		test('leaves nothing running when the signal aborts mid-setup', async () => {
			const abort = new AbortController()
			const added: string[] = []

			// The mock yields on a real timer before registering, so aborting now lands mid-setup
			const pending = collection.observeChanges(
				{},
				{ added: (docId) => void added.push(String(docId)) },
				{
					signal: abort.signal,
				}
			)
			abort.abort()

			// Abort during setup resolves quietly rather than rejecting
			await expect(pending).resolves.toBeUndefined()
			expect(liveObserverCount()).toBe(0)
		})
	})

	describe('observe', () => {
		test('runs until the signal aborts', async () => {
			const abort = new AbortController()
			const added: string[] = []

			await collection.observe({}, { added: (doc) => void added.push(doc.name) }, { signal: abort.signal })
			expect(liveObserverCount()).toBe(1)

			await flushCallbacks()
			expect(added).toEqual(['a'])

			abort.abort()
			expect(liveObserverCount()).toBe(0)
		})

		test('starts nothing when the signal is already aborted', async () => {
			const abort = new AbortController()
			abort.abort()

			await collection.observe({}, {}, { signal: abort.signal })
			expect(liveObserverCount()).toBe(0)
		})
	})

	describe('sequential setup', () => {
		test('a failure partway through releases the observers already started', async () => {
			const abort = new AbortController()

			await expect(
				(async () => {
					await collection.observeChanges({}, {}, { signal: abort.signal })
					await collection.observeChanges({}, {}, { signal: abort.signal })
					throw new Error('setup failed')
				})()
			).rejects.toThrow('setup failed')

			// Both observers are still running: it is the caller's abort that releases them,
			// which is exactly what makes the leak impossible to forget
			expect(liveObserverCount()).toBe(2)

			abort.abort()
			expect(liveObserverCount()).toBe(0)
		})
	})
})
