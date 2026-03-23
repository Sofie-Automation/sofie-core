/* eslint-disable @typescript-eslint/unbound-method */
import { useFakeCurrentTime, useRealCurrentTime } from '../../../../__mocks__/time.js'
import { TTimersService, PlaylistTTimerImpl } from '../TTimersService.js'
import type { PlayoutModel } from '../../../../playout/model/PlayoutModel.js'
import type { RundownTTimer, RundownTTimerIndex } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { mock, MockProxy } from 'jest-mock-extended'
import type { ReadonlyDeep } from 'type-fest'
import type { JobContext } from '../../../../jobs/index.js'

function createMockJobContext(): MockProxy<JobContext> {
	return mock<JobContext>()
}

function createMockPlayoutModel(tTimers: [RundownTTimer, RundownTTimer, RundownTTimer]): MockProxy<PlayoutModel> {
	const mockPlayoutModel = mock<PlayoutModel>()
	const mockPlaylist = {
		tTimers,
	} as unknown as ReadonlyDeep<DBRundownPlaylist>

	Object.defineProperty(mockPlayoutModel, 'playlist', {
		get: () => mockPlaylist,
		configurable: true,
	})

	return mockPlayoutModel
}

function createEmptyTTimers(): [RundownTTimer, RundownTTimer, RundownTTimer] {
	return [
		{ index: 1, label: 'Timer 1', mode: null, state: null },
		{ index: 2, label: 'Timer 2', mode: null, state: null },
		{ index: 3, label: 'Timer 3', mode: null, state: null },
	]
}

describe('TTimersService', () => {
	beforeEach(() => {
		useFakeCurrentTime(1750000000000) // June 2025
	})

	afterEach(() => {
		useRealCurrentTime()
	})

	describe('constructor', () => {
		it('should create three timer instances', () => {
			const timers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(timers)
			const mockJobContext = createMockJobContext()

			const service = new TTimersService(timers, updateFn, mockPlayoutModel, mockJobContext)

			expect(service.timers).toHaveLength(3)
			expect(service.timers[0]).toBeInstanceOf(PlaylistTTimerImpl)
			expect(service.timers[1]).toBeInstanceOf(PlaylistTTimerImpl)
			expect(service.timers[2]).toBeInstanceOf(PlaylistTTimerImpl)
		})
	})

	it('from playout model', () => {
		const mockPlayoutModel = createMockPlayoutModel(createEmptyTTimers())
		const mockJobContext = createMockJobContext()

		const service = TTimersService.withPlayoutModel(mockPlayoutModel, mockJobContext)
		expect(service.timers).toHaveLength(3)

		const timer = service.getTimer(1)
		expect(timer.index).toBe(1)

		timer.setLabel('New Label')
		expect(mockPlayoutModel.updateTTimer).toHaveBeenCalledWith(
			expect.objectContaining({ index: 1, label: 'New Label' })
		)
	})

	describe('getTimer', () => {
		it('should return the correct timer for index 1', () => {
			const timers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(timers)
			const mockJobContext = createMockJobContext()

			const service = new TTimersService(timers, updateFn, mockPlayoutModel, mockJobContext)

			const timer = service.getTimer(1)

			expect(timer).toBe(service.timers[0])
		})

		it('should return the correct timer for index 2', () => {
			const timers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(timers)
			const mockJobContext = createMockJobContext()

			const service = new TTimersService(timers, updateFn, mockPlayoutModel, mockJobContext)

			const timer = service.getTimer(2)

			expect(timer).toBe(service.timers[1])
		})

		it('should return the correct timer for index 3', () => {
			const timers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(timers)
			const mockJobContext = createMockJobContext()

			const service = new TTimersService(timers, updateFn, mockPlayoutModel, mockJobContext)

			const timer = service.getTimer(3)

			expect(timer).toBe(service.timers[2])
		})

		it('should throw for invalid index', () => {
			const timers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(timers)
			const mockJobContext = createMockJobContext()

			const service = new TTimersService(timers, updateFn, mockPlayoutModel, mockJobContext)

			expect(() => service.getTimer(0 as RundownTTimerIndex)).toThrow('T-timer index out of range: 0')
			expect(() => service.getTimer(4 as RundownTTimerIndex)).toThrow('T-timer index out of range: 4')
		})
	})

	describe('clearAllTimers', () => {
		it('should call clearTimer on all timers', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].mode = { type: 'freeRun' }
			tTimers[0].state = { paused: false, zeroTime: 5000 }
			tTimers[1].mode = { type: 'countdown', duration: 60000, stopAtZero: true }
			tTimers[1].state = { paused: false, zeroTime: 65000 }

			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()

			const service = new TTimersService(tTimers, updateFn, mockPlayoutModel, mockJobContext)

			service.clearAllTimers()

			// updateTTimer should have been called 3 times (once for each timer)
			expect(updateFn).toHaveBeenCalledTimes(3)
			expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ index: 1, mode: null }))
			expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ index: 2, mode: null }))
			expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ index: 3, mode: null }))
		})
	})
})

