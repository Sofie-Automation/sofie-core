import _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { SupressLogMessages } from '../../../../__mocks__/suppressLogging'
import { callKoaRoute } from '../../../../__mocks__/koa-util'
import { blueprintsRouter } from '../http'

jest.mock('../../deviceTriggers/observer')
import * as api from '../api'
jest.mock('../api.ts')

const DEFAULT_CONTEXT = expect.objectContaining({ req: expect.any(Object), res: expect.any(Object) })

require('../http.ts') // include in order to create the Meteor methods needed

describe('Test blueprint http api', () => {
	describe('router restore single', () => {
		async function callRoute(blueprintId: string, body: any, name?: string, force?: boolean) {
			const queryParams = _.compact([name ? `name=${name}` : undefined, force ? 'force=1' : undefined])

			const ctx = await callKoaRoute(blueprintsRouter, {
				method: 'POST',
				url: `/restore/${blueprintId}?${queryParams.join('&')}`,

				requestBody: body,
			})

			expect(ctx.response.type).toBe('text/plain')
			return ctx
		}

		function resetUploadMock() {
			const uploadBlueprint = api.uploadBlueprint as any as jest.MockInstance<any, any>
			uploadBlueprint.mockClear()
			return uploadBlueprint
		}

		beforeEach(() => {
			resetUploadMock()
		})

		test('missing body', async () => {
			SupressLogMessages.suppressLogMessage(/Invalid request body/i)
			const res = await callRoute('id1', undefined)
			expect(res.response.status).toEqual(500)
			expect(res.body).toEqual('[400] Restore Blueprint: Invalid request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		test('empty body', async () => {
			SupressLogMessages.suppressLogMessage(/Invalid request body/i)
			const res = await callRoute('id1', '')
			expect(res.response.status).toEqual(500)
			expect(res.body).toEqual('[400] Restore Blueprint: Invalid request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		test('non-string body', async () => {
			const id = 'id1'
			const body = 99

			SupressLogMessages.suppressLogMessage(/Invalid request body/i)
			const res = await callRoute(id, body)
			expect(res.response.status).toEqual(500)
			expect(res.body).toEqual('[400] Restore Blueprint: Invalid request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		test('with body', async () => {
			const id = 'id1'
			const body = '0123456789'

			const res = await callRoute(id, body)
			expect(res.response.status).toEqual(200)
			expect(res.body).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, undefined, false)
		})
		test('with body & force', async () => {
			const id = 'id1'
			const body = '0123456789'

			const res = await callRoute(id, body, undefined, true)
			expect(res.response.status).toEqual(200)
			expect(res.body).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, undefined, true)
		})
		test('internal error', async () => {
			const id = 'id1'
			const body = '0123456789'

			const uploadBlueprint = resetUploadMock()
			uploadBlueprint.mockImplementation(() => {
				throw new Meteor.Error(505, 'Some thrown error')
			})

			try {
				SupressLogMessages.suppressLogMessage(/Some thrown error/i)
				const res = await callRoute(id, body)

				expect(res.response.status).toEqual(500)
				expect(res.body).toEqual('[505] Some thrown error')

				expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
				expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, undefined, false)
			} finally {
				uploadBlueprint.mockRestore()
			}
		})
		test('with name', async () => {
			const id = 'id1'
			const body = '0123456789'
			const name = 'custom_name'

			const res = await callRoute(id, body, name)
			// expect(res.response.status).toEqual(200)
			expect(res.body).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, name, false)
		})
	})

	describe('router restore bulk', () => {
		async function callRoute(body: any) {
			const ctx = await callKoaRoute(blueprintsRouter, {
				method: 'POST',
				url: `/restore?force=1`,

				requestBody: body,
			})

			expect(ctx.response.type).toBe('text/plain')
			return ctx
		}

		function resetUploadMock() {
			const uploadBlueprint = api.uploadBlueprint as any as jest.MockInstance<any, any>
			uploadBlueprint.mockClear()
			return uploadBlueprint
		}

		beforeEach(() => {
			resetUploadMock()
		})

		test('missing body', async () => {
			SupressLogMessages.suppressLogMessage(/Invalid request body/i)
			const res = await callRoute(undefined)
			expect(res.response.status).toEqual(500)
			expect(res.body).toEqual('[400] Restore Blueprint: Invalid request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		test('empty body', async () => {
			SupressLogMessages.suppressLogMessage(/Missing request body/i)
			const res = await callRoute('')
			expect(res.response.status).toEqual(500)
			expect(res.body).toEqual('[400] Restore Blueprint: Missing request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		test('non-string body', async () => {
			const body = 99

			SupressLogMessages.suppressLogMessage(/Invalid request body/i)
			const res = await callRoute(body)
			expect(res.response.status).toEqual(500)
			expect(res.body).toEqual('[400] Restore Blueprint: Invalid request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		test('invalid body', async () => {
			const body = '99'

			SupressLogMessages.suppressLogMessage(/Invalid request body/i)
			const res = await callRoute(body)
			expect(res.response.status).toEqual(500)
			expect(res.body).toEqual('[400] Restore Blueprint: Invalid request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		test('non-json body', async () => {
			const body = '0123456789012'

			SupressLogMessages.suppressLogMessage(/Invalid request body/i)
			const res = await callRoute(body)
			expect(res.response.status).toEqual(500)
			expect(res.body).toEqual('[400] Restore Blueprint: Invalid request body')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(0)
		})
		test('with json body', async () => {
			const id = 'id1'
			const body = 'bodyStr1'

			const payload: any = {
				blueprints: {
					[id]: body,
				},
			}

			const res = await callRoute(payload)
			expect(res.response.status).toEqual(200)
			expect(res.body).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, id)
		})
		test('with json body as object', async () => {
			const id = 'id1'
			const body = { val: 'bodyStr1' }

			const payload: any = {
				blueprints: {
					[id]: body,
				},
			}

			const res = await callRoute(payload)
			expect(res.response.status).toEqual(200)
			expect(res.body).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, id)
		})
		test('with json body - multiple', async () => {
			const count = 10

			const payload: any = {
				blueprints: {},
			}
			for (let i = 0; i < count; i++) {
				payload.blueprints[`id${i}`] = `body${i}`
			}

			const res = await callRoute(payload)
			expect(res.response.status).toEqual(200)
			expect(res.body).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(count)
			for (let i = 0; i < count; i++) {
				expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, `id${i}`, `body${i}`, `id${i}`)
			}
		})
		test('with errors', async () => {
			const count = 10

			const payload: any = {
				blueprints: {},
			}
			for (let i = 0; i < count; i++) {
				payload.blueprints[`id${i}`] = `body${i}`
			}

			const uploadBlueprint = resetUploadMock()
			let called = 0
			uploadBlueprint.mockImplementation(() => {
				called++
				if (called === 3 || called === 7) {
					throw new Meteor.Error(505, 'Some thrown error')
				}
			})

			try {
				SupressLogMessages.suppressLogMessage(/Some thrown error/i)
				SupressLogMessages.suppressLogMessage(/Some thrown error/i)
				const res = await callRoute(payload)
				expect(res.response.status).toEqual(500)
				expect(res.body).toEqual(
					'Errors were encountered: \n[505] Some thrown error\n[505] Some thrown error\n'
				)

				expect(api.uploadBlueprint).toHaveBeenCalledTimes(count)
				for (let i = 0; i < count; i++) {
					expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, `id${i}`, `body${i}`, `id${i}`)
				}
			} finally {
				uploadBlueprint.mockRestore()
			}
		})
	})
})
