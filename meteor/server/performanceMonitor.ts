import _ from 'underscore'
import { getCoreSystemAsync } from './coreSystem/collection'
import { logger } from './logging'
import { getRunningMethods, resetRunningMethods } from './methods'
import type { DdpConnectionRegistry } from './ddp-server/ConnectionRegistry'

/**
 * The performanceMonotor runs at an interval, and when run it checks that it actually ran on time.
 * If it didn't run on time, this was probably because the main thread was blocked, either due to some
 * slow-running function or garbage collection.
 * If it detects a delay, it logs a warning to the console along with some debugging data, to help us find
 * the culprit.
 */

const PERMORMANCE_CHECK_INTERVAL = 500 // how often to check
const ACCEPTED_DELAY = 100 // how much delay to accept before logging a warning
const statisticsDelays: Array<number> = []
const statisticsCount = 10000 // how many to base each statistics on
const statistics: Array<{
	timestamp: number
	count: number
	average: number
	min: number
	max: number
	warnings: number
	halfWarnings: number
	quarterWarnings: number
	averageWarnings: number
}> = []

interface DebugData {
	connectionCount: number
	subscriptionCount: number
	/** Total documents across all sessions' merge boxes (deduplicated per session) */
	documentCount: number

	subscriptions: Record<string, { count: number; documents: Record<string, number> }>
	connections: Array<{
		id: string
		clientAddress: string
		subscriptionCount: number
		documentCount: number
	}>
}

function traceDebuggingData(connections: DdpConnectionRegistry): DebugData {
	// Collect a set of data that can be useful for performance debugging

	const debugData: DebugData = {
		connectionCount: 0,
		subscriptionCount: 0,
		documentCount: 0,

		subscriptions: {},
		connections: [],
	}

	for (const session of connections.getDebugData()) {
		debugData.connectionCount++
		debugData.documentCount += session.mergedDocumentCount

		debugData.connections.push({
			id: session.id,
			clientAddress: session.clientAddress,
			subscriptionCount: session.subscriptions.length,
			documentCount: session.mergedDocumentCount,
		})

		for (const sub of session.subscriptions) {
			debugData.subscriptionCount++

			let sub0 = debugData.subscriptions[sub.name]
			if (!sub0) {
				sub0 = { count: 0, documents: {} }
				debugData.subscriptions[sub.name] = sub0
			}

			sub0.count++

			for (const [collectionName, count] of Object.entries<number>(sub.documents)) {
				sub0.documents[collectionName] = (sub0.documents[collectionName] ?? 0) + count
			}
		}
	}

	return debugData
}
function updateStatistics(onlyReturn?: boolean) {
	const stat = {
		timestamp: Date.now(),
		count: statisticsDelays.length,
		average: 0,
		min: 99999,
		max: -99999,
		warnings: 0,
		averageWarnings: 0,
		halfWarnings: 0,
		quarterWarnings: 0,
	}
	_.each(statisticsDelays, (d) => {
		stat.average += d
		if (d < stat.min) stat.min = d
		if (d > stat.max) stat.max = d
		if (d > ACCEPTED_DELAY) {
			stat.warnings++
			stat.averageWarnings += d
		}

		if (d > ACCEPTED_DELAY / 2) stat.halfWarnings++
		if (d > ACCEPTED_DELAY / 4) stat.quarterWarnings++
	})
	if (stat.count) stat.average = stat.average / stat.count
	if (stat.warnings) stat.averageWarnings = stat.averageWarnings / stat.warnings

	if (!onlyReturn) {
		statisticsDelays.splice(0, statisticsDelays.length) // clear the array
		statistics.push(stat)
	}
	return stat
}
// function getStatistics() {
// 	const stat = {
// 		timestamp: Date.now(),
// 		count: 0,
// 		average: 0,
// 		min: 99999,
// 		max: -99999,
// 		warnings: 0,
// 		averageWarnings: 0,
// 		halfWarnings: 0,
// 		quarterWarnings: 0,
// 		periods: [],
// 	}

// 	const periods = [updateStatistics(true)]
// 	_.each(statistics, (s) => {
// 		periods.push(s)
// 	})

// 	_.each(periods, (s) => {
// 		stat.count += s.count
// 		stat.average += s.average * s.count

// 		if (s.min < stat.min) stat.min = s.min
// 		if (s.max > stat.max) stat.max = s.max

// 		stat.warnings += s.warnings
// 		stat.averageWarnings += s.averageWarnings * s.warnings

// 		stat.halfWarnings += s.halfWarnings
// 		stat.quarterWarnings += s.quarterWarnings
// 	})
// 	if (stat.count) stat.average = stat.average / stat.count
// 	if (stat.warnings) stat.averageWarnings = stat.averageWarnings / stat.warnings

// 	// @ts-ignore
// 	stat.periods = statistics

// 	return stat
// }

let lastTime = 0
const monitorBlockedThread = (connections: DdpConnectionRegistry) => {
	if (lastTime) {
		const timeSinceLast = Date.now() - lastTime

		const delayTime = timeSinceLast - PERMORMANCE_CHECK_INTERVAL

		if (delayTime > ACCEPTED_DELAY) {
			logger.warn('Main thread was blocked for ' + delayTime + ' ms')
			const trace: string[] = []
			const runningMethods = getRunningMethods()
			if (!_.isEmpty(runningMethods)) {
				_.each(runningMethods, (m) => {
					trace.push(m.method + ': ' + (Date.now() - m.startTime) + ' ms ago')
				})
			}
			resetRunningMethods()
			logger.info('Running methods:', trace)
			logger.info('traceDebuggingData:', traceDebuggingData(connections))
		}

		statisticsDelays.push(delayTime)
		if (statisticsDelays.length >= statisticsCount) {
			updateStatistics()
		}
	}
	lastTime = Date.now()
	setTimeout(() => {
		monitorBlockedThread(connections)
	}, PERMORMANCE_CHECK_INTERVAL)
}

export function startPerformanceMonitor(connections: DdpConnectionRegistry): void {
	getCoreSystemAsync()
		.then((coreSystem) => {
			if (coreSystem?.enableMonitorBlockedThread) {
				setTimeout(() => {
					monitorBlockedThread(connections)
				}, 5000)
			}
		})
		.catch((e) => {
			logger.error(`Error in startPerformanceMonitor: ${e}`)
		})
}
