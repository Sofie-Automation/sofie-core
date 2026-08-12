/**
 * The leak this migration exists to close: a publication that starts several observers in sequence
 * used to orphan the earlier ones if a later one threw, because each observer's teardown lived in a
 * handle that the throw skipped past. Now every observer is started on the worker's signal, which is
 * aborted on failure, so a partial setup releases itself.
 */
import { protectString, ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { createMockCollection, WrappedMockCollection } from '../../../collections/implementations/mock'
import { setUpOptimizedObserverInner } from '../optimizedObserverBase'
import type { CustomPublish, CustomPublishChanges } from '../publish'

interface TestDoc {
	_id: ProtectedString<'TestDoc'>
	name: string
}

/** A subscriber whose lifetime we can end, as unsubscribing would */
class SubscriberMock implements CustomPublish<TestDoc> {
	readonly #abort = new AbortController()

	get isReady(): boolean {
		return false
	}

	get signal(): AbortSignal {
		return this.#abort.signal
	}

	unsubscribe(): void {
		this.#abort.abort()
	}

	init = jest.fn()
	changed = jest.fn()
}

const noChanges: CustomPublishChanges<TestDoc> = { added: [], changed: [], removed: [] }
const manipulateData = async (): Promise<[TestDoc[], CustomPublishChanges<TestDoc>]> => [[], noChanges]

describe('optimizedObserver observer lifetimes', () => {
	let collection: WrappedMockCollection<TestDoc>

	beforeEach(() => {
		collection = createMockCollection<TestDoc>('observerLeakTest')
		collection.asyncBulkWriteDelay = 0
		collection.mockCollection.mockSetData([{ _id: protectString<TestDoc['_id']>('A'), name: 'a' }])
	})

	function liveObserverCount(): number {
		return collection.mockCollection.observers.length
	}

	test('a throw partway through setupObservers releases the observers it already started', async () => {
		const setupFailed = new Error('third observer failed')

		const setupObservers = async (_args: any, _triggerUpdate: any, signal: AbortSignal) => {
			await collection.observeChanges({}, {}, { signal })
			await collection.observeChanges({}, {}, { signal })

			expect(liveObserverCount()).toBe(2)

			// Before this migration, the two observers above were owned by handles this throw skipped past
			throw setupFailed
		}

		await expect(
			setUpOptimizedObserverInner(
				'leak_setup_throws',
				{},
				setupObservers,
				manipulateData,
				new SubscriberMock(),
				0
			)
		).rejects.toBe(setupFailed)

		expect(liveObserverCount()).toBe(0)
	})

	test('the observers are released once the last subscriber unsubscribes', async () => {
		const setupObservers = async (_args: any, _triggerUpdate: any, signal: AbortSignal) => {
			await collection.observeChanges({}, {}, { signal })
			await collection.observeChanges({}, {}, { signal })
		}

		const subscriber = new SubscriberMock()
		await setUpOptimizedObserverInner('leak_last_subscriber', {}, setupObservers, manipulateData, subscriber, 0)

		expect(liveObserverCount()).toBe(2)

		subscriber.unsubscribe()

		// Teardown is driven by a debounced update, so let it run
		await new Promise((resolve) => setTimeout(resolve, 10))

		expect(liveObserverCount()).toBe(0)
	})
})
