import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { computeCurrentPartIndex } from '../syncChangesToPartInstance.js'

describe('computeCurrentPartIndex', () => {
	function createMockSegmentsAndParts() {
		const segments = [
			{
				_id: protectString('segment1'),
				_rank: 1,
			},
			{
				_id: protectString('segment1b'),
				_rank: 2,
			},
			{
				_id: protectString('segment2'),
				_rank: 3,
			},
			{
				_id: protectString('segment3'),
				_rank: 4,
			},
		] satisfies Partial<DBSegment>[]
		const parts = [
			{
				_id: protectString('part1'),
				segmentId: protectString('segment1'),
				_rank: 1,
			},
			{
				_id: protectString('part2'),
				segmentId: protectString('segment1'),
				_rank: 2,
			},
			{
				_id: protectString('part3'),
				segmentId: protectString('segment2'),
				_rank: 1,
			},
			{
				_id: protectString('part4'),
				segmentId: protectString('segment2'),
				_rank: 2,
			},
			{
				_id: protectString('part5'),
				segmentId: protectString('segment3'),
				_rank: 1,
			},
			{
				_id: protectString('part6'),
				segmentId: protectString('segment3'),
				_rank: 2,
			},
			{
				_id: protectString('part7'),
				segmentId: protectString('segment3'),
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

		const index = computeCurrentPartIndex(segments, parts, protectString('part3'), protectString('segment2'), 3)
		expect(index).toBe(2)
	})

	it('interpolate by rank', () => {
		const { segments, parts } = createMockSegmentsAndParts()

		const index = computeCurrentPartIndex(segments, parts, protectString('partY'), protectString('segment2'), 1.3)
		expect(index).toBe(2.5)
	})

	it('before first part in segment', () => {
		const { segments, parts } = createMockSegmentsAndParts()

		const index = computeCurrentPartIndex(segments, parts, protectString('partZ'), protectString('segment2'), 0)
		expect(index).toBe(1.5)
	})

	it('after last part in segment', () => {
		const { segments, parts } = createMockSegmentsAndParts()

		const index = computeCurrentPartIndex(segments, parts, protectString('partW'), protectString('segment2'), 3)
		expect(index).toBe(3.5)
	})

	it('segment with no parts', () => {
		const { segments, parts } = createMockSegmentsAndParts()

		const index = computeCurrentPartIndex(segments, parts, protectString('partV'), protectString('segment1b'), 1)
		expect(index).toBe(1.5)
	})

	it('non-existing segment', () => {
		const { segments, parts } = createMockSegmentsAndParts()

		const index = computeCurrentPartIndex(segments, parts, protectString('partU'), protectString('segmentX'), 1)
		expect(index).toBeNull()
	})

	it('no parts at all', () => {
		const segments: DBSegment[] = []
		const parts: DBPart[] = []

		const index = computeCurrentPartIndex(segments, parts, protectString('partT'), protectString('segment1'), 1)
		expect(index).toBeNull()
	})

	it('before first part', () => {
		const { segments, parts } = createMockSegmentsAndParts()

		const index = computeCurrentPartIndex(segments, parts, protectString('partS'), protectString('segment1'), 0)
		expect(index).toBe(-0.5)
	})
})
