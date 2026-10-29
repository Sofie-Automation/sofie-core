import type React from 'react'
import { render } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type {
	PartId,
	PartInstanceId,
	RundownPlaylistId,
	SegmentId,
	SegmentPlayoutId,
	ShowStyleBaseId,
	StudioId,
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
import type { PartUi } from '../../SegmentTimeline/SegmentTimelineContainer.js'

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
/** The screen's data, as its tracker would have it */
let screenData: Record<string, unknown>

/** Find a document by id or by a selector, as the collections do */
function findIn<TDoc extends { _id: unknown }>(docs: TDoc[], selector: unknown): TDoc | undefined {
	if (typeof selector === 'string') return docs.find((doc) => doc._id === selector)
	return docs.find((doc) => mongoWhere(doc, selector as MongoQuery<TDoc>))
}

jest.mock('../../Collections.js', () => ({
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
jest.mock('../../../collections/index.js', () => ({
	...jest.requireActual('../../../collections/index.js'),
	RundownPlaylists: {
		findOne: (selector: unknown) => findIn(pagePlaylist ? [pagePlaylist] : [], selector),
	},
	Segments: {
		findOne: (selector: unknown) => findIn(pageSegments, selector),
	},
}))
// The reactive layer is not what is under test here: run the tracked functions directly, subscribe to
// nothing, and hand the screen its data
jest.mock('../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
	useSubscription: () => true,
	useSubscriptions: () => true,
	withTracker: () => (Component: React.ComponentType<Record<string, unknown>>) => (props: Record<string, unknown>) =>
		jest.requireActual('react').createElement(Component, { ...props, ...screenData }),
}))
jest.mock('../../../lib/systemTime.js', () => ({
	getCurrentTime: () => NOW,
}))
jest.mock('../../util/useRundownAndShowStyleIdsForPlaylist.js', () => ({
	useRundownAndShowStyleIdsForPlaylist: () => ({ rundownIds: [], showStyleBaseIds: [], showStyleVariantIds: [] }),
}))
jest.mock('../../../lib/rundownPlaylistUtil.js', () => ({
	RundownPlaylistClientUtil: {
		getSelectedPartInstances: () => ({
			currentPartInstance: undefined,
			nextPartInstance: undefined,
			previousPartInstance: undefined,
		}),
	},
}))
jest.mock('../../RundownPlaylistContext.js', () => ({
	useRundownPlaylistId: () => PLAYLIST_ID,
}))
jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (str: string) => str }),
}))

// Only the on-air countdowns are under test: the rest of the screen is mocked away
jest.mock('../DirectorScreen/DirectorScreenTop.js', () => ({ DirectorScreenTop: () => null }))
jest.mock('../ClockViewPieceIcons/ClockViewPieceIcon.js', () => ({ PieceIconContainer: () => null }))
jest.mock('../ClockViewPieceIcons/ClockViewPieceName.js', () => ({ PieceNameContainer: () => null }))
jest.mock('../ClockViewPieceIcons/ClockViewFreezeCount.js', () => ({ PieceFreezeContainer: () => null }))
jest.mock('../../util/AdjustLabelFit.js', () => ({ AdjustLabelFit: () => null }))
jest.mock('../../RundownView/RundownTiming/AutoNextStatus.js', () => ({ AutoNextStatus: () => null }))
jest.mock('../../RundownView/RundownHeader/Countdown.js', () => ({ Countdown: () => null }))
jest.mock('../RundownStatusBar.js', () => ({ RundownStatusBar: () => null }))

import { DirectorScreen } from '../DirectorScreen/DirectorScreen.js'

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
			title: 'Taken part',
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
	screenData = {
		playlist: pagePlaylist,
		segments: [],
		currentSegment: { _id: takenPartSegmentId, name: 'Taken segment', _rank: 1 },
		currentPartInstance: { instance: takenPartInstance } as PartUi,
		currentShowStyleBaseId: protectString<ShowStyleBaseId>('showStyleBase0'),
		rundownIds: [],
	}
}

/** Render the Director screen and return its two on-air countdowns */
function renderDirector(): { segmentCountdown: HTMLElement; partCountdown: HTMLElement } {
	const { container } = render(
		<DirectorScreen studioId={protectString<StudioId>('studio0')} playlistId={PLAYLIST_ID} />
	)

	const segmentCountdown = container.querySelector<HTMLElement>('.director-screen__body__segment__countdown')
	const partCountdown = container.querySelector<HTMLElement>(
		'.director-screen__body__part__piece-countdown [role="timer"]'
	)
	if (!segmentCountdown) throw new Error('The segment countdown was not rendered')
	if (!partCountdown) throw new Error('The part countdown was not rendered')
	return { segmentCountdown, partCountdown }
}

describe('Director screen on-air countdowns', () => {
	beforeEach(() => {
		publishedPlaylistTiming = undefined
		publishedPartTimings = []
		pagePlaylist = undefined
		pagePartInstances = []
		pageSegments = []
		screenData = {}
	})

	it("show the on-air part's remaining time", () => {
		setUpRightAfterTake(NEXT_SEGMENT)
		// the server's timing for the taken part has arrived
		publishedPlaylistTiming = makeDoc({
			currentPartInstanceId: TAKEN_PART,
			currentSegmentId: NEXT_SEGMENT,
			remainingOnCurrentPart: { paused: false, zeroTime: NOW + 8_000 },
		})

		const { segmentCountdown, partCountdown } = renderDirector()

		expect(partCountdown.textContent).toBe('00:08')
		// the segment countdown shows a budget only, and this segment has none
		expect(segmentCountdown.textContent).toBe('')
	})

	it("show the taken part's planned length right after a take, not the previous part's countdown or the previous segment's budget", () => {
		setUpRightAfterTake(NEXT_SEGMENT)
		pageSegments = [{ _id: NEXT_SEGMENT, segmentTiming: undefined }]

		const { segmentCountdown, partCountdown } = renderDirector()

		expect(partCountdown.textContent).toBe('00:10')
		expect(segmentCountdown.textContent).toBe('')
	})

	it("show the next segment's budget right after a take into a segment that counts one", () => {
		setUpRightAfterTake(NEXT_SEGMENT)
		pageSegments = [
			{
				_id: NEXT_SEGMENT,
				segmentTiming: { budgetDuration: 60_000, countdownType: CountdownType.SEGMENT_BUDGET_DURATION },
			},
		]

		const { segmentCountdown, partCountdown } = renderDirector()

		expect(partCountdown.textContent).toBe('00:10')
		expect(segmentCountdown.textContent).toBe('01:00')
	})
})
