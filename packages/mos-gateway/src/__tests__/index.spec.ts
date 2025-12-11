import { Connector } from '../connector.js'
import * as Winston from 'winston'

test('Simple test', async () => {
	const logger = Winston.createLogger({
		transports: [new Winston.transports.Console()],
	})
	// @ts-ignore
	logger.info = console.log
	// @ts-ignore
	logger.debug = console.log
	// @ts-ignore
	logger.error = console.log
	// @ts-ignore
	logger.warn = console.log

	const c: Connector = new Connector(logger)

	expect(c).toBeInstanceOf(Connector)
	await c.dispose()
	expect(1).toEqual(1)
})
