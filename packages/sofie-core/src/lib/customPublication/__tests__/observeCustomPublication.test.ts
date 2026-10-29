import { InMemoryMongoCollection } from '@sofie-automation/corelib/dist/memoryCollection'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import type { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { CustomPublishToCollection, observeCustomPublication } from '../observeCustomPublication'
import type { CustomPublish } from '../publish'
import { setUpCollectionOptimizedObserver } from '../optimizedObserverCollection'
import { optimizedObserverCountSubscribers } from '../optimizedObserverBase'
import type { CustomPublishCollection } from '../customPublishCollection'
import { sleep } from '../../lib'

type TestDocId = ProtectedString<'TestDoc'>
interface TestDoc {
	_id: TestDocId
	name: string
	rank?: number
}

function makeCollection(): InMemoryMongoCollection<TestDoc> {
	return new InMemoryMongoCollection<TestDoc>('testDocs')
}

function doc(id: string, name: string, rank?: number): TestDoc {
	return { _id: protectString<TestDocId>(id), name, ...(rank !== undefined ? { rank } : {}) }
}

describe('CustomPublishToCollection', () => {
	it('is not ready until initialised', () => {
		const receiver = new CustomPublishToCollection(makeCollection())

		expect(receiver.isReady).toBe(false)

		receiver.init([])
		expect(receiver.isReady).toBe(true)
	})

	it('populates the collection on init', () => {
		const collection = makeCollection()
		const receiver = new CustomPublishToCollection(collection)

		receiver.init([doc('a', 'Doc A'), doc('b', 'Doc B')])

		expect(collection.findFetch({}).sort((x, y) => x.name.localeCompare(y.name))).toEqual([
			doc('a', 'Doc A'),
			doc('b', 'Doc B'),
		])
	})

	it('clears anything already in the collection on init', () => {
		const collection = makeCollection()
		collection.insert(doc('stale', 'Stale'))
		const receiver = new CustomPublishToCollection(collection)

		receiver.init([doc('a', 'Doc A')])

		expect(collection.findFetch({})).toEqual([doc('a', 'Doc A')])
	})

	it('rejects a second init', () => {
		const receiver = new CustomPublishToCollection(makeCollection())
		receiver.init([])

		expect(() => receiver.init([])).toThrow(/already been initialised/)
	})

	it('rejects changes before init', () => {
		const receiver = new CustomPublishToCollection(makeCollection())

		expect(() => receiver.changed({ added: [], changed: [], removed: [] })).toThrow(/not been initialised/)
	})

	describe('applying changes', () => {
		it('adds, updates and removes documents', () => {
			const collection = makeCollection()
			const receiver = new CustomPublishToCollection(collection)
			receiver.init([doc('a', 'Doc A'), doc('b', 'Doc B')])

			receiver.changed({
				added: [doc('c', 'Doc C')],
				changed: [{ _id: protectString<TestDocId>('a'), name: 'Doc A renamed' }],
				removed: [protectString<TestDocId>('b')],
			})

			expect(collection.findOne(protectString<TestDocId>('a'))).toEqual(doc('a', 'Doc A renamed'))
			expect(collection.findOne(protectString<TestDocId>('b'))).toBeUndefined()
			expect(collection.findOne(protectString<TestDocId>('c'))).toEqual(doc('c', 'Doc C'))
		})

		it('merges a partial change, leaving untouched fields alone', () => {
			const collection = makeCollection()
			const receiver = new CustomPublishToCollection(collection)
			receiver.init([doc('a', 'Doc A', 5)])

			receiver.changed({
				added: [],
				changed: [{ _id: protectString<TestDocId>('a'), rank: 7 }],
				removed: [],
			})

			expect(collection.findOne(protectString<TestDocId>('a'))).toEqual(doc('a', 'Doc A', 7))
		})

		/**
		 * The upstream diff marks a field that has gone away by setting it to undefined, so it has to
		 * be removed from the document rather than stored as an undefined value.
		 */
		it('unsets a field whose new value is undefined', () => {
			const collection = makeCollection()
			const receiver = new CustomPublishToCollection(collection)
			receiver.init([doc('a', 'Doc A', 5)])

			receiver.changed({
				added: [],
				changed: [{ _id: protectString<TestDocId>('a'), rank: undefined }],
				removed: [],
			})

			const updated = collection.findOne(protectString<TestDocId>('a'))
			expect(updated).toEqual(doc('a', 'Doc A'))
			expect(updated && Object.hasOwn(updated, 'rank')).toBe(false)
		})

		it('replaces a document that is re-added', () => {
			const collection = makeCollection()
			const receiver = new CustomPublishToCollection(collection)
			receiver.init([doc('a', 'Doc A', 5)])

			receiver.changed({ added: [doc('a', 'Doc A again')], changed: [], removed: [] })

			expect(collection.findOne(protectString<TestDocId>('a'))).toEqual(doc('a', 'Doc A again'))
		})
	})

	describe('change notification', () => {
		it('fires once per batch rather than once per document', () => {
			const onChanged = jest.fn()
			const receiver = new CustomPublishToCollection(makeCollection(), onChanged)

			receiver.init([doc('a', 'Doc A'), doc('b', 'Doc B')])
			expect(onChanged).toHaveBeenCalledTimes(1)

			receiver.changed({
				added: [doc('c', 'Doc C'), doc('d', 'Doc D')],
				changed: [{ _id: protectString<TestDocId>('a'), name: 'renamed' }],
				removed: [protectString<TestDocId>('b')],
			})
			expect(onChanged).toHaveBeenCalledTimes(2)
		})
	})

	describe('stopping', () => {
		it('calls the registered stop callback', () => {
			const receiver = new CustomPublishToCollection(makeCollection())
			const onStop = jest.fn()
			receiver.onStop(onStop)

			receiver.stop()

			expect(onStop).toHaveBeenCalledTimes(1)
		})

		it('only unsubscribes once, however many times it is stopped', () => {
			const receiver = new CustomPublishToCollection(makeCollection())
			const onStop = jest.fn()
			receiver.onStop(onStop)

			receiver.stop()
			receiver.stop()

			expect(onStop).toHaveBeenCalledTimes(1)
		})
	})
})

describe('observeCustomPublication', () => {
	it('returns a handle that unsubscribes, like a Mongo observer', async () => {
		const collection = makeCollection()
		const onStop = jest.fn()

		const handle = await observeCustomPublication(collection, async (receiver) => {
			receiver.onStop(onStop)
			receiver.init([doc('a', 'Doc A')])
		})

		expect(collection.findFetch({})).toEqual([doc('a', 'Doc A')])
		expect(onStop).not.toHaveBeenCalled()

		handle.stop()
		expect(onStop).toHaveBeenCalledTimes(1)
	})

	it('keeps the collection up to date as the upstream publishes', async () => {
		const collection = makeCollection()
		let upstream: CustomPublish<TestDoc> | undefined

		await observeCustomPublication(collection, async (receiver) => {
			upstream = receiver
			receiver.init([doc('a', 'Doc A')])
		})

		upstream?.changed({ added: [doc('b', 'Doc B')], changed: [], removed: [] })

		expect(
			collection
				.findFetch({})
				.map((d) => d.name)
				.sort()
		).toEqual(['Doc A', 'Doc B'])
	})

	/**
	 * The tests above drive the receiver by hand. These check the thing that actually matters: that
	 * it behaves as a real subscriber of a real optimized observer - joining the shared one rather
	 * than starting a second, and unsubscribing when the handle is stopped.
	 */
	describe('against a real optimized observer', () => {
		interface TestArgs {
			readonly id: string
		}

		/** setUpCollectionOptimizedObserver namespaces the identifier it registers the observer under */
		function observerKey(identifier: string): string {
			return `pub_collection_${identifier}`
		}

		function setUpTestObserver(
			identifier: string,
			docs: TestDoc[]
		): {
			subscribe: (receiver: CustomPublish<TestDoc>) => Promise<void>
			setupObservers: jest.Mock
			publish: (newDocs: TestDoc[]) => void
		} {
			let triggerUpdate: ((props: Record<string, never>) => void) | undefined
			let current = docs

			const setupObservers = jest.fn(async (_args: TestArgs, triggerUpdate0: any) => {
				triggerUpdate = triggerUpdate0
				return []
			})

			const manipulateData = async (
				_args: TestArgs,
				_state: Partial<Record<string, never>>,
				collection: CustomPublishCollection<TestDoc>
			) => {
				collection.remove(null)
				for (const doc of current) collection.replace(doc)
			}

			return {
				setupObservers,
				subscribe: async (receiver) =>
					setUpCollectionOptimizedObserver<TestDoc, TestArgs, Record<string, never>, Record<string, never>>(
						identifier,
						{ id: identifier },
						setupObservers as any,
						manipulateData,
						receiver,
						0
					),
				publish: (newDocs) => {
					current = newDocs
					triggerUpdate?.({})
				},
			}
		}

		it('receives the observer output, and further updates', async () => {
			const collection = makeCollection()
			const upstream = setUpTestObserver('test_observe_updates', [doc('a', 'Doc A')])

			const handle = await observeCustomPublication(collection, upstream.subscribe)
			expect(collection.findFetch({})).toEqual([doc('a', 'Doc A')])

			upstream.publish([doc('a', 'Doc A renamed'), doc('b', 'Doc B')])
			await sleep(20)

			expect(collection.findOne(protectString<TestDocId>('a'))).toEqual(doc('a', 'Doc A renamed'))
			expect(collection.findOne(protectString<TestDocId>('b'))).toEqual(doc('b', 'Doc B'))

			handle.stop()
			await sleep(20)
		})

		it('joins the existing observer rather than starting another', async () => {
			const identifier = 'test_observe_shared'
			const upstream = setUpTestObserver(identifier, [doc('a', 'Doc A')])

			const first = makeCollection()
			const second = makeCollection()
			const handleA = await observeCustomPublication(first, upstream.subscribe)
			const handleB = await observeCustomPublication(second, upstream.subscribe)

			// one observer doing the work, two subscribers reading it
			expect(upstream.setupObservers).toHaveBeenCalledTimes(1)
			expect(optimizedObserverCountSubscribers(observerKey(identifier))).toBe(2)
			// both are populated by the time they resolve, including the one that joined an
			// already-running observer and is therefore initialised on a later tick
			expect(first.findFetch({})).toEqual([doc('a', 'Doc A')])
			expect(second.findFetch({})).toEqual([doc('a', 'Doc A')])

			handleA.stop()
			handleB.stop()
			await sleep(20)
		})

		it('unsubscribes from the shared observer when stopped', async () => {
			const identifier = 'test_observe_unsubscribe'
			const upstream = setUpTestObserver(identifier, [doc('a', 'Doc A')])

			const handleA = await observeCustomPublication(makeCollection(), upstream.subscribe)
			const handleB = await observeCustomPublication(makeCollection(), upstream.subscribe)
			expect(optimizedObserverCountSubscribers(observerKey(identifier))).toBe(2)

			handleA.stop()
			expect(optimizedObserverCountSubscribers(observerKey(identifier))).toBe(1)

			handleB.stop()
			expect(optimizedObserverCountSubscribers(observerKey(identifier))).toBe(0)

			await sleep(20)
		})
	})

	it('does not leak a subscription when setting up fails', async () => {
		const onStop = jest.fn()

		await expect(
			observeCustomPublication(makeCollection(), async (receiver) => {
				receiver.onStop(onStop)
				throw new Error('upstream boom')
			})
		).rejects.toThrow('upstream boom')

		expect(onStop).toHaveBeenCalledTimes(1)
	})
})
