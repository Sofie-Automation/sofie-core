import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	PartId,
	PartInstanceId,
	PieceId,
	PieceInstanceId,
	PieceInstanceInfiniteId,
	RundownId,
	RundownPlaylistActivationId,
	SegmentPlayoutId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { PlayoutPartInstanceModelImpl } from '../PlayoutPartInstanceModelImpl.js'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { IBlueprintPieceType, PieceLifespan } from '@sofie-automation/blueprints-integration'

describe('PlayoutPartInstanceModelImpl', () => {
	function createBasicDBPartInstance(): DBPartInstance {
		return {
			_id: getRandomId(),
			rundownId: protectString<RundownId>(''),
			segmentId: protectString(''),
			playlistActivationId: protectString<RundownPlaylistActivationId>(''),
			segmentPlayoutId: protectString<SegmentPlayoutId>(''),
			rehearsal: false,

			takeCount: 0,
			brandingId: null,

			part: {
				_id: getRandomId(),
				_rank: 0,
				rundownId: protectString<RundownId>(''),
				segmentId: protectString(''),
				externalId: '',
				title: '',

				expectedDurationWithTransition: undefined,
			},
		}
	}

	function createPieceInstanceAsInfinite(id: string, fromPreviousPlayhead: boolean): PieceInstance {
		return literal<PieceInstance>({
			_id: protectString<PieceInstanceId>(id),
			rundownId: protectString<RundownId>(''),
			partInstanceId: protectString<PartInstanceId>(''),
			playlistActivationId: protectString<RundownPlaylistActivationId>('active'),
			piece: literal<PieceInstancePiece>({
				_id: protectString(`${id}_p`),
				externalId: '',
				startPartId: protectString<PartId>(''),
				enable: { start: 0 },
				name: '',
				lifespan: PieceLifespan.OutOnRundownChange,
				sourceLayerId: '',
				outputLayerId: '',
				invalid: false,
				content: {},
				timelineObjectsString: protectString(''),
				pieceType: IBlueprintPieceType.Normal,
			}),
			infinite: {
				infiniteInstanceId: protectString<PieceInstanceInfiniteId>(`${id}_inf`),
				infiniteInstanceIndex: 0,
				infinitePieceId: protectString<PieceId>(`${id}_p`),
				fromPreviousPart: false,
				fromPreviousPlayhead,
			},
		})
	}

	describe('replaceInfinitesFromPreviousPlayhead', () => {
		it('works for an empty part', async () => {
			const partInstance = createBasicDBPartInstance()
			// note: QuickLoopService not implemented as it is not required for the test
			const model = new PlayoutPartInstanceModelImpl(partInstance, [], false, {} as any)

			expect(() => model.replaceInfinitesFromPreviousPlayhead([])).not.toThrow()
			expect(model.pieceInstances).toEqual([])
		})

		it('keeps pieceInstance with fromPreviousPlayhead=false', async () => {
			const partInstance = createBasicDBPartInstance()
			// note: QuickLoopService not implemented as it is not required for the test
			const model = new PlayoutPartInstanceModelImpl(
				partInstance,
				[createPieceInstanceAsInfinite('p1', false)],
				false,
				{} as any
			)

			expect(() => model.replaceInfinitesFromPreviousPlayhead([])).not.toThrow()
			expect(model.pieceInstances.map((p) => p.pieceInstance._id)).toEqual(['p1'])
		})

		it('deleted pieceInstance with fromPreviousPlayhead=true if no replacement provided', async () => {
			const partInstance = createBasicDBPartInstance()
			// note: QuickLoopService not implemented as it is not required for the test
			const model = new PlayoutPartInstanceModelImpl(
				partInstance,
				[createPieceInstanceAsInfinite('p1', true)],
				false,
				{} as any
			)

			expect(() => model.replaceInfinitesFromPreviousPlayhead([])).not.toThrow()
			expect(model.pieceInstances.map((p) => p.pieceInstance._id)).toEqual([])
		})

		it('replaces pieceInstance with fromPreviousPlayhead=true if replacement provided', async () => {
			const partInstance = createBasicDBPartInstance()
			// note: QuickLoopService not implemented as it is not required for the test
			const model = new PlayoutPartInstanceModelImpl(
				partInstance,
				[createPieceInstanceAsInfinite('p1', true)],
				false,
				{} as any
			)

			expect(() =>
				model.replaceInfinitesFromPreviousPlayhead([createPieceInstanceAsInfinite('p1', true)])
			).not.toThrow()
			expect(model.pieceInstances.map((p) => p.pieceInstance._id)).toEqual(['p1'])
		})
	})
})
