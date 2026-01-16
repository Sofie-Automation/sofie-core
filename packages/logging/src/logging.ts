import { getFileSink } from '@logtape/file'
import * as LogTape from '@logtape/logtape'

/**
 * Configure logging with default, Sofie-recommended options.
 * Note: This should only ever be called at application level. Do not call this from within libraries.
 */
export async function loggingConfigureWithDefault(options: LoggingOptions): Promise<void> {
	await loggingConfigure(getDefaultConfiguration(options))
}
/**
 * Configure logging with custom options.
 * Note: This should only ever be called at application level. Do not call this from within libraries.
 */
export async function loggingConfigure(config: Config<any, any>): Promise<void> {
	CURRENT_CONFIG.config = config
	await LogTape.configure(config)
}
/**
 * Get Sofie-recommended logging configuration.
 */
export function getDefaultConfiguration(options: LoggingOptions): Config<any, any> {
	if (!options.logPath) {
		// When logPath is not set, log everything to console

		return {
			reset: options.reset,
			sinks: {
				console: LogTape.getConsoleSink({
					// Default is to log as JSON for easier parsing by log collectors
					formatter: LogTape.getJsonLinesFormatter(),
				}),
			},
			loggers: [
				{
					category: [], // catch all
					lowestLevel: options.logLevel || DEFAULT_LOG_LEVEL,
					sinks: ['console'],
				},
				{
					category: ['logtape', 'meta'],
					sinks: ['console'],
					lowestLevel: 'warning',
				},
			],
		}
	} else {
		// If logPath is set, log everything to file (as well as console):

		return {
			reset: options.reset,
			sinks: {
				console: LogTape.getConsoleSink({
					// When logging to file, use text formatter for console, for readability
					formatter: LogTape.getTextFormatter(),
				}),
				file: getFileSink(options.logPath, {
					formatter: LogTape.getJsonLinesFormatter(),
				}),
			},
			loggers: [
				{
					category: [], // catch all
					sinks: ['console', 'file'],
					lowestLevel: options.logLevel || DEFAULT_LOG_LEVEL,
				},
				{
					category: ['logtape', 'meta'],
					sinks: ['console'],
					lowestLevel: 'warning',
				},
			],
		}
	}
}
const DEFAULT_LOG_LEVEL: LogTape.LogLevel = 'info'
const CURRENT_CONFIG: {
	config: LogTape.Config<any, any> | null
} = {
	config: null,
}
export interface LoggingOptions {
	/** When set, log to disk */
	logPath?: string

	logLevel?: LogTape.LogLevel

	/** * Whether to reset the configuration before applying this one.  */
	reset?: boolean
}

/**
 * A Sofie-recommended logger.
 * (If you know what you are doing, you can use getLogger from @logtape/logtape directly as well.)
 * This is functionally identical to getLogger from @logtape/logtape, but sets a few Sofie-specific restrictions in typings.
 */
export function getLogger(category?: Parameters<typeof LogTape.getLogger>[0]): SofieLogger {
	const logger = LogTape.getLogger(category)

	for (const methodName of ['info'] as const) {
		const orgMethod = logger[methodName] as any

		;(logger as any)[methodName] = (...args: any[]) => {
			let context: SofieLoggerContext | undefined = undefined
			if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0])) context = args[0]
			else if (args.length == 2 && typeof args[1] === 'object' && !Array.isArray(args[1])) context = args[1]

			if (context) {
				const newContext: Record<string, any> = context

				if (context.data && typeof context.data !== 'object') {
					// Stringify JSON-object, to avoid logging ANY type of data.
					// This is done to avoid issues with elasticsearch and other log collectors indexing arbitrary properties.
					try {
						newContext.data = JSON.stringify(context.data)
					} catch (e) {
						newContext.data = `<<Unserializable data: ${e}>>`
					}
				}
				return orgMethod.apply(logger, args)
			} else {
				return orgMethod.apply(logger, args)
			}
		}
	}

	return logger as unknown as SofieLogger
}

/**
 * Functionally identical to getLogger from @logtape/logtape, but sets a few Sofie-specific restrictions in typings.
 */
export interface SofieLogger
	extends Omit<
		LogTape.Logger,
		'getChild' | 'with' | 'trace' | 'debug' | 'info' | 'warn' | 'warning' | 'error' | 'fatal'
	> {
	/** Get a child logger with the given subcategory. */
	getChild: (...args: Parameters<LogTape.Logger['getChild']>) => SofieLogger

	/**
	 * Get a logger with contextual properties.  This is useful for
	 * log multiple messages with the shared set of properties.
	 */
	with(context: SofieLoggerContext): SofieLogger

	trace(message: string, context?: SofieLoggerContext): void
	trace(context: SofieLoggerContext): void
	trace(message: TemplateStringsArray, ...values: readonly unknown[]): void
	trace(callback: LogCallback): void

	debug(message: string, context?: SofieLoggerContext): void
	debug(context: SofieLoggerContext): void
	debug(message: TemplateStringsArray, ...values: readonly unknown[]): void
	debug(callback: LogCallback): void

	info(message: string, context?: SofieLoggerContext): void
	info(context: SofieLoggerContext): void
	info(message: TemplateStringsArray, ...values: readonly unknown[]): void
	info(callback: LogCallback): void

	warn(message: string, context?: SofieLoggerContext): void
	warn(context: SofieLoggerContext): void
	warn(message: TemplateStringsArray, ...values: readonly unknown[]): void
	warn(callback: LogCallback): void

	warning(message: string, context?: SofieLoggerContext): void
	warning(context: SofieLoggerContext): void
	warning(message: TemplateStringsArray, ...values: readonly unknown[]): void
	warning(callback: LogCallback): void

	error(message: string, context?: SofieLoggerContext): void
	error(context: SofieLoggerContext): void
	error(message: TemplateStringsArray, ...values: readonly unknown[]): void
	error(callback: LogCallback): void

	fatal(message: string, context?: SofieLoggerContext): void
	fatal(context: SofieLoggerContext): void
	fatal(message: TemplateStringsArray, ...values: readonly unknown[]): void
	fatal(callback: LogCallback): void
}

export type Config<TSinkId extends string, TFilterId extends string> = LogTape.Config<TSinkId, TFilterId>

/**
 * A Sofie-recommended logger context.
 * Note: If you need to add more properties, you can use module augmentation to extend this interface:
 *
 * @example
 * declare module 'sofie-logging' {
 *  interface SofieLoggerContext {
 *   myData?: string
 *  }
 * }
 */
export interface SofieLoggerContext {
	/**
	 * Log any arbitrary, JSON-stringifyable data.
	 */
	data?: JSONAbleDataTypes
}
type JSONAbleDataTypes = Record<string, unknown> | string | number | boolean | null | JSONAbleDataTypes[]

// This is a modified copy of LogTape.LogCallback:
type LogCallback = (prefix: LogTemplatePrefix) => string
// This is a modified copy of LogTape.LogTemplatePrefix:
type LogTemplatePrefix = (message: TemplateStringsArray, ...values: unknown[]) => unknown[]
