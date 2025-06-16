import '../../__mocks__/_extendJest'
import { runAllTimers, waitUntil } from '../../__mocks__/helpers/jest'
import { MeteorMock } from '../../__mocks__/meteor'
import { logger } from '../logging'
import { getRandomId, getRandomString, literal, protectString } from '../lib/tempLib'
import { SnapshotType } from '@sofie-automation/meteor-lib/dist/collections/Snapshots'
import {
	IBlueprintPieceType,
	PieceLifespan,
	PlaylistTimingType,
	StatusCode,
	TSR,
} from '@sofie-automation/blueprints-integration'
import {
	PeripheralDeviceType,
	PeripheralDeviceCategory,
	PeripheralDevice,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { SYSTEM_ID } from '@sofie-automation/meteor-lib/dist/collections/CoreSystem'
import * as lib from '../lib/lib'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { Meteor } from 'meteor/meteor'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	NrcsIngestDataCacheObjId,
	SofieIngestDataCacheObjId,
	PartId,
	PeripheralDeviceId,
	RundownId,
	SegmentId,
	SnapshotId,
	UserActionsLogItemId,
	StudioId,
	RundownPlaylistId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'

// Set up mocks for tests in this suite
let mockCurrentTime = 0
let origGetCurrentTime = lib.getCurrentTime
jest.mock('../logging')
// we don't want the deviceTriggers observer to start up at this time
jest.mock('../api/deviceTriggers/observer')

const MAX_WAIT_TIME = 4 * 1000

import '../cronjobs'

import '../api/peripheralDevice'
import {
	CoreSystem,
	NrcsIngestDataCache,
	PartInstances,
	Parts,
	PeripheralDeviceCommands,
	PeripheralDevices,
	PieceInstances,
	Snapshots,
	UserActionsLog,
	Segments,
	SofieIngestDataCache,
	Studios,
	RundownPlaylists,
} from '../collections'
import { NrcsIngestCacheType } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import { JSONBlobStringify } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'
import {
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
	setupDefaultStudioEnvironment,
} from '../../__mocks__/helpers/database'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { Settings } from '../Settings'
import { SofieIngestCacheType } from '@sofie-automation/corelib/dist/dataModel/SofieIngestDataCache'
import { ObjectOverrideSetOp, ObjectWithOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

describe('cronjobs', () => {
	let env: DefaultEnvironment
	let rundownId: RundownId

	async function setCasparCGCronEnabled(enabled: boolean) {
		await CoreSystem.updateAsync(
			{},
			{
				// This is a little bit of a hack, as it will result in duplicate ops, but it's fine for unit tests
				$push: {
					'settingsWithOverrides.overrides': literal<ObjectOverrideSetOp>({
						op: 'set',
						path: 'cron.casparCGRestart.enabled',
						value: enabled,
					}),
				},
			},
			{ multi: true }
		)
	}

	beforeAll(async () => {
		env = await setupDefaultStudioEnvironment()

		const o = await setupDefaultRundownPlaylist(env)
		rundownId = o.rundownId

		await setCasparCGCronEnabled(true)

		jest.useFakeTimers()
		// set time to 2020/07/19 00:00 Local Time
		mockCurrentTime = new Date(2020, 6, 19, 0, 0, 0).getTime()
		await MeteorMock.mockRunMeteorStartup()
		origGetCurrentTime = lib.getCurrentTime
		//@ts-ignore Mock getCurrentTime for tests
		// eslint-disable-next-line no-import-assign
		lib.getCurrentTime = jest.fn(() => {
			return mockCurrentTime
		})
	})
	afterAll(async () => {
		//@ts-ignore Return getCurrentTime to orig
		// eslint-disable-next-line no-import-assign
		lib.getCurrentTime = origGetCurrentTime
		await CoreSystem.removeAsync(SYSTEM_ID)
	})
	describe('Runs at the appropriate time', () => {
		test("Doesn't run during the day", async () => {
			// set time to 2020/07/19 12:00 Local Time
			mockCurrentTime = new Date(2020, 6, 19, 12, 0, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			await jest.advanceTimersByTimeAsync(6 * 60 * 1000)
			expect(lib.getCurrentTime).toHaveBeenCalled()

			await runAllTimers()

			expect(logger.info).toHaveBeenCalledTimes(0)
		})
		test("Runs at 4 o'clock", async () => {
			// set time to 2020/07/20 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, 20, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			await jest.advanceTimersByTimeAsync(6 * 60 * 1000)
			expect(lib.getCurrentTime).toHaveBeenCalled()

			expect(logger.info).not.toHaveBeenLastCalledWith('Nightly cronjob: done')
			await waitUntil(async () => {
				// Run timers, so that all promises in the cronjob has a chance to resolve:
				await runAllTimers()

				expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')
			}, MAX_WAIT_TIME)
		})
		test("Doesn't run if less than 20 hours have passed since last run", async () => {
			// set time to 2020/07/21 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, 21, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			await jest.advanceTimersByTimeAsync(6 * 60 * 1000)
			expect(lib.getCurrentTime).toHaveBeenCalled()

			expect(logger.info).not.toHaveBeenLastCalledWith('Nightly cronjob: done')
			await waitUntil(async () => {
				// Run timers, so that all promises in the cronjob has a chance to resolve:
				await runAllTimers()
				expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')
			}, MAX_WAIT_TIME)

			// clear the mock
			;(logger.info as jest.Mock).mockClear()

			mockCurrentTime = new Date(2020, 6, 20, 4, 50, 0).getTime()
			await jest.advanceTimersByTimeAsync(6 * 60 * 1000)

			await runAllTimers()
			// less than 24 hours have passed so we do not expect the cronjob to run
			expect(logger.info).toHaveBeenCalledTimes(0)
		})
	})
	describe('Does appropriate cron actions', () => {
		let date = 23
		async function runCronjobs() {
			;(logger.info as jest.Mock).mockClear()
			// set time to 2020/07/{date} 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, date++, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			await jest.advanceTimersByTimeAsync(6 * 60 * 1000)

			expect(logger.info).not.toHaveBeenLastCalledWith('Nightly cronjob: done')
			await waitUntil(async () => {
				// Run timers, so that all promises in the cronjob has a chance to resolve:
				await runAllTimers()
				expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')
			}, MAX_WAIT_TIME)
		}

		afterEach(async () => {
			await PeripheralDevices.removeAsync({})
		})

		test('Remove NrcsIngestDataCache objects that are not connected to any Rundown', async () => {
			// Set up a mock rundown, a detached NrcsIngestDataCache object and an object attached to the mock rundown
			// Detached NrcsIngestDataCache object 0
			const dataCache0Id = protectString<NrcsIngestDataCacheObjId>(getRandomString())
			await NrcsIngestDataCache.mutableCollection.insertAsync({
				_id: dataCache0Id,
				data: {
					externalId: '',
					name: '',
					segments: [],
					type: '',
					rundownSource: {} as any,
					payload: undefined,
				},
				modified: new Date(2000, 0, 1, 0, 0, 0).getTime(),
				// this one is attached to rundown0
				rundownId: getRandomId(),
				type: NrcsIngestCacheType.RUNDOWN,
			})
			// Attached NrcsIngestDataCache object 1
			const dataCache1Id = protectString<NrcsIngestDataCacheObjId>(getRandomString())
			await NrcsIngestDataCache.mutableCollection.insertAsync({
				_id: dataCache1Id,
				data: {
					externalId: '',
					name: '',
					segments: [],
					type: '',
					rundownSource: {} as any,
					payload: undefined,
				},
				modified: new Date(2000, 0, 1, 0, 0, 0).getTime(),
				// just some random ID
				rundownId: rundownId,
				type: NrcsIngestCacheType.RUNDOWN,
			})

			await runCronjobs()

			expect(await NrcsIngestDataCache.findOneAsync(dataCache1Id)).toMatchObject({
				_id: dataCache1Id,
			})
			expect(await NrcsIngestDataCache.findOneAsync(dataCache0Id)).toBeUndefined()
		})
		test('Remove SofieIngestDataCache objects that are not connected to any Rundown', async () => {
			// Set up a mock rundown, a detached SofieIngestDataCache object and an object attached to the mock rundown
			// Detached SofieIngestDataCache object 0
			const dataCache0Id = protectString<SofieIngestDataCacheObjId>(getRandomString())
			await SofieIngestDataCache.mutableCollection.insertAsync({
				_id: dataCache0Id,
				data: {
					externalId: '',
					name: '',
					segments: [],
					type: '',
					rundownSource: {} as any,
					userEditStates: {},
					payload: undefined,
				},
				modified: new Date(2000, 0, 1, 0, 0, 0).getTime(),
				// this one is attached to rundown0
				rundownId: getRandomId(),
				type: SofieIngestCacheType.RUNDOWN,
			})
			// Attached SofieIngestDataCache object 1
			const dataCache1Id = protectString<SofieIngestDataCacheObjId>(getRandomString())
			await SofieIngestDataCache.mutableCollection.insertAsync({
				_id: dataCache1Id,
				data: {
					externalId: '',
					name: '',
					segments: [],
					type: '',
					rundownSource: {} as any,
					userEditStates: {},
					payload: undefined,
				},
				modified: new Date(2000, 0, 1, 0, 0, 0).getTime(),
				// just some random ID
				rundownId: rundownId,
				type: SofieIngestCacheType.RUNDOWN,
			})

			await runCronjobs()

			expect(await SofieIngestDataCache.findOneAsync(dataCache1Id)).toMatchObject({
				_id: dataCache1Id,
			})
			expect(await SofieIngestDataCache.findOneAsync(dataCache0Id)).toBeUndefined()
		})
		test('Removes old PartInstances and PieceInstances', async () => {
			// nightlyCronjobInner()

			const segment0: DBSegment = {
				_id: getRandomId<SegmentId>(),
				_rank: 0,
				externalId: '',
				rundownId,
				name: 'mock segment',
			}
			await Segments.mutableCollection.insertAsync(segment0)

			const part0: DBPart = {
				_id: getRandomId<PartId>(),
				_rank: 0,
				rundownId: rundownId,
				segmentId: segment0._id,
				externalId: '',
				title: '',
				expectedDurationWithTransition: undefined,
			}
			await Parts.mutableCollection.insertAsync(part0)
			const part1: DBPart = {
				_id: getRandomId<PartId>(),
				_rank: 1,
				rundownId: getRandomId<RundownId>(), // non-existent
				segmentId: getRandomId<SegmentId>(), // non-existent
				externalId: '',
				title: '',
				expectedDurationWithTransition: undefined,
			}
			await Parts.mutableCollection.insertAsync(part1)

			const partInstance0: PartInstance = {
				_id: protectString(`${part0._id}_${getRandomId()}`),
				rundownId: part0.rundownId,
				segmentId: part0.segmentId,
				takeCount: 1,
				rehearsal: false,
				isTemporary: false,
				part: part0,
				reset: true,
				timings: {
					plannedStoppedPlayback: lib.getCurrentTime() - 1000 * 3600 * 24 * 51,
				},
				playlistActivationId: protectString(''),
				segmentPlayoutId: protectString(''),
			}
			await PartInstances.mutableCollection.insertAsync(partInstance0)

			const partInstance1: PartInstance = {
				_id: protectString(`${part0._id}_${getRandomId()}`),
				rundownId: part0.rundownId,
				segmentId: part0.segmentId,
				takeCount: 1,
				rehearsal: false,
				isTemporary: false,
				part: part0,
				playlistActivationId: protectString(''),
				segmentPlayoutId: protectString(''),
			}
			await PartInstances.mutableCollection.insertAsync(partInstance1)

			const partInstance2: PartInstance = {
				_id: protectString(`${part0._id}_${getRandomId()}`),
				rundownId: part1.rundownId,
				segmentId: part1.segmentId,
				takeCount: 1,
				rehearsal: false,
				isTemporary: false,
				part: part1,
				reset: true,
				timings: {
					plannedStoppedPlayback: lib.getCurrentTime() - 1000 * 3600 * 24 * 51,
				},
				playlistActivationId: protectString(''),
				segmentPlayoutId: protectString(''),
			}
			await PartInstances.mutableCollection.insertAsync(partInstance2)

			const pieceInstance0: PieceInstance = {
				_id: protectString(`${partInstance0._id}_piece0`),
				rundownId: partInstance0.part.rundownId,
				partInstanceId: partInstance0._id,
				piece: {
					_id: protectString(`${partInstance0._id}_piece_inner1`),
					startPartId: partInstance2.part._id,
					content: {},
					timelineObjectsString: EmptyPieceTimelineObjectsBlob,
					externalId: '',
					name: 'abc',
					sourceLayerId: '',
					outputLayerId: '',
					enable: { start: 0 },
					lifespan: PieceLifespan.OutOnSegmentChange,
					invalid: false,
					pieceType: IBlueprintPieceType.Normal,
				},
				playlistActivationId: protectString(''),
			}
			const pieceInstance1: PieceInstance = {
				_id: protectString(`${partInstance2._id}_piece0`),
				rundownId: partInstance2.part.rundownId,
				partInstanceId: partInstance2._id,
				piece: {
					_id: protectString(`${partInstance2._id}_piece_inner1`),
					startPartId: partInstance2.part._id,
					content: {},
					timelineObjectsString: EmptyPieceTimelineObjectsBlob,
					externalId: '',
					name: 'abc',
					sourceLayerId: '',
					outputLayerId: '',
					enable: { start: 0 },
					lifespan: PieceLifespan.OutOnSegmentChange,
					invalid: false,
					pieceType: IBlueprintPieceType.Normal,
				},
				playlistActivationId: protectString(''),
			}
			await PieceInstances.mutableCollection.insertAsync(pieceInstance0)
			await PieceInstances.mutableCollection.insertAsync(pieceInstance1)
			await runCronjobs()

			expect(await Parts.findOneAsync(part0._id)).toBeDefined()
			expect(await Parts.findOneAsync(part1._id)).toBeUndefined() // Removed, since owned by non-existent rundown

			expect(await PartInstances.findOneAsync(partInstance0._id)).toBeDefined()
			expect(await PartInstances.findOneAsync(partInstance1._id)).toBeDefined()
			expect(await PartInstances.findOneAsync(partInstance2._id)).toBeUndefined() // Removed, since owned by non-existent part1
			expect(await PieceInstances.findOneAsync(pieceInstance0._id)).toBeDefined()
			expect(await PieceInstances.findOneAsync(pieceInstance1._id)).toBeUndefined() // Removed, since owned by non-existent partInstance2
		})
		test('Removes old entries in UserActionsLog', async () => {
			// reasonably fresh entry
			const userAction0 = protectString<UserActionsLogItemId>(getRandomString())
			await UserActionsLog.insertAsync({
				_id: userAction0,
				organizationId: null,
				userId: null,
				args: '',
				clientAddress: '',
				context: '',
				method: '',
				// 3 days old
				timestamp: lib.getCurrentTime() - 1000 * 3600 * 24 * 3,
			})
			// stale entry
			const userAction1 = protectString<UserActionsLogItemId>(getRandomString())
			await UserActionsLog.insertAsync({
				_id: userAction1,
				organizationId: null,
				userId: null,
				args: '',
				clientAddress: '',
				context: '',
				method: '',
				timestamp: lib.getCurrentTime() - Settings.maximumDataAge - 1000,
			})

			await runCronjobs()

			expect(await UserActionsLog.findOneAsync(userAction0)).toMatchObject({
				_id: userAction0,
			})
			expect(await UserActionsLog.findOneAsync(userAction1)).toBeUndefined()
		})
		test('Removes old entries in Snapshots', async () => {
			// reasonably fresh entry
			const snapshot0 = protectString<SnapshotId>(getRandomString())
			await Snapshots.insertAsync({
				_id: snapshot0,
				organizationId: null,
				comment: '',
				fileName: '',
				name: '',
				type: SnapshotType.DEBUG,
				version: '',
				// 3 days old
				created: lib.getCurrentTime() - 1000 * 3600 * 24 * 3,
			})
			// stale entry
			const snapshot1 = protectString<SnapshotId>(getRandomString())
			await Snapshots.insertAsync({
				_id: snapshot1,
				organizationId: null,
				comment: '',
				fileName: '',
				name: '',
				type: SnapshotType.DEBUG,
				version: '',
				// Very old:
				created: lib.getCurrentTime() - Settings.maximumDataAge - 1000,
			})

			await runCronjobs()

			expect(await Snapshots.findOneAsync(snapshot0)).toMatchObject({
				_id: snapshot0,
			})
			expect(await Snapshots.findOneAsync(snapshot1)).toBeUndefined()
		})
		async function insertPlayoutDevice(
			props: Pick<
				PeripheralDevice,
				'subType' | 'deviceName' | 'lastSeen' | 'parentDeviceId' | 'studioAndConfigId'
			> &
				Partial<Pick<PeripheralDevice, 'token'>>
		): Promise<PeripheralDeviceId> {
			const deviceId = protectString<PeripheralDeviceId>(getRandomString())
			await PeripheralDevices.insertAsync({
				_id: deviceId,
				organizationId: null,
				type: PeripheralDeviceType.PLAYOUT,
				category: PeripheralDeviceCategory.PLAYOUT,
				configManifest: {
					deviceConfigSchema: JSONBlobStringify({}),
					subdeviceManifest: {},
				},
				connected: true,
				connectionId: '',
				created: 0,
				lastConnected: 0,
				name: props.deviceName,
				status: {
					statusCode: StatusCode.GOOD,
				},
				token: '',
				...props,
			})

			return deviceId
		}

		async function createMockPlayoutGatewayAndDevices(
			lastSeen: number,
			studioId?: StudioId
		): Promise<{
			deviceToken: string
			mockPlayoutGw: PeripheralDeviceId
			mockCasparCg: PeripheralDeviceId
			mockAtem: PeripheralDeviceId
		}> {
			const deviceToken = 'token1'
			const mockPlayoutGw = await insertPlayoutDevice({
				deviceName: 'Playout Gateway',
				lastSeen: lastSeen,
				subType: PERIPHERAL_SUBTYPE_PROCESS,
				token: deviceToken,
				studioAndConfigId: studioId
					? {
							configId: '',
							studioId,
						}
					: undefined,
			})
			const mockCasparCg = await insertPlayoutDevice({
				deviceName: 'CasparCG',
				lastSeen: lastSeen,
				subType: TSR.DeviceType.CASPARCG,
				parentDeviceId: mockPlayoutGw,
				token: deviceToken,
			})
			const mockAtem = await insertPlayoutDevice({
				deviceName: 'ATEM',
				lastSeen: lastSeen,
				subType: TSR.DeviceType.ATEM,
				parentDeviceId: mockPlayoutGw,
				token: deviceToken,
			})

			return {
				deviceToken,
				mockPlayoutGw,
				mockCasparCg,
				mockAtem,
			}
		}

		async function createMockStudioAndRundown(): Promise<{
			studioId: StudioId
			rundownPlaylistId: RundownPlaylistId
		}> {
			function newObjectWithOverrides<T extends object>(defaults: T): ObjectWithOverrides<T> {
				return {
					defaults,
					overrides: [],
				}
			}
			const studioId = protectString<StudioId>(getRandomString())
			await Studios.insertAsync({
				_id: studioId,
				organizationId: null,
				name: 'Studio',
				blueprintConfigWithOverrides: newObjectWithOverrides({}),
				_rundownVersionHash: '',
				lastBlueprintConfig: undefined,
				lastBlueprintFixUpHash: undefined,
				mappingsWithOverrides: newObjectWithOverrides({}),
				supportedShowStyleBase: [],
				settingsWithOverrides: newObjectWithOverrides({
					allowHold: true,
					allowPieceDirectPlay: true,
					enableBuckets: true,
					enableEvaluationForm: true,
					frameRate: 25,
					mediaPreviewsUrl: '',
					minimumTakeSpan: 1000,
				}),
				routeSetsWithOverrides: newObjectWithOverrides({}),
				routeSetExclusivityGroupsWithOverrides: newObjectWithOverrides({}),
				packageContainersWithOverrides: newObjectWithOverrides({}),
				previewContainerIds: [],
				thumbnailContainerIds: [],
				peripheralDeviceSettings: {
					deviceSettings: newObjectWithOverrides({}),
					ingestDevices: newObjectWithOverrides({}),
					inputDevices: newObjectWithOverrides({}),
					playoutDevices: newObjectWithOverrides({}),
				},
			})

			const rundownPlaylistId = protectString<RundownPlaylistId>(getRandomString())
			await RundownPlaylists.mutableCollection.insertAsync({
				_id: rundownPlaylistId,
				created: Date.now(),
				currentPartInfo: null,
				nextPartInfo: null,
				externalId: '',
				modified: Date.now(),
				name: 'Rundown',
				previousPartInfo: null,
				rundownIdsInOrder: [],
				studioId,
				timing: {
					type: PlaylistTimingType.None,
				},
				activationId: protectString(''),
			})

			return {
				studioId,
				rundownPlaylistId,
			}
		}

		test('Attempts to restart CasparCG when job is enabled', async () => {
			const { mockCasparCg, deviceToken } = await createMockPlayoutGatewayAndDevices(Date.now()) // Some time after the threshold

			;(logger.info as jest.Mock).mockClear()
			// set time to 2020/07/{date} 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, date++, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			await jest.advanceTimersByTimeAsync(6 * 60 * 1000)
			await runAllTimers()

			// check if the correct PeripheralDevice command has been issued, and only for CasparCG devices
			const pendingCommands = await PeripheralDeviceCommands.findFetchAsync({})
			expect(pendingCommands).toHaveLength(1)
			expect(pendingCommands[0]).toMatchObject({
				deviceId: mockCasparCg,
				actionId: 'restartServer',
			})

			// Emulate that the restart was successful:
			await Promise.all(
				pendingCommands.map(async (cmd) =>
					Meteor.callAsync(
						'peripheralDevice.functionReply',
						cmd.deviceId, // deviceId
						deviceToken, // deviceToken
						cmd._id, // commandId
						null, // err
						null // result
					)
				)
			)

			expect(logger.info).not.toHaveBeenLastCalledWith('Nightly cronjob: done')
			await waitUntil(async () => {
				// Run timers, so that all promises in the cronjob has a chance to resolve:
				await runAllTimers()
				expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')
			}, MAX_WAIT_TIME)
		})
		test('Skips offline CasparCG when job is enabled', async () => {
			const { mockCasparCg } = await createMockPlayoutGatewayAndDevices(Date.now()) // Some time after the threshold
			await PeripheralDevices.updateAsync(mockCasparCg, {
				$set: {
					lastSeen: 0,
				},
			})
			;(logger.info as jest.Mock).mockClear()
			// set time to 2020/07/{date} 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, date++, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			await jest.advanceTimersByTimeAsync(6 * 60 * 1000)

			await waitUntil(async () => {
				// Run timers, so that all promises in the cronjob has a chance to resolve:
				const pendingCommands = await PeripheralDeviceCommands.findFetchAsync({})
				expect(pendingCommands).toHaveLength(0)
			}, MAX_WAIT_TIME)

			// make sure that the cronjob ends
			await waitUntil(async () => {
				// Run timers, so that all promises in the cronjob has a chance to resolve:
				await runAllTimers()
				expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')
			}, MAX_WAIT_TIME)
		})
		test('Skips CasparCG in Studios with active Playlists when job is enabled', async () => {
			const { studioId } = await createMockStudioAndRundown()
			await createMockPlayoutGatewayAndDevices(Date.now(), studioId) // Some time after the threshold
			;(logger.info as jest.Mock).mockClear()
			// set time to 2020/07/{date} 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, date++, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			await jest.advanceTimersByTimeAsync(6 * 60 * 1000)

			await waitUntil(async () => {
				// Run timers, so that all promises in the cronjob has a chance to resolve:
				const pendingCommands = await PeripheralDeviceCommands.findFetchAsync({})
				expect(pendingCommands).toHaveLength(0)
			}, MAX_WAIT_TIME)

			// make sure that the cronjob ends
			await waitUntil(async () => {
				// Run timers, so that all promises in the cronjob has a chance to resolve:
				await runAllTimers()
				expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')
			}, MAX_WAIT_TIME)
		})
		test('Does not attempt to restart CasparCG when job is disabled', async () => {
			await createMockPlayoutGatewayAndDevices(Date.now()) // Some time after the threshold
			await setCasparCGCronEnabled(false)
			;(logger.info as jest.Mock).mockClear()
			// set time to 2020/07/{date} 04:05 Local Time, should be more than 24 hours after 2020/07/19 00:00 UTC
			mockCurrentTime = new Date(2020, 6, date++, 4, 5, 0).getTime()
			// cronjob is checked every 5 minutes, so advance 6 minutes
			await jest.advanceTimersByTimeAsync(6 * 60 * 1000)
			jest.runOnlyPendingTimers()

			// check if the no PeripheralDevice command have been issued
			const pendingCommands = await PeripheralDeviceCommands.findFetchAsync({})
			expect(pendingCommands).toHaveLength(0)

			await waitUntil(async () => {
				// Run timers, so that all promises in the cronjob has a chance to resolve:
				await runAllTimers()
				expect(logger.info).toHaveBeenLastCalledWith('Nightly cronjob: done')
			}, MAX_WAIT_TIME)
		})
	})
})
