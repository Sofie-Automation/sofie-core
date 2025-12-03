import { Connector, Config } from './connector.js'
import * as Winston from 'winston'
import _ from 'underscore'
import { protectString, stringifyError } from '@sofie-automation/server-core-integration'

console.log('process started') // This is a message all Sofie processes log upon startup

// CLI arguments / Environment variables --------------
let host: string = process.env.CORE_HOST || '127.0.0.1'
let port: number = parseInt(process.env.CORE_PORT + '', 10) || 3000
let logPath: string = process.env.CORE_LOG || ''
let deviceId: string = process.env.DEVICE_ID || ''
let deviceToken: string = process.env.DEVICE_TOKEN || ''
let disableWatchdog: boolean = process.env.DISABLE_WATCHDOG === '1' || false
let unsafeSSL: boolean = process.env.UNSAFE_SSL === '1' || false
const certs: string[] = (process.env.CERTIFICATES || '').split(';') || []
let healthPort: number | undefined = parseInt(process.env.HEALTH_PORT + '') || undefined
let debug = false
let printHelp = false

let prevProcessArg = ''
process.argv.forEach((val) => {
	val = val + ''

	let nextPrevProcessArg = val
	if (prevProcessArg.match(/-host/i)) {
		host = val
	} else if (prevProcessArg.match(/-port/i)) {
		port = parseInt(val, 10)
	} else if (prevProcessArg.match(/-log/i)) {
		logPath = val
	} else if (prevProcessArg.match(/-id/i)) {
		deviceId = val
	} else if (prevProcessArg.match(/-token/i)) {
		deviceToken = val
	} else if ((val + '').match(/-debug/i)) {
		debug = true
	} else if ((val + ' ').match(/-h(elp)? /i)) {
		printHelp = true
	} else if (prevProcessArg.match(/-certificates/i)) {
		certs.push(val)
		nextPrevProcessArg = prevProcessArg // so that we can get multiple certificates

		// arguments with no options:
	} else if (val.match(/-disableWatchdog/i)) {
		disableWatchdog = true
	} else if (val.match(/-unsafeSSL/i)) {
		// Will cause the Node applocation to blindly accept all certificates. Not recommenced unless in local, controlled networks.
		unsafeSSL = true
	} else if (prevProcessArg.match(/-healthPort/i)) {
		healthPort = parseInt(val)
	}
	prevProcessArg = nextPrevProcessArg + ''
})

if (printHelp) {
	console.log(`
The MOS-gateway acts as a gateway between mos-devices and Core
Options:
CLI                ENV
-host              CORE_HOST         Host of Core  Default: '127.0.0.1'
-port              CORE_PORT         Port of Core  Default: '3000'
-id                CORE_LOG          Custom id of this device
-token             DEVICE_ID         Custom token of this device
-log               DEVICE_TOKEN      File path to output log to (if not set, logs are sent to console)
-disableWatchdog   DISABLE_WATCHDOG  Disable the watchdog (Killing the process if no commands are received after some time)
-certificates      CERTIFICATES      Provide paths to SSL certificates, (for self-signed certificates). '-certificates path1 path2 path3'
-unsafeSSL         UNSAFE_SSL        Will cause the Node applocation to blindly accept all certificates. Not recommenced unless in local, controlled networks.
-debug                               Debug mode
-h, -help                            Displays this help message
`)
	// eslint-disable-next-line n/no-process-exit
	process.exit(0)
}

/**
 * Used when JSON.stringifying values that might be circular
 * Usage: JSON.stringify(value, JSONStringifyCircular()))
 */
