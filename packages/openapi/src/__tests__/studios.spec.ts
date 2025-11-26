import { Configuration, GetStudioConfig200ResponseResult, Studio, StudiosApi } from '../../client/ts/index.js'
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

	const studiosApi = new StudiosApi(config)
	const studioIds: string[] = []
	test('can request all Studios', async () => {
		const studios = await studiosApi.getStudios()
		expect(studios.status).toBe(200)
		expect(studios).toHaveProperty('result')
		expect(studios.result.length).toBeGreaterThanOrEqual(1)
		studios.result.forEach((studio) => {
			expect(typeof studio).toBe('object')
			expect(typeof studio.id).toBe('string')
			studioIds.push(studio.id)
		})
	})

	let newStudio: Studio | undefined
	test('can request a Studio by id', async () => {
		const studio = await studiosApi.getStudio({
			studioId: studioIds[0],
		})
		expect(studio.status).toBe(200)
		expect(studio).toHaveProperty('result')
		expect(studio.result).toHaveProperty('name')
		expect(studio.result).toHaveProperty('blueprintId')
		expect(studio.result).toHaveProperty('blueprintConfigPresetId')
		expect(studio.result).toHaveProperty('supportedShowStyleBase')
		expect(studio.result).toHaveProperty('config')
		expect(studio.result).toHaveProperty('settings')
		expect(studio.result.settings).toHaveProperty('frameRate')
		expect(studio.result.settings).toHaveProperty('mediaPreviewsUrl')
		newStudio = JSON.parse(JSON.stringify(studio.result))
	})

	test('can update a studio', async () => {
		newStudio.config.developerMode = !newStudio.config.developerMode
		const studio = await studiosApi.addOrUpdateStudio({
			studioId: studioIds[0],
			studio: newStudio,
		})
		expect(studio.status).toBe(200)
	})

	let studioConfig: GetStudioConfig200ResponseResult | undefined
	test('can request a Studio config by id', async () => {
		const studio = await studiosApi.getStudioConfig({
			studioId: studioIds[0],
		})
		expect(studio.status).toBe(200)
		expect(studio).toHaveProperty('result')
		expect(studio.result).toHaveProperty('developerMode')
		studioConfig = JSON.parse(JSON.stringify(studio.result))
	})

	test('can update a studio config', async () => {
		studioConfig.developerMode = !studioConfig.developerMode
		const studio = await studiosApi.updateStudioConfig({
			studioId: studioIds[0],
			requestBody: studioConfig,
		})
		expect(studio.status).toBe(200)
	})

	const studioDevices: string[] = []
	test('can request a list of devices for a studio', async () => {
		const devices = await studiosApi.devices({ studioId: studioIds[0] })
		expect(devices.status).toBe(200)
		expect(devices).toHaveProperty('result')
		expect(devices.result.length).toBeGreaterThanOrEqual(1)
		devices.result.forEach((id) => {
			expect(typeof id).toBe('object')
			expect(typeof id.id).toBe('string')
			studioDevices.push(id.id)
		})
	})

	test('can detach a device from a studio', async () => {
		const detach = await studiosApi.detachDevice({
			studioId: studioIds[0],
			deviceId: studioDevices[0],
		})
		expect(detach.status).toBe(200)
	})

	test('can attach a device to a studio', async () => {
		const attach = await studiosApi.attachDevice({
			studioId: studioIds[0],
			attachDeviceRequest: {
				deviceId: studioDevices[0],
			},
		})
		expect(attach.status).toBe(200)
	})

	if (testServer) {
		let testStudioId: string | undefined
		test('can add a new Studio', async () => {
			newStudio.name = newStudio.name + 'Added'
			const studio = await studiosApi.addStudio({
				studio: newStudio,
			})
			expect(studio.status).toBe(200)
			expect(studio).toHaveProperty('result')
			expect(typeof studio.result).toBe('string')
			testStudioId = studio.result
		})

		test('can remove a Studio by id', async () => {
			const studio = await studiosApi.deleteStudio({
				studioId: testStudioId,
			})
			expect(studio.status).toBe(200)
		})

		test('can activate a route set in a studio', async () => {
			const routeSet = await studiosApi.switchRouteSet({
				studioId: 'B0avqzSM41UJDpbyf3U28',
				switchRouteSetRequest: { routeSetId: 'Main', active: true },
			})
			expect(routeSet.status).toBe(200)
		})

		test('can deactivate a route set in a studio', async () => {
			const routeSet = await studiosApi.switchRouteSet({
				studioId: 'B0avqzSM41UJDpbyf3U28',
				switchRouteSetRequest: { routeSetId: 'Main', active: false },
			})
			expect(routeSet.status).toBe(200)
		})
	} else {
		test.todo('add/remove studio, activate/deactivate routes in a studio')
	}
})
