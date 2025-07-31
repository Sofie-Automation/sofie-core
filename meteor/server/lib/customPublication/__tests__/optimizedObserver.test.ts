import { createManualPromise } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { optimizedObserverCountSubscribers, setUpOptimizedObserverInner, TriggerUpdate } from '../optimizedObserverBase'
import { CustomPublish, CustomPublishChanges } from '../publish'
import { sleep } from '../../lib'

interface CustomPublishMockExt {
	stop?: () => void
}

class CustomPublishMock<DBObj extends { _id: ProtectedString<any> }>
	implements CustomPublish<DBObj>, CustomPublishMockExt
{
	static create<DBObj extends { _id: ProtectedString<any> }>(): CustomPublish<DBObj> & CustomPublishMockExt {
		const mock = new CustomPublishMock<DBObj>()
		return mock as CustomPublish<DBObj>
	}

	get isReady(): boolean {
		return false
	}

	stop?: () => void

	onStop(callback: () => void) {
		this.stop = callback
	}

	init: CustomPublish<DBObj>['init'] = jest.fn()
	changed: CustomPublish<DBObj>['changed'] = jest.fn()
}

function emptyChanges<DBObj extends { _id: ProtectedString<any> }>(): CustomPublishChanges<DBObj> {
	return {
		added: [],
		changed: [],
		removed: [],
	}
}

type ManipulateDataRes = [any[], CustomPublishChanges<any>]

describe('optimizedObserver base', () => {
	test('setup observer with pair of subscribers', async () => {
		const receiver = CustomPublishMock.create<any>()
		const receiver2 = CustomPublishMock.create<any>()

		try {
			let triggerUpdate: TriggerUpdate<Record<string, never>> | undefined
			const setupObservers = jest.fn(async (_args, triggerUpdate0) => {
				triggerUpdate = triggerUpdate0
				return []
			})
			const manipulateData = jest.fn(async (): Promise<ManipulateDataRes> => [[], emptyChanges()])

			// Start off the first subscriber
			setUpOptimizedObserverInner('test2', {}, setupObservers, manipulateData, receiver, 0).catch(() => null)
			// This should be ready before anything async
			expect(optimizedObserverCountSubscribers('test2')).toBe(1)

			// At this point, it should have started on the async, but not gotten anywhere with it
			expect(setupObservers).toHaveBeenCalledTimes(1)
			expect(manipulateData).toHaveBeenCalledTimes(0)

			// Add the second subscriber
			await setUpOptimizedObserverInner('test2', {}, null as any, null as any, receiver2, 0).catch(() => null)

			// Let the async run
			await sleep(0)

			expect(optimizedObserverCountSubscribers('test2')).toBe(2)

			// Receiver was init, no changes
			expect(receiver.changed).toHaveBeenCalledTimes(0)
			expect(receiver.init).toHaveBeenCalledTimes(1)
			expect(receiver.init).toHaveBeenNthCalledWith(1, [])
			expect(receiver.stop).toBeTruthy()

			// Receiver was init, no changes
			expect(receiver2.changed).toHaveBeenCalledTimes(0)
			expect(receiver2.init).toHaveBeenCalledTimes(1)
			expect(receiver2.init).toHaveBeenNthCalledWith(1, [])
			expect(receiver2.stop).toBeTruthy()

			// provided methods were called correctly
			expect(setupObservers).toHaveBeenCalledTimes(1)
			expect(manipulateData).toHaveBeenCalledTimes(1)
			expect(typeof triggerUpdate).toBe('function')
		} finally {
			if (receiver.stop) receiver.stop()
			if (receiver2.stop) receiver2.stop()

			// Let the async run
			await sleep(0)
			expect(optimizedObserverCountSubscribers('test2')).toBeNull()
		}
	})

	test('remove the first subscribers while second joins', async () => {
		const receiver = CustomPublishMock.create<any>()
		const receiver2 = CustomPublishMock.create<any>()

		try {
			const setupObservers = jest.fn(async () => [])
			const manipulateData = jest.fn(async (): Promise<ManipulateDataRes> => [[], emptyChanges()])

			// Start off the first subscriber
			await setUpOptimizedObserverInner('test2', {}, setupObservers, manipulateData, receiver, 0)
			await setUpOptimizedObserverInner('test2', {}, null as any, null as any, receiver2, 0)
			expect(optimizedObserverCountSubscribers('test2')).toBe(2)

			expect(manipulateData).toHaveBeenCalledTimes(1)
			const manualPromise = createManualPromise<ManipulateDataRes>()
			manipulateData.mockImplementationOnce(async () => manualPromise)

			// Let the async run
			await sleep(0)

			// At this point, the second manipulateData() call, is waiting on our manualPromise
			expect(manipulateData).toHaveBeenCalledTimes(2)

			// Check the receiver calls
			expect(receiver.changed).toHaveBeenCalledTimes(0)
			expect(receiver.init).toHaveBeenCalledTimes(1)
			expect(receiver2.changed).toHaveBeenCalledTimes(0)
			expect(receiver2.init).toHaveBeenCalledTimes(0)

			// Now lets remove our first subscriber
			receiver.stop!()
			await sleep(0)

			expect(optimizedObserverCountSubscribers('test2')).toBe(1)

			// Lets unblock
			manualPromise.manualResolve([[], emptyChanges()])
			await sleep(0)

			// Check the receiver calls
			expect(receiver.changed).toHaveBeenCalledTimes(0)
			expect(receiver.init).toHaveBeenCalledTimes(1)
			expect(receiver2.changed).toHaveBeenCalledTimes(0)
			expect(receiver2.init).toHaveBeenCalledTimes(1)
		} finally {
			if (receiver.stop) receiver.stop()
			if (receiver2.stop) receiver2.stop()

			// Let the async run
			await sleep(0)
		}
	})
})
