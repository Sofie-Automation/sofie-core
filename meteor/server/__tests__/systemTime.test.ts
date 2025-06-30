import { runTimersUntilNow } from '../../__mocks__/helpers/jest'
import { TimeJumpDetector } from '../systemTime'

describe('lib/systemTime', () => {
	test('TimeJumpDetector', async () => {
		jest.useFakeTimers()
		const mockCallback = jest.fn()
		let now = Date.now()
		let monotonicNow = BigInt(5000 * 1000000) // say it's running for 5 seconds
		const mockDateNow = jest.spyOn(global.Date, 'now').mockImplementation(() => now)
		const mockProcessHrtime = jest.spyOn(global.process.hrtime, 'bigint').mockImplementation(() => monotonicNow)

		const timeJumpDetector = new TimeJumpDetector(10000, mockCallback)
		timeJumpDetector.start()

		jest.advanceTimersByTime(11000)
		await runTimersUntilNow()
		expect(mockCallback).toHaveBeenCalledTimes(0)

		now += 11000
		monotonicNow += BigInt(11051 * 1000000)

		jest.advanceTimersByTime(11000)
		await runTimersUntilNow()
		expect(mockCallback).toHaveBeenCalledTimes(1)
		mockCallback.mockClear()

		now += 11000
		monotonicNow += BigInt(10951 * 1000000)

		jest.advanceTimersByTime(11000)
		await runTimersUntilNow()
		expect(mockCallback).toHaveBeenCalledTimes(0)

		mockDateNow.mockRestore()
		mockProcessHrtime.mockRestore()
	})
})
