import { render } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type {
	PartId,
	PartInstanceId,
	RundownPlaylistId,
	SegmentId,
	SegmentPlayoutId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import {
	getPartTimingStateDocId,
	getPlaylistTimingStateDocId,
	type PartTimingStateDoc,
	type PlaylistTimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { mongoWhere, type MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { CountdownType, PlaylistTimingType } from '@sofie-automation/blueprints-integration'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const NOW = 100000
const PREVIOUS_PART = protectString<PartInstanceId>('previousPartInstance')
const TAKEN_PART = protectString<PartInstanceId>('takenPartInstance')
const PREVIOUS_SEGMENT = protectString<SegmentId>('previousSegment')
const NEXT_SEGMENT = protectString<SegmentId>('nextSegment')
const LAST_SEGMENT = protectString<SegmentId>('lastSegment')

/** The published playlist document and part documents */
let publishedPlaylistTiming: PlaylistTimingStateDoc | undefined
let publishedPartTimings: PartTimingStateDoc[]
/** What the page has of the playlist, its part instances and its segments */
let pagePlaylist: Pick<DBRundownPlaylist, '_id' | 'currentPartInfo'> | undefined
let pagePartInstances: DBPartInstance[]
let pageSegments: Array<Pick<DBSegment, '_id' | 'segmentTiming'>>

/** Find a document by id or by a selector, as the collections do */
function findIn<TDoc extends { _id: unknown }>(docs: TDoc[], selector: unknown): TDoc | undefined {
	if (typeof selector === 'string') return docs.find((doc) => doc._id === selector)
	return docs.find((doc) => mongoWhere(doc, selector as MongoQuery<TDoc>))
}

jest.mock('../../../Collections.js', () => ({
	PlaylistTimingStates: {
		findOne: (selector: unknown) =>
			findIn<PlaylistTimingStateDoc | PartTimingStateDoc>(
				[...(publishedPlaylistTiming ? [publishedPlaylistTiming] : []), ...publishedPartTimings],
				selector
			),
	},
	UIPartInstances: {
		findOne: (selector: unknown) => findIn(pagePartInstances, selector),
	},
}))
jest.mock('../../../../collections/index.js', () => ({
	RundownPlaylists: {
		findOne: (selector: unknown) => findIn(pagePlaylist ? [pagePlaylist] : [], selector),
	},
	Segments: {
		findOne: (selector: unknown) => findIn(pageSegments, selector),
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../../lib/systemTime.js', () => ({
	getCurrentTime: () => NOW,
}))
jest.mock('../../../RundownPlaylistContext.js', () => ({
	useRundownPlaylistId: () => PLAYLIST_ID,
}))
// The countdown's own styling is not under test, only the value it is given
jest.mock('../Countdown.js', () => ({
	Countdown: ({ children }: { children?: unknown }) => children,
}))

import { RundownHeaderPartRemaining, RundownHeaderSegmentBudget } from '../CurrentPartOrSegmentRemaining.js'

function makeDoc(fields: Partial<PlaylistTimingStateDoc>): PlaylistTimingStateDoc {
	return {
		_id: getPlaylistTimingStateDocId(PLAYLIST_ID),
		type: 'playlist',
		playlistId: PLAYLIST_ID,
		timingType: PlaylistTimingType.ForwardTime,
		currentPartWillAutoNext: false,
		partCountdownBase: { paused: true, duration: 0 },
		...fields,
	}
}

function makePartTiming(partId: PartId, segmentId: SegmentId, rank: number): PartTimingStateDoc {
	return {
		_id: getPartTimingStateDocId(partId),
		type: 'part',
		playlistId: PLAYLIST_ID,
		segmentId,
		partId,
		rank,
		isInQuickLoop: false,
		countsTowardsTiming: true,
		untimed: false,
		orphaned: false,
	}
}

function makePartInstance(
	partInstanceId: PartInstanceId,
	segmentId: SegmentId,
	takeCount: number,
	expectedDuration: number
): DBPartInstance {
	return {
		_id: partInstanceId,
		segmentId,
		segmentPlayoutId: protectString<SegmentPlayoutId>(`playOf_${segmentId}`),
		takeCount,
		part: {
			_id: protectString<PartId>(`partOf_${partInstanceId}`),
			segmentId,
			expectedDuration,
			// with no transition
			expectedDurationWithTransition: expectedDuration,
		},
	} as DBPartInstance
}

/**
 * The page right after a take of a 10s part in `takenPartSegmentId`, and the published values, which
 * still describe the previous part, in the previous segment: 2s left of it, and 30s of its segment's budget
 */
function setUpRightAfterTake(takenPartSegmentId: SegmentId): void {
	const previousPartInstance = makePartInstance(PREVIOUS_PART, PREVIOUS_SEGMENT, 1, 20_000)
	const takenPartInstance = makePartInstance(TAKEN_PART, takenPartSegmentId, 2, 10_000)
	pagePartInstances = [previousPartInstance, takenPartInstance]
	pagePlaylist = {
		_id: PLAYLIST_ID,
		currentPartInfo: { partInstanceId: TAKEN_PART } as DBRundownPlaylist['currentPartInfo'],
	}
	publishedPlaylistTiming = makeDoc({
		currentPartInstanceId: PREVIOUS_PART,
		currentSegmentId: PREVIOUS_SEGMENT,
		remainingOnCurrentPart: { paused: false, zeroTime: NOW + 2_000 },
		remainingBudgetOnCurrentSegment: { paused: false, zeroTime: NOW + 30_000 },
	})
	publishedPartTimings = [
		makePartTiming(previousPartInstance.part._id, PREVIOUS_SEGMENT, 0),
		makePartTiming(takenPartInstance.part._id, takenPartSegmentId, 1),
		makePartTiming(protectString<PartId>('partOfTheLastSegment'), LAST_SEGMENT, 2),
	]
}

describe('Rundown header On Air and Seg. Budg.', () => {
	beforeEach(() => {
		publishedPlaylistTiming = undefined
		publishedPartTimings = []
		pagePlaylist = undefined
		pagePartInstances = []
		pageSegments = []
	})

	it("show the on-air part's remaining time and its segment's budget", () => {
		publishedPlaylistTiming = makeDoc({
			currentPartInstanceId: TAKEN_PART,
			currentSegmentId: PREVIOUS_SEGMENT,
			remainingOnCurrentPart: { paused: false, zeroTime: NOW + 8_000 },
			remainingBudgetOnCurrentSegment: { paused: false, zeroTime: NOW + 50_000 },
		})

		const onAir = render(<RundownHeaderPartRemaining currentPartInstanceId={TAKEN_PART} />)
		const segmentBudget = render(<RundownHeaderSegmentBudget currentPartInstanceId={TAKEN_PART} />)

		expect(onAir.container.textContent).toBe('00:08')
		expect(segmentBudget.container.textContent).toBe('00:50')
	})

	it("On Air shows the taken part's planned length right after a take, not the previous part's countdown", () => {
		setUpRightAfterTake(NEXT_SEGMENT)

		const onAir = render(<RundownHeaderPartRemaining currentPartInstanceId={TAKEN_PART} />)

		expect(onAir.container.textContent).toBe('00:10')
	})

	it("Seg. Budg. shows the next segment's budget right after a take into a segment that counts one", () => {
		setUpRightAfterTake(NEXT_SEGMENT)
		pageSegments = [
			{
				_id: NEXT_SEGMENT,
				segmentTiming: { budgetDuration: 60_000, countdownType: CountdownType.SEGMENT_BUDGET_DURATION },
			},
		]

		const segmentBudget = render(<RundownHeaderSegmentBudget currentPartInstanceId={TAKEN_PART} />)

		expect(segmentBudget.container.textContent).toBe('01:00')
	})

	it("Seg. Budg. is not shown right after a take into a segment with no budget, rather than the previous segment's budget", () => {
		setUpRightAfterTake(NEXT_SEGMENT)
		pageSegments = [{ _id: NEXT_SEGMENT, segmentTiming: undefined }]

		const segmentBudget = render(<RundownHeaderSegmentBudget currentPartInstanceId={TAKEN_PART} />)

		expect(segmentBudget.container.textContent).toBe('')
	})

	it('Seg. Budg. keeps the published budget right after a take within the segment', () => {
		setUpRightAfterTake(PREVIOUS_SEGMENT)

		const segmentBudget = render(<RundownHeaderSegmentBudget currentPartInstanceId={TAKEN_PART} />)

		expect(segmentBudget.container.textContent).toBe('00:30')
	})
})
