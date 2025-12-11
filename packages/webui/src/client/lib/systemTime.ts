import { Meteor } from 'meteor/meteor'
import { logger } from './logging.js'
import { MeteorCall } from './meteorApi.js'
import { Time } from '@sofie-automation/shared-lib/dist/lib/lib'

export const systemTime = {
	hasBeenSet: false,
	diff: 0,
	stdDev: 9999,
	lastSync: 0,
	timeOriginDiff: 0,
}

/**
 * Returns the current (synced) time.
 * If NTP-syncing is enabled, it'll be unaffected of whether the client has a well-synced computer time or not.
 * @return {Time}
 */
export function getCurrentTime(): Time {
	return Math.floor(Date.now() - systemTime.diff)
}

/** How often the client should sync its time to the server [ms] */
const SYNC_TIME = 5 * 60 * 1000 // 5 minutes

/** How much we assume a clock to drift over time [time unit per time unit] */
const ASSUMED_CLOCK_DRIFT = 5 / (3600 * 24) // We assume 5 seconds drift in a day for the system clock

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
		setInterval(() => {
			if (Meteor.status().connected) {
				this.detectTimeJump()
			}
		}, this.jumpCheckInterval)
	}

	/** Returns the actual time of the OS, which could be influenced (jump) by an NTP sync. */
	private static getWallTime() {
		return Date.now()
	}

	/** Returns a Monotonic Time, which is not influenced by any NTP-sync  */
	private static getMonotonicTime() {
		return performance.now()
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

// fetch time from server:
const updateDiffTime = (force?: boolean) => {
	// Calculate an "adjusted standard deviation", something that increases over time.
	// Using this we can decide wether a new measurement is better or worse than previous one. (the lower, the better)
	const currentSyncDegradation = systemTime.stdDev + (performance.now() - systemTime.lastSync) * ASSUMED_CLOCK_DRIFT

	// If the sync is assumed to have degraded enough, it's time to resync
	if (currentSyncDegradation > TARGET_TIME_SYNC_QUALITY || force) {
		const sentTime = performance.now()
		MeteorCall.peripheralDevice
			.getTimeDiff()
			.then((stat) => {
				const replyTime = performance.now()

				const diff = Math.round(Date.now() + (sentTime - replyTime) / 2 - stat.currentTime)
				const stdDev = Math.abs(Math.round(sentTime - replyTime)) / 2 // Not really a standard deviation calculation, but it's what we can do with just one measuring point..

				// Only use the result if the stdDev is better than previous sync quality:
				if (stdDev <= currentSyncDegradation || force) {
					// Only trace the result if the diff is different than the previous:
					if (Math.abs(systemTime.diff - diff) > 10) {
						logger.verbose(
							`Time diff set to: ${diff} ms (server stdDev: ${
								Math.floor(stat.stdDev * 10) / 10
							} ms, client stdDev: ${stdDev} ms)`
						)
					}

					// Store the result into the global variable `systemTime` (used in getCurrentTime()):
					systemTime.diff = diff
					systemTime.stdDev = stdDev
					systemTime.lastSync = performance.now()
					systemTime.hasBeenSet = true
					systemTime.timeOriginDiff = getCurrentTime() - (performance.timeOrigin + performance.now())
				}
			})
			.catch((err) => {
				logger.error(err)
			})
	}
}

Meteor.startup(() => {
	// Run it once right away:
	updateDiffTime()

	// Also run it a few seconds in, to get a more accurate reading:
	Meteor.setTimeout(() => {
		updateDiffTime()
	}, 5000)

	// Also run it after 30 seconds, to get an even more accurate reading:
	Meteor.setTimeout(() => {
		updateDiffTime()
	}, 30 * 1000)

	// Then run it on an interval, to ensure it is kept up to date:
	Meteor.setInterval(() => {
		if (Meteor.status().connected) {
			updateDiffTime()
		}
	}, SYNC_TIME)

	const timeJumpDetector = new TimeJumpDetector(JUMP_CHECK_INTERVAL, (syncDiff) => {
		logger.verbose(`Time jump or skew of ${Math.round(syncDiff)} ms detected, resyncing with server.`)
		updateDiffTime(true)
	})
	timeJumpDetector.start()
})
