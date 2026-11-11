import { calculateSegmentTiming } from '../segmentTiming.js'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	PartId,
	PartInstanceId,
	RundownId,
	RundownPlaylistActivationId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'

function makeTestPart(id: string, expectedDuration: number): Partial<DBPart> {
	return {
		_id: protectString<PartId>(`part_${id}`),
		segmentId: protectString<SegmentId>('segment_1'),
		rundownId: protectString<RundownId>('rundown_1'),
		untimed: false,
		expectedDurationWithTransition: expectedDuration,
	}
}

function makeTestPartInstance(id: string, partId: string, expectedDuration: number): Partial<DBPartInstance> {
	return {
		_id: protectString<PartInstanceId>(`partInstance_${id}`),
		part: makeTestPart(partId, expectedDuration) as DBPart,
		rundownId: protectString<RundownId>('rundown_1'),
		segmentId: protectString<SegmentId>('segment_1'),
		playlistActivationId: protectString<RundownPlaylistActivationId>('activation_1'),
	}
}

describe('segmentTiming - calculateSegmentTiming', () => {
	it('should use partInstance duration when available instead of original part duration', () => {
		const parts = [makeTestPart('1', 5000), makeTestPart('2', 3000)]

		// Create partInstances with modified durations
		const partInstances = [makeTestPartInstance('1', '1', 6000), makeTestPartInstance('2', '2', 4000)]

		const result = calculateSegmentTiming(undefined, partInstances as DBPartInstance[], parts as DBPart[])

		// Should use the modified durations from partInstances (6000 + 4000), not the original (5000 + 3000)
		expect(result.expectedDurationMs).toBe(10000)
	})

	it('should fall back to original part duration when no matching partInstance', () => {
		const parts = [makeTestPart('1', 5000), makeTestPart('2', 3000), makeTestPart('3', 2000)]

		// Only provide instances for parts 1 and 2, part 3 has no instance
		const partInstances = [
			makeTestPartInstance('1', '1', 6000), // modified from 5000
			makeTestPartInstance('2', '2', 3000), // unchanged
		]

		const result = calculateSegmentTiming(undefined, partInstances as DBPartInstance[], parts as DBPart[])

		// Should use: 6000 (instance) + 3000 (instance) + 2000 (original, no instance)
		expect(result.expectedDurationMs).toBe(11000)
	})
})
