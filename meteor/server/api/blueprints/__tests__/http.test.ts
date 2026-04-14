import _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { PassThrough } from 'stream'
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
		async function callRoute(
			blueprintId: string,
			body: any,
			name?: string,
			force?: boolean,
			developmentMode?: boolean
		) {
			const queryParams = _.compact([
				name ? `name=${name}` : undefined,
				force ? 'force=1' : undefined,
				developmentMode ? 'developmentMode=1' : undefined,
			])

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
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, {
				blueprintName: undefined,
				ignoreIdChange: false,
				developmentMode: false,
			} satisfies api.UploadBlueprintOptions)
		})
		test('with body & force', async () => {
			const id = 'id1'
			const body = '0123456789'

			const res = await callRoute(id, body, undefined, true)
			expect(res.response.status).toEqual(200)
			expect(res.body).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, {
				blueprintName: undefined,
				ignoreIdChange: true,
				developmentMode: false,
			} satisfies api.UploadBlueprintOptions)
		})
		test('with body & developmentMode', async () => {
			const id = 'id1'
			const body = '0123456789'

			const res = await callRoute(id, body, undefined, false, true)
			expect(res.response.status).toEqual(200)
			expect(res.body).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, {
				blueprintName: undefined,
				ignoreIdChange: false,
				developmentMode: true,
			} satisfies api.UploadBlueprintOptions)
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
				expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, {
					blueprintName: undefined,
					ignoreIdChange: false,
					developmentMode: false,
				} satisfies api.UploadBlueprintOptions)
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
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, {
				blueprintName: name,
				ignoreIdChange: false,
				developmentMode: false,
			} satisfies api.UploadBlueprintOptions)
		})
	})

	describe('router restore bulk', () => {
		async function callRoute(body: any, developmentMode?: boolean) {
			const queryParams = _.compact(['force=1', developmentMode ? 'developmentMode=1' : undefined])

			const ctx = await callKoaRoute(blueprintsRouter, {
				method: 'POST',
				url: `/restore?${queryParams.join('&')}`,

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
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, {
				blueprintName: id,
				developmentMode: false,
			} satisfies api.UploadBlueprintOptions)
		})
		test('with json body & developmentMode', async () => {
			const id = 'id1'
			const body = 'bodyStr1'

			const payload: any = {
				blueprints: {
					[id]: body,
				},
			}

			const res = await callRoute(payload, true)
			expect(res.response.status).toEqual(200)
			expect(res.body).toEqual('')

			expect(api.uploadBlueprint).toHaveBeenCalledTimes(1)
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, {
				blueprintName: id,
				developmentMode: true,
			} satisfies api.UploadBlueprintOptions)
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
			expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, id, body, {
				blueprintName: id,
				developmentMode: false,
			} satisfies api.UploadBlueprintOptions)
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
				expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, `id${i}`, `body${i}`, {
					blueprintName: `id${i}`,
					developmentMode: false,
				} satisfies api.UploadBlueprintOptions)
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
					expect(api.uploadBlueprint).toHaveBeenCalledWith(DEFAULT_CONTEXT, `id${i}`, `body${i}`, {
						blueprintName: `id${i}`,
						developmentMode: false,
					})
				}
			} finally {
				uploadBlueprint.mockRestore()
			}
		})
	})

	describe('router upload assets', () => {
		describe('POST /assets', () => {
			async function callRoute(body: any) {
				const ctx = await callKoaRoute(blueprintsRouter, {
					method: 'POST',
					url: '/assets',

					requestBody: body,
				})

				expect(ctx.response.type).toBe('text/plain')
				return ctx
			}

			function resetUploadAssetMock() {
				const uploadBlueprintAsset = api.uploadBlueprintAsset as any as jest.MockInstance<any, any>
				uploadBlueprintAsset.mockClear()
				return uploadBlueprintAsset
			}

			beforeEach(() => {
				resetUploadAssetMock()
			})

			test('missing body', async () => {
				SupressLogMessages.suppressLogMessage(/Invalid request body/i)
				const res = await callRoute(undefined)
				expect(res.response.status).toEqual(500)

				expect(api.uploadBlueprintAsset).toHaveBeenCalledTimes(0)
			})

			test('empty body', async () => {
				SupressLogMessages.suppressLogMessage(/Missing request body/i)
				const res = await callRoute('')
				expect(res.response.status).toEqual(500)

				expect(api.uploadBlueprintAsset).toHaveBeenCalledTimes(0)
			})

			test('non-object body', async () => {
				SupressLogMessages.suppressLogMessage(/Invalid request body/i)
				const res = await callRoute(99)
				expect(res.response.status).toEqual(500)

				expect(api.uploadBlueprintAsset).toHaveBeenCalledTimes(0)
			})

			test('empty object body', async () => {
				SupressLogMessages.suppressLogMessage(/Invalid request body/i)
				const res = await callRoute({})
				expect(res.response.status).toEqual(500)

				expect(api.uploadBlueprintAsset).toHaveBeenCalledTimes(0)
			})

			test('with json body', async () => {
				const fileId = 'folder/asset.png'
				const payload = {
					[fileId]: 'Ym9keQ==',
				}

				const res = await callRoute(payload)
				expect(res.response.status).toEqual(200)
				expect(res.body).toEqual('')

				expect(api.uploadBlueprintAsset).toHaveBeenCalledTimes(1)
				expect(api.uploadBlueprintAsset).toHaveBeenCalledWith(DEFAULT_CONTEXT, fileId, payload[fileId])
			})

			test('with json body - multiple', async () => {
				const count = 10
				const payload: Record<string, string> = {}
				for (let i = 0; i < count; i++) {
					payload[`id${i}.png`] = `body${i}`
				}

				const res = await callRoute(payload)
				expect(res.response.status).toEqual(200)
				expect(res.body).toEqual('')

				expect(api.uploadBlueprintAsset).toHaveBeenCalledTimes(count)
				for (let i = 0; i < count; i++) {
					expect(api.uploadBlueprintAsset).toHaveBeenCalledWith(DEFAULT_CONTEXT, `id${i}.png`, `body${i}`)
				}
			})

			test('with errors', async () => {
				const count = 10
				const payload: Record<string, string> = {}
				for (let i = 0; i < count; i++) {
					payload[`id${i}.png`] = `body${i}`
				}

				const uploadBlueprintAsset = resetUploadAssetMock()
				let called = 0
				uploadBlueprintAsset.mockImplementation(() => {
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

					expect(api.uploadBlueprintAsset).toHaveBeenCalledTimes(count)
					for (let i = 0; i < count; i++) {
						expect(api.uploadBlueprintAsset).toHaveBeenCalledWith(DEFAULT_CONTEXT, `id${i}.png`, `body${i}`)
					}
				} finally {
					uploadBlueprintAsset.mockRestore()
				}
			})
		})

		describe('GET /assets/*fileId', () => {
			function createDataStream() {
				const stream = new PassThrough()
				stream.end('asset')
				return stream
			}

			async function callRoute(fileId: string) {
				const ctx = await callKoaRoute(blueprintsRouter, {
					method: 'GET',
					url: `/assets/${fileId}`,
				})

				return ctx
			}

			function resetRetrieveAssetMock() {
				const retrieveBlueprintAsset = api.retrieveBlueprintAsset as any as jest.MockInstance<any, any>
				retrieveBlueprintAsset.mockClear()
				return retrieveBlueprintAsset
			}

			beforeEach(() => {
				resetRetrieveAssetMock()
			})

			test('png asset', async () => {
				const fileId = 'folder/file.png'
				const dataStream = createDataStream()

				const retrieveBlueprintAsset = resetRetrieveAssetMock()
				retrieveBlueprintAsset.mockReturnValue(dataStream)

				const res = await callRoute(fileId)

				expect(res.statusCode).toEqual(200)
				expect(res.response.type).toEqual('image/png')
				expect(res.body).toBe(dataStream)
				expect(res.response.get('Cache-Control')).toEqual('public, max-age=1296000, immutable')

				expect(api.retrieveBlueprintAsset).toHaveBeenCalledTimes(1)
				expect(api.retrieveBlueprintAsset).toHaveBeenCalledWith(DEFAULT_CONTEXT, fileId)
			})

			test('svg asset', async () => {
				const fileId = 'folder/file.svg'
				const dataStream = createDataStream()

				const retrieveBlueprintAsset = resetRetrieveAssetMock()
				retrieveBlueprintAsset.mockReturnValue(dataStream)

				const res = await callRoute(fileId)

				expect(res.statusCode).toEqual(200)
				expect(res.response.type).toEqual('image/svg+xml')
				expect(res.body).toBe(dataStream)

				expect(api.retrieveBlueprintAsset).toHaveBeenCalledTimes(1)
				expect(api.retrieveBlueprintAsset).toHaveBeenCalledWith(DEFAULT_CONTEXT, fileId)
			})

			test('gif asset', async () => {
				const fileId = 'folder/file.gif'
				const dataStream = createDataStream()

				const retrieveBlueprintAsset = resetRetrieveAssetMock()
				retrieveBlueprintAsset.mockReturnValue(dataStream)

				const res = await callRoute(fileId)

				expect(res.statusCode).toEqual(200)
				expect(res.response.type).toEqual('image/gif')
				expect(res.body).toBe(dataStream)

				expect(api.retrieveBlueprintAsset).toHaveBeenCalledTimes(1)
				expect(api.retrieveBlueprintAsset).toHaveBeenCalledWith(DEFAULT_CONTEXT, fileId)
			})

			test('not found', async () => {
				const fileId = 'folder/missing.png'

				const retrieveBlueprintAsset = resetRetrieveAssetMock()
				retrieveBlueprintAsset.mockImplementation(() => {
					const err = new Error('No such file') as Error & { code?: string }
					err.code = 'ENOENT'
					throw err
				})

				SupressLogMessages.suppressLogMessage(/Blueprint asset not found/i)
				const res = await callRoute(fileId)
				expect(res.statusCode).toEqual(404)
			})

			test('path traversal attempt', async () => {
				const fileId = 'folder/../escape.png'

				const retrieveBlueprintAsset = resetRetrieveAssetMock()
				retrieveBlueprintAsset.mockImplementation(() => {
					throw new Error('Requested asset outside of asset storage path')
				})

				SupressLogMessages.suppressLogMessage(/Blueprint asset path traversal attempt/i)
				const res = await callRoute(fileId)
				expect(res.statusCode).toEqual(400)
			})

			test('internal error', async () => {
				const fileId = 'folder/file.png'

				const retrieveBlueprintAsset = resetRetrieveAssetMock()
				retrieveBlueprintAsset.mockImplementation(() => {
					throw new Error('Some thrown error')
				})

				SupressLogMessages.suppressLogMessage(/Blueprint asset retrieval failed/i)
				const res = await callRoute(fileId)
				expect(res.statusCode).toEqual(500)
			})
		})
	})
})
