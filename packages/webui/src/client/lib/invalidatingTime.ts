import { Tracker } from 'meteor/tracker'
import { getCurrentTime } from './systemTime.js'

/** Invalidate a reactive computation after a given amount of time */
export function invalidateAfter(timeout: number): void {
	const time = new Tracker.Dependency()
	time.depend()
	const t = setTimeout(() => {
		time.changed()
	}, timeout)
	if (Tracker.currentComputation) {
		Tracker.currentComputation.onInvalidate(() => {
			clearTimeout(t)
		})
	}
}

/** Invalidate a reactive computation after when a given time is reached */
export function invalidateAt(timestamp: number): void {
	const timeout = Math.max(0, timestamp - getCurrentTime())
	invalidateAfter(timeout)
}
