import '../../../__mocks__/_extendJest'
import { setupDefaultStudioEnvironment, DefaultEnvironment } from '../../../__mocks__/helpers/database'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { MeteorMock } from '../../../__mocks__/meteor'
import { status2ExternalStatus, setSystemStatus } from '../systemStatus'
import { StatusResponse } from '@sofie-automation/meteor-lib/dist/api/systemStatus'
import { StatusCode } from '@sofie-automation/blueprints-integration'
import { MeteorCall } from '../../api/methods'
import { callKoaRoute } from '../../../__mocks__/koa-util'
import { healthRouter } from '../api'
import { UIBlueprintUpgradeStatus } from '@sofie-automation/meteor-lib/dist/api/upgradeStatus'

// we don't want the deviceTriggers observer to start up at this time
jest.mock('../../api/deviceTriggers/observer')

require('../api')
require('../../coreSystem/index')
const PackageInfo = require('../../../package.json')

import * as getServerBlueprintUpgradeStatuses from '../../publications/blueprintUpgradeStatus/systemStatus'
jest.spyOn(getServerBlueprintUpgradeStatuses, 'getServerBlueprintUpgradeStatuses').mockReturnValue(
	Promise.resolve(literal<UIBlueprintUpgradeStatus[]>([]))
)

describe('systemStatus API', () => {
	let env: DefaultEnvironment

	describe('General health endpoint', () => {
		async function callRoute() {
			const ctx = await callKoaRoute(healthRouter, {
				method: 'GET',
				url: '/',
			})

			expect(ctx.response.type).toBe('application/json')
			return ctx
		}

		test('REST /health with state BAD', async () => {
			env = await setupDefaultStudioEnvironment()
			await MeteorMock.mockRunMeteorStartup()
			await MeteorMock.sleepNoFakeTimers(200)

			// The system is uninitialized, the status will be BAD
			const expectedStatus0 = StatusCode.BAD
			const result0: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()
			expect(result0).toMatchObject({
				status: status2ExternalStatus(expectedStatus0),
				_status: expectedStatus0,
			})
			expect(result0.checks && result0.checks.length).toBeGreaterThan(0)

			const response = await callRoute()
			expect(response.response.status).toBe(500)
			const systemHealth = JSON.parse(response.body as any)

			expect(systemHealth).toMatchObject({
				status: status2ExternalStatus(expectedStatus0),
			})
		})
	})

	describe('Specific studio health endpoint', () => {
		async function callRoute(studioId?: string) {
			const ctx = await callKoaRoute(healthRouter, {
				method: 'GET',
				url: `/${studioId}`,
			})

			expect(ctx.response.type).toBe('application/json')
			return ctx
		}

		test('REST /health with state GOOD', async () => {
			env = await setupDefaultStudioEnvironment()
			await MeteorMock.mockRunMeteorStartup()
			await MeteorMock.sleepNoFakeTimers(200)

			// simulate initialized system
			setSystemStatus('systemTime', {
				statusCode: StatusCode.GOOD,
				messages: [`NTP-time accuracy (standard deviation): ${Math.floor(0 * 10) / 10} ms`],
			})
			setSystemStatus('databaseVersion', {
				statusCode: StatusCode.GOOD,
				messages: [`${'databaseVersion'} version: ${PackageInfo.version}`],
			})

			// The system is initialized, the status will be GOOD
			const expectedStatus0 = StatusCode.GOOD
			const result0: StatusResponse = await MeteorCall.systemStatus.getSystemStatus()
			expect(result0).toMatchObject({
				status: status2ExternalStatus(expectedStatus0),
				_status: expectedStatus0,
			})
			expect(result0.checks && result0.checks.length).toBeGreaterThan(0)

			const response = await callRoute(unprotectString(env.studio._id))
			expect(response.response.status).toBe(200)
			const systemHealth = JSON.parse(response.body as any)

			expect(systemHealth).toMatchObject({
				status: status2ExternalStatus(expectedStatus0),
			})
		})
	})
})
