import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import type { PartId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	getPartTimingStateDocId,
	getPlaylistTimingStateDocId,
	getSegmentTimingStateDocId,
	type PartTimingStateDoc,
	type PlaylistTimingStateDoc,
	type SegmentTimingStateDoc,
	type TimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { CountdownType, PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { splitTimingStates } from '../playlistTimingStatesHandler.js'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const SEGMENT_ID = protectString<SegmentId>('segment0')
const PART_ID = protectString<PartId>('part0')

function playlistDoc(): PlaylistTimingStateDoc {
	return {
		_id: getPlaylistTimingStateDocId(PLAYLIST_ID),
		type: 'playlist',
		playlistId: PLAYLIST_ID,
		timingType: PlaylistTimingType.ForwardTime,
		currentPartWillAutoNext: false,
		partCountdownBase: { paused: true, duration: 0 },
	}
}

function segmentDoc(segmentId: SegmentId): SegmentTimingStateDoc {
	return {
		_id: getSegmentTimingStateDocId(segmentId),
		type: 'segment',
		playlistId: PLAYLIST_ID,
		segmentId,
		countdownType: CountdownType.PART_EXPECTED_DURATION,
	}
}

function partDoc(partId: PartId, rank: number): PartTimingStateDoc {
	return {
		_id: getPartTimingStateDocId(partId),
		type: 'part',
		playlistId: PLAYLIST_ID,
		segmentId: SEGMENT_ID,
		partId,
		rank,
		isInQuickLoop: false,
		countsTowardsTiming: true,
		untimed: false,
		orphaned: false,
	}
}

describe('splitTimingStates', () => {
	it('is empty when nothing is published', () => {
		const states = splitTimingStates([])

		expect(states.playlist).toBeUndefined()
		expect(states.segments.size).toBe(0)
		expect(states.parts.size).toBe(0)
	})

	it('splits the published union by what each document describes', () => {
		const otherSegment = protectString<SegmentId>('segment1')
		const otherPart = protectString<PartId>('part1')

		const states = splitTimingStates([
			segmentDoc(SEGMENT_ID),
			partDoc(PART_ID, 0),
			playlistDoc(),
			partDoc(otherPart, 1),
			segmentDoc(otherSegment),
		])

		expect(states.playlist).toEqual(playlistDoc())
		expect(Array.from(states.segments.keys())).toEqual([SEGMENT_ID, otherSegment])
		expect(Array.from(states.parts.keys())).toEqual([PART_ID, otherPart])
		// keyed by what a topic looks them up by, not by document id
		expect(states.segments.get(SEGMENT_ID)?.segmentId).toBe(SEGMENT_ID)
		expect(states.parts.get(otherPart)?.rank).toBe(1)
	})

	it('ignores a document type it does not recognise', () => {
		// the publication is an open union - a future shape must not land in the wrong bucket
		const unknown = { ...playlistDoc(), type: 'somethingElse' } as unknown as TimingStateDoc

		const states = splitTimingStates([unknown, segmentDoc(SEGMENT_ID)])

		expect(states.playlist).toBeUndefined()
		expect(states.segments.size).toBe(1)
		expect(states.parts.size).toBe(0)
	})
})
