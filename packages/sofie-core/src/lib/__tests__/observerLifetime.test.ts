import { createChildAbort, runOnAbort } from '../observerLifetime'
import { getEventListeners } from 'node:events'
import { testWithAbort } from '../../__mocks__/helpers/testWithAbort'

describe('observerLifetime', () => {
	describe('createChildAbort', () => {
		testWithAbort('child aborts when parent aborts', ({ signal }) => {
			const parent = createChildAbort(signal)
			const child = createChildAbort(parent.signal)

			expect(child.signal.aborted).toBe(false)
			parent.abort()
			expect(child.signal.aborted).toBe(true)
		})

		testWithAbort('child is aborted immediately if parent already aborted', ({ signal }) => {
			const parent = createChildAbort(signal)
			const reason = new Error('parent gone')
			parent.abort(reason)

			const child = createChildAbort(parent.signal)
			expect(child.signal.aborted).toBe(true)
			expect(child.signal.reason).toBe(reason)
		})

		testWithAbort('child abort reason is propagated from parent', ({ signal }) => {
			const parent = createChildAbort(signal)
			const child = createChildAbort(parent.signal)

			const reason = new Error('parent gone')
			parent.abort(reason)
			expect(child.signal.reason).toBe(reason)
		})

		testWithAbort('aborting the child does not abort the parent', ({ signal }) => {
			const parent = createChildAbort(signal)
			const child = createChildAbort(parent.signal)

			child.abort()
			expect(child.signal.aborted).toBe(true)
			expect(parent.signal.aborted).toBe(false)
		})

		testWithAbort('many sequential children do not accumulate listeners on the parent', ({ signal }) => {
			const parent = createChildAbort(signal)

			const before = getEventListeners(parent.signal, 'abort').length
			for (let i = 0; i < 1000; i++) {
				createChildAbort(parent.signal).abort()
			}

			// Composition via AbortSignal.any does not register user-visible listeners on the parent,
			// and dropped children are not pinned to it
			expect(getEventListeners(parent.signal, 'abort').length).toBe(before)
		})

		testWithAbort('aborting the parent still ends children created earlier', ({ signal }) => {
			const parent = createChildAbort(signal)
			const children = Array.from({ length: 100 }, () => createChildAbort(parent.signal))

			parent.abort()

			for (const child of children) {
				expect(child.signal.aborted).toBe(true)
			}
		})
	})

	describe('runOnAbort', () => {
		testWithAbort('runs the cleanup when the signal aborts', ({ signal }) => {
			const abort = createChildAbort(signal)
			const cleanup = jest.fn()

			runOnAbort(abort.signal, cleanup)
			expect(cleanup).toHaveBeenCalledTimes(0)

			abort.abort()
			expect(cleanup).toHaveBeenCalledTimes(1)
		})

		testWithAbort('runs the cleanup immediately if the signal is already aborted', ({ signal }) => {
			const abort = createChildAbort(signal)
			abort.abort()

			const cleanup = jest.fn()
			runOnAbort(abort.signal, cleanup)
			expect(cleanup).toHaveBeenCalledTimes(1)
		})

		testWithAbort('a throwing cleanup does not prevent the others from running', ({ signal }) => {
			const abort = createChildAbort(signal)
			const good = jest.fn()

			runOnAbort(abort.signal, () => {
				throw new Error('cleanup failed')
			})
			runOnAbort(abort.signal, good)

			expect(() => abort.abort()).not.toThrow()
			expect(good).toHaveBeenCalledTimes(1)
		})

		testWithAbort('an async rejecting cleanup is tolerated', async ({ signal }) => {
			const abort = createChildAbort(signal)
			let cleanupCalled = false

			runOnAbort(abort.signal, async () => {
				cleanupCalled = true
				throw new Error('async cleanup failed')
			})
			abort.abort()
			expect(cleanupCalled).toBe(true)

			// Flush the rejection handling
			await new Promise((resolve) => setImmediate(resolve))
		})
	})
})