describe('PlaylistTTimerImpl', () => {
	beforeEach(() => {
		useFakeCurrentTime(1750000000000) // June 2025
	})

	afterEach(() => {
		useRealCurrentTime()
	})

	describe('getters', () => {
		it('should return the correct index', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[1], updateFn, mockPlayoutModel, mockJobContext)

			expect(timer.index).toBe(2)
		})

		it('should return the correct label', () => {
			const tTimers = createEmptyTTimers()
			tTimers[1].label = 'Custom Label'
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[1], updateFn, mockPlayoutModel, mockJobContext)

			expect(timer.label).toBe('Custom Label')
		})
	})

	describe('setLabel', () => {
		it('should update the label', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.setLabel('New Label')

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'New Label',
				mode: null,
				state: null,
			})
		})
	})

	describe('clearTimer', () => {
		it('should clear the timer mode', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].mode = { type: 'freeRun' }
			tTimers[0].state = { paused: false, zeroTime: 5000 }
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.clearTimer()

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: null,
				state: null,
			})
		})
	})

	describe('startCountdown', () => {
		it('should start a running countdown with default options', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.startCountdown(60000)

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: true,
				},
				state: { paused: false, zeroTime: 1750000060000 },
			})
		})

		it('should start a paused countdown', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.startCountdown(30000, { startPaused: true, stopAtZero: false })

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: {
					type: 'countdown',
					duration: 30000,
					stopAtZero: false,
				},
				state: { paused: true, duration: 30000 },
			})
		})
	})

	describe('startFreeRun', () => {
		it('should start a running free-run timer', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.startFreeRun()

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: {
					type: 'freeRun',
				},
				state: { paused: false, zeroTime: 1750000000000 },
			})
		})

		it('should start a paused free-run timer', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.startFreeRun({ startPaused: true })

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: {
					type: 'freeRun',
				},
				state: { paused: true, duration: 0 },
			})
		})
	})

	describe('startTimeOfDay', () => {
		it('should start a timeOfDay timer with time string', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.startTimeOfDay('15:30')

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: {
					type: 'timeOfDay',
					targetRaw: '15:30',
					stopAtZero: true,
				},
				state: {
					paused: false,
					zeroTime: expect.any(Number), // new target time
				},
			})
		})

		it('should start a timeOfDay timer with numeric timestamp', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)
			const targetTimestamp = 1737331200000

			timer.startTimeOfDay(targetTimestamp)

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: {
					type: 'timeOfDay',
					targetRaw: targetTimestamp,
					stopAtZero: true,
				},
				state: {
					paused: false,
					zeroTime: targetTimestamp,
				},
			})
		})

		it('should start a timeOfDay timer with stopAtZero false', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.startTimeOfDay('18:00', { stopAtZero: false })

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: expect.objectContaining({
					type: 'timeOfDay',
					targetRaw: '18:00',
					stopAtZero: false,
				}),
				state: expect.objectContaining({
					paused: false,
					zeroTime: expect.any(Number),
				}),
			})
		})

		it('should start a timeOfDay timer with 12-hour format', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.startTimeOfDay('5:30pm')

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: expect.objectContaining({
					type: 'timeOfDay',
					targetRaw: '5:30pm',
					stopAtZero: true,
				}),
				state: expect.objectContaining({
					paused: false,
					zeroTime: expect.any(Number),
				}),
			})
		})

		it('should throw for invalid time string', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			expect(() => timer.startTimeOfDay('invalid')).toThrow('Unable to parse target time for timeOfDay T-timer')
		})

		it('should throw for empty time string', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			expect(() => timer.startTimeOfDay('')).toThrow('Unable to parse target time for timeOfDay T-timer')
		})
	})

	describe('pause', () => {
		it('should pause a running freeRun timer', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].mode = { type: 'freeRun' }
			tTimers[0].state = { paused: false, zeroTime: 1749999995000 }
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			const result = timer.pause()

			expect(result).toBe(true)
			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: {
					type: 'freeRun',
				},
				state: { paused: true, duration: -5000 },
			})
		})

		it('should pause a running countdown timer', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].mode = { type: 'countdown', duration: 60000, stopAtZero: true }
			tTimers[0].state = { paused: false, zeroTime: 1750000060000 }
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			const result = timer.pause()

			expect(result).toBe(true)
			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: true,
				},
				state: { paused: true, duration: 60000 },
			})
		})

		it('should return false for timer with no mode', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			const result = timer.pause()

			expect(result).toBe(false)
			expect(updateFn).not.toHaveBeenCalled()
		})

		it('should return false for timeOfDay timer (does not support pause)', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].mode = {
				type: 'timeOfDay',
				targetRaw: '15:30',
				stopAtZero: true,
			}
			tTimers[0].state = { paused: false, zeroTime: 20000 }
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			const result = timer.pause()

			expect(result).toBe(false)
			expect(updateFn).not.toHaveBeenCalled()
		})
	})

	describe('resume', () => {
		it('should resume a paused freeRun timer', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].mode = { type: 'freeRun' }
			tTimers[0].state = { paused: true, duration: -3000 }
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			const result = timer.resume()

			expect(result).toBe(true)
			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: {
					type: 'freeRun',
				},
				state: { paused: false, zeroTime: 1749999997000 }, // adjusted for pause duration
			})
		})

		it('should return true but not change a running timer', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].mode = { type: 'freeRun' }
			tTimers[0].state = { paused: false, zeroTime: 5000 }
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			const result = timer.resume()

			// Returns true because timer supports resume, but it's already running
			expect(result).toBe(true)
			expect(updateFn).toHaveBeenCalled()
		})

		it('should return false for timer with no mode', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			const result = timer.resume()

			expect(result).toBe(false)
			expect(updateFn).not.toHaveBeenCalled()
		})

		it('should return false for timeOfDay timer (does not support resume)', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].mode = {
				type: 'timeOfDay',
				targetRaw: '15:30',
				stopAtZero: true,
			}
			tTimers[0].state = { paused: false, zeroTime: 20000 }
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			const result = timer.resume()

			expect(result).toBe(false)
			expect(updateFn).not.toHaveBeenCalled()
		})
	})

	describe('restart', () => {
		it('should restart a countdown timer', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].mode = { type: 'countdown', duration: 60000, stopAtZero: true }
			tTimers[0].state = { paused: false, zeroTime: 40000 }
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			const result = timer.restart()

			expect(result).toBe(true)
			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: true,
				},
				state: { paused: false, zeroTime: 1750000060000 }, // reset to now + duration
			})
		})

		it('should restart a paused countdown timer (stays paused)', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].mode = {
				type: 'countdown',
				duration: 60000,
				stopAtZero: false,
			}
			tTimers[0].state = { paused: true, duration: 15000 }
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			const result = timer.restart()

			expect(result).toBe(true)
			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: false,
				},
				state: { paused: true, duration: 60000 }, // reset to full duration, paused
			})
		})

		it('should return false for freeRun timer', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].mode = { type: 'freeRun' }
			tTimers[0].state = { paused: false, zeroTime: 5000 }
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			const result = timer.restart()

			expect(result).toBe(false)
			expect(updateFn).not.toHaveBeenCalled()
		})

		it('should restart a timeOfDay timer with valid targetRaw', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].mode = {
				type: 'timeOfDay',
				targetRaw: '15:30',
				stopAtZero: true,
			}
			tTimers[0].state = { paused: false, zeroTime: 5000 } // old target time
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			const result = timer.restart()

			expect(result).toBe(true)
			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: {
					type: 'timeOfDay',
					targetRaw: '15:30',
					stopAtZero: true,
				},
				state: {
					paused: false,
					zeroTime: expect.any(Number), // new target time
				},
			})
		})

		it('should return false for timeOfDay timer with invalid targetRaw', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].mode = {
				type: 'timeOfDay',
				targetRaw: 'invalid-time-string',
				stopAtZero: true,
			}
			tTimers[0].state = { paused: false, zeroTime: 5000 }
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			const result = timer.restart()

			expect(result).toBe(false)
			expect(updateFn).not.toHaveBeenCalled()
		})

		it('should return false for timer with no mode', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			const result = timer.restart()

			expect(result).toBe(false)
			expect(updateFn).not.toHaveBeenCalled()
		})
	})

	describe('clearProjected', () => {
		it('should clear both anchorPartId and projectedState', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].anchorPartId = 'part1' as any
			tTimers[0].projectedState = { paused: false, zeroTime: 50000 }
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.clearProjected()

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: null,
				state: null,
				anchorPartId: undefined,
				projectedState: undefined,
			})
		})

		it('should work when projections are already cleared', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.clearProjected()

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: null,
				state: null,
				anchorPartId: undefined,
				projectedState: undefined,
			})
		})
	})

	describe('setProjectedAnchorPart', () => {
		it('should set anchorPartId and clear projectedState', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].projectedState = { paused: false, zeroTime: 50000 }
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.setProjectedAnchorPart('part123')

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: null,
				state: null,
				anchorPartId: 'part123',
				projectedState: undefined,
			})
		})

		it('should not queue job or throw error', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			// Should not throw
			expect(() => timer.setProjectedAnchorPart('part456')).not.toThrow()

			// Job queue should not be called (recalculate is called directly)
			expect(mockJobContext.queueStudioJob).not.toHaveBeenCalled()
		})
	})

	describe('setProjectedTime', () => {
		it('should set projectedState with absolute time (not paused)', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.setProjectedTime(50000, false)

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: null,
				state: null,
				anchorPartId: undefined,
				projectedState: { paused: false, zeroTime: 50000 },
			})
		})

		it('should set projectedState with absolute time (paused)', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.setProjectedTime(1750000050000, true)

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: null,
				state: null,
				anchorPartId: undefined,
				projectedState: { paused: true, duration: 50000 }, // 1750000050000 - 1750000000000 (current time)
			})
		})

		it('should clear anchorPartId when setting manual projection', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].anchorPartId = 'part1' as any
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.setProjectedTime(50000)

			expect(updateFn).toHaveBeenCalledWith(
				expect.objectContaining({
					anchorPartId: undefined,
				})
			)
		})

		it('should default paused to false when not provided', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.setProjectedTime(1750000050000)

			expect(updateFn).toHaveBeenCalledWith(
				expect.objectContaining({
					projectedState: { paused: false, zeroTime: 1750000050000 },
				})
			)
		})
	})

	describe('setProjectedDuration', () => {
		it('should set projectedState with relative duration (not paused)', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.setProjectedDuration(30000, false)

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: null,
				state: null,
				anchorPartId: undefined,
				projectedState: { paused: false, zeroTime: 1750000030000 }, // 1750000000000 (current) + 30000 (duration)
			})
		})

		it('should set projectedState with relative duration (paused)', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.setProjectedDuration(30000, true)

			expect(updateFn).toHaveBeenCalledWith({
				index: 1,
				label: 'Timer 1',
				mode: null,
				state: null,
				anchorPartId: undefined,
				projectedState: { paused: true, duration: 30000 },
			})
		})

		it('should clear anchorPartId when setting manual projection', () => {
			const tTimers = createEmptyTTimers()
			tTimers[0].anchorPartId = 'part1' as any
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.setProjectedDuration(30000)

			expect(updateFn).toHaveBeenCalledWith(
				expect.objectContaining({
					anchorPartId: undefined,
				})
			)
		})

		it('should default paused to false when not provided', () => {
			const tTimers = createEmptyTTimers()
			const updateFn = jest.fn()
			const mockPlayoutModel = createMockPlayoutModel(tTimers)
			const mockJobContext = createMockJobContext()
			const timer = new PlaylistTTimerImpl(tTimers[0], updateFn, mockPlayoutModel, mockJobContext)

			timer.setProjectedDuration(30000)

			expect(updateFn).toHaveBeenCalledWith(
				expect.objectContaining({
					projectedState: { paused: false, zeroTime: 1750000030000 },
				})
			)
		})
	})
})
