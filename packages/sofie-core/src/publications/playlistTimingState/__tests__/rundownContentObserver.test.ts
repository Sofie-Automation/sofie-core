import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import type { RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { LiveQueryHandleSync } from '../../../lib/lib'
import { sleep } from '../../../lib/lib'

/** Subscriptions handed out by the mocked publication, so tests can drive and inspect them */
interface FakeSubscription {
	activationId: RundownPlaylistActivationId
	stop: jest.Mock
	/** Simulates the upstream publishing its documents */
	publish: (count: number) => void
}
let subscriptions: FakeSubscription[] = []
/** Blocks the next subscribe, so the "disposed mid-subscribe" case can be exercised */
let pendingSubscribe: PromiseWithResolvers<void> | undefined

jest.mock('../../partInstancesUI/publication', () => ({
	observeUIPartInstances: jest.fn(
		async (
			activationId: RundownPlaylistActivationId,
			collection: { insert: (doc: any) => void; remove: (selector: any) => void },
			onChanged?: () => void
		): Promise<LiveQueryHandleSync> => {
			if (pendingSubscribe) await pendingSubscribe.promise

			const subscription: FakeSubscription = {
				activationId,
				stop: jest.fn(),
				publish: (count: number) => {
					for (let i = 0; i < count; i++) {
						collection.insert({ _id: protectString(`${activationId}_${i}`) })
					}
					onChanged?.()
				},
			}
			subscriptions.push(subscription)
			return { stop: subscription.stop }
		}
	),
}))

import { PartInstancesForActivationObserver } from '../rundownContentObserver'
import { createReactiveContentCache, type ContentCache } from '../reactiveContentCache'

const ACTIVATION_A = protectString<RundownPlaylistActivationId>('activationA')
const ACTIVATION_B = protectString<RundownPlaylistActivationId>('activationB')

/** Longer than the observer's internal debounce */
const AFTER_DEBOUNCE = 50

describe('PartInstancesForActivationObserver', () => {
	let cache: ContentCache
	let onChanged: jest.Mock

	beforeEach(() => {
		subscriptions = []
		pendingSubscribe = undefined
		cache = createReactiveContentCache()
		onChanged = jest.fn()
	})

	it('does not subscribe while the playlist is inactive', async () => {
		const observer = new PartInstancesForActivationObserver(cache, onChanged)

		observer.setActivation(undefined)
		await sleep(AFTER_DEBOUNCE)

		expect(subscriptions).toHaveLength(0)
		observer.dispose()
	})

	it('subscribes for the activation, and feeds the cache', async () => {
		const observer = new PartInstancesForActivationObserver(cache, onChanged)

		observer.setActivation(ACTIVATION_A)
		await sleep(AFTER_DEBOUNCE)

		expect(subscriptions).toHaveLength(1)
		expect(subscriptions[0].activationId).toBe(ACTIVATION_A)

		subscriptions[0].publish(2)
		expect(cache.PartInstances.findFetch({})).toHaveLength(2)
		expect(onChanged).toHaveBeenCalled()

		observer.dispose()
	})

	it('resubscribes when the activation changes, discarding the previous instances', async () => {
		const observer = new PartInstancesForActivationObserver(cache, onChanged)

		observer.setActivation(ACTIVATION_A)
		await sleep(AFTER_DEBOUNCE)
		subscriptions[0].publish(2)
		expect(cache.PartInstances.findFetch({})).toHaveLength(2)

		observer.setActivation(ACTIVATION_B)
		await sleep(AFTER_DEBOUNCE)

		expect(subscriptions[0].stop).toHaveBeenCalledTimes(1)
		expect(subscriptions).toHaveLength(2)
		expect(subscriptions[1].activationId).toBe(ACTIVATION_B)
		// the previous activation's instances must not linger
		expect(cache.PartInstances.findFetch({})).toHaveLength(0)

		observer.dispose()
	})

	it('unsubscribes and clears when the playlist is deactivated', async () => {
		const observer = new PartInstancesForActivationObserver(cache, onChanged)

		observer.setActivation(ACTIVATION_A)
		await sleep(AFTER_DEBOUNCE)
		subscriptions[0].publish(2)

		observer.setActivation(undefined)
		await sleep(AFTER_DEBOUNCE)

		expect(subscriptions[0].stop).toHaveBeenCalledTimes(1)
		expect(subscriptions).toHaveLength(1)
		expect(cache.PartInstances.findFetch({})).toHaveLength(0)
		// the consumer must be told, or it would keep publishing the stale instances
		expect(onChanged).toHaveBeenCalled()

		observer.dispose()
	})

	it('ignores being told the same activation again', async () => {
		const observer = new PartInstancesForActivationObserver(cache, onChanged)

		observer.setActivation(ACTIVATION_A)
		await sleep(AFTER_DEBOUNCE)
		observer.setActivation(ACTIVATION_A)
		await sleep(AFTER_DEBOUNCE)

		expect(subscriptions).toHaveLength(1)
		expect(subscriptions[0].stop).not.toHaveBeenCalled()

		observer.dispose()
	})

	it('stops its subscription when disposed', async () => {
		const observer = new PartInstancesForActivationObserver(cache, onChanged)
		observer.setActivation(ACTIVATION_A)
		await sleep(AFTER_DEBOUNCE)

		observer.dispose()

		expect(subscriptions[0].stop).toHaveBeenCalledTimes(1)
	})

	it('does not leak a subscription that completes after disposal', async () => {
		pendingSubscribe = Promise.withResolvers<void>()
		const observer = new PartInstancesForActivationObserver(cache, onChanged)
		observer.setActivation(ACTIVATION_A)

		// dispose while the subscribe is still in flight
		await sleep(AFTER_DEBOUNCE)
		observer.dispose()
		pendingSubscribe.resolve()
		await sleep(AFTER_DEBOUNCE)

		expect(subscriptions).toHaveLength(1)
		expect(subscriptions[0].stop).toHaveBeenCalledTimes(1)
	})

	it('does not subscribe at all if disposed before the debounce elapses', async () => {
		const observer = new PartInstancesForActivationObserver(cache, onChanged)

		observer.setActivation(ACTIVATION_A)
		observer.dispose()
		await sleep(AFTER_DEBOUNCE)

		expect(subscriptions).toHaveLength(0)
	})
})
