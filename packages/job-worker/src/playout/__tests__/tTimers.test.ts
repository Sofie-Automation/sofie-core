/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { RundownTTimer } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/TTimers'
import { useFakeCurrentTime, useRealCurrentTime } from '../../__mocks__/time.js'
import {
	validateTTimerIndex,
	pauseTTimer,
	resumeTTimer,
	restartTTimer,
	createCountdownTTimer,
	createFreeRunTTimer,
	calculateNextTimeOfDayTarget,
	createTimeOfDayTTimer,
} from '../tTimers.js'

describe('tTimers utils', () => {
	beforeEach(() => {
		useFakeCurrentTime(10000) // Set a fixed time for tests
	})

	afterEach(() => {
		useRealCurrentTime()
	})

	describe('validateTTimerIndex', () => {
		it('should accept valid indices 1, 2, 3', () => {
			expect(() => validateTTimerIndex(1)).not.toThrow()
			expect(() => validateTTimerIndex(2)).not.toThrow()
			expect(() => validateTTimerIndex(3)).not.toThrow()
		})

		it('should reject index 0', () => {
			expect(() => validateTTimerIndex(0)).toThrow('T-timer index out of range: 0')
		})

		it('should reject index 4', () => {
			expect(() => validateTTimerIndex(4)).toThrow('T-timer index out of range: 4')
		})

		it('should reject negative indices', () => {
			expect(() => validateTTimerIndex(-1)).toThrow('T-timer index out of range: -1')
		})

		it('should reject NaN', () => {
			expect(() => validateTTimerIndex(NaN)).toThrow('T-timer index out of range: NaN')
		})

		it('should reject fractional indices', () => {
			expect(() => validateTTimerIndex(1.5)).toThrow('T-timer index out of range: 1.5')
			expect(() => validateTTimerIndex(2.1)).toThrow('T-timer index out of range: 2.1')
		})
	})

	describe('pauseTTimer', () => {
		it('should pause a running countdown timer', () => {
			const timer: RundownTTimer = {
				index: 1,
				label: 'Test',
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: true,
				},
				state: { paused: false, zeroTime: 70000 }, // 60 seconds from now
			}

			const result = pauseTTimer(timer)

			expect(result).toEqual({
				index: 1,
				label: 'Test',
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: true,
				},
				state: { paused: true, duration: 60000 }, // Captured remaining time
			})
		})

		it('should pause a running freeRun timer', () => {
			const timer: RundownTTimer = {
				index: 2,
				label: 'Test',
				mode: {
					type: 'freeRun',
				},
				state: { paused: false, zeroTime: 5000 }, // Started 5 seconds ago
			}

			const result = pauseTTimer(timer)

			expect(result).toEqual({
				index: 2,
				label: 'Test',
				mode: {
					type: 'freeRun',
				},
				state: { paused: true, duration: -5000 }, // Elapsed time (negative for counting up)
			})
		})

		it('should return unchanged countdown timer if already paused', () => {
			const timer: RundownTTimer = {
				index: 1,
				label: 'Test',
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: true,
				},
				state: { paused: true, duration: 30000 }, // already paused
			}

			const result = pauseTTimer(timer)

			expect(result).toBe(timer) // same reference, unchanged
		})

		it('should return unchanged freeRun timer if already paused', () => {
			const timer: RundownTTimer = {
				index: 2,
				label: 'Test',
				mode: {
					type: 'freeRun',
				},
				state: { paused: true, duration: 5000 }, // already paused
			}

			const result = pauseTTimer(timer)

			expect(result).toBe(timer) // same reference, unchanged
		})

		it('should return null for timer with no mode', () => {
			const timer: RundownTTimer = {
				index: 1,
				label: 'Test',
				mode: null,
				state: null,
			}

			expect(pauseTTimer(timer)).toBeNull()
		})
	})

	describe('resumeTTimer', () => {
		it('should resume a paused countdown timer', () => {
			const timer: RundownTTimer = {
				index: 1,
				label: 'Test',
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: true,
				},
				state: { paused: true, duration: 30000 }, // 30 seconds remaining
			}

			const result = resumeTTimer(timer)

			expect(result).toEqual({
				index: 1,
				label: 'Test',
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: true,
				},
				state: { paused: false, zeroTime: 40000 }, // now (10000) + duration (30000)
			})
		})

		it('should resume a paused freeRun timer', () => {
			const timer: RundownTTimer = {
				index: 2,
				label: 'Test',
				mode: {
					type: 'freeRun',
				},
				state: { paused: true, duration: -5000 }, // 5 seconds elapsed
			}

			const result = resumeTTimer(timer)

			expect(result).toEqual({
				index: 2,
				label: 'Test',
				mode: {
					type: 'freeRun',
				},
				state: { paused: false, zeroTime: 5000 }, // now (10000) + duration (-5000)
			})
		})

		it('should return countdown timer unchanged if already running', () => {
			const timer: RundownTTimer = {
				index: 1,
				label: 'Test',
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: true,
				},
				state: { paused: false, zeroTime: 70000 }, // already running
			}

			const result = resumeTTimer(timer)

			expect(result).toBe(timer) // same reference
		})

		it('should return freeRun timer unchanged if already running', () => {
			const timer: RundownTTimer = {
				index: 2,
				label: 'Test',
				mode: {
					type: 'freeRun',
				},
				state: { paused: false, zeroTime: 5000 }, // already running
			}

			const result = resumeTTimer(timer)

			expect(result).toBe(timer) // same reference
		})

		it('should return null for timer with no mode', () => {
			const timer: RundownTTimer = {
				index: 1,
				label: 'Test',
				mode: null,
				state: null,
			}

			expect(resumeTTimer(timer)).toBeNull()
		})
	})

	describe('restartTTimer', () => {
		it('should restart a running countdown timer', () => {
			const timer: RundownTTimer = {
				index: 1,
				label: 'Test',
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: true,
				},
				state: { paused: false, zeroTime: 40000 }, // Partway through
			}

			const result = restartTTimer(timer)

			expect(result).toEqual({
				index: 1,
				label: 'Test',
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: true,
				},
				state: { paused: false, zeroTime: 70000 }, // now (10000) + duration (60000)
			})
		})

		it('should restart a paused countdown timer (stays paused)', () => {
			const timer: RundownTTimer = {
				index: 1,
				label: 'Test',
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: false,
				},
				state: { paused: true, duration: 15000 }, // Paused with time remaining
			}

			const result = restartTTimer(timer)

			expect(result).toEqual({
				index: 1,
				label: 'Test',
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: false,
				},
				state: { paused: true, duration: 60000 }, // Reset to full duration, still paused
			})
		})

		it('should restart a running freeRun timer', () => {
			const timer: RundownTTimer = {
				index: 2,
				label: 'Test',
				mode: {
					type: 'freeRun',
				},
				state: { paused: false, zeroTime: 5000 },
			}

			expect(restartTTimer(timer)).toEqual({
				index: 2,
				label: 'Test',
				mode: {
					type: 'freeRun',
				},
				state: { paused: false, zeroTime: 10000 }, // now
			})
		})

		it('should restart a paused freeRun timer (stays paused)', () => {
			const timer: RundownTTimer = {
				index: 2,
				label: 'Test',
				mode: {
					type: 'freeRun',
				},
				state: { paused: true, duration: 12345 },
			}

			expect(restartTTimer(timer)).toEqual({
				index: 2,
				label: 'Test',
				mode: {
					type: 'freeRun',
				},
				state: { paused: true, duration: 0 },
			})
		})

		it('should return null for timer with no mode', () => {
			const timer: RundownTTimer = {
				index: 1,
				label: 'Test',
				mode: null,
				state: null,
			}

			expect(restartTTimer(timer)).toBeNull()
		})
	})

	describe('createCountdownTTimer', () => {
		it('should create a running countdown timer', () => {
			const result = createCountdownTTimer(60000, {
				stopAtZero: true,
				startPaused: false,
			})

			expect(result).toEqual({
				mode: {
					type: 'countdown',
					duration: 60000,
					stopAtZero: true,
				},
				state: { paused: false, zeroTime: 70000 }, // now (10000) + duration (60000)
			})
		})

		it('should create a paused countdown timer', () => {
			const result = createCountdownTTimer(30000, {
				stopAtZero: false,
				startPaused: true,
			})

			expect(result).toEqual({
				mode: {
					type: 'countdown',
					duration: 30000,
					stopAtZero: false,
				},
				state: { paused: true, duration: 30000 },
			})
		})

		it('should throw for zero duration', () => {
			expect(() =>
				createCountdownTTimer(0, {
					stopAtZero: true,
					startPaused: false,
				})
			).toThrow('Duration must be greater than zero')
		})

		it('should throw for negative duration', () => {
			expect(() =>
				createCountdownTTimer(-1000, {
					stopAtZero: true,
					startPaused: false,
				})
			).toThrow('Duration must be greater than zero')
		})
	})

	describe('createFreeRunTTimer', () => {
		it('should create a running freeRun timer', () => {
			const result = createFreeRunTTimer({ startPaused: false })

			expect(result).toEqual({
				mode: {
					type: 'freeRun',
				},
				state: { paused: false, zeroTime: 10000 }, // now
			})
		})

		it('should create a paused freeRun timer', () => {
			const result = createFreeRunTTimer({ startPaused: true })

			expect(result).toEqual({
				mode: {
					type: 'freeRun',
				},
				state: { paused: true, duration: 0 },
			})
		})
	})

	describe('calculateNextTimeOfDayTarget', () => {
		// Mock date to 2026-01-19 10:00:00 UTC for predictable tests
		const MOCK_DATE = new Date('2026-01-19T10:00:00Z').getTime()

		beforeEach(() => {
			jest.useFakeTimers()
			jest.setSystemTime(MOCK_DATE)
		})

		afterEach(() => {
			jest.useRealTimers()
		})

		it('should return number input unchanged (unix timestamp)', () => {
			const timestamp = 1737331200000 // Some future timestamp
			expect(calculateNextTimeOfDayTarget(timestamp)).toBe(timestamp)
		})

		it('should return null for null/undefined/empty input', () => {
			expect(calculateNextTimeOfDayTarget('' as string)).toBeNull()
			expect(calculateNextTimeOfDayTarget('   ')).toBeNull()
		})

		// 24-hour time formats
		it('should parse 24-hour time HH:mm', () => {
			const result = calculateNextTimeOfDayTarget('13:34')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T13:34:00.000Z')
		})

		it('should parse 24-hour time H:mm (single digit hour)', () => {
			const result = calculateNextTimeOfDayTarget('9:05')
			expect(result).not.toBeNull()
			// 9:05 is in the past (before 10:00), so chrono bumps to tomorrow
			expect(new Date(result!).toISOString()).toBe('2026-01-20T09:05:00.000Z')
		})

		it('should parse 24-hour time with seconds HH:mm:ss', () => {
			const result = calculateNextTimeOfDayTarget('14:30:45')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T14:30:45.000Z')
		})

		// 12-hour time formats
		it('should parse 12-hour time with pm', () => {
			const result = calculateNextTimeOfDayTarget('5:13pm')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T17:13:00.000Z')
		})

		it('should parse 12-hour time with PM (uppercase)', () => {
			const result = calculateNextTimeOfDayTarget('5:13PM')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T17:13:00.000Z')
		})

		it('should parse 12-hour time with am', () => {
			const result = calculateNextTimeOfDayTarget('9:30am')
			expect(result).not.toBeNull()
			// 9:30am is in the past (before 10:00), so chrono bumps to tomorrow
			expect(new Date(result!).toISOString()).toBe('2026-01-20T09:30:00.000Z')
		})

		it('should parse 12-hour time with space before am/pm', () => {
			const result = calculateNextTimeOfDayTarget('3:45 pm')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T15:45:00.000Z')
		})

		it('should parse 12-hour time with seconds', () => {
			const result = calculateNextTimeOfDayTarget('11:30:15pm')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T23:30:15.000Z')
		})

		// Date + time formats
		it('should parse date with time (slash separator)', () => {
			const result = calculateNextTimeOfDayTarget('1/19/2026 15:43')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T15:43:00.000Z')
		})

		it('should parse date with time and seconds', () => {
			const result = calculateNextTimeOfDayTarget('1/19/2026 15:43:30')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T15:43:30.000Z')
		})

		it('should parse date with 12-hour time', () => {
			const result = calculateNextTimeOfDayTarget('1/19/2026 3:43pm')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T15:43:00.000Z')
		})

		// ISO 8601 format
		it('should parse ISO 8601 format', () => {
			const result = calculateNextTimeOfDayTarget('2026-01-19T15:43:00')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T15:43:00.000Z')
		})

		it('should parse ISO 8601 with timezone', () => {
			const result = calculateNextTimeOfDayTarget('2026-01-19T15:43:00+01:00')
			expect(result).not.toBeNull()
			// +01:00 means the time is 1 hour ahead of UTC, so 15:43 +01:00 = 14:43 UTC
			expect(new Date(result!).toISOString()).toBe('2026-01-19T14:43:00.000Z')
		})

		// Natural language formats (chrono-node strength)
		it('should parse natural language date', () => {
			const result = calculateNextTimeOfDayTarget('January 19, 2026 at 3:30pm')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T15:30:00.000Z')
		})

		it('should parse "noon"', () => {
			const result = calculateNextTimeOfDayTarget('noon')
			expect(result).not.toBeNull()
			expect(new Date(result!).toISOString()).toBe('2026-01-19T12:00:00.000Z')
		})

		it('should parse "midnight"', () => {
			const result = calculateNextTimeOfDayTarget('midnight')
			expect(result).not.toBeNull()
			// Midnight is in the past (before 10:00), so chrono bumps to tomorrow
			expect(new Date(result!).toISOString()).toBe('2026-01-20T00:00:00.000Z')
		})

		// Edge cases
		it('should return null for invalid time string', () => {
			expect(calculateNextTimeOfDayTarget('not a time')).toBeNull()
		})

		it('should return null for gibberish', () => {
			expect(calculateNextTimeOfDayTarget('asdfghjkl')).toBeNull()
		})
	})

	describe('createTimeOfDayTTimer', () => {
		// Mock date to 2026-01-19 10:00:00 UTC for predictable tests
		const MOCK_DATE = new Date('2026-01-19T10:00:00Z').getTime()

		beforeEach(() => {
			jest.useFakeTimers()
			jest.setSystemTime(MOCK_DATE)
		})

		afterEach(() => {
			jest.useRealTimers()
		})

		it('should create a timeOfDay timer with valid time string', () => {
			const result = createTimeOfDayTTimer('15:30', { stopAtZero: true })

			expect(result).toEqual({
				mode: {
					type: 'timeOfDay',
					stopAtZero: true,
					targetRaw: '15:30',
				},
				state: {
					paused: false,
					zeroTime: expect.any(Number), // Parsed target time
				},
			})
		})

		it('should create a timeOfDay timer with numeric timestamp', () => {
			const timestamp = 1737331200000
			const result = createTimeOfDayTTimer(timestamp, { stopAtZero: false })

			expect(result).toEqual({
				mode: {
					type: 'timeOfDay',
					targetRaw: timestamp,
					stopAtZero: false,
				},
				state: {
					paused: false,
					zeroTime: timestamp,
				},
			})
		})

		it('should throw for invalid time string', () => {
			expect(() => createTimeOfDayTTimer('invalid', { stopAtZero: true })).toThrow(
				'Unable to parse target time for timeOfDay T-timer'
			)
		})

		it('should throw for empty string', () => {
			expect(() => createTimeOfDayTTimer('', { stopAtZero: true })).toThrow(
				'Unable to parse target time for timeOfDay T-timer'
			)
		})
	})

	describe('restartTTimer with timeOfDay', () => {
		// Mock date to 2026-01-19 10:00:00 UTC for predictable tests
		const MOCK_DATE = new Date('2026-01-19T10:00:00Z').getTime()

		beforeEach(() => {
			jest.useFakeTimers()
			jest.setSystemTime(MOCK_DATE)
		})

		afterEach(() => {
			jest.useRealTimers()
		})

		it('should restart a timeOfDay timer with valid targetRaw', () => {
			const timer: RundownTTimer = {
				index: 1,
				label: 'Test',
				mode: {
					type: 'timeOfDay',
					targetRaw: '15:30',
					stopAtZero: true,
				},
				state: { paused: false, zeroTime: 1737300000000 },
			}

			const result = restartTTimer(timer)

			expect(result).not.toBeNull()
			expect(result?.mode).toEqual(timer.mode)
			expect(result?.state).toEqual({
				paused: false,
				zeroTime: expect.any(Number), // new target time
			})
			if (!result || !result.state || result.state.paused) {
				throw new Error('Expected running timeOfDay timer state')
			}
			expect(result.state.zeroTime).toBeGreaterThan(1737300000000)
		})

		it('should return null for timeOfDay timer with invalid targetRaw', () => {
			const timer: RundownTTimer = {
				index: 1,
				label: 'Test',
				mode: {
					type: 'timeOfDay',
					targetRaw: 'invalid',
					stopAtZero: true,
				},
				state: { paused: false, zeroTime: 1737300000000 },
			}

			const result = restartTTimer(timer)

			expect(result).toBeNull()
		})

		it('should return null for timeOfDay timer with unix timestamp', () => {
			const timer: RundownTTimer = {
				index: 1,
				label: 'Test',
				mode: {
					type: 'timeOfDay',
					targetRaw: 1737300000000,
					stopAtZero: true,
				},
				state: { paused: false, zeroTime: 1737300000000 },
			}

			const result = restartTTimer(timer)

			expect(result).toBeNull()
		})
	})
})
