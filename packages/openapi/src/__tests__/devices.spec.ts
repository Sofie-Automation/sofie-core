import { Configuration, DevicesApi } from '../../client/ts/index.js'
import { checkServer } from '../checkServer.js'
import Logging from '../httpLogging.js'

const httpLogging = false
let testServer
if (process.env.SERVER_TYPE === 'TEST') {
	testServer = true
}

describe('Network client', () => {
	const config = new Configuration({
		basePath: process.env.SERVER_URL,
		middleware: [new Logging(httpLogging)],
	})

	beforeAll(async () => await checkServer(config))

	const devicesApi = new DevicesApi(config)
	const deviceIds: string[] = []
	test('can request all peripheral devices attached to Sofie', async () => {
		const devices = await devicesApi.devices()
		expect(devices.status).toBe(200)
		expect(devices).toHaveProperty('result')
		devices.result.forEach((device) => {
			expect(typeof device).toBe('object')
			expect(device).toHaveProperty('id')
			expect(typeof device.id).toBe('string')
			deviceIds.push(device.id)
		})
	})

	test('can request details of a specified peripheral device attached to Sofie', async () => {
		const device = await devicesApi.device({ deviceId: deviceIds[0] })
		expect(device.status).toBe(200)
		expect(device).toHaveProperty('result')
		expect(device.result).toHaveProperty('id')
		expect(device.result).toHaveProperty('name')
		expect(device.result).toHaveProperty('status')
		expect(device.result).toHaveProperty('messages')
		expect(device.result).toHaveProperty('deviceType')
		expect(device.result).toHaveProperty('connected')
	})

	if (testServer) {
		test('can send a command to a specified peripheral device', async () => {
			const action = await devicesApi.deviceAction({
				deviceId: deviceIds[0],
				deviceActionRequest: { action: 'restart' },
			})
			expect(action.status).toBe(202)
		})
	} else {
		test.todo(`Add an action that doesn't kill the peripheral device!`)
	}
})
