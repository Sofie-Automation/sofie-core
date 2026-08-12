import type { LiveQueryHandleSync } from '../lib'
import {
	createChildAbort,
	stopOnAbort,
	attachPendingHandles,
	handleFromSignalSetup,
	processLifetimeSignal,
} from '../observerLifetime'
import { getEventListeners } from 'node:events'

function makeHandle(): LiveQueryHandleSync & { stopCount: number } {
	const handle = {
		stopCount: 0,
		stop: () => {
			handle.stopCount++
		},
	}
	return handle
}

describe('observerLifetime', () => {
	describe('createChildAbort', () => {
		test('child aborts when parent aborts', () => {
			const parent = new AbortController()
			const child = createChildAbort(parent.signal)

			expect(child.signal.aborted).toBe(false)
			parent.abort()
			expect(child.signal.aborted).toBe(true)
		})

		test('child is aborted immediately if parent already aborted', () => {
			const parent = new AbortController()
			const reason = new Error('parent gone')
			parent.abort(reason)

			const child = createChildAbort(parent.signal)
			expect(child.signal.aborted).toBe(true)
			expect(child.signal.reason).toBe(reason)
		})

		test('child abort reason is propagated from parent', () => {
			const parent = new AbortController()
			const child = createChildAbort(parent.signal)

			const reason = new Error('parent gone')
			parent.abort(reason)
			expect(child.signal.reason).toBe(reason)
		})

		test('aborting the child does not abort the parent', () => {
			const parent = new AbortController()
			const child = createChildAbort(parent.signal)

			child.abort()
			expect(child.signal.aborted).toBe(true)
			expect(parent.signal.aborted).toBe(false)
		})

		test('many sequential children do not accumulate listeners on the parent', () => {
			const parent = new AbortController()

			const before = getEventListeners(parent.signal, 'abort').length
			for (let i = 0; i < 1000; i++) {
				createChildAbort(parent.signal).abort()
			}

			// Composition via AbortSignal.any does not register user-visible listeners on the parent,
			// and dropped children are not pinned to it
			expect(getEventListeners(parent.signal, 'abort').length).toBe(before)
		})

		test('aborting the parent still ends children created earlier', () => {
			const parent = new AbortController()
			const children = Array.from({ length: 100 }, () => createChildAbort(parent.signal))

			parent.abort()

			for (const child of children) {
				expect(child.signal.aborted).toBe(true)
			}
		})
	})

	describe('processLifetimeSignal', () => {
		test('is not aborted', () => {
			expect(processLifetimeSignal.aborted).toBe(false)
		})
	})

	describe('stopOnAbort', () => {
		test('stops handles when the signal aborts', () => {
			const abort = new AbortController()
			const handle1 = makeHandle()
			const handle2 = makeHandle()

			stopOnAbort(abort.signal, handle1, handle2)
			expect(handle1.stopCount).toBe(0)
			expect(handle2.stopCount).toBe(0)

			abort.abort()
			expect(handle1.stopCount).toBe(1)
			expect(handle2.stopCount).toBe(1)
		})

		test('stops handles immediately if the signal is already aborted', () => {
			const abort = new AbortController()
			abort.abort()

			const handle = makeHandle()
			stopOnAbort(abort.signal, handle)
			expect(handle.stopCount).toBe(1)
		})

		test('a throwing stop does not prevent other handles from stopping', () => {
			const abort = new AbortController()
			const bad: LiveQueryHandleSync = {
				stop: () => {
					throw new Error('stop failed')
				},
			}
			const good = makeHandle()

			stopOnAbort(abort.signal, bad, good)
			abort.abort()
			expect(good.stopCount).toBe(1)
		})

		test('an async rejecting stop is tolerated', async () => {
			const abort = new AbortController()
			let stopCalled = false
			stopOnAbort(abort.signal, {
				stop: async () => {
					stopCalled = true
					throw new Error('async stop failed')
				},
			})
			abort.abort()
			expect(stopCalled).toBe(true)
			// Flush the rejection handling
			await new Promise((resolve) => setImmediate(resolve))
		})
	})

	describe('attachPendingHandles', () => {
		test('binds all handles to the signal on success', async () => {
			const abort = new AbortController()
			const handle1 = makeHandle()
			const handle2 = makeHandle()

			await attachPendingHandles(abort.signal, [Promise.resolve(handle1), handle2])
			expect(handle1.stopCount).toBe(0)
			expect(handle2.stopCount).toBe(0)

			abort.abort()
			expect(handle1.stopCount).toBe(1)
			expect(handle2.stopCount).toBe(1)
		})

		test('stops started handles and rethrows when one rejects', async () => {
			const abort = new AbortController()
			const handle1 = makeHandle()
			const handle2 = makeHandle()
			const error = new Error('setup failed')

			await expect(
				attachPendingHandles(abort.signal, [Promise.resolve(handle1), Promise.reject(error), handle2])
			).rejects.toBe(error)

			// The started handles must have been stopped, without needing the signal to abort
			expect(handle1.stopCount).toBe(1)
			expect(handle2.stopCount).toBe(1)
			expect(abort.signal.aborted).toBe(false)
		})

		test('rethrows the first rejection when multiple reject', async () => {
			const abort = new AbortController()
			const error1 = new Error('first')
			const error2 = new Error('second')

			await expect(
				attachPendingHandles(abort.signal, [Promise.reject(error1), Promise.reject(error2)])
			).rejects.toBe(error1)
		})

		test('stops handles immediately if the signal is already aborted', async () => {
			const abort = new AbortController()
			abort.abort()

			const handle = makeHandle()
			await attachPendingHandles(abort.signal, [Promise.resolve(handle)])
			expect(handle.stopCount).toBe(1)
		})
	})

	describe('handleFromSignalSetup', () => {
		test('stop aborts the setup signal', async () => {
			let receivedSignal: AbortSignal | undefined
			const handle = await handleFromSignalSetup(async (signal) => {
				receivedSignal = signal
			})

			expect(receivedSignal).toBeInstanceOf(AbortSignal)
			expect(receivedSignal?.aborted).toBe(false)

			handle.stop()
			expect(receivedSignal?.aborted).toBe(true)
		})

		test('aborts the signal and rethrows when setup fails', async () => {
			let receivedSignal: AbortSignal | undefined
			const error = new Error('setup failed')

			await expect(
				handleFromSignalSetup(async (signal) => {
					receivedSignal = signal
					throw error
				})
			).rejects.toBe(error)

			// Anything started under the signal before the throw must have been cleaned up
			expect(receivedSignal?.aborted).toBe(true)
		})
	})
})
