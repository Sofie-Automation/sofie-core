import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import { QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { RundownPlaylistActivationId, PartInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import type { PartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { unprotectString, protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { ForceQuickLoopAutoNext } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'
import { wrapPartToTemporaryInstance } from '@sofie-automation/corelib/dist/playout/stateCacheResolver'
import { prepareTimingPartInstances } from '../prepareTimingInputs'

const RUNDOWN_ID = 'rundown0'

function makeMockPlaylist(): DBRundownPlaylist {
	return literal<DBRundownPlaylist>({
		_id: protectString('mock-playlist'),
		externalId: 'mock-playlist',
		studioId: protectString('studio0'),
		name: 'Mock Playlist',
		created: 0,
		modified: 0,
		defaultBrandingId: null,
		currentPartInfo: null,
		nextPartInfo: null,
		previousPartsInfo: [],
		timing: { type: PlaylistTimingType.None },
		rundownIdsInOrder: [protectString(RUNDOWN_ID)],
		tTimers: [
			{ index: 1, label: '', mode: null, state: null },
			{ index: 2, label: '', mode: null, state: null },
			{ index: 3, label: '', mode: null, state: null },
		],
	})
}

function makeMockPart(id: string, rank: number, segmentId: string): DBPart {
	return literal<DBPart>({
		_id: protectString(id),
		externalId: id,
		title: id,
		segmentId: protectString(segmentId),
		_rank: rank,
		rundownId: protectString(RUNDOWN_ID),
		expectedDuration: 1000,
		expectedDurationWithTransition: 1000,
	})
}

function makeMockSegment(id: string, rank: number): DBSegment {
	return literal<DBSegment>({
		_id: protectString(id),
		name: id,
		externalId: id,
		_rank: rank,
		rundownId: protectString(RUNDOWN_ID),
	})
}

/** A "real" (non-temporary) PartInstance for the given part, as playout would have created */
function makePlayedPartInstance(part: DBPart, id: string, takeCount: number): PartInstance {
	return {
		...wrapPartToTemporaryInstance(protectString<RundownPlaylistActivationId>('activation0'), part),
		_id: protectString<PartInstanceId>(id),
		isTemporary: false,
		takeCount,
	}
}

function partIdsOf(partInstances: Array<{ part: Pick<DBPart, '_id'> }>): string[] {
	return partInstances.map((instance) => unprotectString(instance.part._id))
}

describe('prepareTimingPartInstances', () => {
	// Two segments, two parts each, deliberately supplied out of order
	const segments = [makeMockSegment('segment0', 0), makeMockSegment('segment1', 1)]
	function makeParts(): DBPart[] {
		return [
			makeMockPart('part2', 0, 'segment1'),
			makeMockPart('part0', 0, 'segment0'),
			makeMockPart('part3', 1, 'segment1'),
			makeMockPart('part1', 1, 'segment0'),
		]
	}

	it('wraps every Part as a temporary instance when there are none yet', () => {
		const playlist = makeMockPlaylist()

		const { partInstances, partsInQuickLoop } = prepareTimingPartInstances(playlist, segments, makeParts(), [])

		expect(partIdsOf(partInstances)).toEqual(['part0', 'part1', 'part2', 'part3'])
		expect(partInstances.every((instance) => instance.isTemporary)).toBe(true)
		expect(partsInQuickLoop).toEqual({})
	})

	it('sorts into segment order, then rank within a segment', () => {
		const playlist = makeMockPlaylist()
		// Segments supplied in playout order, but reversed relative to their names
		const reversedSegments = [makeMockSegment('segment1', 0), makeMockSegment('segment0', 1)]

		const { partInstances } = prepareTimingPartInstances(playlist, reversedSegments, makeParts(), [])

		expect(partIdsOf(partInstances)).toEqual(['part2', 'part3', 'part0', 'part1'])
	})

	it('prefers an existing PartInstance over wrapping its Part', () => {
		const playlist = makeMockPlaylist()
		const parts = makeParts()
		const played = makePlayedPartInstance(parts[1], 'instance0', 1) // part0

		const { partInstances } = prepareTimingPartInstances(playlist, segments, parts, [played])

		expect(partIdsOf(partInstances)).toEqual(['part0', 'part1', 'part2', 'part3'])
		// the played instance is used as-is, and is not duplicated by a temporary wrapper
		const part0Instances = partInstances.filter((instance) => instance.part._id === parts[1]._id)
		expect(part0Instances).toHaveLength(1)
		expect(part0Instances[0]._id).toBe(played._id)
		expect(part0Instances[0].isTemporary).toBe(false)
	})

	it('keeps PartInstances whose Part no longer exists (e.g. deleted mid-playout)', () => {
		const playlist = makeMockPlaylist()
		const parts = makeParts()
		const orphanedPart = makeMockPart('partGone', 2, 'segment0')
		const orphaned = makePlayedPartInstance(orphanedPart, 'instanceGone', 1)

		const { partInstances } = prepareTimingPartInstances(playlist, segments, parts, [orphaned])

		expect(partIdsOf(partInstances)).toEqual(['part0', 'part1', 'partGone', 'part2', 'part3'])
	})

	describe('QuickLoop', () => {
		function playlistWithLoop(running: boolean): DBRundownPlaylist {
			const playlist = makeMockPlaylist()
			playlist.quickLoop = {
				start: { type: QuickLoopMarkerType.PART, id: protectString('part1') },
				end: { type: QuickLoopMarkerType.PART, id: protectString('part2') },
				running,
				forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
				locked: false,
			}
			return playlist
		}

		it('marks the parts within the loop', () => {
			const { partInstances, partsInQuickLoop } = prepareTimingPartInstances(
				playlistWithLoop(false),
				segments,
				makeParts(),
				[]
			)

			const inLoop = partInstances
				.filter((instance) => partsInQuickLoop[unprotectString(instance.part._id)])
				.map((instance) => unprotectString(instance.part._id))
			expect(inLoop).toEqual(['part1', 'part2'])
		})

		it('marks nothing when no loop is defined', () => {
			const { partsInQuickLoop } = prepareTimingPartInstances(makeMockPlaylist(), segments, makeParts(), [])

			expect(partsInQuickLoop).toEqual({})
		})

		it('deduplicates repeated instances of the current Part while the loop is running', () => {
			const playlist = playlistWithLoop(true)
			const parts = makeParts()
			const part1 = parts[3]

			// part1 has been played twice around the loop; the second time is current
			const firstTimeAround = makePlayedPartInstance(part1, 'instance-part1-a', 1)
			const secondTimeAround = makePlayedPartInstance(part1, 'instance-part1-b', 5)
			playlist.currentPartInfo = {
				partInstanceId: secondTimeAround._id,
				rundownId: protectString(RUNDOWN_ID),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}

			const { partInstances } = prepareTimingPartInstances(playlist, segments, parts, [
				firstTimeAround,
				secondTimeAround,
			])

			// only the current instance of part1 survives, so it is not counted twice
			const part1Instances = partInstances.filter((instance) => instance.part._id === part1._id)
			expect(part1Instances).toHaveLength(1)
			expect(part1Instances[0]._id).toBe(secondTimeAround._id)
		})

		it('keeps repeated instances when the loop is not running', () => {
			const playlist = playlistWithLoop(false)
			const parts = makeParts()
			const part1 = parts[3]

			const firstTimeAround = makePlayedPartInstance(part1, 'instance-part1-a', 1)
			const secondTimeAround = makePlayedPartInstance(part1, 'instance-part1-b', 5)
			playlist.currentPartInfo = {
				partInstanceId: secondTimeAround._id,
				rundownId: protectString(RUNDOWN_ID),
				manuallySelected: false,
				consumesQueuedSegmentId: false,
			}

			const { partInstances } = prepareTimingPartInstances(playlist, segments, parts, [
				firstTimeAround,
				secondTimeAround,
			])

			expect(partInstances.filter((instance) => instance.part._id === part1._id)).toHaveLength(2)
		})
	})

	it('does not reorder the arrays it is given', () => {
		const playlist = makeMockPlaylist()
		const parts = makeParts()
		// supplied in an order that sorting will change, so an in-place sort would be visible here
		const activePartInstances = [
			makePlayedPartInstance(parts[0], 'instance-part2', 3), // part2, segment1
			makePlayedPartInstance(parts[1], 'instance-part0', 1), // part0, segment0
		]

		const { partInstances } = prepareTimingPartInstances(playlist, segments, parts, activePartInstances)

		// the result is sorted...
		expect(partIdsOf(partInstances)).toEqual(['part0', 'part1', 'part2', 'part3'])
		// ...without disturbing the caller's arrays
		expect(partIdsOf(activePartInstances)).toEqual(['part2', 'part0'])
		expect(parts.map((part) => unprotectString(part._id))).toEqual(['part2', 'part0', 'part3', 'part1'])
	})
})
