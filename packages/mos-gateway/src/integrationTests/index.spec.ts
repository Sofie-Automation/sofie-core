import { protectString } from '@sofie-automation/server-core-integration'
import { Connector } from '../connector.js'
import * as Winston from 'winston'

test('Simple test', async () => {
	const logger = Winston.createLogger({
		transports: [new Winston.transports.Console()],
	})

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	logger.info = console.log

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	logger.debug = console.log

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	logger.error = console.log

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	logger.warn = console.log

	const c: Connector = new Connector(logger)

	await c.init({
		core: {
			host: '127.0.0.1',
			port: 3000,
			watchdog: false,
		},
		device: {
			deviceId: protectString('JestTest'),
			deviceToken: '1234',
		},
		certificates: {
			unsafeSSL: true,
			certificates: [],
		},
		mos: {
			self: {
				mosID: 'test.tv.automation',
				acceptsConnections: true, // default:true
				// accepsConnectionsFrom: ['127.0.0.1'],
				profiles: {
					'0': true,
					'1': true,
					'2': true,
					'3': false,
					'4': false,
					'5': false,
					'6': false,
					'7': false,
				},
			},
			// devices: []
		},
		health: {
			port: undefined,
		},
	})

	expect(c).toBeInstanceOf(Connector)
	await c.dispose()
	expect(1).toEqual(1)
	// Todo: check that all socket connections have been closed
})
