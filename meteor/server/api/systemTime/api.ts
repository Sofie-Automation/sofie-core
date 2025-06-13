import { TimeDiff } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { getCurrentTime } from '../../lib/lib'

export function getTimeDiff(): TimeDiff {
	return {
		currentTime: getCurrentTime(),
		systemRawTime: Date.now(),
		// TODO: Since the server doesn't do its own sync, these are never set, but are propogated to clients. They probably shouldn't be
		diff: 0,
		stdDev: 0,
		good: true,
		// diff: systemTime.diff,
		// stdDev: systemTime.stdDev,
		// good: systemTime.stdDev < 1000 / 50,
	}
}
