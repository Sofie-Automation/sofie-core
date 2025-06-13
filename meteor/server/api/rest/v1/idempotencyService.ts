export class IdempotencyService {
	private requestRecords: Map<string, number> = new Map()

	constructor(
		private idempotencyPeriodMs: number,
		private cleanupIntervalMs: number
	) {
		this.scheduleCleanup()
	}

	private scheduleCleanup() {
		setInterval(this.cleanupExpiredRecords.bind(this), this.cleanupIntervalMs)
	}

	isUniqueWithinIdempotencyPeriod(requestId: string): boolean {
		const currentTime = this.getCurrentTime()
		const requestTimestamp = this.requestRecords.get(requestId)

		if (requestTimestamp !== undefined) {
			if (currentTime - requestTimestamp <= this.idempotencyPeriodMs) {
				return false
			}
			this.requestRecords.delete(requestId) // so that the entry is reinserted at the end
		}
		this.requestRecords.set(requestId, currentTime)
		return true
	}

	private cleanupExpiredRecords(): void {
		const currentTime = this.getCurrentTime()
		for (const [requestId, requestTimestamp] of this.requestRecords.entries()) {
			if (currentTime - requestTimestamp < this.idempotencyPeriodMs) {
				break // because the entries are in insertion order
			}
			this.requestRecords.delete(requestId)
		}
	}

	private getCurrentTime() {
		return Date.now()
	}
}

export default new IdempotencyService(60 * 5 * 1000, 60 * 1000)
