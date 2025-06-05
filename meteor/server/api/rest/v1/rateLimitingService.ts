export class RateLimitingService {
	private resourceRecords: Map<string, number> = new Map()

	constructor(private throttlingPeriodMs: number) {}

	isAllowedToAccess(resourceName: string): boolean | number {
		const currentTime = this.getCurrentTime()
		const requestTimestamp = this.resourceRecords.get(resourceName)
		if (requestTimestamp !== undefined && currentTime - requestTimestamp <= this.throttlingPeriodMs) {
			return false
		}
		this.resourceRecords.set(resourceName, currentTime)
		return true
	}

	private getCurrentTime() {
		return Date.now()
	}
}

export default new RateLimitingService(1 * 1000)
