import { runTimersUntilNow } from '../../../__mocks__/helpers/jest.js'
import { getCurrentTime, systemTime, TimeJumpDetector } from '../systemTime.js'

test('getCurrentTime', () => {
	systemTime.diff = 5439
	expect(getCurrentTime() / 1000).toBeCloseTo((Date.now() - 5439) / 1000, 1)
})

test('TimeJumpDetector', async () => {
	jest.useFakeTimers()
	const mockCallback = jest.fn()
	let now = Date.now()
	let monotonicNow = 5000 // say it's running for 5 seconds
	const mockDateNow = jest.spyOn(global.Date, 'now').mockImplementation(() => now)
	const mockProcessHrtime = jest.spyOn(performance, 'now').mockImplementation(() => monotonicNow)

	const timeJumpDetector = new TimeJumpDetector(10000, mockCallback)
	timeJumpDetector.start()

	jest.advanceTimersByTime(11000)
	await runTimersUntilNow()
	expect(mockCallback).toHaveBeenCalledTimes(0)

	now += 11000
	monotonicNow += 11051

	jest.advanceTimersByTime(11000)
	await runTimersUntilNow()
	expect(mockCallback).toHaveBeenCalledTimes(1)
	mockCallback.mockClear()

	now += 11000
	monotonicNow += 10951

	jest.advanceTimersByTime(11000)
	await runTimersUntilNow()
	expect(mockCallback).toHaveBeenCalledTimes(0)

	mockDateNow.mockRestore()
	mockProcessHrtime.mockRestore()
})
