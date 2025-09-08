import { mockRO } from './mock-mos-data.js'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { sortPartsInSortedSegments, sortSegmentsInRundowns } from '@sofie-automation/corelib/dist/playout/playlist'
import {
	handleMosDeleteStory,
	handleMosFullStory,
	handleMosInsertStories,
	handleMosMoveStories,
	handleMosSwapStories,
} from '../mosStoryJobs.js'
import { handleMosRundownData, handleMosRundownReadyToAir, handleMosRundownStatus } from '../mosRundownJobs.js'
import { getMosIngestSegmentExternalId, parseMosString } from '../lib.js'
import { MockJobContext, setupDefaultJobEnvironment } from '../../../__mocks__/context.js'
import { setupMockIngestDevice, setupMockShowStyleCompound } from '../../../__mocks__/presetCollections.js'
import { fixSnapshot } from '../../../__mocks__/helpers/snapshot.js'
import { DBRundown, RundownOrphanedReason, RundownSource } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { MongoQuery } from '../../../db/index.js'
import { handleRemovedRundown } from '../../ingestRundownJobs.js'
import { MOS } from '@sofie-automation/corelib'
import { groupByToMap, literal, normalizeArrayToMap, omit } from '@sofie-automation/corelib/dist/lib'
import { NrcsIngestCacheType } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import { getPartId } from '../../lib.js'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { handleSetNextPart } from '../../../playout/setNextJobs.js'
import { handleTakeNextPart } from '../../../playout/take.js'
import { handleActivateRundownPlaylist, handleDeactivateRundownPlaylist } from '../../../playout/activePlaylistJobs.js'
import { removeRundownPlaylistFromDb } from '../../__tests__/lib.js'
import { UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { wrapCustomIngestJob, wrapGenericIngestJob, wrapMosIngestJob } from '../../jobWrappers.js'

jest.mock('../../updateNext')
import { ensureNextPartIsValid } from '../../updateNext.js'
type TensureNextPartIsValid = jest.MockedFunction<typeof ensureNextPartIsValid>
const ensureNextPartIsValidMock = ensureNextPartIsValid as TensureNextPartIsValid

const mosTypes = MOS.getMosTypes(true)

function getPartIdMap(segments: DBSegment[], parts: DBPart[]) {
	const sortedParts = sortPartsInSortedSegments(parts, segments)

	const segmentMap = normalizeArrayToMap(segments, '_id')

	const groupedParts = groupByToMap(sortedParts, 'segmentId')
	const arr: [SegmentId, DBPart[]][] = Array.from(groupedParts.entries())
	const idMap = arr.map((group) => ({
		segmentId: group[0],
		segmentName: segmentMap.get(group[0])?.name ?? null,
		parts: group[1].map((p) => p.externalId),
	}))

	return idMap.sort((a, b) => {
		const aRank = segmentMap.get(a.segmentId)?._rank ?? 99999
		const bRank = segmentMap.get(b.segmentId)?._rank ?? 99999

		return aRank - bRank
	})
}

const handleMosDeleteStoryWrapped = wrapMosIngestJob(handleMosDeleteStory)
const handleMosFullStoryWrapped = wrapMosIngestJob(handleMosFullStory)
const handleMosInsertStoriesWrapped = wrapMosIngestJob(handleMosInsertStories)
const handleMosMoveStoriesWrapped = wrapMosIngestJob(handleMosMoveStories)
const handleMosSwapStoriesWrapped = wrapMosIngestJob(handleMosSwapStories)
const handleMosRundownDataWrapped = wrapMosIngestJob(handleMosRundownData)
const handleRemovedRundownWrapped = wrapGenericIngestJob(handleRemovedRundown)
const handleMosRundownReadyToAirWrapped = wrapCustomIngestJob(handleMosRundownReadyToAir)

function createRundownSource(peripheralDevice: PeripheralDevice): RundownSource {
	return {
		type: 'nrcs',
		peripheralDeviceId: peripheralDevice._id,
		nrcsName: peripheralDevice.nrcsName,
	}
}

describe('Test recieved mos ingest payloads', () => {
	let context: MockJobContext
	let device: PeripheralDevice
	beforeAll(async () => {
		context = setupDefaultJobEnvironment(protectString('mockStudio4'))

		const showStyleCompound = await setupMockShowStyleCompound(context)

		context.setStudio({
			...context.rawStudio,
			supportedShowStyleBase: [showStyleCompound._id],
		})

		device = await setupMockIngestDevice(context)
	})
	beforeEach(() => {
		ensureNextPartIsValidMock.mockClear()
	})

	async function resetOrphanedRundown() {
		await context.mockCollections.Rundowns.update({}, { $unset: { orphaned: 1 } })

		// Reset RO
		const roData = mockRO.roCreate()
		await handleMosRundownDataWrapped(context, {
			rundownExternalId: parseMosString(roData.ID),
			mosRunningOrder: roData,
			isUpdateOperation: false,
			rundownSource: createRundownSource(device),
		})

		ensureNextPartIsValidMock.mockClear()
	}

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

	async function expectRundownToMatchSnapshot(rundownId: RundownId, playlist: boolean, pieces: boolean) {
		const rundown = (await context.mockCollections.Rundowns.findOne(rundownId)) as DBRundown
		expect(rundown).toBeTruthy()

		if (playlist) {
			expect(
				fixSnapshot(await context.mockCollections.RundownPlaylists.findOne(rundown.playlistId), true)
			).toMatchSnapshot()
		}

		expect(fixSnapshot(rundown, true)).toMatchSnapshot()
		expect(
			fixSnapshot(await context.mockCollections.Segments.findFetch({ rundownId: rundown._id }), true)
		).toMatchSnapshot()
		expect(
			fixSnapshot(await context.mockCollections.Parts.findFetch({ rundownId: rundown._id }), true)
		).toMatchSnapshot()

		if (pieces) {
			expect(
				fixSnapshot(await context.mockCollections.Pieces.findFetch({ rundownId: rundown._id }), true)
			).toMatchSnapshot()
		}
	}

	test('mosRoCreate', async () => {
		// setLogLevel(LogLevel.DEBUG)

		await expect(context.mockCollections.Rundowns.findOne()).resolves.toBeFalsy()

		const roData = mockRO.roCreate()
		await handleMosRundownDataWrapped(context, {
			rundownExternalId: parseMosString(roData.ID),
			mosRunningOrder: roData,
			isUpdateOperation: false,
			rundownSource: createRundownSource(device),
		})

		const { rundown, rundownPlaylist, segments, parts } = await getRundownData()

		expect(rundownPlaylist).toMatchObject({
			externalId: rundown._id,
		})

		expect(rundown).toMatchObject({
			externalId: mosTypes.mosString128.stringify(roData.ID),
			playlistId: rundownPlaylist._id,
		})

		expect(getPartIdMap(segments, parts)).toEqual(mockRO.segmentIdMap())

		await expectRundownToMatchSnapshot(rundown._id, true, false)
	})

	test('mosRoCreate: replace existing', async () => {
		// setLogLevel(LogLevel.DEBUG)

		const roData = mockRO.roCreate()
		const s = roData.Stories.splice(7, 1)
		roData.Stories.splice(4, 0, ...s)

		expect(
			await context.mockCollections.Rundowns.findOne({ externalId: mosTypes.mosString128.stringify(roData.ID) })
		).toBeTruthy()

		await handleMosRundownDataWrapped(context, {
			rundownExternalId: parseMosString(roData.ID),
			mosRunningOrder: roData,
			isUpdateOperation: false,
			rundownSource: createRundownSource(device),
		})

		const { rundown, rundownPlaylist, segments, parts } = await getRundownData()
		expect(rundownPlaylist).toMatchObject({
			externalId: rundown._id,
		})

		expect(rundown).toMatchObject({
			externalId: mosTypes.mosString128.stringify(roData.ID),
			playlistId: rundownPlaylist._id,
		})

		const partMap2 = mockRO.segmentIdMap()
		partMap2[1].parts.splice(1, 0, ...partMap2[3].parts)
		partMap2.splice(3, 1)

		expect(getPartIdMap(segments, parts)).toEqual(partMap2)

		await expectRundownToMatchSnapshot(rundown._id, true, false)
	})

	test('mosRoCreate: replace deleted', async () => {
		const roData = mockRO.roCreate()

		await context.mockCollections.Rundowns.update(
			{ externalId: mosTypes.mosString128.stringify(roData.ID) },
			{ $set: { orphaned: RundownOrphanedReason.DELETED } }
		)
		expect(
			await context.mockCollections.Rundowns.findOne({ externalId: mosTypes.mosString128.stringify(roData.ID) })
		).toBeTruthy()

		await handleMosRundownDataWrapped(context, {
			rundownExternalId: parseMosString(roData.ID),
			mosRunningOrder: roData,
			isUpdateOperation: false,
			rundownSource: createRundownSource(device),
		})

		const { rundown, rundownPlaylist } = await getRundownData()
		expect(rundownPlaylist).toMatchObject({
			externalId: rundown._id,
		})

		expect(rundown).toMatchObject({
			externalId: mosTypes.mosString128.stringify(roData.ID),
			playlistId: rundownPlaylist._id,
		})

		expect(rundown.orphaned).toBeUndefined()
	})

	test('mosRoDelete: already orphaned rundown', async () => {
		const roData = mockRO.roCreate()
		await context.mockCollections.Rundowns.update(
			{ externalId: mosTypes.mosString128.stringify(roData.ID) },
			{ $set: { orphaned: RundownOrphanedReason.DELETED } }
		)

		const rundown = (await context.mockCollections.Rundowns.findOne({
			externalId: mosTypes.mosString128.stringify(roData.ID),
		})) as DBRundown
		expect(rundown).toBeTruthy()
		expect(await context.mockCollections.RundownPlaylists.findOne(rundown.playlistId)).toBeTruthy()

		await expect(
			handleRemovedRundownWrapped(context, {
				rundownExternalId: parseMosString(roData.ID),
			})
		).rejects.toMatchUserError(UserErrorMessage.RundownRemoveWhileActive)

		expect(
			await context.mockCollections.Rundowns.findOne({
				externalId: mosTypes.mosString128.stringify(roData.ID),
			})
		).toBeTruthy()
	})
	test('mosRoDelete', async () => {
		await resetOrphanedRundown()

		const roData = mockRO.roCreate()
		const rundown = (await context.mockCollections.Rundowns.findOne({
			externalId: mosTypes.mosString128.stringify(roData.ID),
		})) as DBRundown
		expect(rundown).toBeTruthy()
		expect(rundown.orphaned).toBeFalsy()
		expect(await context.mockCollections.RundownPlaylists.findOne(rundown.playlistId)).toBeTruthy()

		await handleRemovedRundownWrapped(context, {
			rundownExternalId: parseMosString(roData.ID),
		})

		expect(await context.mockCollections.Rundowns.findOne()).toBeFalsy()

		expect(await context.mockCollections.RundownPlaylists.findOne()).toBeFalsy()
	})

	test('mosRoDelete: Does not exist', async () => {
		const roData = mockRO.roCreate()
		expect(await context.mockCollections.Rundowns.findOne()).toBeFalsy()
		expect(await context.mockCollections.RundownPlaylists.findOne()).toBeFalsy()

		await expect(
			handleRemovedRundownWrapped(context, {
				rundownExternalId: parseMosString(roData.ID),
			})
		).rejects.toThrow(/Rundown.*not found/i)
	})

	test('mosRoStatus: Update ro', async () => {
		// Reset RO
		await resetOrphanedRundown()

		const newStatus = MOS.IMOSObjectStatus.BUSY

		let rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()
		expect(rundown.status).not.toEqual(newStatus.toString())

		await handleMosRundownStatus(context, {
			rundownExternalId: rundown.externalId,
			status: newStatus,
		})

		rundown = (await context.mockCollections.Rundowns.findOne({ _id: rundown._id })) as DBRundown
		expect(rundown).toBeTruthy()
		expect(rundown.status).toEqual(newStatus.toString())

		await expectRundownToMatchSnapshot(rundown._id, true, false)
	})

	test('mosRoStatus: orphaned rundown', async () => {
		await context.mockCollections.Rundowns.update({}, { $set: { orphaned: RundownOrphanedReason.DELETED } })

		const newStatus = MOS.IMOSObjectStatus.UPDATED

		let rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()
		expect(rundown.status).not.toEqual(newStatus.toString())

		await handleMosRundownStatus(context, {
			rundownExternalId: rundown.externalId,
			status: newStatus,
		})

		rundown = (await context.mockCollections.Rundowns.findOne({ _id: rundown._id })) as DBRundown
		expect(rundown).toBeTruthy()
		expect(rundown.status).not.toEqual(newStatus.toString())
	})

	test('mosRoStatus: Missing ro', async () => {
		await resetOrphanedRundown()

		const newStatus = MOS.IMOSObjectStatus.BUSY

		const externalId = 'fakeId'
		expect(await context.mockCollections.Rundowns.findOne({ externalId: externalId })).toBeFalsy()

		await expect(
			handleMosRundownStatus(context, {
				rundownExternalId: externalId,
				status: newStatus,
			})
		).rejects.toThrow(/Rundown.*not found/i)
	})

	test('mosRoReadyToAir: Update ro', async () => {
		const newStatus = MOS.IMOSObjectAirStatus.READY

		let rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()
		expect(rundown.status).not.toEqual(newStatus.toString())
		expect((rundown.privateData as any)?.airStatus).not.toEqual(newStatus.toString())

		await handleMosRundownReadyToAirWrapped(context, {
			rundownExternalId: rundown.externalId,
			status: newStatus,
		})

		rundown = (await context.mockCollections.Rundowns.findOne({ _id: rundown._id })) as DBRundown
		expect(rundown).toBeTruthy()
		expect(rundown.airStatus).toEqual(newStatus.toString())

		expect((rundown.privateData as any)?.airStatus).toEqual(newStatus.toString())

		await expectRundownToMatchSnapshot(rundown._id, true, false)
	})

	test('mosRoReadyToAir: orphaned rundown', async () => {
		await context.mockCollections.Rundowns.update({}, { $set: { orphaned: RundownOrphanedReason.DELETED } })

		const newStatus = MOS.IMOSObjectAirStatus.NOT_READY

		let rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()
		expect(rundown.status).not.toEqual(newStatus.toString())

		await handleMosRundownReadyToAirWrapped(context, {
			rundownExternalId: rundown.externalId,
			status: newStatus,
		})

		rundown = (await context.mockCollections.Rundowns.findOne({ _id: rundown._id })) as DBRundown
		expect(rundown).toBeTruthy()
		expect(rundown.airStatus).not.toEqual(newStatus.toString())
	})

	test('mosRoReadyToAir: Missing ro', async () => {
		await resetOrphanedRundown()

		const newStatus = MOS.IMOSObjectAirStatus.READY

		const externalId = 'fakeId'
		expect(await context.mockCollections.Rundowns.findOne({ externalId: externalId })).toBeFalsy()

		await expect(
			handleMosRundownReadyToAirWrapped(context, {
				rundownExternalId: externalId,
				status: newStatus,
			})
		).rejects.toThrow(/Rundown.*not found/i)
	})

	test('mosRoStoryInsert: Into segment', async () => {
		const playlist = (await context.mockCollections.RundownPlaylists.findOne()) as DBRundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = await context.mockCollections.Rundowns.findFetch({ playlistId: playlist._id })
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const newPartData = mockRO.newItem('ro1;s1;newPart1', 'SEGMENT1;new1')

		await handleMosInsertStoriesWrapped(context, {
			rundownExternalId: rundown.externalId,
			insertBeforeStoryId: mosTypes.mosString128.create('ro1;s1;p3'),
			newStories: [newPartData],
			replace: false,
		})

		expect(ensureNextPartIsValid).toHaveBeenCalledTimes(1)

		const { segments, parts } = await getRundownData({ _id: rundown._id })

		const partMap = mockRO.segmentIdMap()
		partMap[0].parts.splice(2, 0, mosTypes.mosString128.stringify(newPartData.ID))
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		await expectRundownToMatchSnapshot(rundown._id, true, true)

		// Clean up after ourselves:
		const partsToRemove = await context.mockCollections.Parts.findFetch({ externalId: 'ro1;s1;newPart1' })
		await context.mockCollections.Parts.remove({ _id: { $in: partsToRemove.map((p) => p._id) } })
		await context.mockCollections.NrcsIngestDataCache.remove({
			rundownId: rundown._id,
			type: NrcsIngestCacheType.PART,
			partId: { $in: partsToRemove.map((p) => p._id) },
		})
	})

	test('mosRoStoryInsert: orphaned rundown', async () => {
		await context.mockCollections.Rundowns.update({}, { $set: { orphaned: RundownOrphanedReason.DELETED } })

		const playlist = (await context.mockCollections.RundownPlaylists.findOne()) as DBRundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = await context.mockCollections.Rundowns.findFetch({ playlistId: playlist._id })
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const newPartData = mockRO.newItem('ro1;s1;newPart2', 'SEGMENT1;new2')

		await handleMosInsertStoriesWrapped(context, {
			rundownExternalId: rundown.externalId,
			insertBeforeStoryId: mosTypes.mosString128.create('ro1;s1;p3'),
			newStories: [newPartData],
			replace: false,
		})

		const { parts } = await getRundownData({ _id: rundown._id })

		expect((await context.mockCollections.Rundowns.findOne(rundown._id))?.orphaned).toEqual(
			RundownOrphanedReason.DELETED
		)
		expect(parts.find((p) => p.externalId === mosTypes.mosString128.stringify(newPartData.ID))).toBeUndefined()
	})

	test('mosRoStoryInsert: New segment', async () => {
		await resetOrphanedRundown()

		const playlist = (await context.mockCollections.RundownPlaylists.findOne()) as DBRundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = await context.mockCollections.Rundowns.findFetch({ playlistId: playlist._id })
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const newPartData = mockRO.newItem('ro1;s1b;newPart1', 'SEGMENT1B;new1')

		await handleMosInsertStoriesWrapped(context, {
			rundownExternalId: rundown.externalId,
			insertBeforeStoryId: mosTypes.mosString128.create('ro1;s2;p1'),
			newStories: [newPartData],
			replace: false,
		})

		expect(ensureNextPartIsValid).toHaveBeenCalledTimes(1)

		const { segments, parts } = await getRundownData({ _id: rundown._id })

		const partMap = mockRO.segmentIdMap()
		partMap.splice(1, 0, {
			segmentId: 'Rjo_e_rlOh2eE8XOyVmXZCMgTNY_',
			segmentName: 'SEGMENT1B',
			parts: [mosTypes.mosString128.stringify(newPartData.ID)],
		})
		partMap[2].segmentId = '6cEU5uY8M93lfQssMy9XaGxT23E_'
		partMap[3].segmentId = 'rSEZMzZhJ55454sqsU_7TOq_DIk_'
		partMap[4].segmentId = 'YXMZjMqslZFcM3K4sGelyBYJ_rA_'
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		await expectRundownToMatchSnapshot(rundown._id, true, true)
	})

	test('mosRoStoryInsert: Invalid previous id', async () => {
		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		await context.mockCollections.Parts.remove({ externalId: 'ro1;s1b;newPart1' })

		const newPartData = mockRO.newItem('ro1;s1;failPart1', 'SEGMENT1;fake1')

		const beforeStoryId = mosTypes.mosString128.create('newFakePart')

		await expect(
			handleMosInsertStoriesWrapped(context, {
				rundownExternalId: rundown.externalId,
				insertBeforeStoryId: beforeStoryId,
				newStories: [newPartData],
				replace: false,
			})
		).rejects.toThrow(
			`Part ${mosTypes.mosString128.stringify(beforeStoryId)} in rundown ${rundown.externalId} not found`
		)

		expect(
			await context.mockCollections.Parts.findOne({
				externalId: mosTypes.mosString128.stringify(newPartData.ID),
			})
		).toBeFalsy()
	})

	test('mosRoStoryInsert: Existing externalId', async () => {
		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		await context.mockCollections.Parts.remove({ externalId: 'ro1;s1;failPart1' })

		const newPartData = mockRO.roCreate().Stories[0]

		await expect(
			handleMosInsertStoriesWrapped(context, {
				rundownExternalId: rundown.externalId,
				insertBeforeStoryId: mosTypes.mosString128.create('ro1;s2;p1'),
				newStories: [newPartData],
				replace: false,
			})
		).rejects.toThrow(
			`Parts ${getMosIngestSegmentExternalId(
				mosTypes.mosString128.stringify(newPartData.ID)
			)} already exist in rundown ${rundown.externalId}`
		)
	})

	// TODO - check if this should be allowed
	// eslint-disable-next-line jest/no-commented-out-tests
	// test('mosRoStoryInsert: Insert at end', async () => {
	// 	const rundown = Rundowns.findOne() as DBRundown
	// 	expect(rundown).toBeTruthy()

	// 	Parts.remove({ externalId: 'ro1;s1;newPart1' })

	// 	const newPartData = mockRO.newItem('ro1;s99;endPart1', 'SEGMENT99;end1')

	// 	const action = literal<MOS.IMOSStoryAction>({
	// 		RunningOrderID: mosTypes.mosString128.create(rundown.externalId),
	// 		StoryID: mosTypes.mosString128.create(''),
	// 	})

	// 	// try {
	// await (MeteorCall.peripheralDevice.mosRoStoryInsert(device._id, device.token, action, [newPartData]))
	// 	// 	fail('expected to throw')
	// 	// } catch (e) {
	// 	// 	expect(e.message).toBe(`[404] Part ${action.StoryID.toString()} in rundown ${rundown.externalId} not found`)
	// 	// }

	// 	// expect(Parts.findOne({ externalId: mosTypes.mosString128.stringify(newPartData.ID) })).toBeFalsy()
	// })

	test('mosRoStoryReplace: Same segment', async () => {
		await resetOrphanedRundown()

		const playlist = (await context.mockCollections.RundownPlaylists.findOne()) as DBRundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = await context.mockCollections.Rundowns.findFetch({ playlistId: playlist._id })
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		await context.mockCollections.Parts.remove({ externalId: 'ro1;s1;newPart1' })

		const newPartData = mockRO.newItem('ro1;s1;newPart1', 'SEGMENT1;new1')

		await handleMosInsertStoriesWrapped(context, {
			rundownExternalId: rundown.externalId,
			insertBeforeStoryId: mosTypes.mosString128.create('ro1;s1;p2'),
			newStories: [newPartData],
			replace: true,
		})

		expect(ensureNextPartIsValid).toHaveBeenCalledTimes(1)

		const { segments, parts } = await getRundownData({ _id: rundown._id })

		const partMap = mockRO.segmentIdMap()
		partMap[0].parts[1] = mosTypes.mosString128.stringify(newPartData.ID)
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		await expectRundownToMatchSnapshot(rundown._id, true, true)
	})

	test('mosRoStoryReplace: orphaned rundown', async () => {
		await context.mockCollections.Rundowns.update({}, { $set: { orphaned: RundownOrphanedReason.DELETED } })

		const playlist = (await context.mockCollections.RundownPlaylists.findOne()) as DBRundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = await context.mockCollections.Rundowns.findFetch({ playlistId: playlist._id })
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const newPartData = mockRO.newItem('ro1;s1;newPart2', 'SEGMENT1;new2')

		await handleMosInsertStoriesWrapped(context, {
			rundownExternalId: rundown.externalId,
			insertBeforeStoryId: mosTypes.mosString128.create('ro1;s1;p3'),
			newStories: [newPartData],
			replace: true,
		})
		const { parts } = await getRundownData({ _id: rundown._id })

		expect((await context.mockCollections.Rundowns.findOne(rundown._id))?.orphaned).toEqual(
			RundownOrphanedReason.DELETED
		)
		expect(parts.find((p) => p.externalId === mosTypes.mosString128.stringify(newPartData.ID))).toBeUndefined()
	})

	test('mosRoStoryReplace: Unknown ID', async () => {
		await resetOrphanedRundown()

		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		await context.mockCollections.Parts.remove({ externalId: 'ro1;s1;newPart1' })

		const newPartData = mockRO.newItem('ro1;s1;newPart1', 'SEGMENT1;new1')

		const beforeStoryId = mosTypes.mosString128.create('fakeId2')
		await expect(
			handleMosInsertStoriesWrapped(context, {
				rundownExternalId: rundown.externalId,
				insertBeforeStoryId: beforeStoryId,
				newStories: [newPartData],
				replace: true,
			})
		).rejects.toThrow(
			`Part ${mosTypes.mosString128.stringify(beforeStoryId)} in rundown ${rundown.externalId} not found`
		)

		expect(
			await context.mockCollections.Parts.findOne({
				externalId: mosTypes.mosString128.stringify(newPartData.ID),
			})
		).toBeFalsy()
	})

	test('mosRoStoryDelete: Remove segment', async () => {
		await resetOrphanedRundown()

		const playlist = (await context.mockCollections.RundownPlaylists.findOne()) as DBRundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = await context.mockCollections.Rundowns.findFetch({ playlistId: playlist._id })
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const partExternalIds = ['ro1;s3;p1', 'ro1;s3;p2']

		await handleMosDeleteStoryWrapped(context, {
			rundownExternalId: rundown.externalId,
			stories: partExternalIds.map((i) => mosTypes.mosString128.create(i)),
		})

		expect(await context.mockCollections.Parts.findFetch({ externalId: { $in: partExternalIds } })).toHaveLength(0)

		expect(ensureNextPartIsValid).toHaveBeenCalledTimes(1)

		const { segments, parts } = await getRundownData({ _id: rundown._id })

		const partMap = mockRO.segmentIdMap()
		partMap[1].parts.push(...partMap[3].parts)
		partMap.splice(2, 2)
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		await expectRundownToMatchSnapshot(rundown._id, true, true)
	})

	test('mosRoStoryDelete: Remove invalid id', async () => {
		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		const partExternalIds = ['ro1;s1;p2', 'fakeId']

		await expect(
			handleMosDeleteStoryWrapped(context, {
				rundownExternalId: rundown.externalId,
				stories: partExternalIds.map((i) => mosTypes.mosString128.create(i)),
			})
		).rejects.toThrow(`Parts segment-fakeId in rundown ${rundown.externalId} were not found`)

		expect(await context.mockCollections.Parts.findFetch({ externalId: { $in: partExternalIds } })).toHaveLength(1)
	})

	test('mosRoFullStory: Valid data', async () => {
		await resetOrphanedRundown()

		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		const story = literal<MOS.IMOSROFullStory>({
			RunningOrderId: mosTypes.mosString128.create(rundown.externalId),
			ID: mosTypes.mosString128.create('ro1;s1;p2'),
			Body: [],
		})

		await handleMosFullStoryWrapped(context, {
			rundownExternalId: rundown.externalId,
			story: story,
		})

		const part = (await context.mockCollections.Parts.findOne({
			externalId: mosTypes.mosString128.stringify(story.ID),
		})) as DBPart
		expect(part).toBeTruthy()
		expect(part.privateData).toEqual(story)

		await expectRundownToMatchSnapshot(rundown._id, true, true)
	})

	test('mosRoFullStory: Unknown Part', async () => {
		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		const story = literal<MOS.IMOSROFullStory>({
			RunningOrderId: mosTypes.mosString128.create(rundown.externalId),
			ID: mosTypes.mosString128.create('fakeId'),
			Body: [],
		})

		await expect(
			handleMosFullStoryWrapped(context, {
				rundownExternalId: rundown.externalId,
				story: story,
			})
		).rejects.toThrow(
			`handleMosFullStory: Missing MOS Story "${mosTypes.mosString128.stringify(
				story.ID
			)}" in Rundown ingest data for "${rundown.externalId}"`
		)
	})

	test('mosRoFullStory: Unknown Rundown', async () => {
		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		const story = literal<MOS.IMOSROFullStory>({
			RunningOrderId: mosTypes.mosString128.create('fakeId'),
			ID: mosTypes.mosString128.create('ro1;s1;p2'),
			Body: [],
		})

		await expect(
			handleMosFullStoryWrapped(context, {
				rundownExternalId: mosTypes.mosString128.stringify(story.RunningOrderId),
				story: story,
			})
		).rejects.toThrow(`Rundown "${mosTypes.mosString128.stringify(story.RunningOrderId)}" not found`)
	})

	test('mosRoStorySwap: Within same segment', async () => {
		await resetOrphanedRundown()

		const playlist = (await context.mockCollections.RundownPlaylists.findOne()) as DBRundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = await context.mockCollections.Rundowns.findFetch({ playlistId: playlist._id })
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const story0 = mosTypes.mosString128.create('ro1;s1;p2')
		const story1 = mosTypes.mosString128.create('ro1;s1;p3')

		await handleMosSwapStoriesWrapped(context, {
			rundownExternalId: rundown.externalId,
			story0,
			story1,
		})

		expect(ensureNextPartIsValid).toHaveBeenCalledTimes(1)

		const { segments, parts } = await getRundownData({ _id: rundown._id })

		const partMap = mockRO.segmentIdMap()
		partMap[0].parts[1] = 'ro1;s1;p3'
		partMap[0].parts[2] = 'ro1;s1;p2'
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		await expectRundownToMatchSnapshot(rundown._id, true, true)
	})

	test('mosRoStorySwap: With first in same segment', async () => {
		await resetOrphanedRundown()

		const playlist = (await context.mockCollections.RundownPlaylists.findOne()) as DBRundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = await context.mockCollections.Rundowns.findFetch({ playlistId: playlist._id })
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const story0 = mosTypes.mosString128.create('ro1;s1;p1')
		const story1 = mosTypes.mosString128.create('ro1;s1;p3')

		await handleMosSwapStoriesWrapped(context, {
			rundownExternalId: rundown.externalId,
			story0,
			story1,
		})

		expect(ensureNextPartIsValid).toHaveBeenCalledTimes(1)

		const { segments, parts } = await getRundownData({ _id: rundown._id })

		const partMap = mockRO.segmentIdMap()
		partMap[0].segmentId = 'o0rZ5k7WadtZ2XSmf_c3txGILuw_'
		partMap[0].parts[0] = 'ro1;s1;p3'
		partMap[0].parts[2] = 'ro1;s1;p1'
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		await expectRundownToMatchSnapshot(rundown._id, true, true)
	})

	test('mosRoStorySwap: Swap with self', async () => {
		await resetOrphanedRundown()

		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		const story0 = mosTypes.mosString128.create('ro1;s1;p1')

		// Swap should happen without error
		await handleMosSwapStoriesWrapped(context, {
			rundownExternalId: rundown.externalId,
			story0,
			story1: story0,
		})

		// should match the default
		const { segments, parts } = await getRundownData({ _id: rundown._id })
		const partMap = mockRO.segmentIdMap()
		expect(getPartIdMap(segments, parts)).toEqual(partMap)
	})

	test('mosRoStorySwap: Story not found', async () => {
		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		const story0 = mosTypes.mosString128.create('ro1;s1;p1')
		const story1 = mosTypes.mosString128.create('ro1;s1;p99')

		await expect(
			handleMosSwapStoriesWrapped(context, {
				rundownExternalId: rundown.externalId,
				story0,
				story1,
			})
		).rejects.toThrow(`Story ${mosTypes.mosString128.stringify(story1)} not found in rundown ${rundown.externalId}`)

		await expect(
			handleMosSwapStoriesWrapped(context, {
				rundownExternalId: rundown.externalId,
				story0: story1,
				story1: story0,
			})
		).rejects.toThrow(`Story ${mosTypes.mosString128.stringify(story1)} not found in rundown ${rundown.externalId}`)
	})

	test('mosRoStorySwap: Swap across segments', async () => {
		await resetOrphanedRundown()

		const playlist = (await context.mockCollections.RundownPlaylists.findOne()) as DBRundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = await context.mockCollections.Rundowns.findFetch({ playlistId: playlist._id })
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const story0 = mosTypes.mosString128.create('ro1;s3;p1')
		const story1 = mosTypes.mosString128.create('ro1;s4;p1')

		await handleMosSwapStoriesWrapped(context, {
			rundownExternalId: rundown.externalId,
			story0,
			story1,
		})

		expect(ensureNextPartIsValid).toHaveBeenCalledTimes(1)

		const { segments, parts } = await getRundownData({ _id: rundown._id })

		const partMap = mockRO.segmentIdMap()
		partMap[1].parts.push('ro1;s4;p1')
		partMap[2].segmentId = 'o6BHLNEWMc9FbHBRRWMOiwQ3IN0_'
		partMap[2].parts.reverse()
		partMap.splice(3, 1)
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		await expectRundownToMatchSnapshot(rundown._id, true, true)
	})

	test('mosRoStorySwap: Swap across segments2', async () => {
		await resetOrphanedRundown()

		const playlist = (await context.mockCollections.RundownPlaylists.findOne()) as DBRundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = await context.mockCollections.Rundowns.findFetch({ playlistId: playlist._id })
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const story0 = mosTypes.mosString128.create('ro1;s1;p2')
		const story1 = mosTypes.mosString128.create('ro1;s2;p2')

		await handleMosSwapStoriesWrapped(context, {
			rundownExternalId: rundown.externalId,
			story0,
			story1,
		})

		expect(ensureNextPartIsValid).toHaveBeenCalledTimes(1)

		const { segments, parts } = await getRundownData({ _id: rundown._id })

		const partMap = [
			{
				parts: ['ro1;s1;p1'],
				segmentName: 'SEGMENT1',
				segmentId: 'baQfD5zawLDmJTRumGpHDH2MwaM_',
			},
			{
				parts: ['ro1;s2;p2'],
				segmentName: 'SEGMENT2',
				segmentId: 'yVemxI_brsRMvHAeFVtG2tahCgU_',
			},
			{
				parts: ['ro1;s1;p3'],
				segmentName: 'SEGMENT1',
				segmentId: 'o0rZ5k7WadtZ2XSmf_c3txGILuw_',
			},
			{
				parts: ['ro1;s2;p1'],
				segmentName: 'SEGMENT2',
				segmentId: '6cEU5uY8M93lfQssMy9XaGxT23E_',
			},
			{
				parts: ['ro1;s1;p2'],
				segmentName: 'SEGMENT1',
				segmentId: 'zz3BgLI_xxlvfTOTR55skUkKWHk_',
			},
			{
				parts: ['ro1;s3;p1', 'ro1;s3;p2'],
				segmentName: 'SEGMENT3',
				segmentId: 'rSEZMzZhJ55454sqsU_7TOq_DIk_',
			},
			{
				parts: ['ro1;s4;p1'],
				segmentName: 'SEGMENT2',
				segmentId: 'YXMZjMqslZFcM3K4sGelyBYJ_rA_',
			},
		]
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		await expectRundownToMatchSnapshot(rundown._id, true, true)
	})

	test('mosRoStoryMove: Within segment', async () => {
		await resetOrphanedRundown()

		const playlist = (await context.mockCollections.RundownPlaylists.findOne()) as DBRundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = await context.mockCollections.Rundowns.findFetch({ playlistId: playlist._id })
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const story0 = 'ro1;s1;p3'

		await handleMosMoveStoriesWrapped(context, {
			rundownExternalId: rundown.externalId,
			insertBeforeStoryId: mosTypes.mosString128.create('ro1;s1;p2'),
			stories: [mosTypes.mosString128.create(story0)],
		})

		expect(ensureNextPartIsValid).toHaveBeenCalledTimes(1)

		const { segments, parts } = await getRundownData({ _id: rundown._id })
		const partMap = mockRO.segmentIdMap()
		partMap[0].parts[1] = 'ro1;s1;p3'
		partMap[0].parts[2] = 'ro1;s1;p2'
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		await expectRundownToMatchSnapshot(rundown._id, true, true)
	})

	test('mosRoStoryMove: Move whole segment to end', async () => {
		await resetOrphanedRundown()

		const playlist = (await context.mockCollections.RundownPlaylists.findOne()) as DBRundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = await context.mockCollections.Rundowns.findFetch({ playlistId: playlist._id })
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]

		const stories = [
			mosTypes.mosString128.create('ro1;s1;p1'),
			mosTypes.mosString128.create('ro1;s1;p2'),
			mosTypes.mosString128.create('ro1;s1;p3'),
		]

		await handleMosMoveStoriesWrapped(context, {
			rundownExternalId: rundown.externalId,
			insertBeforeStoryId: mosTypes.mosString128.create(''),
			stories,
		})

		expect(ensureNextPartIsValid).toHaveBeenCalledTimes(1)

		const { segments, parts } = await getRundownData({ _id: rundown._id })
		const partMap = mockRO.segmentIdMap()
		const old = partMap.splice(0, 1)
		partMap.splice(3, 0, ...old)
		expect(getPartIdMap(segments, parts)).toEqual(partMap)

		await expectRundownToMatchSnapshot(rundown._id, true, true)
	})

	test('mosRoStoryMove: Invalid before ID', async () => {
		await resetOrphanedRundown()

		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		const beforeStoryId = mosTypes.mosString128.create('fakeId')
		const stories = [
			mosTypes.mosString128.create('ro1;s1;p1'),
			mosTypes.mosString128.create('ro1;s1;p2'),
			mosTypes.mosString128.create('ro1;s1;p3'),
		]

		await expect(
			handleMosMoveStoriesWrapped(context, {
				rundownExternalId: rundown.externalId,
				insertBeforeStoryId: beforeStoryId,
				stories,
			})
		).rejects.toThrow(
			`Part ${getMosIngestSegmentExternalId(mosTypes.mosString128.stringify(beforeStoryId))} in rundown ${
				rundown.externalId
			} not found`
		)
	})

	test('mosRoStoryMove: Invalid before self', async () => {
		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		const beforeStoryId = mosTypes.mosString128.create('ro1;s1;p2')
		const stories = [
			mosTypes.mosString128.create('ro1;s1;p1'),
			mosTypes.mosString128.create('ro1;s1;p2'),
			mosTypes.mosString128.create('ro1;s1;p3'),
		]

		await expect(
			handleMosMoveStoriesWrapped(context, {
				rundownExternalId: rundown.externalId,
				insertBeforeStoryId: beforeStoryId,
				stories,
			})
		).rejects.toThrow(
			`Part ${getMosIngestSegmentExternalId(mosTypes.mosString128.stringify(beforeStoryId))} in rundown ${
				rundown.externalId
			} not found`
		)
	})

	test('mosRoStoryMove: Bad ID', async () => {
		await resetOrphanedRundown()

		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		const beforeStoryId = mosTypes.mosString128.create('')
		const stories = [
			mosTypes.mosString128.create('ro1;s1;p1'),
			mosTypes.mosString128.create('ro1;s1;p999'),
			mosTypes.mosString128.create('ro1;s1;p3'),
		]

		await expect(
			handleMosMoveStoriesWrapped(context, {
				rundownExternalId: rundown.externalId,
				insertBeforeStoryId: beforeStoryId,
				stories,
			})
		).rejects.toThrow(
			`Parts ro1;s1;p999 were not found in rundown ${mosTypes.mosString128.stringify(beforeStoryId)}`
		)
	})

	test('mosRoStoryDelete: Remove first story in segment', async () => {
		await resetOrphanedRundown()

		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		const partExternalId = 'ro1;s1;p1'

		const partToBeRemoved = (
			await context.mockCollections.Parts.findFetch({
				rundownId: rundown._id,
				externalId: partExternalId,
			})
		)[0]
		expect(partToBeRemoved).toBeTruthy()

		const partsInSegmentBefore = await context.mockCollections.Parts.findFetch({
			rundownId: rundown._id,
			segmentId: partToBeRemoved.segmentId,
		})
		expect(partsInSegmentBefore).toHaveLength(3)

		// This should only remove the first part in the segment. The other parts will be regenerated
		await handleMosDeleteStoryWrapped(context, {
			rundownExternalId: rundown.externalId,
			stories: [mosTypes.mosString128.create(partExternalId)],
		})

		expect(await context.mockCollections.Segments.findOne(partToBeRemoved.segmentId)).toBeFalsy()

		const partAfter = (await context.mockCollections.Parts.findOne(partsInSegmentBefore[2]._id)) as DBPart
		expect(partAfter).toBeTruthy()

		const partsInSegmentAfter = await context.mockCollections.Parts.findFetch({
			rundownId: rundown._id,
			segmentId: partAfter.segmentId,
		})
		expect(partsInSegmentAfter).toHaveLength(2)

		// The other parts in the segment should not not have changed:
		expect(partsInSegmentAfter[0]).toMatchObject(omit(partsInSegmentBefore[1], 'segmentId', '_rank'))

		expect(partsInSegmentAfter[1]).toMatchObject(omit(partsInSegmentBefore[2], 'segmentId', '_rank'))
	})

	async function mosReplaceBasicStory(
		runningOrderId: string,
		oldStoryId: string,
		newStoryId: string,
		newStoryName: string
	): Promise<void> {
		return handleMosInsertStoriesWrapped(context, {
			rundownExternalId: runningOrderId,
			insertBeforeStoryId: mosTypes.mosString128.create(oldStoryId),
			newStories: literal<Array<MOS.IMOSROStory>>([
				{
					ID: mosTypes.mosString128.create(newStoryId),
					Slug: mosTypes.mosString128.create(newStoryName),
					Items: [],
				},
			]),
			replace: true,
		})
	}

	function applySegmentRenameToContents(
		oldName: string,
		newName: string,
		oldSegments: DBSegment[],
		newSegments: DBSegment[],
		oldParts: DBPart[],
		oldPartInstances: DBPartInstance[]
	) {
		for (const oldSegment of oldSegments) {
			if (oldSegment.name === oldName) {
				const newSegment = newSegments.find((s) => s.name === newName)
				if (newSegment) {
					const oldSegmentId = oldSegment._id
					expect(oldSegmentId).toEqual(newSegment._id) // If the id doesn't change, then the whole test is invalid
					oldSegment.name = newSegment.name
					oldSegment._id = newSegment._id
					oldSegment.externalId = newSegment.externalId

					// update parts
					for (const oldPart of oldParts) {
						if (oldPart.segmentId === oldSegmentId) {
							oldPart.segmentId = newSegment._id
							oldPart.title = newSegment.name + ';' + oldPart.title.split(';')[1]
							delete oldPart.privateData
						}
					}

					// update partInstances
					for (const oldPartInstance of oldPartInstances) {
						if (oldPartInstance.segmentId === oldSegmentId) {
							oldPartInstance.segmentId = newSegment._id
							oldPartInstance.part.segmentId = newSegment._id
						}
					}

					// Only the first matching segment
					break
				}
			}
		}
	}

	test('Rename segment during update while on air', async () => {
		await resetOrphanedRundown()

		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()

		// activate and set on air
		await handleActivateRundownPlaylist(context, {
			playlistId: rundown.playlistId,
			rehearsal: true,
		})
		try {
			await handleSetNextPart(context, {
				playlistId: rundown.playlistId,
				nextPartId: getPartId(rundown._id, 'ro1;s2;p1'),
			})
			await handleTakeNextPart(context, {
				playlistId: rundown.playlistId,
				fromPartInstanceId: null,
			})

			const partInstancesBefore = await context.mockCollections.PartInstances.findFetch({
				rundownId: rundown._id,
			})
			const { segments: segmentsBefore, parts: partsBefore } = await getRundownData({ _id: rundown._id })

			await mosReplaceBasicStory(rundown.externalId, 'ro1;s2;p1', 'ro1;s2;p1', 'SEGMENT2b;PART1')
			await mosReplaceBasicStory(rundown.externalId, 'ro1;s2;p2', 'ro1;s2;p2', 'SEGMENT2b;PART2')

			const partInstancesAfter = await context.mockCollections.PartInstances.findFetch({ rundownId: rundown._id })
			const { segments: segmentsAfter, parts: partsAfter } = await getRundownData({ _id: rundown._id })

			// Update expected data, for just the segment name and ids changing
			applySegmentRenameToContents(
				'SEGMENT2',
				'SEGMENT2b',
				segmentsBefore,
				segmentsAfter,
				partsBefore,
				partInstancesBefore
			)

			expect(fixSnapshot(segmentsAfter)).toMatchObject(fixSnapshot(segmentsBefore))
			expect(fixSnapshot(partsAfter)).toMatchObject(fixSnapshot(partsBefore))
			expect(fixSnapshot(partInstancesAfter)).toMatchObject(fixSnapshot(partInstancesBefore))
		} catch (e) {
			console.error(e)
			throw e
		} finally {
			// cleanup
			await handleDeactivateRundownPlaylist(context, {
				playlistId: rundown.playlistId,
			}).catch(() => null)
		}
	})

	test('Rename segment during resync while on air', async () => {
		const mosRO = mockRO.roCreate()

		await resetOrphanedRundown()

		const rundown = (await context.mockCollections.Rundowns.findOne()) as DBRundown
		expect(rundown).toBeTruthy()
		expect(rundown.orphaned).toBeFalsy()

		// activate and set on air
		await handleActivateRundownPlaylist(context, {
			playlistId: rundown.playlistId,
			rehearsal: true,
		})
		try {
			await handleSetNextPart(context, {
				playlistId: rundown.playlistId,
				nextPartId: getPartId(rundown._id, 'ro1;s2;p1'),
			})
			await handleTakeNextPart(context, {
				playlistId: rundown.playlistId,
				fromPartInstanceId: null,
			})

			const partInstancesBefore = await context.mockCollections.PartInstances.findFetch({
				rundownId: rundown._id,
			})
			const { segments: segmentsBefore, parts: partsBefore } = await getRundownData({ _id: rundown._id })

			// rename the segment
			for (const story of mosRO.Stories) {
				// mutate the slugs of the second segment
				if (story.Slug && mosTypes.mosString128.stringify(story.ID).match(/;s2;/i)) {
					story.Slug = mosTypes.mosString128.create(
						'SEGMENT2b;' + mosTypes.mosString128.stringify(story.Slug).split(';')[1]
					)
				}
			}

			// regenerate the rundown
			await handleMosRundownDataWrapped(context, {
				rundownExternalId: rundown.externalId,
				mosRunningOrder: mosRO,
				isUpdateOperation: false,
				rundownSource: createRundownSource(device),
			})

			{
				// still valid
				const rundown2 = (await context.mockCollections.Rundowns.findOne()) as DBRundown
				expect(rundown2).toBeTruthy()
				expect(rundown2.orphaned).toBeFalsy()
			}

			const partInstancesAfter = await context.mockCollections.PartInstances.findFetch({ rundownId: rundown._id })
			const { segments: segmentsAfter, parts: partsAfter } = await getRundownData({ _id: rundown._id })

			// Update expected data, for just the segment name and ids changing
			applySegmentRenameToContents(
				'SEGMENT2',
				'SEGMENT2b',
				segmentsBefore,
				segmentsAfter,
				partsBefore,
				partInstancesBefore
			)

			expect(fixSnapshot(segmentsAfter)).toMatchObject(fixSnapshot(segmentsBefore))
			expect(fixSnapshot(partsAfter)).toMatchObject(fixSnapshot(partsBefore))
			expect(fixSnapshot(partInstancesAfter)).toMatchObject(fixSnapshot(partInstancesBefore))
		} finally {
			// cleanup
			await handleDeactivateRundownPlaylist(context, {
				playlistId: rundown.playlistId,
			}).catch(() => null)
		}
	})

	test('Playlist updates when removing one (of multiple) rundowns', async () => {
		// Cleanup any existing playlists
		await context.mockCollections.RundownPlaylists.update({}, { $unset: { activationId: 1 } })
		await context.mockCollections.RundownPlaylists.findFetch().then(async (playlists) =>
			removeRundownPlaylistFromDb(
				context,
				playlists.map((p) => p._id)
			)
		)
		expect(await context.mockCollections.RundownPlaylists.findFetch()).toHaveLength(0)
		expect(await context.mockCollections.Rundowns.findFetch()).toHaveLength(0)

		const roData1 = mockRO.roCreate()
		roData1.ID = mosTypes.mosString128.create('Rundown1')
		roData1.Slug = mosTypes.mosString128.create('Test Rundown 1')
		;(roData1 as any).ForcePlaylistExternalId = 'playlist1'
		await handleMosRundownDataWrapped(context, {
			rundownExternalId: mosTypes.mosString128.stringify(roData1.ID),
			mosRunningOrder: roData1,
			isUpdateOperation: false,
			rundownSource: createRundownSource(device),
		})

		const roData2 = mockRO.roCreate()
		roData2.ID = mosTypes.mosString128.create('Rundown2')
		roData2.Slug = mosTypes.mosString128.create('Test Rundown 2')
		;(roData2 as any).ForcePlaylistExternalId = 'playlist1'
		await handleMosRundownDataWrapped(context, {
			rundownExternalId: mosTypes.mosString128.stringify(roData2.ID),
			mosRunningOrder: roData2,
			isUpdateOperation: false,
			rundownSource: createRundownSource(device),
		})

		const rundown1 = (await context.mockCollections.Rundowns.findOne({ externalId: 'Rundown1' })) as DBRundown
		expect(rundown1).toBeTruthy()
		const rundown2 = (await context.mockCollections.Rundowns.findOne({ externalId: 'Rundown2' })) as DBRundown
		expect(rundown2).toBeTruthy()

		// The rundowns should be in the same playlist
		expect(rundown1.playlistId).toEqual(rundown2.playlistId)
		expect(rundown1.name).not.toEqual(rundown2.name)

		// check the playlist looks correct
		const playlist = (await context.mockCollections.RundownPlaylists.findOne(
			rundown1.playlistId
		)) as DBRundownPlaylist
		expect(playlist).toBeTruthy()

		expect(playlist.name).toEqual(rundown1.name)
		expect(playlist.name).not.toEqual(rundown2.name)

		// Remove the first rundown in the playlist
		await handleRemovedRundownWrapped(context, {
			rundownExternalId: mosTypes.mosString128.stringify(roData1.ID),
		})
		expect(await context.mockCollections.Rundowns.findOne(rundown1._id)).toBeFalsy()

		// check the playlist looks correct
		const playlist2 = (await context.mockCollections.RundownPlaylists.findOne(
			rundown1.playlistId
		)) as DBRundownPlaylist
		expect(playlist2).toBeTruthy()

		expect(playlist2.name).toEqual(rundown2.name)
		expect(playlist2.name).not.toEqual(playlist.name)
	})

	test('mosRoStoryReplace: Combine into start of segment', async () => {
		await resetOrphanedRundown()

		const mosRO = mockRO.roCreate()
		// regenerate the rundown
		await handleMosRundownDataWrapped(context, {
			rundownExternalId: mosTypes.mosString128.stringify(mosRO.ID),
			mosRunningOrder: mosRO,
			isUpdateOperation: false,
			rundownSource: createRundownSource(device),
		})

		const playlist = (await context.mockCollections.RundownPlaylists.findOne()) as DBRundownPlaylist
		expect(playlist).toBeTruthy()
		const rundowns = await context.mockCollections.Rundowns.findFetch({ playlistId: playlist._id })
		expect(rundowns).toHaveLength(1)
		const rundown = rundowns[0]
		expect(rundown.orphaned).toBeFalsy()
		expect((await getRundownData({ _id: rundown._id })).segments).toHaveLength(4)

		// insert a part after segment1
		const newPartData = mockRO.newItem('ro1;s2a;newPart1', 'SEGMENT2pre;new1')
		await handleMosInsertStoriesWrapped(context, {
			rundownExternalId: rundown.externalId,
			insertBeforeStoryId: mosTypes.mosString128.create('ro1;s2;p1'),
			newStories: [newPartData],
			replace: false,
		})

		{
			const { segments } = await getRundownData({ _id: rundown._id })
			expect(segments).toHaveLength(5)

			// Make sure we inserted, not replaced
			const firstSegment = segments[0]
			expect(firstSegment).toBeTruthy()
			const firstSegmentParts = await context.mockCollections.Parts.findFetch({
				segmentId: firstSegment._id,
			})
			expect(firstSegmentParts).toHaveLength(3)

			const refSegment = segments[2]
			expect(refSegment).toBeTruthy()
			const refSegmentParts = await context.mockCollections.Parts.findFetch({ segmentId: refSegment._id })
			expect(refSegmentParts).toHaveLength(2)

			// Check the insert was ok
			const newSegment = segments[1]
			expect(newSegment).toBeTruthy()
			const newSegmentParts = await context.mockCollections.Parts.findFetch({ segmentId: newSegment._id })
			expect(newSegmentParts).toHaveLength(1)
			expect(newSegmentParts[0].externalId).toBe('ro1;s2a;newPart1')
		}

		// Replace the story with itself, but different slug
		const replacementPartData = mockRO.newItem('ro1;s2a;newPart1', 'SEGMENT2;new1')
		await handleMosInsertStoriesWrapped(context, {
			rundownExternalId: rundown.externalId,
			insertBeforeStoryId: replacementPartData.ID,
			newStories: [replacementPartData],
			replace: true,
		})

		{
			const { segments } = await getRundownData({ _id: rundown._id })
			expect(segments).toHaveLength(4)

			// Make sure first segment is unchanged
			const firstSegment = segments[0]
			expect(firstSegment).toBeTruthy()
			const firstSegmentParts = await context.mockCollections.Parts.findFetch({ segmentId: firstSegment._id })
			expect(firstSegmentParts).toHaveLength(3)

			// Make sure segment combiend ok
			const refSegment = segments[1]
			expect(refSegment).toBeTruthy()
			const refSegmentParts = await context.mockCollections.Parts.findFetch({ segmentId: refSegment._id })
			expect(refSegmentParts).toHaveLength(3)
		}
	})
})
