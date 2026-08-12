import { createChildAbort, processLifetimeSignal, runOnAbort } from '../observerLifetime'
import { getEventListeners } from 'node:events'

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

	describe('runOnAbort', () => {
		test('runs the cleanup when the signal aborts', () => {
			const abort = new AbortController()
			const cleanup = jest.fn()

			runOnAbort(abort.signal, cleanup)
			expect(cleanup).toHaveBeenCalledTimes(0)

			abort.abort()
			expect(cleanup).toHaveBeenCalledTimes(1)
		})

		test('runs the cleanup immediately if the signal is already aborted', () => {
			const abort = new AbortController()
			abort.abort()

			const cleanup = jest.fn()
			runOnAbort(abort.signal, cleanup)
			expect(cleanup).toHaveBeenCalledTimes(1)
		})

		test('a throwing cleanup does not prevent the others from running', () => {
			const abort = new AbortController()
			const good = jest.fn()

			runOnAbort(abort.signal, () => {
				throw new Error('cleanup failed')
			})
			runOnAbort(abort.signal, good)

			expect(() => abort.abort()).not.toThrow()
			expect(good).toHaveBeenCalledTimes(1)
		})

		test('an async rejecting cleanup is tolerated', async () => {
			const abort = new AbortController()
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
