import { IdempotencyService } from '../idempotencyService'

describe('IdempotencyService', () => {
	let idempotencyService: IdempotencyService

	beforeEach(() => {
		jest.useFakeTimers()
		idempotencyService = new IdempotencyService(60 * 5 * 1000, 60 * 1000)
	})

	afterEach(() => {
		jest.clearAllTimers()
		jest.useRealTimers()
	})

	it('should allow unique requests within the idempotency period', () => {
		const requestId = 'unique-request-id'

		expect(idempotencyService.isUniqueWithinIdempotencyPeriod(requestId)).toBe(true)

		const requestId2 = 'another-unique-request-id'

		expect(idempotencyService.isUniqueWithinIdempotencyPeriod(requestId2)).toBe(true)
	})

	it('should disallow duplicate requests within the idempotency period', () => {
		const requestId = 'duplicate-request-id'

		expect(idempotencyService.isUniqueWithinIdempotencyPeriod(requestId)).toBe(true)

		expect(idempotencyService.isUniqueWithinIdempotencyPeriod(requestId)).toBe(false)
	})

	it('should allow duplicate requests after the idempotency period', async () => {
		const requestId = 'unique-request-id'

		expect(idempotencyService.isUniqueWithinIdempotencyPeriod(requestId)).toBe(true)

		jest.advanceTimersByTime(55 * 5 * 1000)
		expect(idempotencyService.isUniqueWithinIdempotencyPeriod(requestId)).toBe(false)

		jest.advanceTimersByTime(5 * 5 * 1000 + 1)
		expect(idempotencyService.isUniqueWithinIdempotencyPeriod(requestId)).toBe(true)
	})
})
