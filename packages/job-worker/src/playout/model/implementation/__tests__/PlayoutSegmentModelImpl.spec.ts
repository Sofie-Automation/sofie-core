import { DBSegment, SegmentOrphanedReason } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { PlayoutSegmentModelImpl } from '../PlayoutSegmentModelImpl.js'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'

describe('PlayoutSegmentModelImpl', () => {
	function createBasicDBSegment(): DBSegment {
		return {
			_id: protectString('abc'),
			rundownId: protectString('rd0'),
			externalId: 'ext1',
			_rank: 1,
			name: 'test segment',
		}
	}

	it('segment getter', async () => {
		const segment = createBasicDBSegment()
		const model = new PlayoutSegmentModelImpl(segment, [])

		expect(model.segment).toBe(segment)
	})

	describe('getPartIds', () => {
		it('no parts', async () => {
			const segment = createBasicDBSegment()
			const model = new PlayoutSegmentModelImpl(segment, [])

			expect(model.getPartIds()).toEqual([])
		})
		it('with parts', async () => {
			const fakePart: DBPart = { _id: protectString('part0'), _rank: 1 } as any
			const fakePart2: DBPart = { _id: protectString('part1'), _rank: 2 } as any
			const segment = createBasicDBSegment()
			const model = new PlayoutSegmentModelImpl(segment, [fakePart, fakePart2])

			expect(model.getPartIds()).toEqual([fakePart._id, fakePart2._id])
		})
		it('with parts ensuring order', async () => {
			const fakePart: DBPart = { _id: protectString('part0'), _rank: 5 } as any
			const fakePart2: DBPart = { _id: protectString('part1'), _rank: 2 } as any
			const segment = createBasicDBSegment()
			const model = new PlayoutSegmentModelImpl(segment, [fakePart, fakePart2])

			expect(model.getPartIds()).toEqual([fakePart2._id, fakePart._id])
		})
	})

	describe('getPart', () => {
		it('no parts', async () => {
			const segment = createBasicDBSegment()
			const model = new PlayoutSegmentModelImpl(segment, [])

			expect(model.getPart(protectString('missing'))).toBeUndefined()
		})
		it('with other parts', async () => {
			const fakePart: DBPart = { _id: protectString('part0'), _rank: 1 } as any
			const fakePart2: DBPart = { _id: protectString('part1'), _rank: 2 } as any
			const segment = createBasicDBSegment()
			const model = new PlayoutSegmentModelImpl(segment, [fakePart, fakePart2])

			expect(model.getPart(protectString('missing'))).toBeUndefined()
		})
		it('with found part', async () => {
			const fakePart: DBPart = { _id: protectString('part0'), _rank: 1 } as any
			const fakePart2: DBPart = { _id: protectString('part1'), _rank: 2 } as any
			const segment = createBasicDBSegment()
			const model = new PlayoutSegmentModelImpl(segment, [fakePart, fakePart2])

			expect(model.getPart(fakePart._id)).toBe(fakePart)
		})
	})

	describe('setAdlibTestingRank', () => {
		it('not AdlibTesting segment', async () => {
			const segment = createBasicDBSegment()
			const originalRank = segment._rank
			const model = new PlayoutSegmentModelImpl(segment, [])

			expect(() => model.setAdlibTestingRank(originalRank + 1)).toThrow(
				/setAdlibTestingRank can only be used on an AdlibTesting segment/
			)
			expect(model.segment._rank).toBe(originalRank)
		})

		it('is AdlibTesting segment', async () => {
			const segment = createBasicDBSegment()
			segment.orphaned = SegmentOrphanedReason.ADLIB_TESTING

			const originalRank = segment._rank
			const model = new PlayoutSegmentModelImpl(segment, [])

			// Set should report change
			expect(model.setAdlibTestingRank(originalRank + 1)).toBeTruthy()
			expect(model.segment._rank).toBe(originalRank + 1)

			// Set again should report no change
			expect(model.setAdlibTestingRank(originalRank + 1)).toBeFalsy()
			expect(model.segment._rank).toBe(originalRank + 1)
		})

		it('not orphaned segment', async () => {
			const segment = createBasicDBSegment()
			segment.orphaned = SegmentOrphanedReason.DELETED

			const originalRank = segment._rank
			const model = new PlayoutSegmentModelImpl(segment, [])

			expect(() => model.setAdlibTestingRank(originalRank + 1)).toThrow(
				/setAdlibTestingRank can only be used on an AdlibTesting segment/
			)
			expect(model.segment._rank).toBe(originalRank)
		})
	})
})
