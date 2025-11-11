/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { overrideLogger } from '../server/logging'

export class SupressLogMessages {
	private static suppressMessages: RegExp[] = []

	static init(): void {
		const suppressMessages = SupressLogMessages.suppressMessages

		overrideLogger((orgLogger) => {
			const makeSuppressableLogger = (orgLogMethod: Function) => {
				return (text: any, ...args: any) => {
					// Check if the log-message is to be suppressed:
					for (let index = 0; index < suppressMessages.length; index++) {
						const suppressMessage = suppressMessages[index]
						if (String(text).match(suppressMessage)) {
							// Remove the suppression, it's only used once:
							suppressMessages.splice(index, 1)
							// suppress it:
							return
						}
					}
					orgLogMethod(text, ...args)
				}
			}

			return {
				...orgLogger,
				silly: makeSuppressableLogger(orgLogger.silly),
				debug: makeSuppressableLogger(orgLogger.debug),
				info: makeSuppressableLogger(orgLogger.info),
				warn: makeSuppressableLogger(orgLogger.warn),
				error: makeSuppressableLogger(orgLogger.error),
			} as any
		})
	}

	static suppressLogMessage(regexp: RegExp): void {
		SupressLogMessages.suppressMessages.push(regexp)
	}
	static expectAllMessagesToHaveBeenHandled(): void {
		const unhandledSuppressMessages = [...SupressLogMessages.suppressMessages]
		SupressLogMessages.suppressMessages.length = 0
		expect(unhandledSuppressMessages).toHaveLength(0)
	}
}
