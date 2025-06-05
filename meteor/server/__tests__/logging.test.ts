import { supressLogging } from '../../__mocks__/helpers/lib'
import { SupressLogMessages } from '../../__mocks__/suppressLogging'
import { logger } from '../logging'

describe('server/logger', () => {
	test('supress errors', async () => {
		const logMessages = () => {
			logger.debug('This is a debug message')
			logger.info('This is an info message')
			logger.warn('This is a warn message')
			logger.error('This is an error message')
		}
		// These should suppress all messages from being logged:
		await supressLogging(logMessages)

		SupressLogMessages.suppressLogMessage(/This is an error message/i)
		// These should suppress all but errors:
		await supressLogging(logMessages, true)
		expect(1).toBe(1)
	})

	test('logger', () => {
		expect(typeof logger.error).toEqual('function')
		expect(typeof logger.warn).toEqual('function')
		// expect(typeof logger.help).toEqual('function')
		expect(typeof logger.info).toEqual('function')
		expect(typeof logger.debug).toEqual('function')
	})
})
