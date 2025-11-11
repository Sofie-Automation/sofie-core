import { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import { PeripheralDevice } from '../dataModel/PeripheralDevice.js'

/**
 * Calculate what the expected latency is going to be for a device.
 * The returned latency represents the amount of time we expect the device will need to receive, process and execute a timeline
 */
export function getExpectedLatency(peripheralDevice: ReadonlyDeep<PeripheralDevice>): {
	average: number
	safe: number
	fastest: number
} {
	if (peripheralDevice.latencies && peripheralDevice.latencies.length) {
		const latencies = _.sortBy(peripheralDevice.latencies, (a, b) => {
			if (a > b) return 1
			if (a < b) return -1
			return 0
		})
		let total = 0
		for (const latency of latencies) {
			total += latency
		}
		const average = total / latencies.length

		// The 95th slowest percentil
		const i95 = Math.floor(latencies.length * 0.95)

		return {
			average: average,
			safe: latencies[i95],
			fastest: latencies[0],
		}
	}
	return {
		average: 0,
		safe: 0,
		fastest: 0,
	}
}
