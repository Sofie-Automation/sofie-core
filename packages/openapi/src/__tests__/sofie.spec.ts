import { Configuration, SofieApi } from '../../client/ts/index.js'
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

	const sofieApi = new SofieApi(config)
	test('can request current version of Sofie application', async () => {
		const sofieVersion = await sofieApi.index()
		expect(sofieVersion.status).toBe(200)
		expect(sofieVersion.result.version).toMatch(/^(\d+\.)?(\d+\.)?(\d+)/)
	})

	test('fails to assign a system blueprint with null id', async () => {
		await expect(sofieApi.assignSystemBlueprint({ assignSystemBlueprintRequest: null })).rejects.toThrow()
	})

	if (testServer) {
		test('can assign a system blueprint for Sofie Core', async () => {
			const sofieVersion = await sofieApi.assignSystemBlueprint({
				assignSystemBlueprintRequest: { blueprintId: 'systemBlueprint' },
			})
			expect(sofieVersion.status).toBe(200)
		})

		test('can unassign a system blueprint for Sofie Core', async () => {
			const sofieVersion = await sofieApi.unassignSystemBlueprint()
			expect(sofieVersion.status).toBe(200)
		})
	} else {
		test.todo('assign/unassign system blueprint - need a test system blueprint')
	}
})
