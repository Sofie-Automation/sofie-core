const ntpClient: NtpClient = require('ntp-client')
import { DiffTimeResult } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import type { NtpClient } from '../../typings/ntp-client'

/**
 * Example usage:
 * determineDiffTime({
 * 	maxSampleCount: 20,
 * 	minSampleCount: 10,
 * 	maxAllowedDelay: 2000
 * })
 * .then((result) => {
 * 	logger.debug('result', result)
 * 	// if result.stdDev is less than one frame-time, we should be okay
 * })
 */

export async function determineDiffTime(config?: Partial<Config>): Promise<DiffTimeResult> {
	return determineDiffTimeInner({
		maxSampleCount: 20,
		minSampleCount: 10,
		maxAllowedDelay: 500,

		...config,
	})
}

/**
 * Send a number of calls to ntp-server, and calculate most-probable diff
 * compared to system time
 * https://stackoverflow.com/questions/1228089/how-does-the-network-time-protocol-work
 * @param config config object
 */
async function determineDiffTimeInner(config?: Config): Promise<DiffTimeResult> {
	const maxSampleCount = config?.maxSampleCount || 20
	const minSampleCount = config?.minSampleCount || 10
	const maxAllowedDelay = config?.maxAllowedDelay || 500
	const maxTries = config?.maxTries || 20
	const host = config?.host || '0.pool.ntp.org'
	const port = config?.port || 123

	return new Promise<Array<ServerTime>>((resolve, reject) => {
		const results: Array<ServerTime> = []
		let tryCount = 0
		const pushTime = () => {
			// logger.debug('a')
			tryCount++
			if (tryCount > maxTries) {
				if (tryCount > minSampleCount) {
					resolve(results)
				} else {
					reject(new Error('Max try count reached'))
				}
				return
			}
			getServerTime(host, port, maxAllowedDelay)
				.then((result) => {
					results.push(result)
					if (results.length < maxSampleCount) pushTime()
					else resolve(results)
				})
				.catch(() => {
					if (results.length < maxSampleCount) pushTime()
					else resolve(results)
				})
		}
		pushTime()
	}).then((results: Array<ServerTime>) => {
		const halfResults = results
			.sort((a, b) => {
				// sort by response time, lower is better
				return a.responseTime - b.responseTime
			})
			.slice(0, Math.ceil(results.length / 2)) // use only the best half
			.map((result) => {
				return result.diff
			})
		if (halfResults.length < 4) throw Error('Too few NTP-responses')
		const stat = standardDeviation(halfResults)
		return stat
	})
}

interface ServerTime {
	diff: number
	serverTime: number
	responseTime: number
}
async function getServerTime(host: string, port: number, timeout?: number): Promise<ServerTime> {
	return new Promise((resolve, reject) => {
		ntpClient.ntpReplyTimeout = timeout || 500

		const sentTime = Date.now()
		try {
			ntpClient.getNetworkTime(host, port, (err: any, date: Date) => {
				if (err) {
					reject(err instanceof Error ? err : new Error(err))
					return
				} else {
					const replyTime = Date.now()
					resolve({
						diff: (sentTime + replyTime) / 2 - date.getTime(),
						serverTime: date.getTime(),
						responseTime: replyTime - sentTime,
					})
				}
			})
		} catch (e) {
			reject(e instanceof Error ? e : new Error(`${e}`))
		}
	})
}
function standardDeviation(arr: Array<number>): { mean: number; stdDev: number } {
	let total = 0
	let mean = 0
	const diffSqredArr: Array<number> = []
	for (let i = 0; i < arr.length; i += 1) {
		total += arr[i]
	}
	mean = total / arr.length
	for (let j = 0; j < arr.length; j += 1) {
		diffSqredArr.push(Math.pow(arr[j] - mean, 2))
	}
	return {
		mean: mean,
		stdDev: Math.sqrt(
			diffSqredArr.reduce((firstEl, nextEl) => {
				return firstEl + nextEl
			}) / arr.length
		),
	}
}
interface Config {
	maxSampleCount?: number
	minSampleCount?: number
	maxAllowedDelay?: number
	maxTries?: number
	host?: string
	port?: number
}
