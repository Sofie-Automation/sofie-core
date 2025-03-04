/* eslint-disable @typescript-eslint/unbound-method */
import '../../__mocks__/_extendJest'
import {
	IBlueprintPiece,
	IngestPart,
	IngestRundown,
	IngestSegment,
	PieceLifespan,
} from '@sofie-automation/blueprints-integration'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import {
	PeripheralDevice,
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import {
	DBRundown,
	Rundown,
	RundownOrphanedReason,
	RundownSource,
} from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { clone, getRandomString, literal } from '@sofie-automation/corelib/dist/lib'
import { sortPartsInSortedSegments, sortSegmentsInRundowns } from '@sofie-automation/corelib/dist/playout/playlist'
import { MongoQuery } from '../../db'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
import { setupMockPeripheralDevice, setupMockShowStyleCompound } from '../../__mocks__/presetCollections'
import {
	handleRemovedRundown,
	handleUpdatedRundown,
	handleUpdatedRundownMetaData,
	handleUserRemoveRundown,
} from '../../ingest/ingestRundownJobs'
import { handleRemovedPart, handleUpdatedPart } from '../../ingest/ingestPartJobs'
import { handleRemovedSegment, handleUpdatedSegment, handleUpdatedSegmentRanks } from '../../ingest/ingestSegmentJobs'
import { handleTakeNextPart } from '../../playout/take'
import { handleActivateRundownPlaylist } from '../../playout/activePlaylistJobs'
import { PartInstanceId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getSelectedPartInstances } from '../../playout/__tests__/lib'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { runJobWithPlayoutModel } from '../../playout/lock'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { insertQueuedPartWithPieces } from '../../playout/adlibUtils'
import { UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { PlayoutPartInstanceModel } from '../../playout/model/PlayoutPartInstanceModel'
import { NrcsIngestCacheType } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import { wrapGenericIngestJob, wrapGenericIngestJobWithPrecheck } from '../jobWrappers'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

const handleRemovedRundownWrapped = wrapGenericIngestJob(handleRemovedRundown)
const handleUpdatedRundownWrapped = wrapGenericIngestJob(handleUpdatedRundown)
const handleUpdatedRundownMetaDataWrapped = wrapGenericIngestJob(handleUpdatedRundownMetaData)
const handleRemovedSegmentWrapped = wrapGenericIngestJob(handleRemovedSegment)
const handleUpdatedSegmentWrapped = wrapGenericIngestJobWithPrecheck(handleUpdatedSegment)
const handleUpdatedSegmentRanksWrapped = wrapGenericIngestJob(handleUpdatedSegmentRanks)
const handleRemovedPartWrapped = wrapGenericIngestJob(handleRemovedPart)
const handleUpdatedPartWrapped = wrapGenericIngestJob(handleUpdatedPart)

const externalId = 'abcde'
const rundownData1: IngestRundown = {
	externalId: externalId,
	name: 'MyMockRundown',
	type: 'mock',
	payload: undefined,
	segments: [
		{
			externalId: 'segment0',
			name: 'Segment 0',
			rank: 0,
			payload: undefined,
			parts: [
				{
					externalId: 'part0',
					name: 'Part 0',
					rank: 0,
					payload: undefined,
				},
				{
					externalId: 'part1',
					name: 'Part 1',
					rank: 0,
					payload: undefined,
				},
			],
		},
		{
			externalId: 'segment1',
			name: 'Segment 1',
			rank: 0,
			payload: undefined,
			parts: [
				{
					externalId: 'part2',
					name: 'Part 2',
					rank: 0,
					payload: undefined,
				},
			],
		},
	],
}

function createRundownSource(peripheralDevice: PeripheralDevice): RundownSource {
	return {
		type: 'nrcs',
		peripheralDeviceId: peripheralDevice._id,
		nrcsName: peripheralDevice.nrcsName,
	}
}

describe('Test ingest actions for rundowns and segments', () => {
	let context: MockJobContext

	let device: PeripheralDevice
	let device2: PeripheralDevice
	const segExternalId = 'zyxwv'
	beforeAll(async () => {
		context = setupDefaultJobEnvironment()

		const showStyleCompound = await setupMockShowStyleCompound(context)

		context.setStudio({
			...context.rawStudio,
			settingsWithOverrides: wrapDefaultObject({
				...context.studio.settings,
				minimumTakeSpan: 0,
			}),
			supportedShowStyleBase: [showStyleCompound._id],
		})

		device = await setupMockPeripheralDevice(
			context,
			PeripheralDeviceCategory.INGEST,
			PeripheralDeviceType.MOS,
			PERIPHERAL_SUBTYPE_PROCESS
		)
		device2 = await setupMockPeripheralDevice(
			context,
			PeripheralDeviceCategory.INGEST,
			// @ts-ignore
			'mockDeviceType',
			PERIPHERAL_SUBTYPE_PROCESS
		)

		jest.clearAllMocks()
	})

	beforeEach(async () => {
		context.queueIngestJob = jest.fn(() => {
			throw new Error('Not implemented')
		})

		await context.clearAllRundownsAndPlaylists()
	})
	async function getRundownData(query?: MongoQuery<DBRundown>) {
		const rundown = (await context.mockCollections.Rundowns.findOne(query)) as DBRundown
		expect(rundown).toBeTruthy()
		const rundownPlaylist = (await context.mockCollections.RundownPlaylists.findOne(
			rundown.playlistId
		)) as DBRundownPlaylist
		expect(rundownPlaylist).toBeTruthy()

		const rawSegments = await context.mockCollections.Segments.findFetch({ rundownId: rundown._id })
		const rawParts = await context.mockCollections.Parts.findFetch({ rundownId: rundown._id })

		const segments = sortSegmentsInRundowns(rawSegments, [rundown._id])
		const parts = sortPartsInSortedSegments(rawParts, segments)

		return {
			rundown,
			rundownPlaylist,
			segments,
			parts,
		}
	}

	async function recreateRundown(data: IngestRundown): Promise<DBRundown> {
		await context.clearAllRundownsAndPlaylists()

		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: data.externalId,
			ingestRundown: data,
			isCreateAction: true,
			rundownSource: createRundownSource(device),
		})

		const rundown = (await context.mockCollections.Rundowns.findOne({ externalId: data.externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		return rundown
	}

	async function setRundownsOrphaned() {
		await expect(context.mockCollections.Rundowns.findOne()).resolves.toBeTruthy()

		await context.mockCollections.Rundowns.update({}, { $set: { orphaned: RundownOrphanedReason.DELETED } })
		await context.mockCollections.NrcsIngestDataCache.remove({})
	}

	test('dataRundownCreate', async () => {
		// setLogLevel(LogLevel.DEBUG)

		await expect(context.mockCollections.Rundowns.findOne()).resolves.toBeFalsy()

		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: rundownData1.externalId,
			ingestRundown: rundownData1,
			isCreateAction: true,
			rundownSource: createRundownSource(device),
		})

		const savedRundownData = await getRundownData()

		expect(savedRundownData.rundownPlaylist).toMatchObject({
			externalId: savedRundownData.rundown._id,
		})

		expect(savedRundownData.rundown).toMatchObject({
			externalId: rundownData1.externalId,
			playlistId: savedRundownData.rundownPlaylist._id,
		})

		expect(savedRundownData.segments).toHaveLength(2)

		const parts0 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[0]._id)
		expect(parts0).toHaveLength(2)

		const parts1 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[1]._id)
		expect(parts1).toHaveLength(1)
	})

	test('dataRundownUpdate change name', async () => {
		await recreateRundown(rundownData1)

		const rundownData: IngestRundown = {
			...rundownData1,
			name: 'MyMockRundownRenamed',
		}

		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: false,
			rundownSource: createRundownSource(device),
		})

		await expect(context.mockCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(1)
		await expect(context.mockCollections.Rundowns.findFetch()).resolves.toHaveLength(1)

		const savedRundownData = await getRundownData()

		expect(savedRundownData.rundownPlaylist).toMatchObject({
			externalId: savedRundownData.rundown._id,
			name: rundownData.name,
		})

		expect(savedRundownData.rundown).toMatchObject({
			externalId: rundownData.externalId,
			name: rundownData.name,
			playlistId: savedRundownData.rundownPlaylist._id,
		})

		expect(savedRundownData.segments).toHaveLength(2)

		const parts0 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[0]._id)
		expect(parts0).toHaveLength(2)

		const parts1 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[1]._id)
		expect(parts1).toHaveLength(1)
	})

	test('dataRundownUpdate add a segment', async () => {
		await recreateRundown(rundownData1)

		const rundownData = clone(rundownData1)
		rundownData.segments.push({
			externalId: 'segment2',
			name: 'Segment 2',
			rank: 0,
			payload: undefined,
			parts: [
				{
					externalId: 'part3',
					name: 'Part 3',
					rank: 0,
					payload: undefined,
				},
			],
		})

		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: false,
			rundownSource: createRundownSource(device),
		})

		await expect(context.mockCollections.Rundowns.findFetch()).resolves.toHaveLength(1)

		const savedRundownData = await getRundownData()

		expect(savedRundownData.rundown).toMatchObject({
			externalId: rundownData.externalId,
		})

		expect(savedRundownData.segments).toHaveLength(3)

		const parts0 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[0]._id)
		expect(parts0).toHaveLength(2)

		const parts1 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[1]._id)
		expect(parts1).toHaveLength(1)

		const parts2 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[2]._id)
		expect(parts2).toHaveLength(1)
	})

	test('dataRundownUpdate add a part', async () => {
		await recreateRundown(rundownData1)

		const rundownData = clone(rundownData1)
		rundownData.segments.push({
			externalId: 'segment2',
			name: 'Segment 2',
			rank: 0,
			payload: undefined,
			parts: [
				{
					externalId: 'part3',
					name: 'Part 3',
					rank: 0,
					payload: undefined,
				},
			],
		})
		rundownData.segments[1].parts.push({
			externalId: 'partZ',
			name: 'Part Z',
			rank: 0,
			payload: undefined,
		})

		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: false,
			rundownSource: createRundownSource(device),
		})

		await expect(context.mockCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(1)
		await expect(context.mockCollections.Rundowns.findFetch()).resolves.toHaveLength(1)

		const savedRundownData = await getRundownData()

		expect(savedRundownData.rundownPlaylist).toMatchObject({
			externalId: savedRundownData.rundown._id,
		})
		expect(savedRundownData.rundown).toMatchObject({
			externalId: rundownData.externalId,
		})

		expect(savedRundownData.segments).toHaveLength(3)

		const parts0 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[0]._id)
		expect(parts0).toHaveLength(2)

		const parts1 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[1]._id)
		expect(parts1).toHaveLength(2)
		expect(parts1.map((x) => x.title)).toEqual(['Part 2', 'Part Z'])

		const parts2 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[2]._id)
		expect(parts2).toHaveLength(1)
	})

	test('dataRundownUpdate remove a segment', async () => {
		const initialRundownData = clone(rundownData1)
		initialRundownData.segments.push({
			externalId: 'segment2',
			name: 'Segment 2',
			rank: 0,
			payload: undefined,
			parts: [
				{
					externalId: 'part3',
					name: 'Part 3',
					rank: 0,
					payload: undefined,
				},
			],
		})
		await recreateRundown(initialRundownData)

		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: rundownData1.externalId,
			ingestRundown: rundownData1,
			isCreateAction: false,
			rundownSource: createRundownSource(device),
		})

		await expect(context.mockCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(1)
		await expect(context.mockCollections.Rundowns.findFetch()).resolves.toHaveLength(1)

		const savedRundownData = await getRundownData()

		expect(savedRundownData.rundownPlaylist).toMatchObject({
			externalId: savedRundownData.rundown._id,
		})
		expect(savedRundownData.rundown).toMatchObject({
			externalId: rundownData1.externalId,
		})

		expect(savedRundownData.segments).toHaveLength(2)

		const parts0 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[0]._id)
		expect(parts0).toHaveLength(2)

		const parts1 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[1]._id)
		expect(parts1).toHaveLength(1)
	})

	test('dataRundownUpdate remove a part', async () => {
		await recreateRundown(rundownData1)

		const rundownData = clone(rundownData1)
		expect(rundownData.segments[0].parts.shift()).toBeTruthy()

		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: false,
			rundownSource: createRundownSource(device),
		})

		await expect(context.mockCollections.Rundowns.findFetch()).resolves.toHaveLength(1)

		const savedRundownData = await getRundownData()

		expect(savedRundownData.rundownPlaylist).toMatchObject({
			externalId: savedRundownData.rundown._id,
		})
		expect(savedRundownData.rundown).toMatchObject({
			externalId: rundownData.externalId,
		})

		expect(savedRundownData.segments).toHaveLength(2)

		const parts0 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[0]._id)
		expect(parts0).toHaveLength(1)
		expect(parts0[0].externalId).toBe('part1')

		const parts1 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[1]._id)
		expect(parts1).toHaveLength(1)
	})

	test('dataRundownMetaDataUpdate change name, does not remove segments', async () => {
		await recreateRundown(rundownData1)

		const rundownData: Omit<IngestRundown, 'segments'> = {
			externalId: externalId,
			name: 'MyMockRundownRenamed',
			type: 'mock',
			payload: undefined,
		}

		await handleUpdatedRundownMetaDataWrapped(context, {
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			rundownSource: createRundownSource(device),
		})

		await expect(context.mockCollections.RundownPlaylists.findFetch()).resolves.toHaveLength(1)
		await expect(context.mockCollections.Rundowns.findFetch()).resolves.toHaveLength(1)

		const savedRundownData = await getRundownData()

		expect(savedRundownData.rundownPlaylist).toMatchObject({
			externalId: savedRundownData.rundown._id,
			name: rundownData.name,
		})
		expect(savedRundownData.rundown).toMatchObject({
			externalId: rundownData.externalId,
			name: rundownData.name,
			playlistId: savedRundownData.rundownPlaylist._id,
		})

		expect(savedRundownData.segments).toHaveLength(2)

		const parts0 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[0]._id)
		expect(parts0).toHaveLength(2)

		const parts1 = savedRundownData.parts.filter((p) => p.segmentId === savedRundownData.segments[1]._id)
		expect(parts1).toHaveLength(1)
	})

	test('dataRundownDelete', async () => {
		await recreateRundown(rundownData1)

		await handleRemovedRundownWrapped(context, {
			rundownExternalId: externalId,
		})

		await expect(context.mockCollections.Rundowns.findOne()).resolves.toBeFalsy()
		await expect(context.mockCollections.Segments.findFetch()).resolves.toHaveLength(0)
		await expect(context.mockCollections.Parts.findFetch()).resolves.toHaveLength(0)
	})

	test('dataRundownDelete for a second time', async () => {
		await expect(context.mockCollections.Rundowns.findOne()).resolves.toBeFalsy()

		await expect(
			handleRemovedRundownWrapped(context, {
				rundownExternalId: externalId,
			})
		).rejects.toThrow(/Rundown.*not found/i)
	})

	// Note: this test fails, due to a backwards-compatibility hack in #c579c8f0
	// eslint-disable-next-line jest/no-commented-out-tests
	// test('dataRundownDelete bad device', () => {
	// 	await expect(context.mockCollections.Rundowns.findOne()).resolves.toBeFalsy()
	// 	try {
	// 		Meteor.call(
	// 			PeripheralDeviceAPIMethods.dataRundownDelete,
	// 			unprotectString(device._id).slice(0, -1),
	// 			device.token,
	// 			externalId
	// 		)
	// 		fail('expected to throw')
	// 	} catch (e) {
	// 		expect(e.message).toBe('[404] PeripheralDevice "mockDevice" not found')
	// 	}
	// 	try {
	// 		Meteor.call(PeripheralDeviceAPIMethods.dataRundownDelete, device._id, device.token.slice(0, -1), externalId)
	// 		fail('expected to throw')
	// 	} catch (e) {
	// 		expect(e.message).toBe('[401] Not allowed access to peripheralDevice')
	// 	}
	// })

	// Reject update when no preceeding create
	test('dataRundownUpdate when not yet created', async () => {
		await expect(context.mockCollections.Rundowns.findOne()).resolves.toBeFalsy()
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			payload: undefined,
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					payload: undefined,
					parts: [
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
							payload: undefined,
						},
					],
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					payload: undefined,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
							payload: undefined,
						},
					],
				},
			],
		}

		await expect(
			handleUpdatedRundownWrapped(context, {
				rundownExternalId: rundownData.externalId,
				ingestRundown: rundownData,
				isCreateAction: false,
				rundownSource: createRundownSource(device),
			})
		).rejects.toThrow(/Rundown.*not found/)

		await expect(context.mockCollections.Rundowns.findOne()).resolves.toBeFalsy()
	})

	test('dataRundownUpdate fail when rundown is orphaned', async () => {
		await recreateRundown(rundownData1)
		await setRundownsOrphaned()

		const rundown0 = (await context.mockCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown0).toBeTruthy()
		expect(rundown0.orphaned).toEqual(RundownOrphanedReason.DELETED)
		await expect(context.mockCollections.Segments.findFetch({ rundownId: rundown0._id })).resolves.toHaveLength(2)

		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			payload: undefined,
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					payload: undefined,
					parts: [
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
							payload: undefined,
						},
					],
				},
			],
		}

		// Submit an update trying to remove a segment
		await expect(
			handleUpdatedRundownWrapped(context, {
				rundownExternalId: rundownData.externalId,
				ingestRundown: rundownData,
				isCreateAction: false,
				rundownSource: createRundownSource(device2),
			})
		).rejects.toThrow(/Rundown(.+)not found/)

		// Segment count should not have changed
		const rundown1 = (await context.mockCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown1).toBeTruthy()
		expect(rundown1.orphaned).toEqual(RundownOrphanedReason.DELETED)
		await expect(context.mockCollections.Segments.findFetch({ rundownId: rundown1._id })).resolves.toHaveLength(2)
	})

	test('dataRundownCreate replace orphaned rundown', async () => {
		await recreateRundown(rundownData1)
		await setRundownsOrphaned()

		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: rundownData1.externalId,
			ingestRundown: rundownData1,
			isCreateAction: true,
			rundownSource: createRundownSource(device),
		})

		await expect(
			context.mockCollections.Rundowns.findFetch({ orphaned: RundownOrphanedReason.DELETED })
		).resolves.toHaveLength(0)
	})

	test('dataSegmentCreate in deleted rundown', async () => {
		await recreateRundown(rundownData1)
		await setRundownsOrphaned()

		const rundown0 = (await context.mockCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown0).toBeTruthy()
		expect(rundown0.orphaned).toEqual(RundownOrphanedReason.DELETED)
		await expect(context.mockCollections.Segments.findFetch({ rundownId: rundown0._id })).resolves.toHaveLength(2)

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			payload: undefined,
			parts: [],
		}

		await expect(
			handleUpdatedSegmentWrapped(context, {
				rundownExternalId: externalId,
				ingestSegment: ingestSegment,
				isCreateAction: true,
			})
		).rejects.toThrow(/Rundown(.+)not found/)

		await expect(context.mockCollections.Segments.findOne({ externalId: segExternalId })).resolves.toBeFalsy()

		await expect(context.mockCollections.Segments.findFetch({ rundownId: rundown0._id })).resolves.toHaveLength(2)
	})

	test('dataSegmentCreate', async () => {
		await recreateRundown(rundownData1)

		const rundown = (await context.mockCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await expect(context.mockCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(2)

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			payload: undefined,
			parts: [],
		}

		await handleUpdatedSegmentWrapped(context, {
			rundownExternalId: externalId,
			ingestSegment: ingestSegment,
			isCreateAction: true,
		})

		const segment = await context.mockCollections.Segments.findOne({ externalId: segExternalId })
		expect(segment).toBeTruthy()
		expect(segment).toMatchObject({
			externalId: ingestSegment.externalId,
			name: 'MyMockSegment',
		})

		await expect(context.mockCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)
	})

	test('dataSegmentCreate replace deleted segment', async () => {
		await recreateRundown(rundownData1)

		const segExternalId = rundownData1.segments[0].externalId

		const segment0 = (await context.mockCollections.Segments.findOne({ externalId: segExternalId })) as DBSegment
		expect(segment0).toBeTruthy()
		await context.mockCollections.Segments.update(segment0._id, {
			$set: { orphaned: SegmentOrphanedReason.DELETED },
		})

		const rundown = (await context.mockCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await expect(context.mockCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(2)

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment2',
			rank: 0,
			payload: undefined,
			parts: [],
		}

		await handleUpdatedSegmentWrapped(context, {
			rundownExternalId: externalId,
			ingestSegment: ingestSegment,
			isCreateAction: true,
		})

		const segment = await context.mockCollections.Segments.findOne({ externalId: segExternalId })
		expect(segment).toBeTruthy()
		expect(segment).toMatchObject({
			name: 'MyMockSegment2',
		})
	})

	test('dataSegmentUpdate add a part', async () => {
		const rundown = await recreateRundown(rundownData1)

		const segExternalId = rundownData1.segments[0].externalId

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			payload: undefined,
			parts: [
				{
					externalId: 'part42',
					name: 'Part 42',
					rank: 0,
					payload: undefined,
				},
			],
		}

		await handleUpdatedSegmentWrapped(context, {
			rundownExternalId: externalId,
			ingestSegment: ingestSegment,
			isCreateAction: false,
		})

		const segments = await context.mockCollections.Segments.findFetch({ rundownId: rundown._id })
		expect(segments).toHaveLength(2)

		const parts0 = await context.mockCollections.Parts.findFetch({
			rundownId: rundown._id,
			segmentId: segments[0]._id,
		})
		expect(parts0).toHaveLength(1)
		expect(parts0[0]).toMatchObject({
			externalId: 'part42',
			title: 'Part 42',
		})
	})

	test('dataSegmentUpdate deleted segment', async () => {
		const rundown = await recreateRundown(rundownData1)
		await context.mockCollections.Segments.update(
			{ rundownId: rundown._id },
			{ $set: { orphaned: SegmentOrphanedReason.DELETED } }
		)
		await context.mockCollections.NrcsIngestDataCache.remove({
			type: NrcsIngestCacheType.SEGMENT,
			rundownId: rundown._id,
		})

		const segExternalId = rundownData1.segments[0].externalId

		const segmentBefore = (await context.mockCollections.Segments.findOne({
			externalId: segExternalId,
		})) as DBSegment
		expect(segmentBefore).toBeTruthy()

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment2',
			rank: 0,
			payload: undefined,
			parts: [
				{
					externalId: 'part423',
					name: 'Part 423',
					rank: 0,
					payload: undefined,
				},
			],
		}

		await expect(
			handleUpdatedSegmentWrapped(context, {
				rundownExternalId: externalId,
				ingestSegment: ingestSegment,
				isCreateAction: false,
			})
		).rejects.toThrow(/Segment.*not found/)

		await expect(context.mockCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(2)

		// Ensure no changes
		const segmentAfter = (await context.mockCollections.Segments.findOne({
			externalId: segExternalId,
		})) as DBSegment
		expect(segmentAfter).toStrictEqual(segmentBefore)
	})

	test('dataSegmentUpdate deleted rundown', async () => {
		const rundown = await recreateRundown(rundownData1)
		await setRundownsOrphaned()

		const segExternalId = rundownData1.segments[0].externalId

		const segmentBefore = (await context.mockCollections.Segments.findOne({
			externalId: segExternalId,
		})) as DBSegment
		expect(segmentBefore).toBeTruthy()

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment2',
			rank: 0,
			payload: undefined,
			parts: [
				{
					externalId: 'part423',
					name: 'Part 423',
					rank: 0,
					payload: undefined,
				},
			],
		}

		await expect(
			handleUpdatedSegmentWrapped(context, {
				rundownExternalId: externalId,
				ingestSegment: ingestSegment,
				isCreateAction: false,
			})
		).rejects.toThrow(/Rundown.*not found/)

		await expect(context.mockCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(2)

		// Ensure no changes
		const segmentAfter = (await context.mockCollections.Segments.findOne({
			externalId: segExternalId,
		})) as DBSegment
		expect(segmentAfter).toStrictEqual(segmentBefore)
	})

	test('dataSegmentUpdate non-existant rundown', async () => {
		const segExternalId2 = getRandomString()
		const ingestSegment: IngestSegment = {
			externalId: segExternalId2,
			name: 'MyMockSegment',
			rank: 0,
			payload: undefined,
			parts: [],
		}

		await expect(context.mockCollections.Segments.findOne({ externalId: segExternalId2 })).resolves.toBeFalsy()

		await expect(
			handleUpdatedSegmentWrapped(context, {
				rundownExternalId: 'wibble',
				ingestSegment: ingestSegment,
				isCreateAction: false,
			})
		).rejects.toThrow(/Rundown.*not found/)

		await expect(context.mockCollections.Segments.findOne({ externalId: segExternalId2 })).resolves.toBeFalsy()
	})

	test('dataSegmentUpdate no change', async () => {
		const rundown = await recreateRundown(rundownData1)

		const segmentsBefore = await context.mockCollections.Segments.findFetch({ rundownId: rundown._id })
		expect(segmentsBefore).toHaveLength(2)

		const partsBefore = await context.mockCollections.Parts.findFetch({
			rundownId: rundown._id,
			segmentId: segmentsBefore[0]._id,
		})

		const ingestSegment = rundownData1.segments[0]

		await handleUpdatedSegmentWrapped(context, {
			rundownExternalId: externalId,
			ingestSegment: ingestSegment,
			isCreateAction: false,
		})

		const segmentsAfter = await context.mockCollections.Segments.findFetch({ rundownId: rundown._id })
		expect(segmentsAfter).toHaveLength(2)

		const partsAfter = await context.mockCollections.Parts.findFetch({
			rundownId: rundown._id,
			segmentId: segmentsBefore[0]._id,
		})
		expect(partsAfter).toEqual(partsBefore)
	})

	test('dataSegmentUpdate remove a part', async () => {
		const rundown = await recreateRundown(rundownData1)

		const ingestSegment = clone(rundownData1.segments[0])
		expect(ingestSegment.parts.pop()).toBeTruthy()

		const segmentsBefore = await context.mockCollections.Segments.findFetch({ rundownId: rundown._id })
		expect(segmentsBefore).toHaveLength(2)

		const partsBefore = await context.mockCollections.Parts.findFetch({
			rundownId: rundown._id,
			segmentId: segmentsBefore[0]._id,
		})
		expect(partsBefore).toHaveLength(2)

		await handleUpdatedSegmentWrapped(context, {
			rundownExternalId: externalId,
			ingestSegment: ingestSegment,
			isCreateAction: false,
		})

		const partsAfter = await context.mockCollections.Parts.findFetch({
			rundownId: rundown._id,
			segmentId: segmentsBefore[0]._id,
		})
		expect(partsAfter).toHaveLength(1)
	})

	test('dataSegmentUpdate no external id', async () => {
		await recreateRundown(rundownData1)

		const ingestSegment: IngestSegment = {
			externalId: '',
			name: 'MyMockSegment',
			rank: 0,
			payload: undefined,
			parts: [],
		}

		await expect(
			handleUpdatedSegmentWrapped(context, {
				rundownExternalId: externalId,
				ingestSegment: ingestSegment,
				isCreateAction: false,
			})
		).rejects.toThrow(`Segment externalId must be set!`)
	})

	test('dataSegmentDelete already orphaned segment', async () => {
		const rundown = await recreateRundown(rundownData1)
		await context.mockCollections.NrcsIngestDataCache.remove({
			type: NrcsIngestCacheType.SEGMENT,
			rundownId: rundown._id,
		})

		const segExternalId = rundownData1.segments[0].externalId

		await context.mockCollections.Segments.update(
			{ rundownId: rundown._id, externalId: segExternalId },
			{ $set: { orphaned: SegmentOrphanedReason.DELETED } }
		)

		await expect(
			handleRemovedSegmentWrapped(context, {
				rundownExternalId: externalId,
				segmentExternalId: segExternalId,
			})
		).rejects.toThrow(/Rundown(.*) does not have a Segment(.*) to remove/)

		await expect(context.mockCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(2)
		await expect(context.mockCollections.Segments.findOne({ externalId: segExternalId })).resolves.toBeTruthy()
	})

	test('dataSegmentDelete in deleted rundown', async () => {
		// reset rundown
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			payload: undefined,
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					payload: undefined,
					parts: [
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 0,
							payload: undefined,
						},
					],
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 0,
					payload: undefined,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
							payload: undefined,
						},
					],
				},
				{
					externalId: segExternalId,
					name: 'Segment 3',
					rank: 0,
					payload: undefined,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
							payload: undefined,
						},
					],
				},
			],
		}

		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: externalId,
			ingestRundown: rundownData,
			isCreateAction: true,
			rundownSource: createRundownSource(device),
		})

		const rundown = (await context.mockCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		await expect(
			context.mockCollections.Segments.findFetch({ rundownId: rundown._id, externalId: segExternalId })
		).resolves.toHaveLength(1)

		await context.mockCollections.Rundowns.update({}, { $set: { orphaned: RundownOrphanedReason.DELETED } })
		await context.mockCollections.NrcsIngestDataCache.remove({})
		await context.mockCollections.Segments.update({ rundownId: rundown._id }, { $unset: { orphaned: 1 } })

		await expect(context.mockCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)

		await expect(
			handleRemovedSegmentWrapped(context, {
				rundownExternalId: externalId,
				segmentExternalId: segExternalId,
			})
		).rejects.toThrow(/Rundown(.+)not found/)

		await expect(context.mockCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(3)
		await expect(context.mockCollections.Segments.findOne({ externalId: segExternalId })).resolves.toBeTruthy()
	})

	test('dataSegmentDelete', async () => {
		const rundown = await recreateRundown(rundownData1)

		const segExternalId = rundownData1.segments[1].externalId

		await handleRemovedSegmentWrapped(context, {
			rundownExternalId: externalId,
			segmentExternalId: segExternalId,
		})

		await expect(context.mockCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(1)
		await expect(context.mockCollections.Segments.findOne({ externalId: segExternalId })).resolves.toBeFalsy()
	})

	test('dataSegmentDelete an unknown segment', async () => {
		const rundown = await recreateRundown(rundownData1)
		await expect(
			context.mockCollections.Segments.findFetch({ rundownId: rundown._id, externalId: segExternalId })
		).resolves.toHaveLength(0)

		await expect(
			handleRemovedSegmentWrapped(context, {
				rundownExternalId: externalId,
				segmentExternalId: segExternalId,
			})
		).rejects.toThrow(`Rundown "${externalId}" does not have a Segment "${segExternalId}" to remove`)

		await expect(context.mockCollections.Segments.findFetch({ rundownId: rundown._id })).resolves.toHaveLength(2)
	})

	test('dataSegmentDelete from non-existant rundown', async () => {
		const rundown = await context.mockCollections.Rundowns.findOne({})
		expect(rundown).toBeFalsy()

		await expect(
			handleRemovedSegmentWrapped(context, {
				rundownExternalId: 'wibble',
				segmentExternalId: segExternalId,
			})
		).rejects.toThrow(/Rundown.*not found/i)
	})

	test('dataSegmentCreate non-existant rundown', async () => {
		const rundown = (await context.mockCollections.Rundowns.findOne({})) as DBRundown
		expect(rundown).toBeFalsy()

		const ingestSegment: IngestSegment = {
			externalId: segExternalId,
			name: 'MyMockSegment',
			rank: 0,
			payload: undefined,
			parts: [],
		}
		await expect(
			handleUpdatedSegmentWrapped(context, {
				rundownExternalId: 'wibble',
				ingestSegment: ingestSegment,
				isCreateAction: true,
			})
		).rejects.toThrow(/Rundown.*not found/)
	})

	test('dataPartCreate', async () => {
		const rundown = await recreateRundown(rundownData1)

		const segmentExternalId = rundownData1.segments[0].externalId
		const segment = (await context.mockCollections.Segments.findOne({ externalId: segmentExternalId })) as DBSegment
		await expect(
			context.mockCollections.Parts.findFetch({ rundownId: rundown._id, segmentId: segment._id })
		).resolves.toHaveLength(2)

		const ingestPart: IngestPart = {
			externalId: 'party',
			name: 'Part Y',
			rank: 0,
			payload: undefined,
		}

		await handleUpdatedPartWrapped(context, {
			rundownExternalId: externalId,
			segmentExternalId: segment.externalId,
			ingestPart: ingestPart,
			isCreateAction: true,
		})

		await expect(
			context.mockCollections.Parts.findFetch({ rundownId: rundown._id, segmentId: segment._id })
		).resolves.toHaveLength(3)

		const part = (await context.mockCollections.Parts.findOne({ externalId: 'party' })) as DBPart
		expect(part).toMatchObject({
			externalId: ingestPart.externalId,
			title: ingestPart.name,
		})
	})

	test('dataPartUpdate', async () => {
		const rundown = await recreateRundown(rundownData1)

		const segmentExternalId = rundownData1.segments[0].externalId
		const segment = (await context.mockCollections.Segments.findOne({ externalId: segmentExternalId })) as DBSegment
		await expect(
			context.mockCollections.Parts.findFetch({ rundownId: rundown._id, segmentId: segment._id })
		).resolves.toHaveLength(2)

		const ingestPart = clone(rundownData1.segments[0].parts[0])
		ingestPart.name = 'My special part'

		await handleUpdatedPartWrapped(context, {
			rundownExternalId: externalId,
			segmentExternalId: segment.externalId,
			ingestPart: ingestPart,
			isCreateAction: false,
		})

		await expect(
			context.mockCollections.Parts.findFetch({ rundownId: rundown._id, segmentId: segment._id })
		).resolves.toHaveLength(2)

		const part = (await context.mockCollections.Parts.findOne({ externalId: ingestPart.externalId })) as DBPart
		expect(part).toMatchObject({
			externalId: ingestPart.externalId,
			title: ingestPart.name,
		})
	})

	test('dataPartDelete', async () => {
		const rundown = await recreateRundown(rundownData1)

		const segmentExternalId = rundownData1.segments[0].externalId
		const partExternalId = rundownData1.segments[0].parts[0].externalId

		const segment = (await context.mockCollections.Segments.findOne({ externalId: segmentExternalId })) as DBSegment
		await expect(
			context.mockCollections.Parts.findFetch({
				rundownId: rundown._id,
				segmentId: segment._id,
				externalId: partExternalId,
			})
		).resolves.toHaveLength(1)

		await handleRemovedPartWrapped(context, {
			rundownExternalId: externalId,
			segmentExternalId: segment.externalId,
			partExternalId: partExternalId,
		})

		await expect(
			context.mockCollections.Parts.findFetch({ rundownId: rundown._id, segmentId: segment._id })
		).resolves.toHaveLength(1)
		await expect(context.mockCollections.Parts.findOne({ externalId: partExternalId })).resolves.toBeFalsy()
	})

	// TODO Part tests are minimal/happy path only on the assumption the API gets little use

	test('dataSegmentRanksUpdate', async () => {
		await context.mockCollections.Rundowns.remove({})
		await expect(context.mockCollections.Rundowns.findOne()).resolves.toBeFalsy()

		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			payload: undefined,
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 1,
					payload: undefined,
					parts: [],
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 2,
					payload: undefined,
					parts: [],
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 3,
					payload: undefined,
					parts: [],
				},
				{
					externalId: 'segment3',
					name: 'Segment 3',
					rank: 4,
					payload: undefined,
					parts: [],
				},
				{
					externalId: 'segment4',
					name: 'Segment 4',
					rank: 5,
					payload: undefined,
					parts: [],
				},
				{
					externalId: 'segment5',
					name: 'Segment 5',
					rank: 6,
					payload: undefined,
					parts: [],
				},
			],
		}
		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: externalId,
			ingestRundown: rundownData,
			isCreateAction: true,
			rundownSource: createRundownSource(device),
		})

		const rundown = (await context.mockCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()

		await handleUpdatedSegmentRanksWrapped(context, {
			rundownExternalId: externalId,
			newRanks: {
				['segment0']: 6,
				['segment2']: 1,
				['segment5']: 3,
			},
		})

		const segments = await context.mockCollections.Segments.findFetch({ rundownId: rundown._id })
		expect(segments).toHaveLength(6)

		expect(segments.find((s) => s.externalId === 'segment0')?._rank).toBe(5)
		expect(segments.find((s) => s.externalId === 'segment1')?._rank).toBe(1)
		expect(segments.find((s) => s.externalId === 'segment2')?._rank).toBe(0)
		expect(segments.find((s) => s.externalId === 'segment3')?._rank).toBe(3)
		expect(segments.find((s) => s.externalId === 'segment4')?._rank).toBe(4)
		expect(segments.find((s) => s.externalId === 'segment5')?._rank).toBe(2)
	})

	test('unsyncing of rundown', async () => {
		// Preparation: set up rundown
		await expect(context.mockCollections.Rundowns.findOne()).resolves.toBeFalsy()

		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: rundownData1.externalId,
			ingestRundown: rundownData1,
			isCreateAction: true,
			rundownSource: createRundownSource(device2),
		})

		const rundown = (await context.mockCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		expect(rundown).toMatchObject({
			externalId: rundownData1.externalId,
		})

		const getRundownOrphaned = async () => {
			const rd = (await context.mockCollections.Rundowns.findOne(rundown._id)) as DBRundown
			return rd.orphaned
		}
		const getPlaylist = async () =>
			(await context.mockCollections.RundownPlaylists.findOne(rundown.playlistId)) as DBRundownPlaylist
		const getSegmentOrphaned = async (id: SegmentId) => {
			const segment = (await context.mockCollections.Segments.findOne(id)) as DBSegment
			return segment.orphaned
		}

		const resyncRundown = async () => {
			// simulate a resync. we don't have a gateway to call out to, but this is how it will respond
			await handleUpdatedRundownWrapped(context, {
				rundownExternalId: rundownData1.externalId,
				ingestRundown: rundownData1,
				isCreateAction: true,
				rundownSource: createRundownSource(device2),
			})
		}

		const segments = await context.mockCollections.Segments.findFetch({ rundownId: rundown._id })
		const parts = await context.mockCollections.Parts.findFetch({ rundownId: rundown._id })

		expect(segments).toHaveLength(2)
		expect(parts).toHaveLength(3)

		// Activate the rundown, make data updates and verify that it gets unsynced properly
		await handleActivateRundownPlaylist(context, {
			playlistId: rundown.playlistId,
			rehearsal: true,
		})
		await expect(getRundownOrphaned()).resolves.toBeUndefined()

		await expect(
			handleRemovedRundownWrapped(context, {
				rundownExternalId: rundownData1.externalId,
			})
		).rejects.toMatchUserError(UserErrorMessage.RundownRemoveWhileActive)
		await expect(getRundownOrphaned()).resolves.toEqual(RundownOrphanedReason.DELETED)

		await resyncRundown()
		await expect(getRundownOrphaned()).resolves.toBeUndefined()

		await handleTakeNextPart(context, { playlistId: rundown.playlistId, fromPartInstanceId: null })
		const partInstance = await context.mockCollections.PartInstances.findFetch({ 'part._id': parts[0]._id })
		expect(partInstance).toHaveLength(1)
		await expect(getPlaylist()).resolves.toMatchObject({
			currentPartInfo: { partInstanceId: partInstance[0]._id },
		})
		expect(partInstance[0].segmentId).toEqual(segments[0]._id)

		await handleRemovedSegmentWrapped(context, {
			rundownExternalId: rundown.externalId,
			segmentExternalId: segments[0].externalId,
		})
		await expect(getRundownOrphaned()).resolves.toBeUndefined()
		await expect(getSegmentOrphaned(segments[0]._id)).resolves.toEqual(SegmentOrphanedReason.DELETED)

		await resyncRundown()
		await expect(getRundownOrphaned()).resolves.toBeUndefined()
		await expect(getSegmentOrphaned(segments[0]._id)).resolves.toBeUndefined()

		await handleRemovedPartWrapped(context, {
			rundownExternalId: rundown.externalId,
			segmentExternalId: segments[0].externalId,
			partExternalId: parts[0].externalId,
		})
		await expect(getRundownOrphaned()).resolves.toBeUndefined()
		await expect(getSegmentOrphaned(segments[0]._id)).resolves.toBeUndefined()

		await resyncRundown()
		await expect(getRundownOrphaned()).resolves.toBeUndefined()
		await expect(getSegmentOrphaned(segments[0]._id)).resolves.toBeUndefined()
	})

	test('replace the nexted part', async () => {
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			payload: undefined,
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					payload: undefined,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
							payload: {
								pieces: [
									literal<IBlueprintPiece>({
										externalId: 'piece0',
										name: '',
										enable: { start: 0 },
										sourceLayerId: '',
										outputLayerId: '',
										lifespan: PieceLifespan.WithinPart,
										content: {
											timelineObjects: [],
										},
									}),
								],
							},
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 1,
							payload: {
								pieces: [
									literal<IBlueprintPiece>({
										externalId: 'piece1',
										name: '',
										enable: { start: 0 },
										sourceLayerId: '',
										outputLayerId: '',
										lifespan: PieceLifespan.WithinPart,
										content: {
											timelineObjects: [],
										},
									}),
								],
							},
						},
					],
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 1,
					payload: undefined,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
							payload: undefined,
						},
					],
				},
			],
		}

		// Preparation: set up rundown
		await expect(context.mockCollections.Rundowns.findOne()).resolves.toBeFalsy()

		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: true,
			rundownSource: createRundownSource(device2),
		})

		const rundown = (await context.mockCollections.Rundowns.findOne({ externalId: externalId })) as DBRundown
		expect(rundown).toBeTruthy()
		expect(rundown).toMatchObject({
			externalId: rundownData.externalId,
		})

		// const getRundown = () => Rundowns.findOne(rundown._id) as Rundown
		const getPlaylist = async () =>
			(await context.mockCollections.RundownPlaylists.findOne(rundown.playlistId)) as DBRundownPlaylist

		const segments = await context.mockCollections.Segments.findFetch({ rundownId: rundown._id })
		const parts = await context.mockCollections.Parts.findFetch({ rundownId: rundown._id })

		expect(segments).toHaveLength(2)
		expect(parts).toHaveLength(3)
		await expect(context.mockCollections.Pieces.findFetch({ startRundownId: rundown._id })).resolves.toHaveLength(2)

		// Activate the rundown, make data updates and verify that it gets unsynced properly
		await handleActivateRundownPlaylist(context, {
			playlistId: rundown.playlistId,
			rehearsal: true,
		})
		await expect(getPlaylist()).resolves.toMatchObject({ currentPartInfo: null })

		// Take the first part
		await handleTakeNextPart(context, { playlistId: rundown.playlistId, fromPartInstanceId: null })
		await expect(getPlaylist()).resolves.toMatchObject({
			currentPartInfo: {
				partInstanceId: expect.stringContaining('random'),
			},
		})

		{
			// Check which parts are current and next
			const playlist = await getPlaylist()
			const selectedInstances = await getSelectedPartInstances(context, playlist)
			const currentPartInstance = selectedInstances.currentPartInstance as DBPartInstance
			const nextPartInstance = selectedInstances.nextPartInstance as DBPartInstance
			expect(currentPartInstance).toBeTruthy()
			expect(currentPartInstance.part.externalId).toBe('part0')
			expect(nextPartInstance).toBeTruthy()
			expect(nextPartInstance.part.externalId).toBe('part1')

			// we should have some pieces
			await expect(
				context.mockCollections.PieceInstances.findFetch({ partInstanceId: nextPartInstance._id })
			).resolves.not.toHaveLength(0)
		}

		// Replace part1 with a new part
		const updatedSegmentData: IngestSegment = rundownData.segments[0]
		updatedSegmentData.parts[1].externalId = 'new-part'

		await handleUpdatedSegmentWrapped(context, {
			rundownExternalId: rundownData.externalId,
			ingestSegment: updatedSegmentData,
			isCreateAction: false,
		})

		{
			const segments2 = await context.mockCollections.Segments.findFetch({ rundownId: rundown._id })
			const parts2 = await context.mockCollections.Parts.findFetch({ rundownId: rundown._id })

			expect(segments2).toHaveLength(2)
			expect(parts2).toHaveLength(3)

			expect(parts2.find((p) => p.externalId === 'part1')).toBeFalsy()
			const newPart = parts2.find((p) => p.externalId === 'new-part') as DBPart
			expect(newPart).toBeTruthy()

			await expect(
				context.mockCollections.Pieces.findFetch({ startRundownId: rundown._id })
			).resolves.toHaveLength(2)

			// we need some pieces for the test to work
			await expect(
				context.mockCollections.Pieces.findFetch({ startPartId: newPart._id })
			).resolves.not.toHaveLength(0)
		}

		{
			// Check if the partInstance was updated
			const playlist = await getPlaylist()
			const selectedInstances = await getSelectedPartInstances(context, playlist)
			const currentPartInstance = selectedInstances.currentPartInstance as DBPartInstance
			const nextPartInstance = selectedInstances.nextPartInstance as DBPartInstance
			expect(currentPartInstance).toBeTruthy()
			expect(currentPartInstance.part.externalId).toBe('part0')
			expect(nextPartInstance).toBeTruthy()
			expect(nextPartInstance.part.externalId).toBe('new-part')

			// the pieces should have been copied
			await expect(
				context.mockCollections.PieceInstances.findFetch({ partInstanceId: nextPartInstance._id })
			).resolves.not.toHaveLength(0)
		}
	})

	test('previous partinstance getting removed if an adlib part', async () => {
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			payload: undefined,
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					payload: undefined,
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
							payload: {
								pieces: [
									literal<IBlueprintPiece>({
										externalId: 'piece0',
										name: '',
										enable: { start: 0 },
										sourceLayerId: '',
										outputLayerId: '',
										lifespan: PieceLifespan.WithinPart,
										content: {
											timelineObjects: [],
										},
									}),
								],
							},
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 1,
							payload: {
								pieces: [
									literal<IBlueprintPiece>({
										externalId: 'piece1',
										name: '',
										enable: { start: 0 },
										sourceLayerId: '',
										outputLayerId: '',
										lifespan: PieceLifespan.WithinPart,
										content: {
											timelineObjects: [],
										},
									}),
								],
							},
						},
					],
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 1,
					payload: undefined,
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
							payload: undefined,
						},
					],
				},
				{
					externalId: 'segment2',
					name: 'Segment 2',
					rank: 1,
					payload: undefined,
					parts: [
						{
							externalId: 'part3',
							name: 'Part 3',
							rank: 0,
							payload: undefined,
						},
					],
				},
			],
		}

		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: true,
			rundownSource: createRundownSource(device2),
		})

		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		// Take into first part
		await handleActivateRundownPlaylist(context, {
			playlistId: rundown.playlistId,
			rehearsal: true,
		})
		await handleTakeNextPart(context, {
			playlistId: rundown.playlistId,
			fromPartInstanceId: null,
		})

		const doQueuePart = async (): Promise<PartInstanceId> =>
			runJobWithPlayoutModel(
				context,
				{
					playlistId: rundown.playlistId,
				},
				null,
				async (playoutModel) => {
					const rundown0 = playoutModel.rundowns[0]
					expect(rundown0).toBeTruthy()

					const currentPartInstance = playoutModel.currentPartInstance as PlayoutPartInstanceModel
					expect(currentPartInstance).toBeTruthy()

					// Simulate a queued part
					const newPartInstance = await insertQueuedPartWithPieces(
						context,
						playoutModel,
						rundown0,
						currentPartInstance,
						{
							_id: protectString(`after_${currentPartInstance.partInstance._id}_part`),
							externalId: `after_${currentPartInstance.partInstance._id}_externalId`,
							title: 'New part',
							expectedDurationWithTransition: undefined,
						},
						[],
						undefined
					)

					return newPartInstance.partInstance._id
				}
			)

		// Queue and take an adlib-part
		const partInstanceId0 = await doQueuePart()
		{
			const playlist = (await context.mockCollections.RundownPlaylists.findOne(
				rundown.playlistId
			)) as DBRundownPlaylist
			expect(playlist).toBeTruthy()

			await handleTakeNextPart(context, {
				playlistId: rundown.playlistId,
				fromPartInstanceId: playlist.currentPartInfo?.partInstanceId ?? null,
			})
		}

		{
			// Verify it was taken properly
			const playlist = (await context.mockCollections.RundownPlaylists.findOne(
				rundown.playlistId
			)) as DBRundownPlaylist
			expect(playlist).toBeTruthy()
			expect(playlist.currentPartInfo?.partInstanceId).toBe(partInstanceId0)

			const currentPartInstance = (await getSelectedPartInstances(context, playlist))
				.currentPartInstance as DBPartInstance
			expect(currentPartInstance).toBeTruthy()
			expect(currentPartInstance.orphaned).toBe('adlib-part')
		}

		// Ingest update should have no effect
		const ingestSegment: IngestSegment = {
			externalId: 'segment2',
			name: 'Segment 2a',
			rank: 1,
			payload: undefined,
			parts: [
				{
					externalId: 'part3',
					name: 'Part 3',
					rank: 0,
					payload: undefined,
				},
			],
		}

		{
			// Check props before
			const segment2 = (await context.mockCollections.Segments.findOne({
				externalId: ingestSegment.externalId,
				rundownId: rundown._id,
			})) as DBSegment
			expect(segment2).toBeTruthy()
			expect(segment2.name).not.toBe(ingestSegment.name)
		}

		await handleUpdatedSegmentWrapped(context, {
			rundownExternalId: rundownData.externalId,
			ingestSegment: ingestSegment,
			isCreateAction: false,
		})

		{
			// Check props after
			const segment2 = (await context.mockCollections.Segments.findOne({
				externalId: ingestSegment.externalId,
				rundownId: rundown._id,
			})) as DBSegment
			expect(segment2).toBeTruthy()
			expect(segment2.name).toBe(ingestSegment.name)
		}

		{
			// Verify the adlibbed part-instance didnt change
			const playlist = (await context.mockCollections.RundownPlaylists.findOne(
				rundown.playlistId
			)) as DBRundownPlaylist
			expect(playlist).toBeTruthy()
			expect(playlist.currentPartInfo?.partInstanceId).toBe(partInstanceId0)

			const currentPartInstance = (await getSelectedPartInstances(context, playlist))
				.currentPartInstance as DBPartInstance
			expect(currentPartInstance).toBeTruthy()
			expect(currentPartInstance.orphaned).toBe('adlib-part')
		}

		// Queue and take another adlib-part
		const partInstanceId1 = await doQueuePart()
		{
			const playlist = (await context.mockCollections.RundownPlaylists.findOne(
				rundown.playlistId
			)) as DBRundownPlaylist
			expect(playlist).toBeTruthy()

			await handleTakeNextPart(context, {
				playlistId: rundown.playlistId,
				fromPartInstanceId: playlist.currentPartInfo?.partInstanceId ?? null,
			})
		}

		{
			// Verify the take was correct
			const playlist = (await context.mockCollections.RundownPlaylists.findOne(
				rundown.playlistId
			)) as DBRundownPlaylist
			expect(playlist).toBeTruthy()
			expect(playlist.currentPartInfo?.partInstanceId).toBe(partInstanceId1)
			expect(playlist.previousPartInfo?.partInstanceId).toBe(partInstanceId0)

			const currentPartInstance = (await getSelectedPartInstances(context, playlist))
				.currentPartInstance as DBPartInstance
			expect(currentPartInstance).toBeTruthy()
			expect(currentPartInstance.orphaned).toBe('adlib-part')

			const previousPartInstance = (await getSelectedPartInstances(context, playlist))
				.previousPartInstance as DBPartInstance
			expect(previousPartInstance).toBeTruthy()
			expect(previousPartInstance.orphaned).toBe('adlib-part')
		}

		// Another ingest update
		ingestSegment.name += '2'

		{
			// Check props before
			const segment2 = (await context.mockCollections.Segments.findOne({
				externalId: ingestSegment.externalId,
				rundownId: rundown._id,
			})) as DBSegment
			expect(segment2).toBeTruthy()
			expect(segment2.name).not.toBe(ingestSegment.name)
		}

		await handleUpdatedSegmentWrapped(context, {
			rundownExternalId: rundownData.externalId,
			ingestSegment: ingestSegment,
			isCreateAction: false,
		})

		{
			// Check props after
			const segment2 = (await context.mockCollections.Segments.findOne({
				externalId: ingestSegment.externalId,
				rundownId: rundown._id,
			})) as DBSegment
			expect(segment2).toBeTruthy()
			expect(segment2.name).toBe(ingestSegment.name)
		}

		{
			// Verify the part-instances havent changed
			const playlist = (await context.mockCollections.RundownPlaylists.findOne(
				rundown.playlistId
			)) as DBRundownPlaylist
			expect(playlist).toBeTruthy()
			expect(playlist.currentPartInfo?.partInstanceId).toBe(partInstanceId1)
			expect(playlist.previousPartInfo?.partInstanceId).toBe(partInstanceId0)

			const currentPartInstance = (await getSelectedPartInstances(context, playlist))
				.currentPartInstance as DBPartInstance
			expect(currentPartInstance).toBeTruthy()
			expect(currentPartInstance.orphaned).toBe('adlib-part')

			const previousPartInstance = (await getSelectedPartInstances(context, playlist))
				.previousPartInstance as DBPartInstance
			expect(previousPartInstance).toBeTruthy()
			expect(previousPartInstance.orphaned).toBe('adlib-part')
		}
	})
	test('prevent hiding current segment when deleting segment onAir', async () => {
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			payload: undefined,
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					payload: {},
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
							payload: {
								pieces: [
									literal<IBlueprintPiece>({
										externalId: 'piece0',
										name: '',
										enable: { start: 0 },
										sourceLayerId: '',
										outputLayerId: '',
										lifespan: PieceLifespan.WithinPart,
										content: { timelineObjects: [] },
									}),
								],
							},
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 1,
							payload: {
								pieces: [
									literal<IBlueprintPiece>({
										externalId: 'piece1',
										name: '',
										enable: { start: 0 },
										sourceLayerId: '',
										outputLayerId: '',
										lifespan: PieceLifespan.WithinPart,
										content: { timelineObjects: [] },
									}),
								],
							},
						},
					],
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 1,
					payload: {},
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
							payload: undefined,
						},
					],
				},
			],
		}

		// Preparation: set up rundown
		await expect(context.mockCollections.Rundowns.findOne()).resolves.toBeFalsy()
		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: true,
			rundownSource: createRundownSource(device2),
		})
		const rundown = (await context.mockCollections.Rundowns.findOne()) as Rundown
		expect(rundown).toMatchObject({
			externalId: rundownData.externalId,
		})

		const getPlaylist = async () =>
			(await context.mockCollections.RundownPlaylists.findOne(rundown.playlistId)) as DBRundownPlaylist
		const getCurrentPartInstanceId = async () => {
			const playlist = await getPlaylist()
			return playlist.currentPartInfo?.partInstanceId ?? null
		}

		const playlist = await getPlaylist()
		expect(playlist).toBeTruthy()

		// const getRundown = async () => (await context.mockCollections.Rundowns.findOne(rundown._id)) as Rundown

		const { segments, parts } = await getRundownData({ _id: rundown._id })
		expect(segments).toHaveLength(2)
		expect(parts).toHaveLength(3)
		await expect(context.mockCollections.Pieces.findFetch({ startRundownId: rundown._id })).resolves.toHaveLength(2)

		// Activate the rundown
		await handleActivateRundownPlaylist(context, {
			playlistId: playlist._id,
			rehearsal: true,
		})
		await expect(getCurrentPartInstanceId()).resolves.toBeNull()

		// Take the first part
		await handleTakeNextPart(context, {
			playlistId: playlist._id,
			fromPartInstanceId: null,
		})
		await expect(getCurrentPartInstanceId()).resolves.not.toBeNull()

		{
			// Check which part is current
			const selectedInstances = await getSelectedPartInstances(context, await getPlaylist())
			const currentPartInstance = selectedInstances.currentPartInstance as DBPartInstance
			expect(currentPartInstance).toBeTruthy()
			expect(currentPartInstance.part.externalId).toBe('part0')
		}

		// Delete segment 0, while on air
		const segmentExternalId = rundownData.segments[0].externalId
		await handleRemovedSegmentWrapped(context, {
			rundownExternalId: rundownData.externalId,
			segmentExternalId: segmentExternalId,
		})

		{
			const { segments, parts } = await getRundownData({ _id: rundown._id })
			expect(segments).toHaveLength(2)

			const segment0 = segments.find((s) => s.externalId === segmentExternalId) as DBSegment
			expect(segment0).toBeTruthy()
			expect(segment0.orphaned).toBe(SegmentOrphanedReason.DELETED)
			expect(segment0.isHidden).toBeFalsy()

			// Check that the PartInstance is still there
			const selectedInstances = await getSelectedPartInstances(context, await getPlaylist())
			const currentPartInstance = selectedInstances.currentPartInstance as DBPartInstance
			expect(currentPartInstance).toBeTruthy()
			expect(currentPartInstance.part.externalId).toBe('part0')
			expect(currentPartInstance.part.segmentId).toBe(segment0._id)

			// Check that the Parts have been removed
			const parts0 = parts.filter((p) => p.segmentId === segment0._id)
			expect(parts0).toHaveLength(0) // <- FAIL, length is 2
		}

		// Trigger an 'resync' of the rundown
		rundownData.segments.splice(0, 1)
		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: false,
			rundownSource: createRundownSource(device2),
		})

		// Make sure segment0 is still deleted
		{
			const { segments } = await getRundownData({ _id: rundown._id })
			expect(segments).toHaveLength(2)

			const segment0 = segments.find((s) => s.externalId === segmentExternalId) as DBSegment
			expect(segment0).toBeTruthy()
			expect(segment0.orphaned).toBe(SegmentOrphanedReason.DELETED)
			expect(segment0.isHidden).toBeFalsy()
		}
	})
	test('ensure rundown can be deleted if it has bad showstyle ids', async () => {
		const rundownData: IngestRundown = {
			externalId: externalId,
			name: 'MyMockRundown',
			type: 'mock',
			payload: undefined,
			segments: [
				{
					externalId: 'segment0',
					name: 'Segment 0',
					rank: 0,
					payload: {},
					parts: [
						{
							externalId: 'part0',
							name: 'Part 0',
							rank: 0,
							payload: {
								pieces: [
									literal<IBlueprintPiece>({
										externalId: 'piece0',
										name: '',
										enable: { start: 0 },
										sourceLayerId: '',
										outputLayerId: '',
										lifespan: PieceLifespan.WithinPart,
										content: { timelineObjects: [] },
									}),
								],
							},
						},
						{
							externalId: 'part1',
							name: 'Part 1',
							rank: 1,
							payload: {
								pieces: [
									literal<IBlueprintPiece>({
										externalId: 'piece1',
										name: '',
										enable: { start: 0 },
										sourceLayerId: '',
										outputLayerId: '',
										lifespan: PieceLifespan.WithinPart,
										content: { timelineObjects: [] },
									}),
								],
							},
						},
					],
				},
				{
					externalId: 'segment1',
					name: 'Segment 1',
					rank: 1,
					payload: {},
					parts: [
						{
							externalId: 'part2',
							name: 'Part 2',
							rank: 0,
							payload: undefined,
						},
					],
				},
			],
		}

		// Preparation: set up rundown
		await expect(context.mockCollections.Rundowns.findOne()).resolves.toBeFalsy()
		await handleUpdatedRundownWrapped(context, {
			rundownExternalId: rundownData.externalId,
			ingestRundown: rundownData,
			isCreateAction: true,
			rundownSource: createRundownSource(device2),
		})
		const rundown = (await context.mockCollections.Rundowns.findOne()) as Rundown
		expect(rundown).toMatchObject({
			externalId: rundownData.externalId,
		})

		await context.mockCollections.Rundowns.update(rundown._id, {
			$set: {
				showStyleVariantId: protectString('this-is-not-a-real-id'),
			},
		})

		await handleUserRemoveRundown(context, {
			rundownId: rundown._id,
		})

		const rundownAfter = await context.mockCollections.Rundowns.findOne(rundown._id)
		expect(rundownAfter).toBeUndefined()
	})
})
