import { RundownPlaylistId, SegmentId, PartId, RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getCurrentTime } from '../../../lib/index.js'
import { LookaheadMode, PlaylistTimingType, TSR } from '@sofie-automation/blueprints-integration'
import { getOrderedPartsAfterPlayhead } from '../util.js'
import { MockJobContext, setupDefaultJobEnvironment } from '../../../__mocks__/context.js'
import { runJobWithPlayoutModel } from '../../../playout/lock.js'
import { defaultRundownPlaylist } from '../../../__mocks__/defaultCollectionObjects.js'
import _ from 'underscore'
import { wrapPartToTemporaryInstance } from '../../../__mocks__/partinstance.js'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ForceQuickLoopAutoNext } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'

describe('getOrderedPartsAfterPlayhead', () => {
	let context!: MockJobContext
	let playlistId: RundownPlaylistId
	let rundownId: RundownId
	let segmentId0: SegmentId
	let segmentId1: SegmentId
	let segmentId2: SegmentId
	let partIds: PartId[]

	beforeEach(async () => {
		context = setupDefaultJobEnvironment()

		const mappings: MappingsExt = {}
		for (const [k, v] of Object.entries<LookaheadMode>(LookaheadMode as any)) {
			mappings[k] = {
				device: TSR.DeviceType.ABSTRACT,
				deviceId: protectString('fake0'),
				lookahead: v,
				// lookaheadDepth: 0,
				// lookaheadMaxSearchDistance: 0,
				options: {},
			}
		}
		context.setStudio({
			...context.rawStudio,
			mappingsWithOverrides: wrapDefaultObject(mappings),
		})

		// Create a playlist with some parts
		rundownId = protectString(`rundown0`)
		playlistId = protectString(`playlist0`)

		await context.mockCollections.RundownPlaylists.insertOne({
			...defaultRundownPlaylist(playlistId, context.studioId),
			activationId: protectString('active'),
		})
		await context.mockCollections.Rundowns.insertOne({
			studioId: context.studioId,
			showStyleBaseId: protectString('showStyleBase0'),
			showStyleVariantId: protectString('showStyleVariante0'),

			playlistId: playlistId,

			_id: rundownId,
			externalId: 'MOCK_RUNDOWN',
			name: 'Default Rundown',

			created: getCurrentTime(),
			modified: getCurrentTime(),
			importVersions: {
				studio: '',
				showStyleBase: '',
				showStyleVariant: '',
				blueprint: '',
				core: '',
			},

			timing: {
				type: PlaylistTimingType.None,
			},
			source: {
				type: 'http',
			},
		})

		const segmentIds = await Promise.all([
			context.mockCollections.Segments.insertOne({
				_id: protectString(rundownId + '_segment0'),
				_rank: 0,
				externalId: 'MOCK_SEGMENT_0',
				rundownId: rundownId,
				name: 'Segment 0',
			}),
			context.mockCollections.Segments.insertOne({
				_id: protectString(rundownId + '_segment01'),
				_rank: 1,
				externalId: 'MOCK_SEGMENT_1',
				rundownId: rundownId,
				name: 'Segment 1',
			}),
			context.mockCollections.Segments.insertOne({
				_id: protectString(rundownId + '_segment2'),
				_rank: 2,
				externalId: 'MOCK_SEGMENT_2',
				rundownId: rundownId,
				name: 'Segment 2',
			}),
		])
		segmentId0 = segmentIds[0]
		segmentId1 = segmentIds[1]
		segmentId2 = segmentIds[2]

		function createMockPart(index: number, segId: SegmentId): DBPart {
			return {
				_id: protectString(rundownId + '_part' + index),
				segmentId: segId,
				rundownId: rundownId,
				_rank: index,
				externalId: 'MOCK_PART_' + index,
				title: 'Part ' + index,
				expectedDurationWithTransition: undefined,
			}
		}

		partIds = await Promise.all([
			context.mockCollections.Parts.insertOne(createMockPart(0, segmentId0)),
			context.mockCollections.Parts.insertOne(createMockPart(1, segmentId0)),
			context.mockCollections.Parts.insertOne(createMockPart(2, segmentId0)),
			context.mockCollections.Parts.insertOne(createMockPart(3, segmentId0)),
			context.mockCollections.Parts.insertOne(createMockPart(4, segmentId0)),

			context.mockCollections.Parts.insertOne(createMockPart(10, segmentId1)),
			context.mockCollections.Parts.insertOne(createMockPart(11, segmentId1)),
			context.mockCollections.Parts.insertOne(createMockPart(12, segmentId1)),

			context.mockCollections.Parts.insertOne(createMockPart(20, segmentId2)),
			context.mockCollections.Parts.insertOne(createMockPart(21, segmentId2)),
			context.mockCollections.Parts.insertOne(createMockPart(22, segmentId2)),
		])
	})
	test('all parts come back', async () => {
		const parts = await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getOrderedPartsAfterPlayhead(context, playoutModel, 100)
		)

		expect(parts.map((p) => p._id)).toEqual(partIds)
	})

	test('first part is next', async () => {
		const firstPart = (await context.mockCollections.Parts.findOne(partIds[0])) as DBPart
		expect(firstPart).toBeTruthy()

		// Convert to instance and set as next
		const firstInstanceId = await context.mockCollections.PartInstances.insertOne(
			wrapPartToTemporaryInstance(protectString('active'), firstPart)
		)
		await context.mockCollections.RundownPlaylists.update(playlistId, {
			$set: {
				nextPartInfo: {
					partInstanceId: firstInstanceId,
					rundownId: firstPart.rundownId,
					manuallySelected: false,
					consumesQueuedSegmentId: false,
				},
			},
		})

		const parts = await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getOrderedPartsAfterPlayhead(context, playoutModel, 100)
		)
		// Should not have the first
		expect(parts.map((p) => p._id)).toEqual(partIds.slice(1))

		// Try with a limit
		const parts2 = await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getOrderedPartsAfterPlayhead(context, playoutModel, 5)
		)
		// Should not have the first
		expect(parts2.map((p) => p._id)).toEqual(partIds.slice(1, 6))
	})

	test('first part is current', async () => {
		const firstPart = (await context.mockCollections.Parts.findOne(partIds[0])) as DBPart
		expect(firstPart).toBeTruthy()

		// Convert to instance and set as next
		const firstInstanceId = await context.mockCollections.PartInstances.insertOne(
			wrapPartToTemporaryInstance(protectString('active'), firstPart)
		)
		await context.mockCollections.RundownPlaylists.update(playlistId, {
			$set: {
				nextPartInfo: {
					partInstanceId: firstInstanceId,
					rundownId: firstPart.rundownId,
					manuallySelected: false,
					consumesQueuedSegmentId: false,
				},
			},
		})

		const parts = await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getOrderedPartsAfterPlayhead(context, playoutModel, 100)
		)
		// Should not have the first
		expect(parts.map((p) => p._id)).toEqual(partIds.slice(1))

		// Try with a limit
		const parts2 = await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getOrderedPartsAfterPlayhead(context, playoutModel, 5)
		)
		// Should not have the first
		expect(parts2.map((p) => p._id)).toEqual(partIds.slice(1, 6))
	})

	test('last part is next', async () => {
		const lastPart = (await context.mockCollections.Parts.findOne(_.last(partIds))) as DBPart
		expect(lastPart).toBeTruthy()

		// Convert to instance and set as next
		const lastInstanceId = await context.mockCollections.PartInstances.insertOne(
			wrapPartToTemporaryInstance(protectString('active'), lastPart)
		)
		await context.mockCollections.RundownPlaylists.update(playlistId, {
			$set: {
				nextPartInfo: {
					partInstanceId: lastInstanceId,
					rundownId: lastPart.rundownId,
					manuallySelected: false,
					consumesQueuedSegmentId: false,
				},
			},
		})

		const parts = await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getOrderedPartsAfterPlayhead(context, playoutModel, 100)
		)
		// Should be empty
		expect(parts.map((p) => p._id)).toEqual([])

		// Playlist could loop
		await context.mockCollections.RundownPlaylists.update(playlistId, {
			$set: {
				quickLoop: {
					start: { type: QuickLoopMarkerType.PLAYLIST },
					end: { type: QuickLoopMarkerType.PLAYLIST },
					running: true,
					forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
					locked: false,
				},
			},
		})
		const parts2 = await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getOrderedPartsAfterPlayhead(context, playoutModel, 5)
		)
		// Should be empty
		expect(parts2.map((p) => p._id)).toEqual(partIds.slice(0, 5))

		// Set some parts as unplayable
		await context.mockCollections.Parts.update(
			{
				_id: { $in: [partIds[1], partIds[4]] },
			},
			{
				$set: { invalid: true },
			}
		)
		const parts3 = await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getOrderedPartsAfterPlayhead(context, playoutModel, 5)
		)
		// Should be empty
		expect(parts3.map((p) => p._id)).toEqual([partIds[0], ...partIds.slice(2, 4), ...partIds.slice(5, 7)])
	})

	test('filter unplayable part is current', async () => {
		const nextPart = (await context.mockCollections.Parts.findOne(partIds[3])) as DBPart
		expect(nextPart).toBeTruthy()

		await context.mockCollections.Parts.update(
			{
				_id: { $in: [partIds[4], partIds[7]] },
			},
			{
				$set: { invalid: true },
			}
		)

		// Convert to instance and set as next
		const nextInstanceId = await context.mockCollections.PartInstances.insertOne(
			wrapPartToTemporaryInstance(protectString('active'), nextPart)
		)
		await context.mockCollections.RundownPlaylists.update(playlistId, {
			$set: {
				nextPartInfo: {
					partInstanceId: nextInstanceId,
					rundownId: nextPart.rundownId,
					manuallySelected: false,
					consumesQueuedSegmentId: false,
				},
			},
		})

		const parts = await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getOrderedPartsAfterPlayhead(context, playoutModel, 5)
		)
		// Should not have the first
		expect(parts.map((p) => p._id)).toEqual([partIds[5], partIds[6], partIds[8], partIds[9], partIds[10]])
	})

	test('filter unplayable part is current2', async () => {
		const firstPart = (await context.mockCollections.Parts.findOne(partIds[0])) as DBPart
		expect(firstPart).toBeTruthy()

		// Convert to instance and set as next
		const nextInstanceId = await context.mockCollections.PartInstances.insertOne(
			wrapPartToTemporaryInstance(protectString('active'), firstPart)
		)
		await context.mockCollections.RundownPlaylists.update(playlistId, {
			$set: {
				currentPartInfo: {
					partInstanceId: nextInstanceId,
					rundownId: firstPart.rundownId,
					manuallySelected: false,
					consumesQueuedSegmentId: false,
				},
			},
		})

		// Change next segment
		await context.mockCollections.RundownPlaylists.update(playlistId, { $set: { queuedSegmentId: segmentId2 } })
		const parts = await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getOrderedPartsAfterPlayhead(context, playoutModel, 10)
		)
		expect(parts.map((p) => p._id)).toEqual([...partIds.slice(1, 5), ...partIds.slice(8)])

		// Set start of next segment to unplayable
		await context.mockCollections.Parts.update(
			{
				_id: { $in: [partIds[8]] },
			},
			{
				$set: { invalid: true },
			}
		)
		const parts2 = await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getOrderedPartsAfterPlayhead(context, playoutModel, 10)
		)
		expect(parts2.map((p) => p._id)).toEqual([...partIds.slice(1, 5), ...partIds.slice(9)])

		// Set the rest of next segment to unplayable
		await context.mockCollections.Parts.update(
			{
				_id: { $in: partIds.slice(9) },
			},
			{
				$set: { invalid: true },
			}
		)
		const parts3 = await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getOrderedPartsAfterPlayhead(context, playoutModel, 10)
		)
		expect(parts3.map((p) => p._id)).toEqual(partIds.slice(1, 8))
	})
})
