import '../../../__mocks__/_extendJest'
import { Meteor } from 'meteor/meteor'
import {
	PeripheralDevice,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { literal, getRandomId, getRandomString } from '@sofie-automation/corelib/dist/lib'
import { LogLevel } from '@sofie-automation/meteor-lib/dist/lib'
import { protectString, ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { getCurrentTime } from '../../lib/lib'
import { waitUntil } from '../../../__mocks__/helpers/jest'
import { setupDefaultStudioEnvironment, DefaultEnvironment } from '../../../__mocks__/helpers/database'
import { setLogLevel } from '../../logging'
import { IngestDeviceSecretSettings } from '@sofie-automation/corelib/dist/dataModel/PeripheralDeviceSettings/ingestDevice'
import { MediaObject } from '@sofie-automation/shared-lib/dist/core/model/MediaObjects'
import {
	IBlueprintPieceType,
	PieceLifespan,
	PlaylistTimingType,
	StatusCode,
} from '@sofie-automation/blueprints-integration'
import { CreateFakeResult, QueueStudioJobSpy } from '../../../__mocks__/worker'

jest.mock('../../api/deviceTriggers/observer')

import '../peripheralDevice'
import { OnTimelineTriggerTimeProps, StudioJobFunc, StudioJobs } from '@sofie-automation/corelib/dist/worker/studio'
import { MeteorCall } from '../methods'
import { PeripheralDeviceForDevice } from '@sofie-automation/shared-lib/dist/core/model/peripheralDevice'
import {
	PeripheralDeviceInitOptions,
	PlayoutChangedType,
	TimelineTriggerTimeResult,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { RundownId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDeviceAPIMethods } from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'
import {
	MediaObjects,
	Parts,
	PeripheralDeviceCommands,
	PeripheralDevices,
	Pieces,
	RundownPlaylists,
	Rundowns,
	Segments,
} from '../../collections'
import { SupressLogMessages } from '../../../__mocks__/suppressLogging'
import { JSONBlobStringify } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import { PeripheralDeviceCommand } from '@sofie-automation/corelib/dist/dataModel/PeripheralDeviceCommand'

const DEBUG = false

describe('test peripheralDevice general API methods', () => {
	let device: PeripheralDevice
	let rundownID: RundownId
	let rundownPlaylistID: RundownPlaylistId
	let env: DefaultEnvironment
	beforeAll(async () => {
		env = await setupDefaultStudioEnvironment()
		device = env.ingestDevice
		rundownID = protectString('rundown0')
		rundownPlaylistID = protectString('rundownPlaylist0')
		const rundownExternalID = 'rundown0'
		await RundownPlaylists.mutableCollection.insertAsync({
			_id: rundownPlaylistID,
			externalId: 'mock_rpl',
			name: 'Mock',
			studioId: env.studio._id,
			created: 0,
			modified: 0,
			currentPartInfo: null,
			nextPartInfo: null,
			previousPartInfo: null,
			activationId: protectString('active'),
			timing: {
				type: PlaylistTimingType.None,
			},
			rundownIdsInOrder: [rundownID],
			tTimers: [] as any,
		})
		await Rundowns.mutableCollection.insertAsync({
			_id: rundownID,
			externalId: rundownExternalID,
			studioId: env.studio._id,
			showStyleBaseId: env.showStyleBaseId,
			showStyleVariantId: env.showStyleVariantId,
			name: 'test rundown',
			created: 1000,
			playlistId: rundownPlaylistID,
			modified: getCurrentTime(),
			importVersions: {
				studio: 'wibble',
				showStyleBase: 'wobble',
				showStyleVariant: 'jelly',
				blueprint: 'on',
				core: 'plate',
			},
			source: {
				type: 'nrcs',
				peripheralDeviceId: env.ingestDevice._id,
				nrcsName: 'mockNRCS',
			},
			timing: {
				type: PlaylistTimingType.None,
			},
		})
		const segmentID: SegmentId = protectString('segment0')
		const segmentExternalID = 'segment0'
		await Segments.mutableCollection.insertAsync({
			_id: segmentID,
			externalId: segmentExternalID,
			_rank: 0,
			rundownId: rundownID,
			name: 'Fire',
		})
		await Parts.mutableCollection.insertAsync({
			_id: protectString('part000'),
			_rank: 0,
			externalId: 'part000',
			segmentId: segmentID,
			rundownId: rundownID,
			title: 'Part 000',
			expectedDurationWithTransition: undefined,
		})
		await Pieces.mutableCollection.insertAsync({
			_id: protectString('piece0001'),
			enable: {
				start: 0,
			},
			externalId: '',
			name: 'Mock',
			sourceLayerId: Object.keys(env.showStyleBase.sourceLayersWithOverrides.defaults)[0],
			outputLayerId: Object.keys(env.showStyleBase.outputLayersWithOverrides.defaults)[0],
			startPartId: protectString('part000'),
			startSegmentId: segmentID,
			startRundownId: rundownID,
			lifespan: PieceLifespan.WithinPart,
			pieceType: IBlueprintPieceType.Normal,
			invalid: false,
			content: {},
			timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		})
		await Parts.mutableCollection.insertAsync({
			_id: protectString('part001'),
			_rank: 1,
			externalId: 'part001',
			segmentId: segmentID,
			rundownId: rundownID,
			title: 'Part 001',
			expectedDurationWithTransition: undefined,
		})
		await Segments.mutableCollection.insertAsync({
			_id: protectString('segment1'),
			_rank: 1,
			externalId: 'segment01',
			rundownId: rundownID,
			name: 'Water',
		})
		await Segments.mutableCollection.insertAsync({
			_id: protectString('segment2'),
			_rank: 2,
			externalId: 'segment02',
			rundownId: rundownID,
			name: 'Earth',
		})
	})
	beforeEach(async () => {
		QueueStudioJobSpy.mockReset()
		QueueStudioJobSpy.mockClear()
	})

	test('initialize', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		expect(await PeripheralDevices.findOneAsync(device._id)).toBeTruthy()

		const options: PeripheralDeviceInitOptions = {
			category: PeripheralDeviceCategory.INGEST,
			type: PeripheralDeviceType.MOS,
			subType: 'mos_connection',
			name: 'test',
			connectionId: 'test',
			configManifest: {
				deviceConfigSchema: JSONBlobStringify({}),
				subdeviceManifest: {},
			},
			documentationUrl: 'http://example.com',
		}
		await MeteorCall.peripheralDevice.initialize(device._id, device.token, options)
		const initDevice = (await PeripheralDevices.findOneAsync(device._id)) as PeripheralDevice
		expect(initDevice).toBeTruthy()
		expect(initDevice.lastSeen).toBeGreaterThan(getCurrentTime() - 100)
		expect(initDevice.lastConnected).toBeGreaterThan(getCurrentTime() - 100)
		expect(initDevice.subType).toBe(options.subType)
	})

	test('setStatus', async () => {
		expect(await PeripheralDevices.findOneAsync(device._id)).toBeTruthy()
		expect(((await PeripheralDevices.findOneAsync(device._id)) as PeripheralDevice).status).toMatchObject({
			statusCode: StatusCode.GOOD,
		})
		await MeteorCall.peripheralDevice.setStatus(device._id, device.token, {
			statusCode: StatusCode.WARNING_MINOR,
			messages: ["Something's not right"],
		})
		expect(((await PeripheralDevices.findOneAsync(device._id)) as PeripheralDevice).status).toMatchObject({
			statusCode: StatusCode.WARNING_MINOR,
			messages: ["Something's not right"],
		})
	})

	test('getPeripheralDevice', async () => {
		const gotDevice: PeripheralDeviceForDevice = await MeteorCall.peripheralDevice.getPeripheralDevice(
			device._id,
			device.token
		)
		expect(gotDevice).toBeTruthy()
		expect(gotDevice._id).toBe(device._id)
	})

	test('ping', async () => {
		jest.useFakeTimers()
		const EPOCH = 10000
		jest.setSystemTime(EPOCH)

		// reset the lastSeen property so that this test is predictable, and not time-dependant
		await PeripheralDevices.updateAsync(device._id, {
			$set: {
				lastSeen: EPOCH,
			},
		})

		expect(await PeripheralDevices.findOneAsync(device._id)).toBeTruthy()
		const lastSeen = ((await PeripheralDevices.findOneAsync(device._id)) as PeripheralDevice).lastSeen

		await jest.advanceTimersByTimeAsync(1200)

		await MeteorCall.peripheralDevice.ping(device._id, device.token)
		await waitUntil(async () => {
			expect(((await PeripheralDevices.findOneAsync(device._id)) as PeripheralDevice).lastSeen).toBeGreaterThan(
				lastSeen
			)
		}, 1000)

		jest.useRealTimers()
	})

	test('determineDiffTime', async () => {
		const response = await MeteorCall.peripheralDevice.determineDiffTime()
		expect(response).toBeTruthy()
		expect(Math.abs(response.mean - 400)).toBeLessThan(10) // be about 400
		expect(response.stdDev).toBeLessThan(10)
		expect(response.stdDev).toBeGreaterThan(0.1)
	})

	test('getTimeDiff', async () => {
		const response = await MeteorCall.peripheralDevice.getTimeDiff()
		const now = getCurrentTime()
		expect(response).toBeTruthy()
		expect(response.currentTime).toBeGreaterThan(now - 30)
		expect(response.currentTime).toBeLessThan(now + 30)
		expect(response.systemRawTime).toBeGreaterThan(0)
		expect(response.diff).toBeDefined()
		expect(response.stdDev).toBeDefined()
		expect(response.good).toBeDefined()
	})

	test('getTime', async () => {
		const response = await MeteorCall.peripheralDevice.getTime()
		const now = getCurrentTime()
		expect(response).toBeGreaterThan(now - 30)
		expect(response).toBeLessThan(now + 30)
	})

	test('pingWithCommand and functionReply', async () => {
		jest.useFakeTimers()
		const EPOCH = 10000
		jest.setSystemTime(EPOCH)
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		// reset the lastSeen property so that this test is predictable, and not time-dependant
		await PeripheralDevices.updateAsync(device._id, {
			$set: {
				lastSeen: EPOCH,
			},
		})

		let resultErr = undefined
		let resultMessage = undefined
		const pingCompleted = jest.fn((err: any, msg: any) => {
			resultErr = err
			resultMessage = msg
		})

		// This is very odd. Ping command is sent and lastSeen updated before response
		const device2 = (await PeripheralDevices.findOneAsync(device._id)) as PeripheralDevice
		expect(device2).toBeTruthy()
		const lastSeen = device2.lastSeen

		jest.advanceTimersByTime(1200)

		// Note: the null is so that Metor doesnt try to use pingCompleted  as a callback instead of blocking
		const message = 'Waving!'
		await MeteorCall.peripheralDevice.pingWithCommand(device._id, device.token, message, pingCompleted)

		let command: PeripheralDeviceCommand | undefined
		await waitUntil(async () => {
			jest.runAllTicks()
			command = await PeripheralDeviceCommands.findOneAsync({
				deviceId: device._id,
			})
			expect(command).toBeTruthy()
		}, 1000)

		if (command === undefined) throw new Error('Command must be defined')
		expect(command.hasReply).toBeFalsy()
		expect(command.functionName).toBe('pingResponse')
		expect(command.args).toEqual([message])

		expect(resultErr).toBeUndefined()
		expect(resultMessage).toBeUndefined()

		const replyMessage = 'Waving back!'
		await Meteor.callAsync(
			PeripheralDeviceAPIMethods.functionReply,
			device._id,
			device.token,
			command._id,
			undefined,
			replyMessage
		)

		jest.advanceTimersByTime(1200)

		expect(await PeripheralDeviceCommands.findOneAsync({})).toBeTruthy()
		await waitUntil(async () => {
			expect(await PeripheralDeviceCommands.findOneAsync({})).toBeFalsy()
		}, 100)

		await waitUntil(async () => {
			jest.runAllTicks()
			expect(((await PeripheralDevices.findOneAsync(device._id)) as PeripheralDevice).lastSeen).toBeGreaterThan(
				lastSeen
			)
		}, 1000)

		expect(resultErr).toBeNull()
		expect(resultMessage).toEqual(replyMessage)
		jest.useRealTimers()
	})

	test('playoutPlaybackChanged', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		QueueStudioJobSpy.mockImplementation(async () => CreateFakeResult(Promise.resolve(null)))

		const partInstanceId = getRandomId()
		const pieceInstanceId = getRandomId()
		const time0 = getCurrentTime()
		const time1 = getCurrentTime()
		const time2 = getCurrentTime()
		const time3 = getCurrentTime()
		await MeteorCall.peripheralDevice.playoutPlaybackChanged(device._id, device.token, {
			rundownPlaylistId: rundownPlaylistID,
			changes: [
				{
					type: PlayoutChangedType.PART_PLAYBACK_STARTED,
					objId: 'object-id',
					data: {
						partInstanceId,
						time: time0,
					},
				},
				{
					type: PlayoutChangedType.PART_PLAYBACK_STOPPED,
					objId: 'object-id',
					data: {
						partInstanceId,
						time: time1,
					},
				},
				{
					type: PlayoutChangedType.PIECE_PLAYBACK_STARTED,
					objId: 'object-id',
					data: {
						partInstanceId,
						pieceInstanceId,
						time: time2,
					},
				},
				{
					type: PlayoutChangedType.PIECE_PLAYBACK_STOPPED,
					objId: 'object-id',
					data: {
						partInstanceId,
						pieceInstanceId,
						time: time3,
					},
				},
			],
		})

		expect(QueueStudioJobSpy).toHaveBeenCalledTimes(1)
		expect(QueueStudioJobSpy).toHaveBeenNthCalledWith(
			1,
			StudioJobs.OnPlayoutPlaybackChanged,
			device.studioAndConfigId!.studioId,
			literal<Parameters<StudioJobFunc[StudioJobs.OnPlayoutPlaybackChanged]>[0]>({
				playlistId: rundownPlaylistID,
				changes: [
					{
						type: PlayoutChangedType.PART_PLAYBACK_STARTED,
						objId: 'object-id',
						data: {
							partInstanceId,
							time: time0,
						},
					},
					{
						type: PlayoutChangedType.PART_PLAYBACK_STOPPED,
						objId: 'object-id',
						data: {
							partInstanceId,
							time: time1,
						},
					},
					{
						type: PlayoutChangedType.PIECE_PLAYBACK_STARTED,
						objId: 'object-id',
						data: {
							partInstanceId,
							pieceInstanceId,
							time: time2,
						},
					},
					{
						type: PlayoutChangedType.PIECE_PLAYBACK_STOPPED,
						objId: 'object-id',
						data: {
							partInstanceId,
							pieceInstanceId,
							time: time3,
						},
					},
				],
			})
		)
	})

	test('timelineTriggerTime', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		QueueStudioJobSpy.mockImplementation(async () => CreateFakeResult(Promise.resolve(null)))

		const timelineTriggerTimeResult: TimelineTriggerTimeResult = []
		for (let i = 0; i < 10; i++) {
			timelineTriggerTimeResult.push({
				id: getRandomString(),
				time: getCurrentTime(),
			})
		}

		await MeteorCall.peripheralDevice.timelineTriggerTime(device._id, device.token, timelineTriggerTimeResult)

		expect(QueueStudioJobSpy).toHaveBeenCalledTimes(1)
		expect(QueueStudioJobSpy).toHaveBeenNthCalledWith(
			1,
			StudioJobs.OnTimelineTriggerTime,
			device.studioAndConfigId!.studioId,
			literal<OnTimelineTriggerTimeProps>({
				results: timelineTriggerTimeResult,
			})
		)
	})

	test('killProcess with a rundown present', async () => {
		// test this does not shutdown because Rundown stored
		if (DEBUG) setLogLevel(LogLevel.DEBUG)
		SupressLogMessages.suppressLogMessage(/Unable to run killProcess/i)
		await expect(MeteorCall.peripheralDevice.killProcess(device._id, device.token, true)).rejects.toThrowMeteor(
			400,
			`Unable to run killProcess: Rundowns not empty!`
		)
	})

	test('testMethod', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)
		const result = await MeteorCall.peripheralDevice.testMethod(device._id, device.token, 'european')
		expect(result).toBe('european')
		SupressLogMessages.suppressLogMessage(/Error thrown/i)
		await expect(
			MeteorCall.peripheralDevice.testMethod(device._id, device.token, 'european', true)
		).rejects.toThrowMeteor(418, `Error thrown, as requested`)
	})

	/*
	test('timelineTriggerTime', () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)
		let timelineTriggerTimeResult: PeripheralDeviceAPI.TimelineTriggerTimeResult = [
			{ id: 'wibble', time: getCurrentTime() }, { id: 'wobble', time: getCurrentTime() - 100 }]
		Meteor.call(PeripheralDeviceAPIMethods.timelineTriggerTime, device._id, device.token, timelineTriggerTimeResult)
	})
	*/

	test('requestUserAuthToken', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)

		SupressLogMessages.suppressLogMessage(/can only request user auth token/i)
		await expect(
			MeteorCall.peripheralDevice.requestUserAuthToken(device._id, device.token, 'https://auth.url/')
		).rejects.toThrowMeteor(400, 'can only request user auth token for peripheral device of spreadsheet type')

		await PeripheralDevices.updateAsync(device._id, {
			$set: {
				type: PeripheralDeviceType.SPREADSHEET,
			},
		})
		await MeteorCall.peripheralDevice.requestUserAuthToken(device._id, device.token, 'https://auth.url/')
		const deviceWithAccessToken = (await PeripheralDevices.findOneAsync(device._id)) as PeripheralDevice
		expect(deviceWithAccessToken).toBeTruthy()
		expect(deviceWithAccessToken.accessTokenUrl).toBe('https://auth.url/')

		await PeripheralDevices.updateAsync(device._id, {
			$set: {
				type: PeripheralDeviceType.MOS,
			},
		})
	})

	// Should only really work for SpreadsheetDevice
	test('storeAccessToken', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)
		SupressLogMessages.suppressLogMessage(/can only store access token/i)
		await expect(
			MeteorCall.peripheralDevice.storeAccessToken(device._id, device.token, 'https://auth.url/')
		).rejects.toThrowMeteor(400, 'can only store access token for peripheral device of spreadsheet type')

		await PeripheralDevices.updateAsync(device._id, {
			$set: {
				type: PeripheralDeviceType.SPREADSHEET,
			},
		})

		await MeteorCall.peripheralDevice.storeAccessToken(device._id, device.token, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')
		const deviceWithSecretToken = (await PeripheralDevices.findOneAsync(device._id)) as PeripheralDevice
		expect(deviceWithSecretToken).toBeTruthy()
		expect(deviceWithSecretToken.accessTokenUrl).toBe('')
		expect((deviceWithSecretToken.secretSettings as IngestDeviceSecretSettings).accessToken).toBe(
			'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
		)
		expect(deviceWithSecretToken.secretSettingsStatus?.accessToken).toBe(true)
	})

	test('uninitialize', async () => {
		if (DEBUG) setLogLevel(LogLevel.DEBUG)
		await MeteorCall.peripheralDevice.unInitialize(device._id, device.token)
		expect(await PeripheralDevices.findOneAsync({})).toBeFalsy()

		device = (await setupDefaultStudioEnvironment()).ingestDevice
		expect(await PeripheralDevices.findOneAsync({})).toBeTruthy()
	})

	// Note: this test fails, due to a backwards-compatibility hack in #c579c8f0
	// test('initialize with bad arguments', () => {
	// 	let options: PeripheralDeviceInitOptions = {
	// 		category: PeripheralDeviceCategory.INGEST,
	// 		type: PeripheralDeviceType.MOS,
	// 		subType: 'mos_connection',
	// 		name: 'test',
	// 		connectionId: 'test',
	// 		configManifest: {
	// 			deviceConfigSchema: JSONBlobStringify({}),
	//			subdeviceManifest: {}
	// 		},
	// 	}

	// 	try {
	// 		Meteor.call(PeripheralDeviceAPIMethods.initialize, device._id, device.token.slice(0, -1), options)
	// 		fail('expected to throw')
	// 	} catch (e) {
	// 		expect(e.message).toBe(`[401] Not allowed access to peripheralDevice`)
	// 	}
	// })

	// test('setStatus with bad arguments', () => {
	// 	try {
	// 		Meteor.call(PeripheralDeviceAPIMethods.setStatus, 'wibbly', device.token, { statusCode: 0 })
	// 		fail('expected to throw')
	// 	} catch (e) {
	// 		expect(e.message).toBe(`[404] PeripheralDevice "wibbly" not found`)
	// 	}

	// 	try {
	// 		Meteor.call(PeripheralDeviceAPIMethods.setStatus, device._id, device.token.slice(0, -1), { statusCode: 0 })
	// 		fail('expected to throw')
	// 	} catch (e) {
	// 		expect(e.message).toBe(`[401] Not allowed access to peripheralDevice`)
	// 	}

	// 	try {
	// 		Meteor.call(PeripheralDeviceAPIMethods.setStatus, device._id, device.token, { statusCode: 42 })
	// 		fail('expected to throw')
	// 	} catch (e) {
	// 		expect(e.message).toBe(`[400] device status code is not known`)
	// 	}
	// })

	test('removePeripheralDevice', async () => {
		{
			const deviceObj = await PeripheralDevices.findOneAsync(device?._id)
			expect(deviceObj).toBeDefined()

			await MeteorCall.peripheralDevice.removePeripheralDevice(device._id)
		}

		{
			const deviceObj = await PeripheralDevices.findOneAsync(device?._id)
			expect(deviceObj).toBeUndefined()
		}
	})

	// test Media Scanner API
	describe('Media Scanner API', () => {
		let deviceId: ProtectedString<any>
		const MOCK_COLLECTION = 'MockCollection'
		const MOCK_MEDIA_ID = 'SOME_FILE'.toUpperCase()
		const MOCK_OBJID = getRandomString()
		beforeEach(async () => {
			deviceId = getRandomId()
			env = await setupDefaultStudioEnvironment()
			await PeripheralDevices.insertAsync({
				_id: deviceId,
				name: 'Mock Media Manager',
				deviceName: 'Media Manager',
				studioAndConfigId: {
					studioId: env.studio._id,
					configId: 'test',
				},
				category: PeripheralDeviceCategory.PLAYOUT,
				configManifest: {
					deviceConfigSchema: JSONBlobStringify({}),
					subdeviceManifest: {},
				},
				connected: true,
				connectionId: '0',
				created: 0,
				lastConnected: 0,
				lastSeen: 0,
				status: {
					statusCode: StatusCode.GOOD,
				},
				subType: '_process',
				token: 'MockToken',
				type: PeripheralDeviceType.PLAYOUT,
			})
			device = (await PeripheralDevices.findOneAsync(deviceId))!

			await MediaObjects.removeAsync({
				collectionId: MOCK_COLLECTION,
			})
			await MediaObjects.insertAsync({
				_id: protectString(MOCK_COLLECTION + '_' + MOCK_OBJID),
				_rev: '1',
				_attachments: {},
				cinf: '',
				collectionId: MOCK_COLLECTION,
				mediaId: MOCK_MEDIA_ID,
				mediaPath: '',
				mediaSize: 10,
				mediaTime: 0,
				objId: MOCK_OBJID,
				studioId: device.studioAndConfigId!.studioId,
				thumbSize: 0,
				thumbTime: 0,
				tinf: '',
			})
		})
		test('getMediaObjectRevisions', async () => {
			const mobjects = (
				await MediaObjects.findFetchAsync({
					studioId: device.studioAndConfigId!.studioId,
				})
			).map((mo) => ({
				_id: mo._id,
				_rev: mo._rev,
			}))
			expect(mobjects.length).toBeGreaterThan(0)

			const revs = await MeteorCall.peripheralDevice.getMediaObjectRevisions(
				device._id,
				device.token,
				MOCK_COLLECTION
			)

			expect(revs.length).toBe(mobjects.length)
			expect(mobjects).toMatchObject(mobjects)
		})
		describe('updateMediaObject', () => {
			test('update', async () => {
				const mo = (await MediaObjects.findOneAsync({
					collectionId: MOCK_COLLECTION,
					studioId: device.studioAndConfigId!.studioId,
				})) as MediaObject
				expect(mo).toBeTruthy()

				const newMo = Object.assign({}, mo)
				newMo._rev = '2'
				newMo.cinf = 'MOCK CINF'

				await MeteorCall.peripheralDevice.updateMediaObject(
					device._id,
					device.token,
					MOCK_COLLECTION,
					mo.objId,
					newMo
				)

				const updateMo = await MediaObjects.findOneAsync({
					collectionId: MOCK_COLLECTION,
					studioId: device.studioAndConfigId!.studioId,
				})
				expect(updateMo).toMatchObject(newMo)
			})
			test('remove', async () => {
				const mo = (await MediaObjects.findOneAsync({
					collectionId: MOCK_COLLECTION,
					studioId: device.studioAndConfigId!.studioId,
				})) as MediaObject
				expect(mo).toBeTruthy()

				await MeteorCall.peripheralDevice.updateMediaObject(
					device._id,
					device.token,
					MOCK_COLLECTION,
					mo.objId,
					null
				)

				const updateMo = await MediaObjects.findOneAsync({
					collectionId: MOCK_COLLECTION,
					studioId: device.studioAndConfigId!.studioId,
				})
				expect(updateMo).toBeFalsy()
			})
		})
	})
})