const JSONStringifyCircular = () => {
	const cacheValues: any[] = []
	const cacheKeys: any[] = []
	const stringifyFixer = (key: string, value: any) => {
		if (typeof value === 'object' && value !== null) {
			const i = cacheValues.indexOf(value)
			if (i !== -1) {
				// Duplicate reference found
				try {
					// If this value does not reference a parent it can be deduped
					return JSON.parse(JSON.stringify(value))
				} catch (_error) {
					// discard key if value cannot be deduped
					return '[circular of ' + (cacheKeys[i] || '*root*') + ']'
				}
			}
			// Store value in our collection
			cacheValues.push(value)
			cacheKeys.push(key)
		}
		return value
	}
	return stringifyFixer
}
// Setup logging --------------------------------------
const { printf } = Winston.format
const myLogFormat = printf((obj) => {
	return JSON.stringify(obj, JSONStringifyCircular())
})
let logger: Winston.Logger
if (logPath) {
	// Log json to file, human-readable to console
	const transportConsole = new Winston.transports.Console({
		level: 'debug',
		handleExceptions: true,
		handleRejections: true,
	})
	const transportFile = new Winston.transports.File({
		level: 'debug',
		handleExceptions: true,
		handleRejections: true,
		filename: logPath,
		format: myLogFormat,
	})

	logger = Winston.createLogger({
		transports: [transportConsole, transportFile],
	})
	logger.info('Logging to', logPath)

	// Hijack console.log:
	const orgConsoleLog = console.log
	console.log = function (...args: any[]) {
		// orgConsoleLog('a')
		if (args.length >= 1) {
			try {
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore one or more arguments
				logger.debug(...args)
				// logger.debug(...args.map(JSONStringifyCircular()))
			} catch (e) {
				orgConsoleLog('CATCH')
				orgConsoleLog(...args)
				throw e
			}
			orgConsoleLog(...args)
		}
	}
} else {
	// custom json stringifier

	// Log json to console
	const transportConsole = new Winston.transports.Console({
		level: 'debug',
		handleExceptions: true,
		handleRejections: true,
		format: myLogFormat,
	})

	logger = Winston.createLogger({
		transports: [transportConsole],
	})
	logger.info('Logging to Console')

	// Hijack console.log:
	console.log = function (...args: any[]) {
		// orgConsoleLog('a')
		if (args.length >= 1) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore one or more arguments
			logger.debug(...args)
		}
	}
}

// Because the default NodeJS-handler sucks and wont display error properly
process.on('warning', (e: any) => {
	logger.error(`Unhandled warning: ${stringifyError(e)}`)
})

logger.info('------------------------------------------------------------------')
logger.info('-----------------------------------')
logger.info('Statup options:')

logger.info(`host: "${host}"`)
logger.info(`port: ${port}`)
logger.info(`log: "${logPath}"`)
logger.info(`id: "${deviceId}"`)
logger.info(`token: "${deviceToken}"`)
logger.info(`debug: ${debug}`)
logger.info(`certificates: [${certs.join(',')}]`)
logger.info(`disableWatchdog: ${disableWatchdog}`)
logger.info(`unsafeSSL: ${unsafeSSL}`)
logger.info('-----------------------------------')
logger.info(`Test info logging`)
logger.warn(`Test warn logging`)
logger.debug(`Test debug logging`)

// App config -----------------------------------------
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
	health: {
		port: healthPort,
	},
	mos: {
		self: {
			debug: debug,
			// mosID: 'sofie.tv.automation',
			mosID: 'N/A', // set by Core
			acceptsConnections: true, // default:true
			// accepsConnectionsFrom: ['127.0.0.1'],
			profiles: {
				'0': true,
				'1': true,
				'2': true,
				'3': false,
				'4': true,
				'5': false,
				'6': false,
				'7': false,
			},
			offspecFailover: true,
		},
		// devices: [{
		// 	primary: {
		// 		id: '2012R2ENPS8VM',
		// 		host: '10.0.1.244'
		// 	}
		// 	/*secondary?: {
		// 		ncsID: string;
		// 		host: string;
		// 	},*/
		// }]
	},
}

const c = new Connector(logger)

logger.info('Core:          ' + config.core.host + ':' + config.core.port)
// logger.info('My Mos id:     ' + config.mos.self.mosID)
// config.mos.devices.forEach((device) => {
// 	if (device.primary) logger.info('Mos Primary:   ' + device.primary.host)
// 	if (device.secondary) logger.info('Mos Secondary: ' + device.secondary.host)
// })
logger.info('------------------------------------------------------------------')
c.init(config).catch(logger.error)

// @todo: remove this line of comment
