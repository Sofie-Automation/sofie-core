import { RateLimitingService } from '../rateLimitingService'

describe('RateLimitingService', () => {
	let rateLimitingService: RateLimitingService
	const throttlingPeriodMs = 1000 // 1 second

	beforeEach(() => {
		jest.useFakeTimers()
		rateLimitingService = new RateLimitingService(throttlingPeriodMs)
	})

	afterEach(() => {
		jest.clearAllTimers()
		jest.useRealTimers()
	})

	test('allows access if no recent access', () => {
		expect(rateLimitingService.isAllowedToAccess('resource')).toBe(true)
		expect(rateLimitingService.isAllowedToAccess('anotherResource')).toBe(true)
	})

	test('denies access if accessed within throttling period', () => {
		rateLimitingService.isAllowedToAccess('resource')
		expect(rateLimitingService.isAllowedToAccess('resource')).toBe(false)
	})

	test('allows access after throttling period', () => {
		rateLimitingService.isAllowedToAccess('resource')
		jest.advanceTimersByTime(throttlingPeriodMs + 1)
		expect(rateLimitingService.isAllowedToAccess('resource')).toBe(true)
	})
})
