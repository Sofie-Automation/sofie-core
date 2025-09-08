import {
	Configuration,
	GetShowStyleConfig200ResponseResult,
	ShowStyleBase,
	ShowstylesApi,
	ShowStyleVariant,
} from '../../client/ts/index.js'
import { checkServer } from '../checkServer.js'
import Logging from '../httpLogging.js'

const httpLogging = false

describe('Network client', () => {
	const config = new Configuration({
		basePath: process.env.SERVER_URL,
		middleware: [new Logging(httpLogging)],
	})

	beforeAll(async () => await checkServer(config))

	const showStylesApi = new ShowstylesApi(config)
	const showStyleBaseIds: string[] = []
	test('can request all ShowStyleBases', async () => {
		const showStyles = await showStylesApi.getShowStyleBases()
		expect(showStyles.status).toBe(200)
		expect(showStyles).toHaveProperty('result')
		expect(showStyles.result.length).toBeGreaterThanOrEqual(1)
		showStyles.result.forEach((showStyleBase) => {
			expect(typeof showStyleBase).toBe('object')
			expect(typeof showStyleBase.id).toBe('string')
			showStyleBaseIds.push(showStyleBase.id)
		})
	})

	let newShowStyleBase: ShowStyleBase | undefined
	test('can request a ShowStyleBase by id', async () => {
		const showStyle = await showStylesApi.showStyleBase({
			showStyleBaseId: showStyleBaseIds[0],
		})
		expect(showStyle.status).toBe(200)
		expect(showStyle).toHaveProperty('result')
		expect(showStyle.result).toHaveProperty('name')
		expect(showStyle.result).toHaveProperty('blueprintId')
		expect(showStyle.result).toHaveProperty('blueprintConfigPresetId')
		expect(showStyle.result).toHaveProperty('outputLayers')
		expect(showStyle.result).toHaveProperty('sourceLayers')
		expect(showStyle.result).toHaveProperty('config')
		newShowStyleBase = JSON.parse(JSON.stringify(showStyle.result))
	})

	test('can update a ShowStyleBase', async () => {
		newShowStyleBase.config.developerMode = !newShowStyleBase.config.developerMode
		newShowStyleBase.outputLayers[0].rank = 1 - newShowStyleBase.outputLayers[0].rank
		newShowStyleBase.sourceLayers[0].rank = 1 - newShowStyleBase.sourceLayers[0].rank
		const showStyle = await showStylesApi.addOrUpdateShowStyleBase({
			showStyleBaseId: showStyleBaseIds[0],
			showStyleBase: newShowStyleBase,
		})
		expect(showStyle.status).toBe(200)
	})

	let testShowStyleBaseId: string | undefined
	test('can add a ShowStyleBase', async () => {
		newShowStyleBase.name = newShowStyleBase.name + 'Added'
		const showStyle = await showStylesApi.addShowStyleBase({
			showStyleBase: newShowStyleBase,
		})
		expect(showStyle.status).toBe(200)
		expect(typeof showStyle.result).toBe('string')
		testShowStyleBaseId = showStyle.result
	})

	test('can remove a ShowStyleBase', async () => {
		const showStyle = await showStylesApi.deleteShowStyleBase({
			showStyleBaseId: testShowStyleBaseId,
		})
		expect(showStyle.status).toBe(200)
	})

	let showStyleConfig: GetShowStyleConfig200ResponseResult | undefined
	test('can request a ShowStyle config by id', async () => {
		const showStyle = await showStylesApi.getShowStyleConfig({
			showStyleBaseId: showStyleBaseIds[0],
		})
		expect(showStyle.status).toBe(200)
		expect(showStyle).toHaveProperty('result')
		expect(showStyle.result).toHaveProperty('developerMode')
		showStyleConfig = JSON.parse(JSON.stringify(showStyle.result))
	})

	test('can update a ShowStyle config', async () => {
		showStyleConfig.developerMode = !showStyleConfig.developerMode
		const showStyle = await showStylesApi.updateShowStyleConfig({
			showStyleBaseId: showStyleBaseIds[0],
			requestBody: showStyleConfig,
		})
		expect(showStyle.status).toBe(200)
	})

	const showStyleVariantIds: string[] = []
	test('can request all ShowStyleVariants', async () => {
		const showStyleVariants = await showStylesApi.getShowStyleVariants({
			showStyleBaseId: showStyleBaseIds[0],
		})
		expect(showStyleVariants.status).toBe(200)
		expect(showStyleVariants).toHaveProperty('result')
		expect(showStyleVariants.result.length).toBeGreaterThanOrEqual(1)
		showStyleVariants.result.forEach((showStyleVariant) => {
			expect(typeof showStyleVariant).toBe('object')
			expect(typeof showStyleVariant.id).toBe('string')
			showStyleVariantIds.push(showStyleVariant.id)
		})
	})

	let newShowStyleVariant: ShowStyleVariant | undefined
	test('can request a ShowStyleVariant by id', async () => {
		const showStyleVariant = await showStylesApi.showStyleVariant({
			showStyleBaseId: showStyleBaseIds[0],
			showStyleVariantId: showStyleVariantIds[0],
		})
		expect(showStyleVariant.status).toBe(200)
		expect(showStyleVariant).toHaveProperty('result')
		expect(showStyleVariant.result).toHaveProperty('name')
		expect(showStyleVariant.result).toHaveProperty('rank')
		expect(showStyleVariant.result).toHaveProperty('showStyleBaseId')
		expect(showStyleVariant.result).toHaveProperty('config')
		newShowStyleVariant = JSON.parse(JSON.stringify(showStyleVariant.result))
	})

	let testShowStyleVariantId: string | undefined
	test('can add a ShowStyleVariant', async () => {
		newShowStyleVariant.name = newShowStyleVariant.name + 'Added'
		const showStyleVariant = await showStylesApi.addShowStyleVariant({
			showStyleBaseId: showStyleBaseIds[0],
			showStyleVariant: newShowStyleVariant,
		})
		expect(showStyleVariant.status).toBe(200)
		expect(typeof showStyleVariant.result).toBe('string')
		testShowStyleVariantId = showStyleVariant.result
	})

	test('can update a ShowStyleVariant', async () => {
		newShowStyleVariant.config.developerMode = !newShowStyleVariant.config.developerMode
		const showStyleVariant = await showStylesApi.addOrUpdateShowStyleVariant({
			showStyleBaseId: showStyleBaseIds[0],
			showStyleVariantId: testShowStyleVariantId,
			showStyleVariant: newShowStyleVariant,
		})
		expect(showStyleVariant.status).toBe(200)
	})

	test('can remove a ShowStyleVariant', async () => {
		const showStyle = await showStylesApi.deleteShowStyleVariant({
			showStyleBaseId: showStyleBaseIds[0],
			showStyleVariantId: testShowStyleVariantId,
		})
		expect(showStyle.status).toBe(200)
	})
})
