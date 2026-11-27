import { PartId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { computeCurrentPartIndex } from '../syncChangesToPartInstance.js'

describe('computeCurrentPartIndex', () => {
	function createMockSegmentsAndParts() {
		const segments = [
			{
				_id: protectString<SegmentId>('segment1'),
				_rank: 1,
			},
			{
				_id: protectString<SegmentId>('segment1b'),
				_rank: 2,
			},
			{
				_id: protectString<SegmentId>('segment2'),
				_rank: 3,
			},
			{
				_id: protectString<SegmentId>('segment3'),
				_rank: 4,
			},
		] satisfies Partial<DBSegment>[]
		const parts = [
			{
				_id: protectString<PartId>('part1'),
				segmentId: protectString<SegmentId>('segment1'),
				_rank: 1,
			},
			{
				_id: protectString<PartId>('part2'),
				segmentId: protectString<SegmentId>('segment1'),
				_rank: 2,
			},
			{
				_id: protectString<PartId>('part3'),
				segmentId: protectString<SegmentId>('segment2'),
				_rank: 1,
			},
			{
				_id: protectString<PartId>('part4'),
				segmentId: protectString<SegmentId>('segment2'),
				_rank: 2,
			},
			{
				_id: protectString<PartId>('part5'),
				segmentId: protectString<SegmentId>('segment3'),
				_rank: 1,
			},
			{
				_id: protectString<PartId>('part6'),
				segmentId: protectString<SegmentId>('segment3'),
				_rank: 2,
			},
			{
				_id: protectString<PartId>('part7'),
				segmentId: protectString<SegmentId>('segment3'),
				_rank: 3,
			},
		] satisfies Partial<DBPart>[]

		return {
			segments: segments as DBSegment[],
			parts: parts as DBPart[],
		}
	}

	it('match by id', () => {
		const { segments, parts } = createMockSegmentsAndParts()

		const index = computeCurrentPartIndex(
			segments,
			parts,
			protectString<PartId>('part3'),
			protectString<SegmentId>('segment2'),
			3
		)
		expect(index).toBe(2)
	})

	it('interpolate by rank', () => {
		const { segments, parts } = createMockSegmentsAndParts()

		const index = computeCurrentPartIndex(
			segments,
			parts,
			protectString<PartId>('partY'),
			protectString<SegmentId>('segment2'),
			1.3
		)
		expect(index).toBe(2.5)
	})

	it('before first part in segment', () => {
		const { segments, parts } = createMockSegmentsAndParts()

		const index = computeCurrentPartIndex(
			segments,
			parts,
			protectString<PartId>('partZ'),
			protectString<SegmentId>('segment2'),
			0
		)
		expect(index).toBe(1.5)
	})

	it('after last part in segment', () => {
		const { segments, parts } = createMockSegmentsAndParts()

		const index = computeCurrentPartIndex(
			segments,
			parts,
			protectString<PartId>('partW'),
			protectString<SegmentId>('segment2'),
			3
		)
		expect(index).toBe(3.5)
	})

	it('segment with no parts', () => {
		const { segments, parts } = createMockSegmentsAndParts()

		const index = computeCurrentPartIndex(
			segments,
			parts,
			protectString<PartId>('partV'),
			protectString<SegmentId>('segment1b'),
			1
		)
		expect(index).toBe(1.5)
	})

	it('non-existing segment', () => {
		const { segments, parts } = createMockSegmentsAndParts()

		const index = computeCurrentPartIndex(
			segments,
			parts,
			protectString<PartId>('partU'),
			protectString<SegmentId>('segmentX'),
			1
		)
		expect(index).toBeNull()
	})

	it('no parts at all', () => {
		const segments: DBSegment[] = []
		const parts: DBPart[] = []

		const index = computeCurrentPartIndex(
			segments,
			parts,
			protectString<PartId>('partT'),
			protectString<SegmentId>('segment1'),
			1
		)
		expect(index).toBeNull()
	})

	it('before first part', () => {
		const { segments, parts } = createMockSegmentsAndParts()

		const index = computeCurrentPartIndex(
			segments,
			parts,
			protectString<PartId>('partS'),
			protectString<SegmentId>('segment1'),
			0
		)
		expect(index).toBe(-0.5)
	})
})
