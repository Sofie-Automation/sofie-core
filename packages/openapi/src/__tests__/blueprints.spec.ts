import { Configuration, BlueprintsApi } from '../../client/ts/index.js'
import { checkServer } from '../checkServer.js'
import Logging from '../httpLogging.js'

const httpLogging = false

describe('Network client', () => {
	const config = new Configuration({
		basePath: process.env.SERVER_URL,
		middleware: [new Logging(httpLogging)],
	})

	beforeAll(async () => await checkServer(config))

	const blueprintsApi = new BlueprintsApi(config)
	const blueprintIds: string[] = []
	test('can request all blueprints available in Sofie', async () => {
		const blueprints = await blueprintsApi.blueprints()
		expect(blueprints.status).toBe(200)
		expect(blueprints).toHaveProperty('result')
		expect(blueprints.result.length).toBeGreaterThanOrEqual(3)
		blueprints.result.forEach((blueprint) => {
			expect(typeof blueprint).toBe('object')
			expect(typeof blueprint.id).toBe('string')
			blueprintIds.push(blueprint.id)
		})
	})

	test('fails to request a blueprint with null id', async () => {
		await expect(blueprintsApi.blueprint({ blueprintId: null })).rejects.toThrow()
	})

	test('can request information about each blueprint', async () => {
		for (const id of blueprintIds) {
			const blueprint = await blueprintsApi.blueprint({ blueprintId: id })
			expect(blueprint.status).toBe(200)
			expect(blueprint).toHaveProperty('result')
			expect(blueprint.result).toHaveProperty('id')
			expect(blueprint.result).toHaveProperty('name')
			expect(blueprint.result).toHaveProperty('blueprintType')
			expect(blueprint.result).toHaveProperty('blueprintVersion')
		}
	})
})
