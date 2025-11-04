import '../../../__mocks__/_extendJest'
import { setupDefaultStudioEnvironment, DefaultEnvironment } from '../../../__mocks__/helpers/database'
import { literal, getRandomString } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	RundownLayoutType,
	RundownLayout,
	CustomizableRegions,
} from '@sofie-automation/meteor-lib/dist/collections/RundownLayouts'
import { MeteorCall } from '../methods'
import { RundownLayoutId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownLayouts } from '../../collections'
import { SupressLogMessages } from '../../../__mocks__/suppressLogging'
import { shelfLayoutsRouter } from '../rundownLayouts'
import { callKoaRoute } from '../../../__mocks__/koa-util'

describe('Rundown Layouts', () => {
	let env: DefaultEnvironment
	beforeAll(async () => {
		env = await setupDefaultStudioEnvironment()
	})
	let rundownLayoutId: RundownLayoutId
	test('Create rundown layout', async () => {
		const res = await MeteorCall.rundownLayout.createRundownLayout(
			'Test',
			RundownLayoutType.RUNDOWN_LAYOUT,
			env.showStyleBaseId,
			'shelf_layouts'
		)
		expect(typeof res).toBe('string') // this should contain the ID for the rundown layout
		rundownLayoutId = res

		const item = await RundownLayouts.findOneAsync(rundownLayoutId)
		expect(item).toMatchObject({
			_id: rundownLayoutId,
		})
	})
	test('Remove rundown layout', async () => {
		const item0 = await RundownLayouts.findOneAsync(rundownLayoutId)
		expect(item0).toMatchObject({
			_id: rundownLayoutId,
		})

		await MeteorCall.rundownLayout.removeRundownLayout(rundownLayoutId)

		const item1 = await RundownLayouts.findOneAsync(rundownLayoutId)
		expect(item1).toBeUndefined()
	})

	describe('HTTP API', () => {
		function makeMockLayout(env: DefaultEnvironment) {
			const rundownLayoutId = getRandomString()
			const mockLayout = literal<RundownLayout>({
				_id: protectString(rundownLayoutId),
				name: 'MOCK LAYOUT',
				filters: [],
				showStyleBaseId: env.showStyleBaseId,
				type: RundownLayoutType.RUNDOWN_LAYOUT,
				exposeAsStandalone: false,
				icon: '',
				iconColor: '',
				showInspector: true,
				openByDefault: false,
				disableContextMenu: true,
				hideDefaultStartExecute: false,
				regionId: CustomizableRegions.Shelf,
				isDefaultLayout: false,
			})
			return { rundownLayout: mockLayout, rundownLayoutId }
		}

		test('download shelf layout', async () => {
			const { rundownLayout: mockLayout, rundownLayoutId } = makeMockLayout(env)
			await RundownLayouts.insertAsync(mockLayout)

			{
				const fakeId = 'FAKE_ID'
				const ctx = await callKoaRoute(shelfLayoutsRouter, {
					method: 'GET',
					url: `/download/${fakeId}`,
				})

				expect(ctx.response.status).toBe(404)
				expect(ctx.body).toContain('not found')
			}

			{
				const ctx = await callKoaRoute(shelfLayoutsRouter, {
					method: 'GET',
					url: `/download/${rundownLayoutId}`,
				})

				expect(ctx.response.status).toBe(200)
				expect(ctx.response.type).toBe('application/json')

				const layout = JSON.parse(ctx.body as string)
				expect(layout).toMatchObject(mockLayout)
			}
		})

		test('upload shelf layout', async () => {
			const { rundownLayout: mockLayout } = makeMockLayout(env)

			{
				// try to upload to a non-existent showStyleBase
				SupressLogMessages.suppressLogMessage(/"FAKE_ID" not found/i)
				const fakeId = 'FAKE_ID'
				const ctx = await callKoaRoute(shelfLayoutsRouter, {
					method: 'POST',
					url: `/upload/${fakeId}`,
					headers: {
						'content-type': 'application/json',
					},
					requestBody: JSON.stringify(mockLayout),
				})

				expect(ctx.response.status).toBe(500)
				expect(ctx.body).toContain('not found')
			}

			{
				// try not to send a request body
				SupressLogMessages.suppressLogMessage(/Missing request body/i)
				const ctx = await callKoaRoute(shelfLayoutsRouter, {
					method: 'POST',
					url: `/upload/${env.showStyleBaseId}`,
					headers: {
						'content-type': 'application/json',
					},
					requestBody: null,
				})

				expect(ctx.response.status).toBe(500)
				expect(ctx.body).toContain('body')
			}

			{
				// try to send too short a body
				SupressLogMessages.suppressLogMessage(/Invalid request body/i)
				const ctx = await callKoaRoute(shelfLayoutsRouter, {
					method: 'POST',
					url: `/upload/${env.showStyleBaseId}`,
					headers: {
						'content-type': 'application/json',
					},
					requestBody: 'sdf',
				})

				expect(ctx.response.status).toBe(500)
				expect(ctx.body).toContain('body')
			}

			{
				const ctx = await callKoaRoute(shelfLayoutsRouter, {
					method: 'POST',
					url: `/upload/${env.showStyleBaseId}`,
					headers: {
						'content-type': 'application/json',
					},
					requestBody: mockLayout,
				})

				expect(ctx.response.status).toBe(200)
				expect(ctx.body).toBe('')

				expect(await RundownLayouts.findOneAsync(mockLayout._id)).toBeTruthy()
			}
		})
	})
})
