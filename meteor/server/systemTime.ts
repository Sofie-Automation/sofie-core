import { Meteor } from 'meteor/meteor'
import { logger } from './logging'

/** How good time sync quality we should strive for [ms] */
const TARGET_TIME_SYNC_QUALITY = 50 // 50 milliseconds

/** How often we should check if its time has jumped or been skewed [ms] */
const JUMP_CHECK_INTERVAL = 10 * 1000 // 10 seconds

export class TimeJumpDetector {
	private wallTime: number = TimeJumpDetector.getWallTime()
	private monotonicTime: number = TimeJumpDetector.getMonotonicTime()

	constructor(
		private jumpCheckInterval: number,
		private onJumpDetected: (syncDiff: number) => void
	) {}

	public start(): void {
		Meteor.setInterval(() => {
			this.detectTimeJump()
		}, this.jumpCheckInterval)
	}

	/** Returns the actual time of the OS, which could be influenced (jump) by an NTP sync. */
	private static getWallTime() {
		return Date.now()
	}

	/** Returns a Monotonic Time, which is not influenced by any NTP-sync  */
	private static getMonotonicTime() {
		// Future: this should use performance.now() once we are using newer nodejs
		return Number(process.hrtime.bigint() / BigInt(1000000))
	}

	private detectTimeJump() {
		const wallTime = TimeJumpDetector.getWallTime()
		const monotonicTime = TimeJumpDetector.getMonotonicTime()
		const currentDiff = wallTime - monotonicTime
		const previousDiff = this.wallTime - this.monotonicTime
		const syncDiff = currentDiff - previousDiff
		if (Math.abs(syncDiff) > TARGET_TIME_SYNC_QUALITY) {
			this.wallTime = wallTime
			this.monotonicTime = monotonicTime
			this.onJumpDetected(syncDiff)
		}
	}
}
// handled in systemTime, but we want to log jumps anyway
if (!Meteor.isTest) {
	Meteor.startup(() => {
		const timeJumpDetector = new TimeJumpDetector(JUMP_CHECK_INTERVAL * 6, (syncDiff) => {
			logger.warn(`Time jump or skew of ${Math.round(syncDiff)} ms detected`)
			// But we're not doing anything more
			// TODO: Should we trigger peripheralDevices to resync? And clients?
		})
		timeJumpDetector.start()
	})
}
