import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { PlayoutSegmentModelImpl } from '../model/implementation/PlayoutSegmentModelImpl.js'
import { PlayoutSegmentModel } from '../model/PlayoutSegmentModel.js'
import { selectNextPart } from '../selectNextPart.js'
import { QuickLoopMarkerType } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ForceQuickLoopAutoNext } from '@sofie-automation/shared-lib/dist/core/model/StudioSettings'

class MockPart {
	constructor(
		public _id: string,
		public _rank: number,
		public segmentId: SegmentId,
		public playable: boolean = true,
		public expectedDuration: number | undefined = undefined
	) {}

	get invalid(): boolean {
		return !this.playable
	}

	toPartInstance() {
		return {
			part: this,
			segmentId: this.segmentId,
		} as unknown as DBPartInstance
	}
}
class MockSegment {
	constructor(
		public _id: SegmentId,
		public _rank: number
	) {}
}

describe('selectNextPart', () => {
	let context: MockJobContext
	let defaultPlaylist: Parameters<typeof selectNextPart>[1]

	const segment1: SegmentId = protectString('segment1')
	const segment2: SegmentId = protectString('segment2')
	const segment3: SegmentId = protectString('segment3')

	let defaultParts: MockPart[]
	let defaultSegments: MockSegment[]

	beforeEach(() => {
		context = setupDefaultJobEnvironment()

		defaultPlaylist = {
			queuedSegmentId: undefined,
			quickLoop: undefined,
		}

		defaultParts = [
			new MockPart('part1', 1, segment1),
			new MockPart('part2', 2, segment1),
			new MockPart('part3', 3, segment1),
			new MockPart('part4', 4, segment2, false),
			new MockPart('part5', 5, segment2),
			new MockPart('part6', 6, segment2),
			new MockPart('part7', 7, segment3),
			new MockPart('part8', 8, segment3, false),
			new MockPart('part9', 9, segment3),
		]
		defaultSegments = [new MockSegment(segment1, 1), new MockSegment(segment2, 2), new MockSegment(segment3, 3)]
	})

	function selectNextPart2(
		previousPartInstance: ReadonlyDeep<DBPartInstance> | null,
		currentlySelectedPartInstance: ReadonlyDeep<DBPartInstance> | null,
		ignoreUnplayable = true,
		ignoreQuickLoop = false
	) {
		const parts = [...(defaultParts as unknown as DBPart[])]
		const segments: readonly PlayoutSegmentModel[] = defaultSegments.map(
			(segment) =>
				new PlayoutSegmentModelImpl(
					segment as unknown as DBSegment,
					parts.filter((p) => p.segmentId === segment._id)
				)
		)

		return selectNextPart(
			context,
			defaultPlaylist,
			previousPartInstance,
			currentlySelectedPartInstance,
			segments,
			parts,
			{ ignoreUnplayable, ignoreQuickLoop }
		)
	}

	test('from nothing', () => {
		{
			// default
			const nextPart = selectNextPart2(null, null)
			expect(nextPart).toEqual({ index: 0, part: defaultParts[0], consumesQueuedSegmentId: false })
		}

		{
			// first isnt playable
			defaultParts[0].playable = false
			const nextPart = selectNextPart2(null, null)
			expect(nextPart).toEqual({ index: 1, part: defaultParts[1], consumesQueuedSegmentId: false })
		}

		{
			// nextSegmentId is set
			defaultPlaylist.queuedSegmentId = segment3
			const nextPart = selectNextPart2(null, null)
			expect(nextPart).toEqual({ index: 6, part: defaultParts[6], consumesQueuedSegmentId: true })
		}

		{
			// nextSegmentId is set (and first there isnt playable)
			defaultPlaylist.queuedSegmentId = segment2
			const nextPart = selectNextPart2(null, null)
			expect(nextPart).toEqual({ index: 4, part: defaultParts[4], consumesQueuedSegmentId: true })
		}
	})

	test('from nothing - allow unplayable', () => {
		{
			// default
			const nextPart = selectNextPart2(null, null, false)
			expect(nextPart).toEqual({ index: 0, part: defaultParts[0], consumesQueuedSegmentId: false })
		}

		{
			// first isnt playable
			defaultParts[0].playable = false
			const nextPart = selectNextPart2(null, null, false)
			expect(nextPart).toEqual({ index: 0, part: defaultParts[0], consumesQueuedSegmentId: false })
		}

		{
			// nextSegmentId is set
			defaultPlaylist.queuedSegmentId = segment3
			const nextPart = selectNextPart2(null, null, false)
			expect(nextPart).toEqual({ index: 6, part: defaultParts[6], consumesQueuedSegmentId: true })
		}

		{
			// nextSegmentId is set (and first there isnt playable)
			defaultPlaylist.queuedSegmentId = segment2
			const nextPart = selectNextPart2(null, null, false)
			expect(nextPart).toEqual({ index: 3, part: defaultParts[3], consumesQueuedSegmentId: true })
		}
	})

	test('from partInstance', () => {
		const previousPartInstance = defaultParts[4].toPartInstance()
		{
			// default
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 5, part: defaultParts[5], consumesQueuedSegmentId: false })
		}

		{
			// next isnt playable
			defaultParts[5].playable = false
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 6, part: defaultParts[6], consumesQueuedSegmentId: false })
		}

		{
			// queuedSegmentId is set
			defaultParts[0].playable = false
			defaultPlaylist.queuedSegmentId = segment1
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 1, part: defaultParts[1], consumesQueuedSegmentId: true })
		}

		{
			// nextSegmentId is set (and first there isnt playable)
			defaultPlaylist.queuedSegmentId = segment2
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 4, part: defaultParts[4], consumesQueuedSegmentId: true })
		}
	})

	test('from partInstance - orphaned', () => {
		const previousPartInstance = defaultParts[4].toPartInstance()
		defaultParts.splice(4, 1)
		previousPartInstance.orphaned = 'deleted'

		{
			// single part is orphaned
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 4, part: defaultParts[4], consumesQueuedSegmentId: false })
		}

		{
			// whole segment is orphaned/deleted
			defaultParts = defaultParts.filter((p) => p.segmentId !== previousPartInstance.segmentId)
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 3, part: defaultParts[3], consumesQueuedSegmentId: false })
		}

		{
			// no parts after
			defaultParts = defaultParts.filter((p) => p.segmentId !== segment3)
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual(null)
		}

		{
			// no parts after, but looping
			defaultPlaylist.quickLoop = {
				start: { type: QuickLoopMarkerType.PLAYLIST },
				end: { type: QuickLoopMarkerType.PLAYLIST },
				running: true,
				forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
				locked: false,
			}
			defaultParts = defaultParts.filter((p) => p.segmentId !== segment3)
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 0, part: defaultParts[0], consumesQueuedSegmentId: false })
		}
	})

	test('from partInstance - allow unplayable', () => {
		const previousPartInstance = defaultParts[4].toPartInstance()
		{
			// default
			const nextPart = selectNextPart2(previousPartInstance, null, false)
			expect(nextPart).toEqual({ index: 5, part: defaultParts[5], consumesQueuedSegmentId: false })
		}

		{
			// next isnt playable
			defaultParts[5].playable = false
			const nextPart = selectNextPart2(previousPartInstance, null, false)
			expect(nextPart).toEqual({ index: 5, part: defaultParts[5], consumesQueuedSegmentId: false })
		}
	})

	test('from End part in QuickLoop', () => {
		const previousPartInstance = defaultParts[5].toPartInstance()
		{
			// Start in previous segment
			defaultPlaylist.quickLoop = {
				forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
				locked: false,
				running: true,
				start: {
					type: QuickLoopMarkerType.PART,
					id: protectString(defaultParts[2]._id),
				},
				end: {
					type: QuickLoopMarkerType.PART,
					id: protectString(defaultParts[5]._id),
				},
			}
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 2, part: defaultParts[2], consumesQueuedSegmentId: false })
		}

		{
			// Start in the same segment
			defaultPlaylist.quickLoop = {
				forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
				locked: false,
				running: true,
				start: {
					type: QuickLoopMarkerType.PART,
					id: protectString(defaultParts[4]._id),
				},
				end: {
					type: QuickLoopMarkerType.PART,
					id: protectString(defaultParts[5]._id),
				},
			}
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 4, part: defaultParts[4], consumesQueuedSegmentId: false })
		}

		{
			// Start is End
			defaultPlaylist.quickLoop = {
				forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
				locked: false,
				running: true,
				start: {
					type: QuickLoopMarkerType.PART,
					id: protectString(defaultParts[5]._id),
				},
				end: {
					type: QuickLoopMarkerType.PART,
					id: protectString(defaultParts[5]._id),
				},
			}
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 5, part: defaultParts[5], consumesQueuedSegmentId: false })
		}

		{
			// Start is the Playlist
			defaultPlaylist.quickLoop = {
				forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
				locked: false,
				running: true,
				start: {
					type: QuickLoopMarkerType.PLAYLIST,
				},
				end: {
					type: QuickLoopMarkerType.PART,
					id: protectString(defaultParts[5]._id),
				},
			}
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 0, part: defaultParts[0], consumesQueuedSegmentId: false })
		}
	})

	test('from last part when End Marker is PLAYLIST', () => {
		const previousPartInstance = defaultParts[defaultParts.length - 1].toPartInstance()

		{
			// Start is a Part
			defaultPlaylist.quickLoop = {
				forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
				locked: false,
				running: true,
				start: {
					type: QuickLoopMarkerType.PART,
					id: protectString(defaultParts[2]._id),
				},
				end: {
					type: QuickLoopMarkerType.PLAYLIST,
				},
			}
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 2, part: defaultParts[2], consumesQueuedSegmentId: false })
		}

		{
			// Start is Playlist
			defaultPlaylist.quickLoop = {
				forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
				locked: false,
				running: true,
				start: {
					type: QuickLoopMarkerType.PLAYLIST,
				},
				end: {
					type: QuickLoopMarkerType.PLAYLIST,
				},
			}
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 0, part: defaultParts[0], consumesQueuedSegmentId: false })
		}
	})

	test('from within QuickLoop', () => {
		const previousPartInstance = defaultParts[4].toPartInstance()
		{
			// default
			defaultPlaylist.quickLoop = {
				forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
				locked: false,
				running: true,
				start: {
					type: QuickLoopMarkerType.PART,
					id: protectString(defaultParts[2]._id),
				},
				end: {
					type: QuickLoopMarkerType.PART,
					id: protectString(defaultParts[5]._id),
				},
			}
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 5, part: defaultParts[5], consumesQueuedSegmentId: false })
		}

		{
			// next is unplayable
			defaultPlaylist.quickLoop = {
				forceAutoNext: ForceQuickLoopAutoNext.DISABLED,
				locked: false,
				running: true,
				start: {
					type: QuickLoopMarkerType.PART,
					id: protectString(defaultParts[4]._id),
				},
				end: {
					type: QuickLoopMarkerType.PART,
					id: protectString(defaultParts[6]._id),
				},
			}
			defaultParts[5].playable = false
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 6, part: defaultParts[6], consumesQueuedSegmentId: false })
		}

		{
			// next does not have valid duration for ENABLED_WHEN_VALID_DURATION
			defaultPlaylist.quickLoop = {
				forceAutoNext: ForceQuickLoopAutoNext.ENABLED_WHEN_VALID_DURATION,
				locked: false,
				running: true,
				start: {
					type: QuickLoopMarkerType.PART,
					id: protectString(defaultParts[4]._id),
				},
				end: {
					type: QuickLoopMarkerType.PART,
					id: protectString(defaultParts[6]._id),
				},
			}
			defaultParts[5].expectedDuration = undefined
			defaultParts[6].expectedDuration = 1000
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 6, part: defaultParts[6], consumesQueuedSegmentId: false })
		}
	})

	test('on last part, with queued segment', () => {
		// On the last part in the rundown, with a queuedSegment id set to earlier
		defaultPlaylist.queuedSegmentId = segment2
		const nextPart = selectNextPart2(defaultParts[8].toPartInstance(), defaultParts[8].toPartInstance())
		expect(nextPart).toEqual({ index: 4, part: defaultParts[4], consumesQueuedSegmentId: true })
	})
})
