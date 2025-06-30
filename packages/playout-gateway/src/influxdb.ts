import { unprotectString } from '@sofie-automation/server-core-integration'
import * as Influx from 'influx'
import { config } from './config.js'

export interface InfluxConfig {
	host: string | undefined
	port: number
	user: string
	password: string | undefined
	database: string
}

const url = /(https?:\/\/)?([\s\S]+)/g.exec(config.influx.host || '')
const hostname = url?.[2]
const protocol = (url?.[1]?.replace('://', '') || 'https') as 'http' | 'https'
const client = config.influx.host
	? new Influx.InfluxDB({
			database: config.influx.database,
			host: hostname,
			port: config.influx.port,
			username: config.influx.user,
			password: config.influx.password,
			protocol,
		})
	: undefined

const versions = getVersions()
let timeout: NodeJS.Timeout | undefined = undefined
let bufferedTraces: Influx.IPoint[] = []

export interface Trace {
	/** id of this trace, should be formatted as namespace:id */
	measurement: string
	/** timestamp of when trace was started */
	start: number
	/** Tags to differentiate data sources */
	tags?: Record<string, string>
}
export interface FinishedTrace extends Trace {
	/** timestamp of when trace was ended */
	ended: number
	/** duration of the trace */
	duration: number
}

export function startTrace(measurement: string, tags?: Record<string, string>): Trace {
	return {
		measurement,
		tags,
		start: Date.now(),
	}
}

export function endTrace(trace: Trace): FinishedTrace {
	return {
		...trace,
		ended: Date.now(),
		duration: Date.now() - trace.start,
	}
}

export function sendTrace(trace: FinishedTrace): void {
	if (!client || Number.isNaN(trace.duration)) return

	const point: Influx.IPoint = {
		measurement: trace.measurement,
		tags: {
			...trace.tags,
			host: unprotectString(config.device.deviceId),
			...versions,
		},
		fields: {
			duration: trace.duration,
		},
		timestamp: trace.start * 1e6,
	}

	bufferedTraces.push(point)

	if (bufferedTraces.length >= 2500) {
		if (timeout) {
			clearTimeout(timeout)
			timeout = undefined
		}
		emptyBuffers()
	} else {
		if (!timeout) {
			timeout = setTimeout(() => {
				emptyBuffers()
				timeout = undefined
			}, 30 * 1000)
		}
	}
}

function getVersions(): Record<string, string> {
	const versions: { [packageName: string]: string } = {}

	if (process.env.npm_package_version) {
		versions['processVersion'] = process.env.npm_package_version
	}

	try {
		const pkgInfo = require(`timeline-state-resolver/package.json`)
		versions['tsrVersion'] = pkgInfo.version || 'N/A'
	} catch (_e) {
		// this.logger.error(`Failed to load package.json for lib "${pkgName}": ${stringifyError(e)}`)
	}

	return versions
}

function emptyBuffers() {
	const points = bufferedTraces // create a reference so we can safely empty bufferedTraces
	bufferedTraces = []

	client?.writePoints(points).catch((e) => console.log(e)) // only tracing so not relevant enough to throw errors, stdout should go to debug
}
