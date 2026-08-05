import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { PlayoutPartInstanceModelImpl } from '../PlayoutPartInstanceModelImpl.js'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { IBlueprintPieceType, PieceLifespan } from '@sofie-automation/blueprints-integration'

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

	function createPieceInstanceAsInfinite(id: string, fromPreviousPlayhead: boolean): PieceInstance {
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
				lifespan: PieceLifespan.OutOnRundownChange,
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
				fromPreviousPart: false,
				fromPreviousPlayhead,
			},
		})
	}

	function createBasicPieceInstance(id: string): PieceInstance {
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
				lifespan: PieceLifespan.WithinPart,
				sourceLayerId: '',
				outputLayerId: '',
				invalid: false,
				content: {},
				timelineObjectsString: protectString(''),
				pieceType: IBlueprintPieceType.Normal,
			}),
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

		it('restores the recue snapshot back to the original next-part state', async () => {
			const partInstance = createBasicDBPartInstance()
			const model = new PlayoutPartInstanceModelImpl(partInstance, [], false, {} as any)

			model.blockTakeUntil(1000)
			model.recueNextPartSnapshot = model.snapshotMakeCopy()
			model.blockTakeUntil(2000)

			expect(model.partInstance.blockTakeUntil).toBe(2000)

			model.recueNextPart()

			expect(model.partInstance.blockTakeUntil).toBe(1000)
		})

		it('snapshotRestore keeps removed current pieces tracked for persistence', async () => {
			const partInstance = createBasicDBPartInstance()
			const model = new PlayoutPartInstanceModelImpl(
				partInstance,
				[createBasicPieceInstance('p1')],
				false,
				{} as any
			)

			const snapshot = model.snapshotMakeCopy()
			const insertedPieceInstance = model.insertPlannedPiece(createBasicPieceInstance('p2').piece)

			expect(model.pieceInstancesImpl.get(insertedPieceInstance.pieceInstance._id)).toBeDefined()

			model.snapshotRestore(snapshot)

			expect(model.pieceInstancesImpl.get(insertedPieceInstance.pieceInstance._id)).toBeNull()
			expect(model.partInstanceHasChanges).toBe(true)
		})
	})
})
