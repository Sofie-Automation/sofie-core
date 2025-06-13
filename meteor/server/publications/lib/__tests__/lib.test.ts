import { Meteor } from 'meteor/meteor'
import { waitForAllObserversReady } from '../lib'
import { sleep } from '@sofie-automation/shared-lib/dist/lib/lib'

describe('waitForAllObserversReady', () => {
	// beforeEach(() => {
	// 	jest.useFakeTimers()
	// })

	it('no observers', async () => {
		await expect(waitForAllObserversReady([])).resolves.toHaveLength(0)
	})

	async function createFakeObserver(waitTime: number, stopFn: () => void): Promise<Meteor.LiveQueryHandle> {
		await sleep(waitTime)

		return {
			stop: stopFn,
		}
	}

	async function createBadObserver(waitTime: number): Promise<Meteor.LiveQueryHandle> {
		await sleep(waitTime)

		throw new Error('Some error')
	}

	function stopAll(observers: Meteor.LiveQueryHandle[]) {
		observers.forEach((o) => o.stop())
	}

	it('multiple good observers', async () => {
		const stopFn = jest.fn()

		const res = waitForAllObserversReady([
			createFakeObserver(10, stopFn),
			createFakeObserver(12, stopFn),
			createFakeObserver(10, stopFn),
			createFakeObserver(8, stopFn),
		])
		await expect(res).resolves.toHaveLength(4)

		expect(stopFn).toHaveBeenCalledTimes(0)

		stopAll(await res)
		expect(stopFn).toHaveBeenCalledTimes(4)
	})

	it('multiple good with a bad observer', async () => {
		const stopFn = jest.fn()

		const res = waitForAllObserversReady([
			createFakeObserver(10, stopFn),
			createFakeObserver(12, stopFn),
			createBadObserver(10),
			createFakeObserver(8, stopFn),
		])
		await expect(res).rejects.toThrow('Some error')

		// Successful ones should be stopped
		expect(stopFn).toHaveBeenCalledTimes(3)
	})
})
