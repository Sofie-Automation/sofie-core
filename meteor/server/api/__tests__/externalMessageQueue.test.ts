import '../../../__mocks__/_extendJest'
import { ExternalMessageQueueObj } from '@sofie-automation/corelib/dist/dataModel/ExternalMessageQueue'
import { ExternalMessageQueue, RundownPlaylists, Rundowns } from '../../collections'
import { IBlueprintExternalMessageQueueType, PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { DefaultEnvironment, setupDefaultStudioEnvironment } from '../../../__mocks__/helpers/database'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getCurrentTime } from '../../lib/lib'
import { MeteorCall } from '../methods'

import '../ExternalMessageQueue'
import { SupressLogMessages } from '../../../__mocks__/suppressLogging'

describe('Test external message queue static methods', () => {
	let studioEnv: DefaultEnvironment
	beforeAll(async () => {
		studioEnv = await setupDefaultStudioEnvironment()
		const now = getCurrentTime()
		await RundownPlaylists.mutableCollection.insertAsync({
			_id: protectString('playlist_1'),
			externalId: 'mock_rpl',
			name: 'Mock',
			studioId: protectString(''),
			created: 0,
			modified: 0,
			currentPartInfo: {
				partInstanceId: protectString('part_now'),
				rundownId: protectString('rundown_1'),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			},
			nextPartInfo: {
				partInstanceId: protectString('partNext'),
				rundownId: protectString('rundown_1'),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			},
			previousPartInfo: null,
			activationId: protectString('active'),
			timing: {
				type: PlaylistTimingType.None,
			},
			rundownIdsInOrder: [protectString('rundown_1')],
			tTimers: [] as any,
		})
		await Rundowns.mutableCollection.insertAsync({
			_id: protectString('rundown_1'),
			name: 'Mockito 1',
			externalId: 'mockito',
			playlistId: protectString('playlist_1'),

			studioId: studioEnv.studio._id,
			showStyleVariantId: studioEnv.showStyleVariant._id,
			showStyleBaseId: studioEnv.showStyleBase._id,
			created: now,
			modified: now,
			importVersions: {
				studio: 'wibble',
				showStyleBase: 'wobble',
				showStyleVariant: 'jelly',
				blueprint: 'on',
				core: 'plate',
			},
			source: {
				type: 'nrcs',
				peripheralDeviceId: studioEnv.ingestDevice._id,
				nrcsName: 'mockNRCS',
			},
			timing: {
				type: PlaylistTimingType.None,
			},
		})
		// rundown = Rundowns.findOne() as Rundown

		await ExternalMessageQueue.insertAsync({
			_id: getRandomId(),
			studioId: studioEnv.studio._id,
			expires: now + 3600,
			created: now,
			tryCount: 0,
			type: IBlueprintExternalMessageQueueType.SLACK,
			receiver: 'some receiver',
			message: 'some message',
		})
	})

	test('toggleHold', async () => {
		let message = (await ExternalMessageQueue.findOneAsync({})) as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.hold).toBeUndefined()

		await MeteorCall.externalMessages.toggleHold(message._id)
		message = (await ExternalMessageQueue.findOneAsync({})) as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.hold).toBe(true)

		await MeteorCall.externalMessages.toggleHold(message._id)
		message = (await ExternalMessageQueue.findOneAsync({})) as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message.hold).toBe(false)
	})

	test('toggleHold unknown id', async () => {
		SupressLogMessages.suppressLogMessage(/ExternalMessage/i)
		await expect(MeteorCall.externalMessages.toggleHold(protectString('cake'))).rejects.toThrowMeteor(
			404,
			'ExternalMessage "cake" not found!'
		)
	})

	test('retry', async () => {
		let message = (await ExternalMessageQueue.findOneAsync({})) as ExternalMessageQueueObj
		expect(message).toBeTruthy()

		await MeteorCall.externalMessages.retry(message._id)

		message = (await ExternalMessageQueue.findOneAsync({})) as ExternalMessageQueueObj
		expect(message).toBeTruthy()
		expect(message).toMatchObject({
			hold: false,
			manualRetry: true,
			errorFatal: false,
		})
	})

	test('retry unknown id', async () => {
		SupressLogMessages.suppressLogMessage(/ExternalMessage/i)
		await expect(MeteorCall.externalMessages.retry(protectString('is_a_lie'))).rejects.toThrowMeteor(
			404,
			'ExternalMessage "is_a_lie" not found!'
		)
	})

	test('remove', async () => {
		const message = (await ExternalMessageQueue.findOneAsync({})) as ExternalMessageQueueObj
		expect(message).toBeTruthy()

		await MeteorCall.externalMessages.remove(message._id)

		expect(await ExternalMessageQueue.findOneAsync({})).toBeFalsy()
	})
})
