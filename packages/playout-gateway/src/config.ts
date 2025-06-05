import { Config } from './connector.js'
import _ from 'underscore'
import { protectString } from '@sofie-automation/server-core-integration'

// CLI arguments / Environment variables --------------
let host: string = process.env.CORE_HOST || '127.0.0.1'
let port: number = parseInt(process.env.CORE_PORT + '', 10) || 3000
let logPath: string = process.env.CORE_LOG || ''
let logLevel: string | undefined = process.env.LOG_LEVEL || undefined
let deviceId: string = process.env.DEVICE_ID || ''
let deviceToken: string = process.env.DEVICE_TOKEN || ''
let disableWatchdog: boolean = process.env.DISABLE_WATCHDOG === '1' || false
let unsafeSSL: boolean = process.env.UNSAFE_SSL === '1' || false
const certs: string[] = (process.env.CERTIFICATES || '').split(';') || []
let disableAtemUpload: boolean = process.env.DISABLE_ATEM_UPLOAD === '1' || false // TODO: change this to be an opt-in instead

let influxHost: string | undefined = process.env.INFLUX_HOST || undefined
let influxPort: number | undefined = parseInt(process.env.INFLUX_PORT + '') || 8086
let influxUser: string | undefined = process.env.INFLUX_USER || 'sofie'
let influxPassword: string | undefined = process.env.INFLUX_PASSWORD || undefined
let influxDatabase: string | undefined = process.env.INFLUX_DB || 'sofie'

let prevProcessArg = ''
process.argv.forEach((val) => {
	val = val + ''

	let nextPrevProcessArg = val
	if (prevProcessArg.match(/-host/i)) {
		host = val
	} else if (prevProcessArg.match(/-port/i)) {
		port = parseInt(val, 10)
	} else if (prevProcessArg.match(/-logLevel/i)) {
		logLevel = val
	} else if (prevProcessArg.match(/-log/i)) {
		logPath = val
	} else if (prevProcessArg.match(/-id/i)) {
		deviceId = val
	} else if (prevProcessArg.match(/-token/i)) {
		deviceToken = val
	} else if (prevProcessArg.match(/-certificates/i)) {
		certs.push(val)
		nextPrevProcessArg = prevProcessArg // so that we can get multiple certificates
	} else if (prevProcessArg.match(/-influxHost/i)) {
		influxHost = val
	} else if (prevProcessArg.match(/-influxPort/i)) {
		influxPort = parseInt(val)
	} else if (prevProcessArg.match(/-influxUser/i)) {
		influxUser = val
	} else if (prevProcessArg.match(/-influxPassword/i)) {
		influxPassword = val
	} else if (prevProcessArg.match(/-influxDatabase/i)) {
		influxDatabase = val

		// arguments with no options:
	} else if (val.match(/-disableWatchdog/i)) {
		disableWatchdog = true
	} else if (val.match(/-disableAtemUpload/i)) {
		disableAtemUpload = true
	} else if (val.match(/-unsafeSSL/i)) {
		// Will cause the Node applocation to blindly accept all certificates. Not recommenced unless in local, controlled networks.
		unsafeSSL = true
	}
	prevProcessArg = nextPrevProcessArg + ''
})

const config: Config = {
	certificates: {
		unsafeSSL: unsafeSSL,
		certificates: _.compact(certs),
	},
	device: {
		deviceId: protectString(deviceId),
		deviceToken: deviceToken,
	},
	core: {
		host: host,
		port: port,
		watchdog: !disableWatchdog,
	},
	tsr: {},
	influx: {
		host: influxHost,
		port: influxPort,
		user: influxUser,
		password: influxPassword,
		database: influxDatabase,
	},
}

export { config, logPath, logLevel, disableWatchdog, disableAtemUpload }
