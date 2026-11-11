import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { PartId, PartInstanceId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getCurrentSegmentParts } from '../segmentParts.js'

function makePart(id: string, title: string): DBPart {
	return {
		_id: protectString<PartId>(id),
		_rank: 0,
		rundownId: protectString<RundownId>('rundown_1'),
		segmentId: protectString<SegmentId>('segment_1'),
		notes: [],
		externalId: id,
		expectedDuration: 1000,
		expectedDurationWithTransition: 1000,
		title,
	}
}

describe('segmentParts - getCurrentSegmentParts', () => {
	it('marks adlib-created parts', () => {
		const adlibPart = makePart('part_1', 'AdLib Part')
		const normalPart = makePart('part_2', 'Normal Part')

		const result = getCurrentSegmentParts(
			[
				{
					_id: protectString<PartInstanceId>('partInstance_1'),
					part: adlibPart,
					orphaned: 'adlib-part',
				} as DBPartInstance,
			],
			[adlibPart, normalPart]
		)

		expect(result).toEqual([
			{
				id: 'part_1',
				name: 'AdLib Part',
				autoNext: undefined,
				createdByAdLib: true,
				timing: { expectedDurationMs: 1000 },
			},
			{
				id: 'part_2',
				name: 'Normal Part',
				autoNext: undefined,
				createdByAdLib: false,
				timing: { expectedDurationMs: 1000 },
			},
		])
	})
})
