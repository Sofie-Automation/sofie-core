import { sleep } from '@sofie-automation/shared-lib/dist/lib/lib'
import { PromiseDebounce } from '../PromiseDebounce'

describe('PromiseDebounce', () => {
	beforeEach(() => {
		jest.useFakeTimers()
	})

	it('trigger', async () => {
		const fn = jest.fn()
		const debounce = new PromiseDebounce(fn, 10)

		// No promise returned
		expect(debounce.trigger()).toBe(undefined)
		// Not called yet
		expect(fn).toHaveBeenCalledTimes(0)

		// Wait for a bit
		await jest.advanceTimersByTimeAsync(6)
		expect(fn).toHaveBeenCalledTimes(0)

		// Wait a bit more
		await jest.advanceTimersByTimeAsync(6)
		expect(fn).toHaveBeenCalledTimes(1)

		// No more calls
		fn.mockClear()
		await jest.advanceTimersByTimeAsync(50)
		expect(fn).toHaveBeenCalledTimes(0)
	})

	it('call', async () => {
		const fn = jest.fn()
		const debounce = new PromiseDebounce(fn, 10)

		const ps = debounce.call()
		expect(ps).not.toBe(undefined)
		// Not called yet
		expect(fn).toHaveBeenCalledTimes(0)

		// Wait for a bit
		await jest.advanceTimersByTimeAsync(6)
		expect(fn).toHaveBeenCalledTimes(0)

		// Wait a bit more
		await jest.advanceTimersByTimeAsync(6)
		expect(fn).toHaveBeenCalledTimes(1)

		// Should resolve without any more timer ticking
		await expect(ps).resolves.toBe(undefined)

		// No more calls
		fn.mockClear()
		await jest.advanceTimersByTimeAsync(50)
		expect(fn).toHaveBeenCalledTimes(0)
	})

	it('cancelWaiting - trigger', async () => {
		const fn = jest.fn()
		const debounce = new PromiseDebounce(fn, 10)

		// No promise returned
		expect(debounce.trigger()).toBe(undefined)
		// Not called yet
		expect(fn).toHaveBeenCalledTimes(0)

		// Wait for a bit
		await jest.advanceTimersByTimeAsync(6)
		expect(fn).toHaveBeenCalledTimes(0)

		// Cancel waiting
		debounce.cancelWaiting()

		// Wait until the timer should have fired
		await jest.advanceTimersByTimeAsync(50)
		expect(fn).toHaveBeenCalledTimes(0)
	})

	it('cancelWaiting - call', async () => {
		const fn = jest.fn()
		const debounce = new PromiseDebounce(fn, 10)

		const ps = debounce.call()
		ps.catch(() => null) // Add an error handler
		expect(ps).not.toBe(undefined)
		// Not called yet
		expect(fn).toHaveBeenCalledTimes(0)

		// Wait for a bit
		await jest.advanceTimersByTimeAsync(6)
		expect(fn).toHaveBeenCalledTimes(0)

		// Cancel waiting
		debounce.cancelWaiting()

		// Wait until the timer should have fired
		await jest.advanceTimersByTimeAsync(50)
		expect(fn).toHaveBeenCalledTimes(0)

		// Should have rejected
		await expect(ps).rejects.toThrow('Cancelled')
	})

	it('cancelWaiting - call with error', async () => {
		const fn = jest.fn()
		const debounce = new PromiseDebounce(fn, 10)

		const ps = debounce.call()
		ps.catch(() => null) // Add an error handler
		expect(ps).not.toBe(undefined)
		// Not called yet
		expect(fn).toHaveBeenCalledTimes(0)

		// Wait for a bit
		await jest.advanceTimersByTimeAsync(6)
		expect(fn).toHaveBeenCalledTimes(0)

		// Cancel waiting
		debounce.cancelWaiting(new Error('Custom error'))

		// Wait until the timer should have fired
		await jest.advanceTimersByTimeAsync(50)
		expect(fn).toHaveBeenCalledTimes(0)

		// Should have rejected
		await expect(ps).rejects.toThrow('Custom error')
	})

	it('trigger - multiple', async () => {
		const fn = jest.fn()
		const debounce = new PromiseDebounce<void, [number]>(fn, 10)

		// No promise returned
		expect(debounce.trigger(1)).toBe(undefined)
		// Not called yet
		expect(fn).toHaveBeenCalledTimes(0)

		// Wait for a bit
		await jest.advanceTimersByTimeAsync(6)
		expect(fn).toHaveBeenCalledTimes(0)

		// Trigger again
		expect(debounce.trigger(3)).toBe(undefined)
		expect(debounce.trigger(5)).toBe(undefined)

		// Wait until the timer should have fired
		await jest.advanceTimersByTimeAsync(50)
		expect(fn).toHaveBeenCalledTimes(1)
		expect(fn).toHaveBeenCalledWith(5)
	})

	it('trigger - during slow execution', async () => {
		const fn = jest.fn(async () => sleep(100))
		const debounce = new PromiseDebounce<void, [number]>(fn, 10)

		// No promise returned
		expect(debounce.trigger(1)).toBe(undefined)
		// Not called yet
		expect(fn).toHaveBeenCalledTimes(0)

		// Wait for it to start executing
		await jest.advanceTimersByTimeAsync(50)
		expect(fn).toHaveBeenCalledTimes(1)
		expect(fn).toHaveBeenCalledWith(1)

		// Trigger again
		fn.mockClear()
		expect(debounce.trigger(3)).toBe(undefined)
		await jest.advanceTimersByTimeAsync(20)
		expect(debounce.trigger(5)).toBe(undefined)

		// Wait until the second timer timer should
		await jest.advanceTimersByTimeAsync(100)
		expect(fn).toHaveBeenCalledTimes(1)
		expect(fn).toHaveBeenCalledWith(5)
	})

	it('call - return value', async () => {
		const fn = jest.fn(async (val) => {
			await sleep(100)
			return val
		})
		const debounce = new PromiseDebounce<number, [number]>(fn, 10)

		const ps1 = debounce.call(1)
		expect(ps1).not.toBe(undefined)
		// Not called yet
		expect(fn).toHaveBeenCalledTimes(0)

		// Wait for it to start executing
		await jest.advanceTimersByTimeAsync(50)
		expect(fn).toHaveBeenCalledTimes(1)
		expect(fn).toHaveBeenCalledWith(1)

		// Trigger again
		fn.mockClear()
		const ps3 = debounce.call(3)
		await jest.advanceTimersByTimeAsync(20)
		const ps5 = debounce.call(5)

		// Wait until the second timer timer should
		await jest.advanceTimersByTimeAsync(150)
		expect(fn).toHaveBeenCalledTimes(1)
		expect(fn).toHaveBeenCalledWith(5)

		await expect(ps1).resolves.toBe(1)
		await expect(ps3).resolves.toBe(5)
		await expect(ps5).resolves.toBe(5)
	})

	it('call - throw error', async () => {
		const fn = jest.fn(async (val) => {
			await sleep(100)
			throw new Error(`Bad value: ${val}`)
		})
		const debounce = new PromiseDebounce<number, [number]>(fn, 10)

		const ps1 = debounce.call(1)
		ps1.catch(() => null) // Add an error handler
		expect(ps1).not.toBe(undefined)
		// Not called yet
		expect(fn).toHaveBeenCalledTimes(0)

		// Wait for it to start executing
		await jest.advanceTimersByTimeAsync(50)
		expect(fn).toHaveBeenCalledTimes(1)
		expect(fn).toHaveBeenCalledWith(1)

		// Trigger again
		fn.mockClear()
		const ps3 = debounce.call(3)
		ps3.catch(() => null) // Add an error handler
		await jest.advanceTimersByTimeAsync(20)
		const ps5 = debounce.call(5)
		ps5.catch(() => null) // Add an error handler

		// Wait until the second timer timer should
		await jest.advanceTimersByTimeAsync(150)
		expect(fn).toHaveBeenCalledTimes(1)
		expect(fn).toHaveBeenCalledWith(5)

		await expect(ps1).rejects.toThrow('Bad value: 1')
		await expect(ps3).rejects.toThrow('Bad value: 5')
		await expect(ps5).rejects.toThrow('Bad value: 5')
	})

	it('canelWaiting - during slow execution', async () => {
		const fn = jest.fn(async () => sleep(100))
		const debounce = new PromiseDebounce<void, [number]>(fn, 10)

		// No promise returned
		expect(debounce.trigger(1)).toBe(undefined)
		// Not called yet
		expect(fn).toHaveBeenCalledTimes(0)

		// Wait for it to start executing
		await jest.advanceTimersByTimeAsync(50)
		expect(fn).toHaveBeenCalledTimes(1)
		expect(fn).toHaveBeenCalledWith(1)

		// Trigger again
		fn.mockClear()
		expect(debounce.trigger(3)).toBe(undefined)
		await jest.advanceTimersByTimeAsync(20)
		expect(debounce.trigger(5)).toBe(undefined)

		debounce.cancelWaiting()

		// Wait until the second timer timer should
		await jest.advanceTimersByTimeAsync(100)
		expect(fn).toHaveBeenCalledTimes(0)
	})
})
