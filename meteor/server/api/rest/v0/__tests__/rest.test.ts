import { MeteorMock } from '../../../../../__mocks__/meteor'
import { Meteor } from 'meteor/meteor'
import { UserActionAPIMethods } from '@sofie-automation/meteor-lib/dist/api/userActions'
import { MeteorMethodSignatures } from '../../../../methods'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { callKoaRoute } from '../../../../../__mocks__/koa-util'
import { createLegacyApiRouter } from '..'
import '../../../userActions' // required to get the UserActionsAPI methods populated

// we don't want the deviceTriggers observer to start up at this time
jest.mock('../../../deviceTriggers/observer')

import '../index'

describe('REST API', () => {
	describe('UNSTABLE v0', () => {
		beforeEach(async () => {
			await MeteorMock.mockRunMeteorStartup()
		})

		const legacyApiRouter = createLegacyApiRouter()

		test('calls the UserActionAPI methods, when doing a POST to the endpoint', async () => {
			for (const [methodName, methodValue] of Object.entries<any>(UserActionAPIMethods)) {
				const signature = MeteorMethodSignatures[methodValue]

				let docString = `/action/${methodName}`
				for (const paramName of signature || []) {
					docString += `/${paramName}`
				}

				jest.spyOn(MeteorMock.mockMethods as any, methodValue).mockReturnValue(
					ClientAPI.responseSuccess(undefined)
				)

				const ctx = await callKoaRoute(legacyApiRouter, {
					method: 'POST',
					url: docString,
				})
				expect(ctx.response.status).toBe(200)
				expect(ctx.response.headers).toMatchObject({
					'content-type': 'application/json; charset=utf-8',
				})
				expect(ctx.body).toMatchObject({
					success: 200,
				})
			}
		})

		test('returns a matching HTTP error code when method throws a Meteor.Error', async () => {
			const methodName = Object.keys(UserActionAPIMethods)[0]

			const methodValue: string = (UserActionAPIMethods as any)[methodName]
			const signature = MeteorMethodSignatures[methodValue]

			let docString = `/action/${methodName}`
			for (const paramName of signature || []) {
				docString += `/${paramName}`
			}

			jest.spyOn(MeteorMock.mockMethods as any, methodValue).mockImplementation(() => {
				throw new Meteor.Error(401, 'Mock error')
			})

			const ctx = await callKoaRoute(legacyApiRouter, {
				method: 'POST',
				url: docString,
			})
			expect(ctx.response.status).toBe(401)
			expect(ctx.response.headers).toMatchObject({
				'content-type': 'text/plain; charset=utf-8',
			})
			expect(ctx.body).toMatch('Mock error')
		})

		test('returns a 500 HTTP error code when method throws a Node Exception', async () => {
			const methodName = Object.keys(UserActionAPIMethods)[0]

			const methodValue: string = (UserActionAPIMethods as any)[methodName]
			const signature = MeteorMethodSignatures[methodValue]

			let docString = `/action/${methodName}`
			for (const paramName of signature || []) {
				docString += `/${paramName}`
			}

			jest.spyOn(MeteorMock.mockMethods as any, methodValue).mockImplementation(() => {
				throw new Error('Mock error')
			})

			const ctx = await callKoaRoute(legacyApiRouter, {
				method: 'POST',
				url: docString,
			})
			expect(ctx.response.status).toBe(500)
			expect(ctx.response.headers).toMatchObject({
				'content-type': 'text/plain; charset=utf-8',
			})
			expect(ctx.body).toMatch('Mock error')
		})

		test('converts URL arguments from string to correct native types', async () => {
			const methodName = Object.keys(UserActionAPIMethods)[0]

			const methodValue: string = (UserActionAPIMethods as any)[methodName]
			const signature = MeteorMethodSignatures[methodValue] || []

			const params: any[] = ['one', true, false, { one: 'two' }, null, 1.323, 30]

			let docString = `/action/${methodName}`
			for (let i = 0; i < signature.length; i++) {
				const val = params[i]
				docString += `/${typeof val === 'object' ? JSON.stringify(val) : val}`
			}

			const stringified: Record<string, string> = {}
			Object.entries<any>(params).forEach(([key, value]) => {
				if (typeof value === 'string') {
					stringified[key] = value
				} else {
					stringified[key] = JSON.stringify(value)
				}
			})

			let resultingArgs: any[] = []

			jest.spyOn(MeteorMock.mockMethods as any, methodValue).mockImplementation((...args) => {
				resultingArgs = args
				return ClientAPI.responseSuccess(undefined)
			})

			const ctx = await callKoaRoute(legacyApiRouter, {
				method: 'POST',
				url: docString,
			})
			expect(ctx.response.status).toBe(200)
			expect(resultingArgs).toMatchObject(params.slice(0, signature.length))
		})

		test('lists available endpoints on /api/0', async () => {
			const rootDocString = `/`

			const ctx = await callKoaRoute(legacyApiRouter, {
				method: 'GET',
				url: rootDocString,
			})
			expect(ctx.response.status).toBe(200)
			expect(ctx.response.headers).toMatchObject({
				'content-type': 'application/json; charset=utf-8',
			})

			const index = JSON.parse(ctx.response.body as string)

			for (const [methodName, methodValue] of Object.entries<any>(UserActionAPIMethods)) {
				const signature = MeteorMethodSignatures[methodValue]

				let docString = `/api/0/action/${methodName}`
				for (const paramName of signature || []) {
					docString += `/:${paramName}`
				}

				const found = index.POST.indexOf(docString)
				if (found < 0) {
					console.error(docString, 'not found in REST index')
				}
				expect(found).toBeGreaterThanOrEqual(0)
			}
		})
	})
})
