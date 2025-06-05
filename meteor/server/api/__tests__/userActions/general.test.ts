import '../../../../__mocks__/_extendJest'
import { setupDefaultStudioEnvironment } from '../../../../__mocks__/helpers/database'
import { hashSingleUseToken } from '../../deviceTriggers/triggersContext'
import { getCurrentTime, sleep } from '../../../lib/lib'
import { MeteorCall } from '../../methods'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { UserActionsLog } from '../../../collections'

require('../../system') // include so that we can call generateSingleUseToken()
require('../../client') // include in order to create the Meteor methods needed
require('../../userActions') // include in order to create the Meteor methods needed

describe('User Actions - General', () => {
	beforeEach(async () => {
		await UserActionsLog.removeAsync({})

		await setupDefaultStudioEnvironment()
	})

	test('Restart Core', async () => {
		jest.useFakeTimers()

		// Generate restart token
		const res = (await MeteorCall.system.generateSingleUseToken()) as ClientAPI.ClientResponseSuccess<string>
		expect(res).toMatchObject({ success: 200 })
		expect(typeof res.result).toBe('string')

		const mockExit = jest.spyOn(process, 'exit').mockImplementation()

		// Use an invalid token to try and restart it
		await expect(
			MeteorCall.userAction.restartCore('e', getCurrentTime(), 'invalidToken')
		).resolves.toMatchUserRawError(/Restart token is invalid/)

		if (!res.result) throw new Error('Token must not be falsy!')

		await expect(
			MeteorCall.userAction.restartCore('e', getCurrentTime(), hashSingleUseToken(res.result))
		).resolves.toMatchObject({
			success: 200,
		})

		jest.runAllTimers()

		expect(mockExit).toHaveBeenCalledTimes(1)
		jest.useRealTimers()
	})

	test('GUI Status', async () => {
		await expect(MeteorCall.userAction.guiFocused('click', getCurrentTime())).resolves.toMatchObject({
			success: 200,
		})
		await sleep(0)
		const logs0 = await UserActionsLog.findFetchAsync({
			method: 'guiFocused',
		})
		expect(logs0).toHaveLength(1)
		// expect(logs0[0]).toMatchObject({
		// 	context: 'mousedown',
		// 	args: JSON.stringify([ [ 'dummyClientData' ] ])
		// })
		await expect(MeteorCall.userAction.guiBlurred('click', getCurrentTime())).resolves.toMatchObject({
			success: 200,
		})
		await sleep(0)
		const logs1 = await UserActionsLog.findFetchAsync({
			method: 'guiBlurred',
		})
		expect(logs1).toHaveLength(1)
		// expect(logs1[0]).toMatchObject({
		// 	context: 'interval',
		// 	args: JSON.stringify([ [ 'dummyClientData' ] ])
		// })
	})
})
