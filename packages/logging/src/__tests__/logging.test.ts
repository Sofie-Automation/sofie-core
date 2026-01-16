import {
	getDefaultConfiguration,
	getLogger,
	loggingConfigure,
	loggingConfigureWithDefault,
	LoggingOptions,
	SofieLogger,
} from '../index.js'

declare module '../index.js' {
	// eslint-disable-next-line jest/no-export
	export interface SofieLoggerContext {
		myCustomAttribute?: string
	}
}

const orgConsoleDebug = console.debug
const orgConsoleLog = console.log
const orgConsoleInfo = console.info
const orgConsoleWarn = console.warn
const orgConsoleError = console.error

const OUTPUT_LOGS = false
beforeAll(() => {
	if (OUTPUT_LOGS) {
		console.debug = jest.fn(orgConsoleDebug)
		console.log = jest.fn(orgConsoleLog)
		console.info = jest.fn(orgConsoleInfo)
		console.warn = jest.fn(orgConsoleWarn)
		console.error = jest.fn(orgConsoleError)
	} else {
		console.debug = jest.fn()
		console.log = jest.fn()
		console.info = jest.fn()
		console.warn = jest.fn()
		console.error = jest.fn()
	}
})
beforeEach(() => {
	;(console.debug as jest.Mock).mockClear()
	;(console.log as jest.Mock).mockClear()
	;(console.info as jest.Mock).mockClear()
	;(console.warn as jest.Mock).mockClear()
	;(console.error as jest.Mock).mockClear()
})
test('exports', () => {
	expect(loggingConfigureWithDefault).toBeTruthy()
	expect(loggingConfigure).toBeTruthy()
	expect(getDefaultConfiguration).toBeTruthy()

	// Type checks:
	const hasLoggingOptions = (options?: LoggingOptions) => options
	hasLoggingOptions()
	const hasSofieLogger = (logger?: SofieLogger) => logger
	hasSofieLogger()
})

describe('Logging output', () => {
	beforeAll(async () => {
		await loggingConfigureWithDefault({
			reset: true,
		})
	})

	test('Log message', async () => {
		const logger = getLogger('unit-test')

		logger.info('This is an info message')
		logger.warn('This is a warning message')
		logger.error('This is an error message')

		// Ensure that it is logged as JSON:
		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"message":"This is an info message"'))

		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('This is an info message'))
		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('This is a warning message'))
		expect(console.error).toHaveBeenCalledWith(expect.stringContaining('This is an error message'))
	})
	test('Categories', async () => {
		const logger1 = getLogger('logger1')
		const logger2 = getLogger('logger2')
		const loggerWithMultipleCategories = getLogger(['these', 'are', 'my', 'categories'])

		logger1.info('abc')
		logger2.info('abc')
		loggerWithMultipleCategories.info('abc')

		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"logger1"'))
		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"logger2"'))
		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"these.are.my.categories"'))
	})
	test('Context data', async () => {
		const logger = getLogger('unit-test')

		logger.info('got a message', { data: { some: 'data' } })

		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('got a message'))
		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"some":"data"'))
	})
	test('Context custom attribute', async () => {
		const logger = getLogger('unit-test')

		// This is possible thanks to the `declare module` at the top of the file:
		logger.info('got a message', { myCustomAttribute: 'Why yes, it IS custom' })

		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('got a message'))
		expect(console.info).toHaveBeenCalledWith(
			expect.stringContaining('"myCustomAttribute":"Why yes, it IS custom"')
		)
	})
	test('Only Context', async () => {
		const logger = getLogger('unit-test')

		logger.info({ data: { some: 'data' } })

		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"some":"data"'))
	})
})

describe('Log levels', () => {
	test('Set log level on startup', async () => {
		await loggingConfigureWithDefault({
			reset: true,
			logLevel: 'warning', // Only warning and above
		})

		const logger = getLogger('unit-test')

		logAll(logger)

		expect(console.debug).toHaveBeenCalledTimes(0)
		expect(console.log).toHaveBeenCalledTimes(0)
		expect(console.info).toHaveBeenCalledTimes(0)
		expect(console.warn).toHaveBeenCalledTimes(1)
		expect(console.error).toHaveBeenCalledTimes(2) // error + fatal
	})
	test('Set log level after startup', async () => {
		// Set initial configuration
		await loggingConfigureWithDefault({
			reset: true,
			logLevel: 'warning', // Only warning and above
		})

		// Change the log level:

		await loggingConfigureWithDefault({
			reset: true,
			logLevel: 'debug', // debug and above
		})

		const logger = getLogger('unit-test')

		logAll(logger)

		expect(console.debug).toHaveBeenCalledTimes(1)
		expect(console.info).toHaveBeenCalledTimes(1)
		expect(console.warn).toHaveBeenCalledTimes(1)
		expect(console.error).toHaveBeenCalledTimes(2) // error + fatal
	})
})

describe('Inheritance', () => {
	beforeAll(async () => {
		await loggingConfigureWithDefault({
			reset: true,
		})
	})

	test('logger.getChild()', async () => {
		const parentLogger = getLogger('unit-test')

		const childLogger = parentLogger.getChild('child-category')

		childLogger.info('This is from the child logger')

		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('This is from the child logger'))
		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"unit-test.child-category"'))
	})
	test('logger.with()', async () => {
		const parentLogger = getLogger('unit-test')

		// This is possible thanks to the `declare module` at the top of the file:
		const withContext = parentLogger.with({ myCustomAttribute: 'aaa' })

		withContext.info('This is from the with-context logger')

		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"unit-test"'))
		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('This is from the with-context logger'))
		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"myCustomAttribute":"aaa"'))
	})
})

describe('Advanced', () => {
	test('Custom category handling', async () => {
		// Set initial configuration
		const config = getDefaultConfiguration({
			reset: true,
			logLevel: 'debug', // debug and above
		})

		const filters = (config.filters = config.filters ?? {})

		filters.myCustomFilter = (log) => {
			if (log.category.includes('special-category')) return false // Don't log this
			return true
		}

		for (const logger of config.loggers) {
			logger.filters = [...(logger.filters || []), 'myCustomFilter']
		}

		await loggingConfigure(config)

		const logger = getLogger('your-friendly-neighborhood-unit-test')
		const specialLogger = logger.getChild('special-category')

		logger.info('This message should appear')
		specialLogger.info('This message should NOT appear')

		expect(console.info).toHaveBeenCalledWith(expect.stringContaining('This message should appear'))
		expect(console.info).not.toHaveBeenCalledWith(expect.stringContaining('This message should NOT appear'))
	})
})

function logAll(logger: SofieLogger): void {
	logger.trace('trace')
	logger.debug('debug')
	logger.info('info')
	logger.warn('warn')
	// logger.warning('warning')
	logger.error('error')
	logger.fatal('fatal')
}
