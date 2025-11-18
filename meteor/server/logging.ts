import * as Winston from 'winston'
import * as fs from 'fs'
import { getAbsolutePath } from './lib'
import { LogLevel } from '@sofie-automation/meteor-lib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { Meteor } from 'meteor/meteor'
import _ from 'underscore'
import { LoggerInstanceFixed } from '@sofie-automation/corelib/dist/logging'

export function getLogLevel(): LogLevel {
	return logger.level as LogLevel
}
export function setLogLevel(level: LogLevel, startup = false): void {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
	if (logger.level !== level || startup) {
		logger.level = level
		if (transports.console) {
			transports.console.level = level
		}
		if (transports.file) {
			transports.file.level = level
		}
		if (!Meteor.isTest) {
			// Note: We can't use logger.info here, since that might be supressed by the log level.
			console.log(`Setting logger level to "${level}"`)
		}
	}
}
let originalLogger: LoggerInstanceFixedExt | undefined = undefined
/** For use in unit tests */
export function overrideLogger(fcn: (logger: LoggerInstanceFixedExt) => LoggerInstanceFixedExt): void {
	originalLogger = logger
	logger = fcn(logger)
}
export function restoreLogger(): void {
	if (!originalLogger) throw new Error('No logger to restore, run overrideLogger first!')
	logger = originalLogger
}

export function getEnvLogLevel(): LogLevel | undefined {
	return Object.values<LogLevel>(LogLevel as any).find((level) => level === process.env.LOG_LEVEL)
}

export type LoggerInstanceFixedExt = LoggerInstanceFixed & Pick<Winston.Logger, 'level'>

const leadingZeros = (num: number | string, length: number) => {
	num = num + ''
	if (num.length < length) {
		return '00000000000000000000000000000000000000000'.slice(0, length - num.length) + num
	} else {
		return num
	}
}
let logToFile = false
if (process.env.LOG_TO_FILE) logToFile = true

let logPath = process.env.LOG_FILE || ''

let logger: LoggerInstanceFixedExt
let transports: {
	console?: Winston.transports.ConsoleTransportInstance
	file?: Winston.transports.FileTransportInstance
}

function safeStringify(o: any): string {
	try {
		return JSON.stringify(o) // make single line
	} catch (e) {
		return 'ERROR in safeStringify: ' + stringifyError(e)
	}
}
if (logToFile || logPath !== '') {
	if (logPath === '') {
		const time = new Date()
		const startDate =
			time.getFullYear() +
			'-' +
			leadingZeros(time.getMonth(), 2) +
			'-' +
			leadingZeros(time.getDate(), 2) +
			'_' +
			leadingZeros(time.getHours(), 2) +
			'_' +
			leadingZeros(time.getMinutes(), 2) +
			'_' +
			leadingZeros(time.getSeconds(), 2)
		const logDirectory = getAbsolutePath() + '/.meteor/local/log'
		logPath = logDirectory + '/log_' + startDate + '.log'

		if (!fs.existsSync(logDirectory)) {
			fs.mkdirSync(logDirectory)
		}
	}
	const transportConsole = new Winston.transports.Console({
		level: getEnvLogLevel() ?? 'verbose',
		handleExceptions: true,
		handleRejections: true,
	})
	const transportFile = new Winston.transports.File({
		level: getEnvLogLevel() ?? 'silly',
		handleExceptions: true,
		handleRejections: true,
		filename: logPath,
	})

	transports = {
		console: transportConsole,
		file: transportFile,
	}
	logger = Winston.createLogger({
		format: Winston.format.json(),
		transports: [transportConsole, transportFile],
	})
	console.log('Logging to ' + logPath)
} else {
	const transportConsole = new Winston.transports.Console({
		level: getEnvLogLevel() ?? 'silly',
		handleExceptions: true,
		handleRejections: true,
	})
	transports = {
		console: transportConsole,
	}
	if (Meteor.isProduction) {
		logger = Winston.createLogger({
			format: Winston.format.json(),
			transports: [transportConsole],
		})
	} else {
		const customFormat = Winston.format.printf((o) => {
			const meta = _.omit(o, 'level', 'message', 'timestamp')
			return `[${o.level}] ${o.message} ${!_.isEmpty(meta) ? safeStringify(meta) : ''}`
		})

		logger = Winston.createLogger({
			format: Winston.format.combine(Winston.format.timestamp(), customFormat),
			transports: [transportConsole],
		})
	}
}

process.on('exit', (code) => {
	logger.info(`Process exiting with code: ${code}`)
})

export { logger, transports, LogLevel }
