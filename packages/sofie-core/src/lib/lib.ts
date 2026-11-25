import { logger } from '../logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { Time } from '@sofie-automation/shared-lib/dist/lib/lib'

export function getCurrentTime(): Time {
	// We assume the os does NTP syncing, at a frequent interval.
	return Date.now()
}

/**
 * Replaces all invalid characters in order to make the path a valid one
 * @param path
 */
export function fixValidPath(path: string): string {
	return path.replace(/([^a-z0-9_.@()-])/gi, '_')
}

const lazyIgnoreCache: { [name: string]: NodeJS.Timeout } = {}
export function lazyIgnore(name: string, f1: () => void, t: number): void {
	// Don't execute the function f1 until the time t has passed.
	// Subsequent calls will extend the laziness and ignore the previous call

	if (lazyIgnoreCache[name]) {
		clearTimeout(lazyIgnoreCache[name])
	}
	lazyIgnoreCache[name] = setTimeout(() => {
		delete lazyIgnoreCache[name]

		try {
			f1()
		} catch (e) {
			logger.error(`Unhandled error in lazyIgnore "${name}": ${stringifyError(e)}`)
		}
	}, t)
}

export function deferAsync(fcn: () => Promise<void>): void {
	setImmediate(() => {
		fcn().catch((e) => logger.error(stringifyError(e)))
	})
}

/**
 * Wait for specified time
 * @param time
 */
export async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}
