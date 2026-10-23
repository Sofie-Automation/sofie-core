import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { PlayoutPartInstanceModelImpl } from '../PlayoutPartInstanceModelImpl.js'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { IBlueprintPieceType } from '@sofie-automation/blueprints-integration'

describe('PlayoutPartInstanceModelImpl', () => {
	function createBasicDBPartInstance(): DBPartInstance {
		return {
			_id: getRandomId(),
			rundownId: protectString(''),
			segmentId: protectString(''),
			playlistActivationId: protectString(''),
			segmentPlayoutId: protectString(''),
			rehearsal: false,

			takeCount: 0,

			part: {
				_id: getRandomId(),
				_rank: 0,
				rundownId: protectString(''),
				segmentId: protectString(''),
				externalId: '',
				title: '',

				expectedDurationWithTransition: undefined,
			},
		}
	}

	function createPieceInstanceAsInfinite(id: string, fromPreviousPart: boolean): PieceInstance {
		return literal<PieceInstance>({
			_id: protectString(id),
			rundownId: protectString(''),
			partInstanceId: protectString(''),
			playlistActivationId: protectString('active'),
			piece: literal<PieceInstancePiece>({
				_id: protectString(`${id}_p`),
				externalId: '',
				startPartId: protectString(''),
				enable: { start: 0 },
				name: '',
				lifespan: { scope: 'rundown', presence: 'follow-playhead', inShadow: 'stop' },
				sourceLayerId: '',
				outputLayerId: '',
				invalid: false,
				content: {},
				timelineObjectsString: protectString(''),
				pieceType: IBlueprintPieceType.Normal,
			}),
			infinite: {
				infiniteInstanceId: protectString(`${id}_inf`),
				infiniteInstanceIndex: 0,
				infinitePieceId: protectString(`${id}_p`),
				fromPreviousPart,
			},
		})
	}

	describe('replaceContinuedInfinites', () => {
		it('works for an empty part', async () => {
			const partInstance = createBasicDBPartInstance()
			// note: QuickLoopService not implemented as it is not required for the test
			const model = new PlayoutPartInstanceModelImpl(partInstance, [], false, {} as any)

			expect(() => model.replaceContinuedInfinites([])).not.toThrow()
			expect(model.pieceInstances).toEqual([])
		})

		it('keeps pieceInstance with fromPreviousPart=false', async () => {
			const partInstance = createBasicDBPartInstance()
			// note: QuickLoopService not implemented as it is not required for the test
			const model = new PlayoutPartInstanceModelImpl(
				partInstance,
				[createPieceInstanceAsInfinite('p1', false)],
				false,
				{} as any
			)

			expect(() => model.replaceContinuedInfinites([])).not.toThrow()
			expect(model.pieceInstances.map((p) => p.pieceInstance._id)).toEqual(['p1'])
		})

		it('deleted pieceInstance with fromPreviousPart=true if no replacement provided', async () => {
			const partInstance = createBasicDBPartInstance()
			// note: QuickLoopService not implemented as it is not required for the test
			const model = new PlayoutPartInstanceModelImpl(
				partInstance,
				[createPieceInstanceAsInfinite('p1', true)],
				false,
				{} as any
			)

			expect(() => model.replaceContinuedInfinites([])).not.toThrow()
			expect(model.pieceInstances.map((p) => p.pieceInstance._id)).toEqual([])
		})

		it('replaces pieceInstance with fromPreviousPart=true if replacement provided', async () => {
			const partInstance = createBasicDBPartInstance()
			// note: QuickLoopService not implemented as it is not required for the test
			const model = new PlayoutPartInstanceModelImpl(
				partInstance,
				[createPieceInstanceAsInfinite('p1', true)],
				false,
				{} as any
			)

			expect(() => model.replaceContinuedInfinites([createPieceInstanceAsInfinite('p1', true)])).not.toThrow()
			expect(model.pieceInstances.map((p) => p.pieceInstance._id)).toEqual(['p1'])
		})
	})
})
