import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { getRandomId } from '@sofie-automation/corelib/dist/lib'
import { IBlueprintPieceType, PieceLifespan } from '@sofie-automation/blueprints-integration'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { EmptyPieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { ReadonlyDeep } from 'type-fest'
import {
	filterPieceInstancesForBranding,
	resolvePartInstanceForBranding,
	resolvePieceInstancesForBranding,
} from '../branding.js'
import { PlayoutPartInstanceModel } from '../model/PlayoutPartInstanceModel.js'

function createPieceInstance(
	piecePartial?: Partial<Pick<PieceInstancePiece, 'name' | 'sourceLayerId' | 'onlyValidForBranding' | 'branding'>>
): PieceInstance {
	return {
		_id: getRandomId(),
		playlistActivationId: protectString(''),
		rundownId: protectString(''),
		partInstanceId: protectString(''),
		disabled: false,
		piece: {
			_id: getRandomId(),
			externalId: '',
			startPartId: protectString(''),
			invalid: false,
			name: piecePartial?.name ?? 'unbranded-name',
			content: {},
			pieceType: IBlueprintPieceType.Normal,
			sourceLayerId: piecePartial?.sourceLayerId ?? 'unbranded-layer',
			outputLayerId: '',
			lifespan: PieceLifespan.WithinPart,
			enable: { start: 0 },
			timelineObjectsString: EmptyPieceTimelineObjectsBlob,
			onlyValidForBranding: piecePartial?.onlyValidForBranding,
			branding: piecePartial?.branding,
		},
	}
}

/** A stub of the parts of the model which `resolvePieceInstancesForBranding` reads */
function createPartInstanceModel(brandingId: string | null, pieceInstances: PieceInstance[]) {
	return {
		partInstance: { brandingId } as ReadonlyDeep<DBPartInstance>,
		pieceInstances: pieceInstances.map((pieceInstance) => ({ pieceInstance })),
	} as unknown as PlayoutPartInstanceModel
}

describe('resolvePieceInstancesForBranding', () => {
	test('a Piece not limited to a Branding is always used', () => {
		const piece0 = createPieceInstance()

		expect(resolvePieceInstancesForBranding(createPartInstanceModel(null, [piece0]))).toEqual([piece0])
		expect(resolvePieceInstancesForBranding(createPartInstanceModel('brandingA', [piece0]))).toEqual([piece0])
	})

	test('a Piece limited to a Branding is not used when no Branding is selected', () => {
		const piece0 = createPieceInstance({ onlyValidForBranding: ['brandingA'] })

		expect(resolvePieceInstancesForBranding(createPartInstanceModel(null, [piece0]))).toEqual([])
	})

	test('a Piece is used only while one of its Brandings is selected', () => {
		const piece0 = createPieceInstance({ onlyValidForBranding: ['brandingA', 'brandingB'] })

		expect(resolvePieceInstancesForBranding(createPartInstanceModel('brandingA', [piece0]))).toEqual([piece0])
		expect(resolvePieceInstancesForBranding(createPartInstanceModel('brandingB', [piece0]))).toEqual([piece0])
		expect(resolvePieceInstancesForBranding(createPartInstanceModel('brandingC', [piece0]))).toEqual([])
	})

	test('a Piece limited to an empty list of Brandings is never used', () => {
		const piece0 = createPieceInstance({ onlyValidForBranding: [] })

		expect(resolvePieceInstancesForBranding(createPartInstanceModel(null, [piece0]))).toEqual([])
		expect(resolvePieceInstancesForBranding(createPartInstanceModel('brandingA', [piece0]))).toEqual([])
	})

	test('only the Pieces used with the Branding are returned', () => {
		const pieceAlways = createPieceInstance()
		const pieceA = createPieceInstance({ onlyValidForBranding: ['brandingA'] })
		const pieceB = createPieceInstance({ onlyValidForBranding: ['brandingB'] })

		expect(
			resolvePieceInstancesForBranding(createPartInstanceModel('brandingA', [pieceAlways, pieceA, pieceB]))
		).toEqual([pieceAlways, pieceA])
	})

	test('the overrides of the selected Branding are applied', () => {
		const piece0 = createPieceInstance({
			branding: {
				brandingA: { name: 'branded-name' },
			},
		})

		const result = resolvePieceInstancesForBranding(createPartInstanceModel('brandingA', [piece0]))

		expect(result).toHaveLength(1)
		expect(result[0].piece.name).toBe('branded-name')
	})

	test('the overrides of another Branding are not applied', () => {
		const piece0 = createPieceInstance({
			branding: {
				brandingB: { name: 'branded-name' },
			},
		})

		for (const brandingId of [null, 'brandingA']) {
			const result = resolvePieceInstancesForBranding(createPartInstanceModel(brandingId, [piece0]))

			expect(result).toHaveLength(1)
			expect(result[0].piece.name).toBe('unbranded-name')
		}
	})

	test('a PieceInstance the Branding does not change is not copied', () => {
		const pieceNoBranding = createPieceInstance()
		const pieceOtherBranding = createPieceInstance({ branding: { brandingB: { name: 'branded-name' } } })

		const result = resolvePieceInstancesForBranding(
			createPartInstanceModel('brandingA', [pieceNoBranding, pieceOtherBranding])
		)

		expect(result[0]).toBe(pieceNoBranding)
		expect(result[1]).toBe(pieceOtherBranding)
	})

	test('the overrides are applied to a copy, leaving the stored PieceInstance untouched', () => {
		const piece0 = createPieceInstance({ branding: { brandingA: { name: 'branded-name' } } })

		const result = resolvePieceInstancesForBranding(createPartInstanceModel('brandingA', [piece0]))

		expect(result[0]).not.toBe(piece0)
		expect(piece0.piece.name).toBe('unbranded-name')
	})
})

describe('filterPieceInstancesForBranding', () => {
	test('hidden pieces are dropped, but the overrides are not applied', () => {
		const pieceHidden = createPieceInstance({ onlyValidForBranding: ['brandingB'] })
		const pieceBranded = createPieceInstance({
			branding: { brandingA: { name: 'branded-name' } },
		})

		const result = filterPieceInstancesForBranding(
			createPartInstanceModel('brandingA', [pieceHidden, pieceBranded])
		)

		expect(result).toHaveLength(1)
		expect(result[0]).toBe(pieceBranded)
		expect(result[0].piece.name).toBe('unbranded-name')
	})
})

describe('resolvePartInstanceForBranding', () => {
	function createPartInstance(
		brandingId: string | null,
		partPartial?: Partial<Pick<DBPart, 'title' | 'branding'>>
	): ReadonlyDeep<DBPartInstance> {
		return {
			_id: getRandomId(),
			brandingId,
			part: {
				_id: getRandomId(),
				title: 'unbranded-title',
				branding: partPartial?.branding,
			},
		} as unknown as ReadonlyDeep<DBPartInstance>
	}

	test('the overrides of the selected Branding are applied', () => {
		const partInstance = createPartInstance('brandingA', {
			branding: { brandingA: { title: 'branded-title' } },
		})

		const result = resolvePartInstanceForBranding(partInstance)

		expect(result.part.title).toBe('branded-title')
		// The stored PartInstance is left untouched
		expect(partInstance.part.title).toBe('unbranded-title')
	})

	test('the overrides of another Branding are not applied', () => {
		const partInstance = createPartInstance('brandingA', {
			branding: { brandingB: { title: 'branded-title' } },
		})

		expect(resolvePartInstanceForBranding(partInstance).part.title).toBe('unbranded-title')
	})

	test('a PartInstance the Branding does not change is not copied', () => {
		const partInstance = createPartInstance('brandingA')

		expect(resolvePartInstanceForBranding(partInstance)).toBe(partInstance)
	})
})
