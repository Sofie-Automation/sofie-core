import '../../../../__mocks__/_extendJest'

import { ReactiveMongoObserverGroup } from '..//observerGroup'
import { LiveQueryHandle, sleep } from '../../../lib/lib'

describe('ReactiveMongoObserverGroup', () => {
	beforeEach(() => {
		jest.useRealTimers()
	})

	test('cleanup on stop', async () => {
		const handle: LiveQueryHandle = { stop: jest.fn() }
		const generator = jest.fn(async () => [Promise.resolve(handle)])

		const observerGroup = await ReactiveMongoObserverGroup(generator)

		// Ensure we got a sane response
		expect(observerGroup).toBeTruthy()
		expect(observerGroup.stop).toBeTruthy()
		expect(observerGroup.restart).toBeTruthy()

		// Generator should be called immediately
		expect(generator).toHaveBeenCalledTimes(1)
		expect(handle.stop).toHaveBeenCalledTimes(0)

		// Stop and it should be gone
		await observerGroup.stop()
		expect(generator).toHaveBeenCalledTimes(1)
		expect(handle.stop).toHaveBeenCalledTimes(1)

		// Call stop again and it should complain but do nothing
		await expect(async () => observerGroup.stop()).rejects.toThrowMeteor(
			500,
			'ReactiveMongoObserverGroup is not running!'
		)
		expect(generator).toHaveBeenCalledTimes(1)
		expect(handle.stop).toHaveBeenCalledTimes(1)
	})

	test('restarting', async () => {
		const handle: LiveQueryHandle = { stop: jest.fn() }
		const generator = jest.fn(async () => [Promise.resolve(handle)])

		const observerGroup = await ReactiveMongoObserverGroup(generator)

		// Ensure we got a sane response
		expect(observerGroup).toBeTruthy()
		expect(observerGroup.stop).toBeTruthy()
		expect(observerGroup.restart).toBeTruthy()

		// Generator should be called immediately
		expect(generator).toHaveBeenCalledTimes(1)
		expect(handle.stop).toHaveBeenCalledTimes(0)

		// Restart it happily
		observerGroup.restart()
		await sleep(21) // wait for the debounce
		expect(generator).toHaveBeenCalledTimes(2)
		expect(handle.stop).toHaveBeenCalledTimes(1)

		// Restart it again
		observerGroup.restart()
		await sleep(21) // wait for the debounce
		expect(generator).toHaveBeenCalledTimes(3)
		expect(handle.stop).toHaveBeenCalledTimes(2)

		// Stop and it should be gone
		await observerGroup.stop()
		expect(generator).toHaveBeenCalledTimes(3)
		expect(handle.stop).toHaveBeenCalledTimes(3)

		// Restart it again
		await expect(async () => observerGroup.restart()).rejects.toThrowMeteor(
			500,
			'ReactiveMongoObserverGroup is not running!'
		)
		expect(generator).toHaveBeenCalledTimes(3)
		expect(handle.stop).toHaveBeenCalledTimes(3)
	})

	test('restart debounce', async () => {
		const handle: LiveQueryHandle = { stop: jest.fn() }
		const generator = jest.fn(async () => [Promise.resolve(handle)])

		const observerGroup = await ReactiveMongoObserverGroup(generator)

		// Ensure we got a sane response
		expect(observerGroup).toBeTruthy()
		expect(observerGroup.stop).toBeTruthy()
		expect(observerGroup.restart).toBeTruthy()

		// Generator should be called immediately
		expect(generator).toHaveBeenCalledTimes(1)
		expect(handle.stop).toHaveBeenCalledTimes(0)

		// Restart it happily
		observerGroup.restart()
		observerGroup.restart()
		observerGroup.restart()
		observerGroup.restart()
		await sleep(10)
		observerGroup.restart()
		observerGroup.restart()
		observerGroup.restart()
		await sleep(5)

		// Should not have happened yet
		expect(generator).toHaveBeenCalledTimes(1)
		expect(handle.stop).toHaveBeenCalledTimes(0)

		// Wait for debounce to fire
		await sleep(16)
		expect(generator).toHaveBeenCalledTimes(2)
		expect(handle.stop).toHaveBeenCalledTimes(1)

		// Ensure debounce doesnt fire again
		await sleep(50)
		expect(generator).toHaveBeenCalledTimes(2)
		expect(handle.stop).toHaveBeenCalledTimes(1)

		// Stop and it should be gone
		await observerGroup.stop()
		expect(generator).toHaveBeenCalledTimes(2)
		expect(handle.stop).toHaveBeenCalledTimes(2)
	})
})
