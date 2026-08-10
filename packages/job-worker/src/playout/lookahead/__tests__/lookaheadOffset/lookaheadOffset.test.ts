jest.mock('../../../../playout/lookahead/index.js', () => {
	const actual = jest.requireActual('../../../../playout/lookahead/index.js')
	return {
		...actual,
		findLargestLookaheadDistance: jest.fn(() => 0),
		getLookeaheadObjects: actual.getLookeaheadObjects,
	}
})
jest.mock('../../../../playout/lookahead/util.js')
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { TSR } from '@sofie-automation/blueprints-integration'
import { JobContext } from '../../../../jobs/index.js'
import { findLargestLookaheadDistance, getLookeaheadObjects } from '../../index.js'
import { getOrderedPartsAfterPlayhead } from '../../util.js'
import { PlayoutModel } from '../../../model/PlayoutModel.js'
import { SelectedPartInstancesTimelineInfo } from '../../../timeline/generate.js'
import { wrapPieceToInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { baseContext, basePlayoutModel, makePiece, makeSimplePiece, lookaheadOffsetTestConstants } from './constants.js'

const findLargestLookaheadDistanceMock = jest.mocked(findLargestLookaheadDistance).mockImplementation(() => 0)
const getOrderedPartsAfterPlayheadMock = jest.mocked(getOrderedPartsAfterPlayhead).mockImplementation(() => [])

describe('lookahead offset integration', () => {
	let context: JobContext
	let playoutModel: PlayoutModel

	beforeEach(() => {
		jest.resetAllMocks()

		context = baseContext
		playoutModel = basePlayoutModel
	})

	test('returns empty array when no lookahead mappings are defined', async () => {
		getOrderedPartsAfterPlayheadMock.mockReturnValue([
			{
				_id: protectString('p1'),
				classesForNext: [],
			} as any,
		])
		const findFetchMock = jest.fn().mockResolvedValue([makePiece({ partId: 'p1', layer: 'layer1' })])
		context = {
			...context,
			studio: {
				...context.studio,
				mappings: {},
			},
			directCollections: {
				...context.directCollections,
				Pieces: {
					...context.directCollections.Pieces,
					findFetch: findFetchMock,
				},
			},
		} as JobContext

		const res = await getLookeaheadObjects(context, playoutModel, {} as SelectedPartInstancesTimelineInfo)

		expect(res).toEqual([])
	})
	test('respects lookaheadMaxSearchDistance', async () => {
		getOrderedPartsAfterPlayheadMock.mockReturnValue([
			{ _id: protectString('p1'), classesForNext: [] } as any,
			{ _id: protectString('p2'), classesForNext: [] } as any,
			{ _id: protectString('p3'), classesForNext: [] } as any,
			{ _id: protectString('p4'), classesForNext: [] } as any,
		])

		const findFetchMock = jest
			.fn()
			.mockResolvedValue([
				makeSimplePiece({ partId: 'p1', layer: 'layer1' }),
				makeSimplePiece({ partId: 'p2', layer: 'layer1' }),
				makeSimplePiece({ partId: 'p3', layer: 'layer1' }),
				makeSimplePiece({ partId: 'p4', layer: 'layer1' }),
			])

		context = {
			...context,
			studio: {
				...context.studio,
				mappings: {
					...context.studio.mappings,
					layer1: {
						...context.studio.mappings['layer1'],
						lookaheadMaxSearchDistance: 3,
					},
				},
			},
			directCollections: {
				...context.directCollections,
				Pieces: {
					...context.directCollections.Pieces,
					findFetch: findFetchMock,
				},
			},
		} as JobContext

		const res = await getLookeaheadObjects(context, playoutModel, {
			current: undefined,
			next: undefined,
			previous: undefined,
		} as SelectedPartInstancesTimelineInfo)

		expect(res).toHaveLength(2)
		const obj0 = res[0]
		const obj1 = res[1]

		expect(obj0.layer).toBe('layer1_lookahead')
		expect(obj0.objectType).toBe('rundown')
		expect(obj0.pieceInstanceId).toContain('p1')
		expect(obj0.partInstanceId).toContain('p1')
		expect(obj0.content).toMatchObject({
			deviceType: TSR.DeviceType.CASPARCG,
			type: TSR.TimelineContentTypeCasparCg.MEDIA,
			file: 'AMB',
		})
		expect(obj1.layer).toBe('layer1_lookahead')
		expect(obj1.objectType).toBe('rundown')
		expect(obj1.pieceInstanceId).toContain('p2')
		expect(obj1.partInstanceId).toContain('p2')
		expect(obj1.content).toMatchObject({
			deviceType: TSR.DeviceType.CASPARCG,
			type: TSR.TimelineContentTypeCasparCg.MEDIA,
			file: 'AMB',
		})
	})
	test('applies nextTimeOffset to lookahead objects in future part', async () => {
		playoutModel = {
			...playoutModel,
			playlist: {
				...playoutModel.playlist,
				nextTimeOffset: 5000,
			},
		} as PlayoutModel
		findLargestLookaheadDistanceMock.mockReturnValue(1)
		getOrderedPartsAfterPlayheadMock.mockReturnValue([
			{ _id: protectString('p1'), classesForNext: [] } as any,
			{ _id: protectString('p2'), classesForNext: [] } as any,
		])

		context.directCollections.Pieces.findFetch = jest
			.fn()
			.mockResolvedValue([
				makeSimplePiece({ partId: 'p1', layer: 'layer1' }),
				makeSimplePiece({ partId: 'p2', layer: 'layer1', start: 2000 }),
			])

		const res = await getLookeaheadObjects(context, playoutModel, {} as SelectedPartInstancesTimelineInfo)

		expect(res).toHaveLength(2)
		expect(res[0].lookaheadOffset).toBe(5000)
		expect(res[1].lookaheadOffset).toBe(3000)
	})
	test('applies nextTimeOffset to lookahead objects in nextPart with no offset on next part', async () => {
		playoutModel = {
			...playoutModel,
			playlist: {
				...playoutModel.playlist,
				nextTimeOffset: 5000,
			},
		} as PlayoutModel
		getOrderedPartsAfterPlayheadMock.mockReturnValue([{ _id: protectString('p1'), classesForNext: [] } as any])

		context.directCollections.Pieces.findFetch = jest
			.fn()
			.mockResolvedValue([
				makeSimplePiece({ partId: 'pNext', layer: 'layer1', start: 0 }),
				makeSimplePiece({ partId: 'p1', layer: 'layer2', start: 0 }),
			])

		const res = await getLookeaheadObjects(context, playoutModel, {
			next: {
				partTimes: { nowInPart: 0 },
				partInstance: {
					_id: protectString('pNextInstance'),
					part: {
						_id: protectString('pNext'),
						_rank: 0,
					},
					playlistActivationId: 'pA1',
				},
				pieceInstances: [
					wrapPieceToInstance(
						makeSimplePiece({ partId: 'pNext', layer: 'layer1', start: 0 }),
						protectString('pA1'),
						protectString('pNextInstance')
					),
				],
				calculatedTimings: undefined,
				regenerateTimelineAt: undefined,
			},
		} as any)

		expect(res).toHaveLength(2)
		expect(res[0].lookaheadOffset).toBe(5000)
		expect(res[1].lookaheadOffset).toBe(undefined)
	})
	test('Multi layer part produces lookahead objects for all layers with the correct offsets', async () => {
		playoutModel = {
			...playoutModel,
			playlist: {
				...playoutModel.playlist,
				nextTimeOffset: 1000,
			},
		} as PlayoutModel
		getOrderedPartsAfterPlayheadMock.mockReturnValue([
			{ ...lookaheadOffsetTestConstants.multiLayerPart, classesForNext: [] } as any,
		])

		context.directCollections.Pieces.findFetch = jest
			.fn()
			.mockResolvedValue(lookaheadOffsetTestConstants.multiLayerPart.pieces)

		const res = await getLookeaheadObjects(context, playoutModel, {
			next: {
				...lookaheadOffsetTestConstants.multiLayerPart,
				pieceInstances: lookaheadOffsetTestConstants.multiLayerPart.pieces.map((piece) =>
					wrapPieceToInstance(
						piece,
						protectString('pA1'),
						lookaheadOffsetTestConstants.multiLayerPart.partInstance._id
					)
				),
			},
		} as any)

		// With multi-object support each piece contributes all three of its timeline
		// objects (pieceStart, beforeOffset, afterOffset) → 3 objects per layer × 3 layers = 9
		expect(res).toHaveLength(9)
		expect(res.map((o) => o.layer).sort()).toEqual([
			'layer1_lookahead',
			'layer1_lookahead',
			'layer1_lookahead',
			'layer2_lookahead',
			'layer2_lookahead',
			'layer2_lookahead',
			'layer3_lookahead',
			'layer3_lookahead',
			'layer3_lookahead',
		])
		// Layers are processed in insertion order (layer1, layer2, layer3).
		// For layer1 (piece start=0, nextTimeOffset=1000):
		//   objPieceStart (start=0 → offset=1000), obj_beforeOffset (start=700 → offset=300), obj_afterOffset (start=1700 → undef)
		// For layer2 (piece start=500):
		//   objPieceStart (start=0 → offset=500), obj_beforeOffset (start=200 → offset=300), obj_afterOffset (start=1200 → undef)
		// For layer3 (piece start=1500 > nextTimeOffset): all offsets are undefined
		expect(res.map((o) => o.lookaheadOffset)).toEqual([
			1000,
			300,
			undefined,
			500,
			300,
			undefined,
			undefined,
			undefined,
			undefined,
		])
	})
	test('Multi layer part produces lookahead objects with while enable values for all layers with the correct offsets', async () => {
		playoutModel = {
			...playoutModel,
			playlist: {
				...playoutModel.playlist,
				nextTimeOffset: 1000,
			},
		} as PlayoutModel
		getOrderedPartsAfterPlayheadMock.mockReturnValue([
			{ ...lookaheadOffsetTestConstants.multiLayerPartWhile, classesForNext: [] } as any,
		])

		context.directCollections.Pieces.findFetch = jest
			.fn()
			.mockResolvedValue(lookaheadOffsetTestConstants.multiLayerPartWhile.pieces)

		const res = await getLookeaheadObjects(context, playoutModel, {
			next: {
				...lookaheadOffsetTestConstants.multiLayerPartWhile,
				pieceInstances: lookaheadOffsetTestConstants.multiLayerPartWhile.pieces.map((piece) =>
					wrapPieceToInstance(
						piece,
						protectString('pA1'),
						lookaheadOffsetTestConstants.multiLayerPartWhile.partInstance._id
					)
				),
			},
		} as any)

		// Same structure as the non-while variant — while enables produce identical offsets
		expect(res).toHaveLength(9)
		expect(res.map((o) => o.layer).sort()).toEqual([
			'layer1_lookahead',
			'layer1_lookahead',
			'layer1_lookahead',
			'layer2_lookahead',
			'layer2_lookahead',
			'layer2_lookahead',
			'layer3_lookahead',
			'layer3_lookahead',
			'layer3_lookahead',
		])
		expect(res.map((o) => o.lookaheadOffset)).toEqual([
			1000,
			300,
			undefined,
			500,
			300,
			undefined,
			undefined,
			undefined,
			undefined,
		])
	})
	test('Single layer part produces lookahead objects with the correct offsets', async () => {
		playoutModel = {
			...playoutModel,
			playlist: {
				...playoutModel.playlist,
				nextTimeOffset: 1000,
			},
		} as PlayoutModel
		getOrderedPartsAfterPlayheadMock.mockReturnValue([
			{ ...lookaheadOffsetTestConstants.singleLayerPart, classesForNext: [] } as any,
		])

		context.directCollections.Pieces.findFetch = jest
			.fn()
			.mockResolvedValue(lookaheadOffsetTestConstants.singleLayerPart.pieces)

		const res = await getLookeaheadObjects(context, playoutModel, {
			next: {
				...lookaheadOffsetTestConstants.singleLayerPart,
				pieceInstances: lookaheadOffsetTestConstants.singleLayerPart.pieces.map((piece) =>
					wrapPieceToInstance(
						piece as any,
						'pA1' as any,
						lookaheadOffsetTestConstants.singleLayerPart.partInstance._id
					)
				),
			},
		} as any)
		// filterPieceInstancesForNextPartWithOffset keeps piece2 (start=500, best before nextTimeOffset=1000)
		// and piece3 (start=1500, after nextTimeOffset). piece1 (start=0) is replaced by piece2.
		// With multi-object support each kept piece contributes all three timeline objects → 3+3=6
		expect(res).toHaveLength(6)
		expect(res.map((o) => o.layer)).toEqual(Array(6).fill('layer1_lookahead'))
		// piece2 (start=500): objPieceStart (0→500), obj_beforeOffset (200→300), obj_afterOffset (1200→undef)
		// piece3 (start=1500 > nextTimeOffset): all three objects have undefined offset
		expect(res.map((o) => o.lookaheadOffset)).toEqual([500, 300, undefined, undefined, undefined, undefined])
	})
	test('Single layer part produces lookahead objects with while enable values with the correct offsets', async () => {
		playoutModel = {
			...playoutModel,
			playlist: {
				...playoutModel.playlist,
				nextTimeOffset: 1000,
			},
		} as PlayoutModel
		getOrderedPartsAfterPlayheadMock.mockReturnValue([
			{ ...lookaheadOffsetTestConstants.singleLayerPartWhile, classesForNext: [] } as any,
		])

		context.directCollections.Pieces.findFetch = jest
			.fn()
			.mockResolvedValue(lookaheadOffsetTestConstants.singleLayerPartWhile.pieces)

		const res = await getLookeaheadObjects(context, playoutModel, {
			next: {
				...lookaheadOffsetTestConstants.singleLayerPartWhile,
				pieceInstances: lookaheadOffsetTestConstants.singleLayerPartWhile.pieces.map((piece) =>
					wrapPieceToInstance(
						piece,
						protectString('pA1'),
						lookaheadOffsetTestConstants.singleLayerPartWhile.partInstance._id
					)
				),
			},
		} as any)
		// Same structure as the non-while variant — while enables produce identical offsets
		expect(res).toHaveLength(6)
		expect(res.map((o) => o.layer)).toEqual(Array(6).fill('layer1_lookahead'))
		expect(res.map((o) => o.lookaheadOffset)).toEqual([500, 300, undefined, undefined, undefined, undefined])
	})
})
