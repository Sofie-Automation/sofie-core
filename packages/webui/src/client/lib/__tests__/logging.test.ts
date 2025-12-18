import { logger } from '../logging.js'

describe('lib/logger', () => {
	test('logger', () => {
		expect(typeof logger.error).toEqual('function')
		expect(typeof logger.warn).toEqual('function')
		// expect(typeof logger.help).toEqual('function')
		expect(typeof logger.info).toEqual('function')
		expect(typeof logger.debug).toEqual('function')
	})
})
