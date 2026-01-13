import { LOOKAHEAD_DEFAULT_SEARCH_DISTANCE } from '@sofie-automation/shared-lib/dist/core/constants'
import { RundownPlaylistId, PartId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBStudio, MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { clone, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { getCurrentTime } from '../../../lib/index.js'
import { SelectedPartInstancesTimelineInfo } from '../../timeline/generate.js'
import { getLookeaheadObjects } from '../index.js'
import { LookaheadMode, PlaylistTimingType, TSR } from '@sofie-automation/blueprints-integration'
import { setupDefaultJobEnvironment, MockJobContext } from '../../../__mocks__/context.js'
import { runJobWithPlayoutModel } from '../../../playout/lock.js'
import { defaultRundownPlaylist } from '../../../__mocks__/defaultCollectionObjects.js'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'

jest.mock('../findForLayer')
type TfindLookaheadForLayer = jest.MockedFunction<typeof findLookaheadForLayer>
import { findLookaheadForLayer } from '../findForLayer.js'
const findLookaheadForLayerMock = findLookaheadForLayer as TfindLookaheadForLayer

jest.mock('../util')
type TgetOrderedPartsAfterPlayhead = jest.MockedFunction<typeof getOrderedPartsAfterPlayhead>
import { getOrderedPartsAfterPlayhead, PartAndPieces, PartInstanceAndPieceInstances } from '../util.js'
import { LookaheadTimelineObject } from '../findObjects.js'
import { wrapDefaultObject } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { createPartCurrentTimes } from '@sofie-automation/corelib/dist/playout/processAndPrune'
const getOrderedPartsAfterPlayheadMock = getOrderedPartsAfterPlayhead as TgetOrderedPartsAfterPlayhead

describe('Lookahead', () => {
	let context!: MockJobContext
	let playlistId: RundownPlaylistId
	let rundownId: RundownId
	// let segmentId: SegmentId
	let partIds: PartId[]

	beforeEach(async () => {
		findLookaheadForLayerMock.mockReset().mockReturnValue({ timed: [], future: [] }) // Default mock
		getOrderedPartsAfterPlayheadMock.mockReset().mockReturnValue([])

		context = setupDefaultJobEnvironment()
		const mappings: MappingsExt = {}
		for (const [k, v] of Object.entries<LookaheadMode>(LookaheadMode as any)) {
			if (isNaN(parseInt(k))) {
				mappings[k] = {
					device: TSR.DeviceType.ABSTRACT,
					deviceId: protectString('fake0'),
					lookahead: v,
					// lookaheadDepth: 0,
					// lookaheadMaxSearchDistance: 0,
					options: {},
				}
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

		const segmentId0: SegmentId = getRandomId()
		const segmentId1: SegmentId = getRandomId()
		const segmentId2: SegmentId = getRandomId()

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

	async function expectLookaheadForLayerMock(
		playlistId0: RundownPlaylistId,
		partInstances: PartInstanceAndPieceInstances[],
		previous: PartInstanceAndPieceInstances | undefined,
		orderedPartsFollowingPlayhead: PartAndPieces[]
	) {
		const playlist = (await context.mockCollections.RundownPlaylists.findOne(playlistId0)) as DBRundownPlaylist
		expect(playlist).toBeTruthy()

		expect(findLookaheadForLayerMock).toHaveBeenCalledTimes(2)
		expect(findLookaheadForLayerMock).toHaveBeenNthCalledWith(
			1,
			context,
			playlist.currentPartInfo?.partInstanceId ?? null,
			partInstances,
			previous,
			orderedPartsFollowingPlayhead,
			'PRELOAD',
			1,
			LOOKAHEAD_DEFAULT_SEARCH_DISTANCE
		)
		expect(findLookaheadForLayerMock).toHaveBeenNthCalledWith(
			2,
			context,
			playlist.currentPartInfo?.partInstanceId ?? null,
			partInstances,
			previous,
			orderedPartsFollowingPlayhead,
			'WHEN_CLEAR',
			1,
			LOOKAHEAD_DEFAULT_SEARCH_DISTANCE
		)
		findLookaheadForLayerMock.mockClear()
	}

	test('No pieces', async () => {
		const partInstancesInfo: SelectedPartInstancesTimelineInfo = {}

		const fakeParts = partIds.map((p) => ({ part: { _id: p } as any, usesInTransition: true, pieces: [] }))
		getOrderedPartsAfterPlayheadMock.mockReturnValueOnce(fakeParts.map((p) => p.part))

		const res = await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getLookeaheadObjects(context, playoutModel, partInstancesInfo)
		)
		expect(res).toHaveLength(0)

		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledTimes(1)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledWith(context, expect.anything(), 10) // default distance
		await expectLookaheadForLayerMock(playlistId, [], undefined, fakeParts)
	})

	function fakeResultObj(id: string, pieceId: string, layer: string): LookaheadTimelineObject {
		return {
			id: id,
			pieceInstanceId: pieceId,
			layer: layer,
			content: { id },
		} as any
	}

	test('got some objects', async () => {
		const partInstancesInfo: SelectedPartInstancesTimelineInfo = {}

		const fakeParts = partIds.map((p) => ({ part: { _id: p } as any, usesInTransition: true, pieces: [] }))
		getOrderedPartsAfterPlayheadMock.mockReturnValueOnce(fakeParts.map((p) => p.part))

		findLookaheadForLayerMock
			.mockImplementationOnce((_context, _id, _parts, _prev, _parts2, layer) => ({
				timed: [fakeResultObj('obj0', 'piece0', layer), fakeResultObj('obj1', 'piece1', layer)],
				future: [
					fakeResultObj('obj2', 'piece0', layer),
					fakeResultObj('obj3', 'piece0', layer),
					fakeResultObj('obj4', 'piece0', layer),
				],
			}))
			.mockImplementationOnce((_context, _id, _parts, _prev, _parts2, layer) => ({
				timed: [fakeResultObj('obj5', 'piece1', layer), fakeResultObj('obj6', 'piece0', layer)],
				future: [
					fakeResultObj('obj7', 'piece1', layer),
					fakeResultObj('obj8', 'piece1', layer),
					fakeResultObj('obj9', 'piece0', layer),
				],
			}))

		const res = await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getLookeaheadObjects(context, playoutModel, partInstancesInfo)
		)
		expect(res).toMatchSnapshot()

		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledTimes(1)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledWith(context, expect.anything(), 10) // default distance
		await expectLookaheadForLayerMock(playlistId, [], undefined, fakeParts)
	})

	test('Different max distances', async () => {
		const partInstancesInfo: SelectedPartInstancesTimelineInfo = {}

		// Set really low
		{
			const studio = clone<DBStudio>(context.rawStudio)
			studio.mappingsWithOverrides.defaults['WHEN_CLEAR'].lookaheadMaxSearchDistance = 0
			studio.mappingsWithOverrides.defaults['PRELOAD'].lookaheadMaxSearchDistance = 0
			context.setStudio(studio)
		}
		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getLookeaheadObjects(context, playoutModel, partInstancesInfo)
		)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledTimes(1)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledWith(context, expect.anything(), 0)

		// really high
		getOrderedPartsAfterPlayheadMock.mockClear()
		{
			const studio = clone<DBStudio>(context.rawStudio)
			studio.mappingsWithOverrides.defaults['WHEN_CLEAR'].lookaheadMaxSearchDistance = -1
			studio.mappingsWithOverrides.defaults['PRELOAD'].lookaheadMaxSearchDistance = 2000
			context.setStudio(studio)
		}
		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getLookeaheadObjects(context, playoutModel, partInstancesInfo)
		)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledTimes(1)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledWith(context, expect.anything(), 2000)

		// unset
		getOrderedPartsAfterPlayheadMock.mockClear()
		{
			const studio = clone<DBStudio>(context.rawStudio)
			studio.mappingsWithOverrides.defaults['WHEN_CLEAR'].lookaheadMaxSearchDistance = undefined
			studio.mappingsWithOverrides.defaults['PRELOAD'].lookaheadMaxSearchDistance = -1
			context.setStudio(studio)
		}
		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getLookeaheadObjects(context, playoutModel, partInstancesInfo)
		)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledTimes(1)
		expect(getOrderedPartsAfterPlayheadMock).toHaveBeenCalledWith(context, expect.anything(), 10)
	})

	test('PartInstances translation', async () => {
		const fakeParts = partIds.map((p) => ({ part: { _id: p } as any, usesInTransition: true, pieces: [] }))
		getOrderedPartsAfterPlayheadMock.mockReturnValue(fakeParts.map((p) => p.part))

		// It does have assertions, but hidden inside helper methods
		expect(true).toBeTruthy()

		const partInstancesInfo: SelectedPartInstancesTimelineInfo = {}
		partInstancesInfo.previous = {
			partInstance: { _id: 'abc2', part: { _id: 'abc' } } as any,
			partTimes: createPartCurrentTimes(getCurrentTime(), getCurrentTime() + 546),
			pieceInstances: ['1', '2'] as any,
			calculatedTimings: { inTransitionStart: null } as any,
			regenerateTimelineAt: undefined,
		}

		const expectedPrevious = {
			part: partInstancesInfo.previous.partInstance,
			onTimeline: true,
			nowInPart: partInstancesInfo.previous.partTimes.nowInPart,
			allPieces: partInstancesInfo.previous.pieceInstances,
			calculatedTimings: partInstancesInfo.previous.calculatedTimings,
		}

		// With a previous
		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getLookeaheadObjects(context, playoutModel, partInstancesInfo)
		)
		await expectLookaheadForLayerMock(playlistId, [], expectedPrevious, fakeParts)

		// Add a current
		partInstancesInfo.current = {
			partInstance: { _id: 'curr', part: {} } as any,
			partTimes: createPartCurrentTimes(getCurrentTime(), getCurrentTime() + 865),
			pieceInstances: ['3', '4'] as any,
			calculatedTimings: { inTransitionStart: null } as any,
			regenerateTimelineAt: undefined,
		}
		const expectedCurrent = {
			part: partInstancesInfo.current.partInstance,
			onTimeline: true,
			nowInPart: partInstancesInfo.current.partTimes.nowInPart,
			allPieces: partInstancesInfo.current.pieceInstances,
			calculatedTimings: partInstancesInfo.current.calculatedTimings,
		}
		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getLookeaheadObjects(context, playoutModel, partInstancesInfo)
		)
		await expectLookaheadForLayerMock(playlistId, [expectedCurrent], expectedPrevious, fakeParts)

		// Add a next
		partInstancesInfo.next = {
			partInstance: { _id: 'nxt2', part: { _id: 'nxt' } } as any,
			partTimes: createPartCurrentTimes(getCurrentTime(), getCurrentTime() + 142),
			pieceInstances: ['5'] as any,
			calculatedTimings: { inTransitionStart: null } as any,
			regenerateTimelineAt: undefined,
		}
		const expectedNext = {
			part: partInstancesInfo.next.partInstance,
			onTimeline: false,
			nowInPart: partInstancesInfo.next.partTimes.nowInPart,
			allPieces: partInstancesInfo.next.pieceInstances,
			calculatedTimings: partInstancesInfo.next.calculatedTimings,
		}
		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getLookeaheadObjects(context, playoutModel, partInstancesInfo)
		)
		await expectLookaheadForLayerMock(playlistId, [expectedCurrent, expectedNext], expectedPrevious, fakeParts)

		// current has autonext
		;(partInstancesInfo.current.partInstance.part as DBPart).autoNext = true
		expectedNext.onTimeline = true
		await runJobWithPlayoutModel(context, { playlistId }, null, async (playoutModel) =>
			getLookeaheadObjects(context, playoutModel, partInstancesInfo)
		)
		await expectLookaheadForLayerMock(playlistId, [expectedCurrent, expectedNext], expectedPrevious, fakeParts)
	})

	// eslint-disable-next-line jest/no-commented-out-tests
	// test('Pieces', () => {
	// 	const fakeParts = partIds.map((p) => ({ _id: p })) as Part[]
	// 	getOrderedPartsAfterPlayheadMock.mockReturnValue(fakeParts)

	// 	const partInstancesInfo: SelectedPartInstancesTimelineInfo = {}

	// 	const pieceMap = new Map<PartId, Piece[]>()

	// 	partIds.forEach((id, i) => {
	// 		const pieces: Piece[] = []
	// 		const target = (i + 2) % 3
	// 		for (let o = 0; o <= target; o++) {
	// 			const piece: Piece = {
	// 				_id: `piece_${i}_${o}`,
	// 				startPartId: id,
	// 				startRundownId: rundownId,
	// 				invalid: target === 2 && i % 2 === 1, // Some 'randomness'
	// 			} as any
	// 			Pieces.insert(piece)
	// 			if (!piece.invalid) {
	// 				pieces.push(piece)
	// 			}
	// 		}

	// 		if (pieces.length > 0) {
	// 			pieceMap.set(id, pieces)
	// 		}
	// 	})
	// 	// Add a couple of pieces which are incorrectly owned
	// 	Pieces.insert({
	// 		_id: `piece_a`,
	// 		startPartId: partIds[0],
	// 		startRundownId: rundownId + '9',
	// 	} as any)
	// 	Pieces.insert({
	// 		_id: `piece_b`,
	// 		startPartId: 'not-real',
	// 		startRundownId: rundownId,
	// 	} as any)

	// 	// pieceMap should have come through valid
	// 	;(
	// 		wrapWithCacheForRundownPlaylist(playlist, async (playoutModel) => {
	// 			await getLookeaheadObjects(context, playoutModel, env.studio, playlist, partInstancesInfo)
	// 			expect(playoutModel.Pieces.initialized).toBeFalsy()
	// 		})
	// 	)
	// 	await expectLookaheadForLayerMock(playlist, [], undefined, fakeParts, pieceMap)

	// 	// Use the modified cache values
	// 	const removedIds: PieceId[] = protectStringArray(['piece_1_0', 'piece_4_0'])
	// 	;(
	// 		wrapWithCacheForRundownPlaylist(playlist, async (playoutModel) => {
	// 			expect(
	// 				playoutModel.Pieces.update(removedIds[0], {
	// 					$set: {
	// 						invalid: true,
	// 					},
	// 				})
	// 			).toEqual(1)
	// 			playoutModel.Pieces.remove(removedIds[1])
	// 			expect(playoutModel.Pieces.initialized).toBeTruthy()

	// 			await getLookeaheadObjects(context, playoutModel, env.studio, playlist, partInstancesInfo)
	// 		})
	// 	)
	// 	const pieceMap2 = new Map<PartId, Piece[]>()
	// 	for (const [id, pieces] of pieceMap) {
	// 		const pieces2 = pieces.filter((p) => !removedIds.includes(p._id))
	// 		if (pieces2.length) pieceMap2.set(id, pieces2)
	// 	}
	// 	await expectLookaheadForLayerMock(playlist, [], undefined, fakeParts, pieceMap2)
	// })
})
