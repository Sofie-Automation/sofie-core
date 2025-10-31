import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PlayoutSegmentModelImpl } from '../PlayoutSegmentModelImpl.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PlayoutRundownModelImpl } from '../PlayoutRundownModelImpl.js'
import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { restartRandomId } from '../../../../__mocks__/nanoid.js'
import { UserErrorMessage } from '@sofie-automation/corelib/dist/error'

describe('PlayoutRundownModelImpl', () => {
	function createBasicDBRundown(): DBRundown {
		return {
			_id: protectString('rd0'),
			studioId: protectString('studio0'),
			showStyleBaseId: protectString('ssb0'),
			showStyleVariantId: protectString('ssv0'),
			created: 0,
			modified: 0,
			externalId: 'rd0',
			name: `my rundown`,
			importVersions: null as any,
			timing: null as any,
			playlistId: protectString('playlist0'),
			source: {
				type: 'http',
			},
		}
	}

	function createBasicDBSegment(id: string, rank: number): DBSegment {
		return {
			_id: protectString(id),
			rundownId: protectString('rd0'),
			externalId: id,
			_rank: rank,
			name: `${id} segment`,
		}
	}

	it('rundown getter', async () => {
		const rundown = createBasicDBRundown()
		const model = new PlayoutRundownModelImpl(rundown, [], [])

		expect(model.rundown).toBe(rundown)
	})

	it('getSegment', async () => {
		const rundown = createBasicDBRundown()

		const segment = createBasicDBSegment('seg0', 0)
		const segmentModel = new PlayoutSegmentModelImpl(segment, [])

		const segment2 = createBasicDBSegment('seg1', 5)
		const segment2Model = new PlayoutSegmentModelImpl(segment2, [])

		const model = new PlayoutRundownModelImpl(rundown, [segmentModel, segment2Model], [])

		expect(model.getSegment(segment._id)).toBe(segmentModel)
		expect(model.getSegment(segment2._id)).toBe(segment2Model)

		expect(model.getSegment(protectString('missing-id'))).toBeUndefined()
	})

	it('getSegmentIds', async () => {
		const rundown = createBasicDBRundown()

		const segment = createBasicDBSegment('seg0', 0)
		const segmentModel = new PlayoutSegmentModelImpl(segment, [])

		const segment2 = createBasicDBSegment('seg1', 5)
		const segment2Model = new PlayoutSegmentModelImpl(segment2, [])

		const model = new PlayoutRundownModelImpl(
			rundown,
			[
				// Intentionally reverse the order
				segment2Model,
				segmentModel,
			],
			[]
		)

		expect(model.getSegmentIds()).toEqual([segment._id, segment2._id])
	})

	describe('insertAdlibTestingSegment', () => {
		beforeEach(() => {
			restartRandomId()
		})

		it('ok', async () => {
			const rundown = createBasicDBRundown()

			const segment = createBasicDBSegment('seg0', 0)
			const segmentModel = new PlayoutSegmentModelImpl(segment, [])

			const model = new PlayoutRundownModelImpl(rundown, [segmentModel], [])
			expect(model.AdlibTestingSegmentHasChanged).toBeFalsy()

			const expectedId: SegmentId = protectString('randomId9000')
			expect(model.insertAdlibTestingSegment()).toEqual(expectedId)

			const createdSegment = model.getSegment(expectedId) as PlayoutSegmentModelImpl
			expect(createdSegment).toBeTruthy()

			const fixedSegment: ReadonlyDeep<DBSegment> = {
				...createdSegment.segment,
			}

			expect(fixedSegment).toEqual({
				_id: expectedId,
				rundownId: protectString('rd0'),
				externalId: '__adlib-testing__',
				_rank: -1,
				name: '',
				orphaned: SegmentOrphanedReason.ADLIB_TESTING,
			} satisfies DBSegment)

			expect(model.AdlibTestingSegmentHasChanged).toBeTruthy()
		})

		it('check rank - first segment higher', async () => {
			const rundown = createBasicDBRundown()
			const segmentModel = new PlayoutSegmentModelImpl(createBasicDBSegment('seg0', 10), [])
			const model = new PlayoutRundownModelImpl(rundown, [segmentModel], [])

			const expectedId: SegmentId = protectString('randomId9000')
			expect(model.insertAdlibTestingSegment()).toEqual(expectedId)

			const createdSegment = model.getSegment(expectedId) as PlayoutSegmentModelImpl
			expect(createdSegment).toBeTruthy()
			expect(createdSegment.segment._rank).toBe(-1)
		})
		it('check rank - first segment lower', async () => {
			const rundown = createBasicDBRundown()
			const segmentModel = new PlayoutSegmentModelImpl(createBasicDBSegment('seg0', -5), [])
			const model = new PlayoutRundownModelImpl(rundown, [segmentModel], [])

			const expectedId: SegmentId = protectString('randomId9000')
			expect(model.insertAdlibTestingSegment()).toEqual(expectedId)

			const createdSegment = model.getSegment(expectedId) as PlayoutSegmentModelImpl
			expect(createdSegment).toBeTruthy()
			expect(createdSegment.segment._rank).toBe(-6)
		})

		it('calling twice fails', async () => {
			const rundown = createBasicDBRundown()

			const segment = createBasicDBSegment('seg0', 0)
			const segmentModel = new PlayoutSegmentModelImpl(segment, [])

			const model = new PlayoutRundownModelImpl(rundown, [segmentModel], [])

			const expectedId: SegmentId = protectString('randomId9000')
			expect(model.insertAdlibTestingSegment()).toEqual(expectedId)

			const createdSegment = model.getSegment(expectedId) as PlayoutSegmentModelImpl
			expect(createdSegment).toBeTruthy()

			model.clearAdlibTestingSegmentChangedFlag()

			// Expect a UserError
			expect(() => model.insertAdlibTestingSegment()).toThrow(
				expect.objectContaining({ key: UserErrorMessage.AdlibTestingAlreadyActive })
			)

			expect(model.AdlibTestingSegmentHasChanged).toBeFalsy()
		})

		it('calling when predefined', async () => {
			const rundown = createBasicDBRundown()

			const segment = createBasicDBSegment('seg0', 0)
			segment.orphaned = SegmentOrphanedReason.ADLIB_TESTING
			const segmentModel = new PlayoutSegmentModelImpl(segment, [])

			const model = new PlayoutRundownModelImpl(rundown, [segmentModel], [])

			// Expect a UserError
			expect(() => model.insertAdlibTestingSegment()).toThrow(
				expect.objectContaining({ key: UserErrorMessage.AdlibTestingAlreadyActive })
			)

			expect(model.AdlibTestingSegmentHasChanged).toBeFalsy()
		})
	})

	describe('removeAdlibTestingSegment', () => {
		beforeEach(() => {
			restartRandomId()
		})

		it('ok', async () => {
			const rundown = createBasicDBRundown()

			const segment = createBasicDBSegment('seg0', 0)
			segment.orphaned = SegmentOrphanedReason.ADLIB_TESTING
			const segmentModel = new PlayoutSegmentModelImpl(segment, [])

			const model = new PlayoutRundownModelImpl(rundown, [segmentModel], [])
			expect(model.AdlibTestingSegmentHasChanged).toBeFalsy()

			expect(model.removeAdlibTestingSegment()).toBeTruthy()
			expect(model.AdlibTestingSegmentHasChanged).toBeTruthy()
		})

		it('calling multiple times', async () => {
			const rundown = createBasicDBRundown()

			const segment = createBasicDBSegment('seg0', 0)
			segment.orphaned = SegmentOrphanedReason.ADLIB_TESTING
			const segmentModel = new PlayoutSegmentModelImpl(segment, [])

			const model = new PlayoutRundownModelImpl(rundown, [segmentModel], [])
			expect(model.AdlibTestingSegmentHasChanged).toBeFalsy()

			expect(model.removeAdlibTestingSegment()).toBeTruthy()
			expect(model.AdlibTestingSegmentHasChanged).toBeTruthy()

			// call again
			expect(model.removeAdlibTestingSegment()).toBeFalsy()
			expect(model.AdlibTestingSegmentHasChanged).toBeTruthy()

			// once more, after clearing changed flag
			model.clearAdlibTestingSegmentChangedFlag()
			expect(model.removeAdlibTestingSegment()).toBeFalsy()
			expect(model.AdlibTestingSegmentHasChanged).toBeFalsy()
		})

		it('insert then remove', async () => {
			const rundown = createBasicDBRundown()

			const segment = createBasicDBSegment('seg0', 0)
			const segmentModel = new PlayoutSegmentModelImpl(segment, [])

			const model = new PlayoutRundownModelImpl(rundown, [segmentModel], [])
			expect(model.AdlibTestingSegmentHasChanged).toBeFalsy()

			const expectedId: SegmentId = protectString('randomId9000')
			expect(model.insertAdlibTestingSegment()).toEqual(expectedId)
			expect(model.AdlibTestingSegmentHasChanged).toBeTruthy()
			expect(model.getSegmentIds()).toEqual([expectedId, segment._id])

			model.clearAdlibTestingSegmentChangedFlag()
			expect(model.removeAdlibTestingSegment()).toBeTruthy()
			expect(model.AdlibTestingSegmentHasChanged).toBeTruthy()
			expect(model.getSegmentIds()).toEqual([segment._id])
		})
	})

	describe('getAdlibTestingSegment', () => {
		beforeEach(() => {
			restartRandomId()
		})

		it('pre-defined', async () => {
			const rundown = createBasicDBRundown()

			const segment = createBasicDBSegment('seg0', 0)
			segment.orphaned = SegmentOrphanedReason.ADLIB_TESTING
			const segmentModel = new PlayoutSegmentModelImpl(segment, [])

			const model = new PlayoutRundownModelImpl(rundown, [segmentModel], [])

			expect(model.getAdlibTestingSegment()).toBe(segmentModel)
		})

		it('after remove', async () => {
			const rundown = createBasicDBRundown()

			const segment = createBasicDBSegment('seg0', 0)
			segment.orphaned = SegmentOrphanedReason.ADLIB_TESTING
			const segmentModel = new PlayoutSegmentModelImpl(segment, [])

			const model = new PlayoutRundownModelImpl(rundown, [segmentModel], [])

			expect(model.removeAdlibTestingSegment()).toBeTruthy()

			expect(model.getAdlibTestingSegment()).toBe(undefined)
		})

		it('after insert', async () => {
			const rundown = createBasicDBRundown()

			const segment = createBasicDBSegment('seg0', 0)
			const segmentModel = new PlayoutSegmentModelImpl(segment, [])

			const model = new PlayoutRundownModelImpl(rundown, [segmentModel], [])

			const expectedId: SegmentId = protectString('randomId9000')
			expect(model.insertAdlibTestingSegment()).toEqual(expectedId)

			expect(model.getAdlibTestingSegment()).toMatchObject({
				segment: { _id: expectedId },
			})
		})
	})

	describe('setAdlibTestingSegmentRank', () => {
		beforeEach(() => {
			restartRandomId()
		})

		it('pre-defined', async () => {
			const rundown = createBasicDBRundown()

			const segment = createBasicDBSegment('seg0', 99)
			segment.orphaned = SegmentOrphanedReason.ADLIB_TESTING
			const segmentModel = new PlayoutSegmentModelImpl(segment, [])

			const model = new PlayoutRundownModelImpl(rundown, [segmentModel], [])

			expect(model.getAdlibTestingSegment()?.segment._rank).toBe(99)

			model.clearAdlibTestingSegmentChangedFlag()
			model.updateAdlibTestingSegmentRank()

			expect(model.getAdlibTestingSegment()?.segment._rank).toBe(-1)
			expect(model.AdlibTestingSegmentHasChanged).toBeTruthy()
		})

		it('pre-defined: no change', async () => {
			const rundown = createBasicDBRundown()

			const segment = createBasicDBSegment('seg0', -1)
			segment.orphaned = SegmentOrphanedReason.ADLIB_TESTING
			const segmentModel = new PlayoutSegmentModelImpl(segment, [])

			const model = new PlayoutRundownModelImpl(rundown, [segmentModel], [])

			model.clearAdlibTestingSegmentChangedFlag()
			model.updateAdlibTestingSegmentRank()

			expect(model.getAdlibTestingSegment()?.segment._rank).toBe(-1)
			expect(model.AdlibTestingSegmentHasChanged).toBeFalsy()
		})

		it('after remove', async () => {
			const rundown = createBasicDBRundown()

			const segment = createBasicDBSegment('seg0', 0)
			segment.orphaned = SegmentOrphanedReason.ADLIB_TESTING
			const segmentModel = new PlayoutSegmentModelImpl(segment, [])

			const model = new PlayoutRundownModelImpl(rundown, [segmentModel], [])

			expect(model.removeAdlibTestingSegment()).toBeTruthy()

			model.clearAdlibTestingSegmentChangedFlag()
			model.updateAdlibTestingSegmentRank()
			expect(model.AdlibTestingSegmentHasChanged).toBeFalsy()
		})
	})
})
