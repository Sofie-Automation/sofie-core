import type React from 'react'
import { render, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type {
	PartId,
	PartInstanceId,
	RundownLayoutId,
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
/** What the mocked system clock reads */
let currentTime = NOW
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
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../lib/systemTime.js', () => ({
	getCurrentTime: () => currentTime,
}))

// Only the big on-air countdown is under test: the rest of the screen is mocked away
jest.mock('../../PieceIcons/PieceIcon.js', () => ({ PieceIconContainer: () => null }))
jest.mock('../../PieceIcons/PieceName.js', () => ({ PieceNameContainer: () => null }))
jest.mock('../../PieceIcons/PieceCountdown.js', () => ({ PieceCountdownContainer: () => null }))
jest.mock('../../RundownView/RundownHeader/CurrentPartOrSegmentRemaining.js', () => ({
	CurrentPartOrSegmentRemaining: () => null,
}))
jest.mock('../../../lib/Components/OverUnderChip.js', () => ({ OverUnderChip: () => null }))
jest.mock('../RundownStatusBar.js', () => ({ RundownStatusBar: () => null }))
jest.mock('../../Shelf/ShelfDashboardLayout.js', () => ({ ShelfDashboardLayout: () => null }))

import { PresenterScreenContentDefaultLayout } from '../PresenterScreen.js'
import { RundownTiming } from '../../RundownView/RundownTiming/RundownTiming.js'

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

/** Render the Presenter screen with the given part instance on air */
function renderWithPartOnAir(partInstanceId: PartInstanceId): HTMLElement {
	const currentPartInstance = {
		instance: {
			_id: partInstanceId,
			part: { title: 'Taken part', autoNext: false },
		},
	} as PartUi
	const { container } = renderPresenter(currentPartInstance)

	const partCountdown = container.querySelector<HTMLElement>('.presenter-screen__part__part-countdown')
	if (!partCountdown) throw new Error('The on-air countdown was not rendered')
	return partCountdown
}

/** Render the Presenter screen with the given part instance on air, or with nothing on air */
function renderPresenter(currentPartInstance: PartUi | undefined): { container: HTMLElement } {
	const props: React.ComponentProps<typeof PresenterScreenContentDefaultLayout> = {
		studioId: protectString<StudioId>('studio0'),
		playlistId: PLAYLIST_ID,
		studio: undefined,
		playlist: { _id: PLAYLIST_ID } as DBRundownPlaylist,
		rundowns: [],
		segments: [],
		currentSegment: undefined,
		currentPartInstance,
		nextSegment: undefined,
		nextPartInstance: undefined,
		currentShowStyleBaseId: protectString<ShowStyleBaseId>('showStyleBase0'),
		currentShowStyleBase: undefined,
		currentShowStyleVariantId: undefined,
		currentShowStyleVariant: undefined,
		nextShowStyleBaseId: undefined,
		showStyleBaseIds: [],
		rundownIds: [],
		presenterLayoutId: protectString<RundownLayoutId>(''),
		margin: undefined,
		fontSize: undefined,
	}

	return render(<PresenterScreenContentDefaultLayout {...props} />)
}

/** Move the clock on, and send the high-resolution tick that RundownTimingProvider sends on each frame */
function advanceClockTo(time: number): void {
	currentTime = time
	act(() => {
		window.dispatchEvent(
			new CustomEvent(RundownTiming.Events.timeupdateHighResolution, { detail: { currentTime: time } })
		)
	})
}

describe('Presenter screen countdown to the planned start', () => {
	beforeEach(() => {
		currentTime = NOW
		publishedPartTimings = []
		pagePlaylist = { _id: PLAYLIST_ID } as DBRundownPlaylist
		pagePartInstances = []
		pageSegments = []
		// the planned start is 20.5 s away
		publishedPlaylistTiming = makeDoc({ plannedStart: { paused: false, zeroTime: NOW + 20_500 } })
	})

	it('counts down as the clock moves, while nothing is on air', () => {
		const { container } = renderPresenter(undefined)
		const countdown = () => container.querySelector('.presenter-screen__rundown-countdown')?.textContent
		expect(countdown()).toBe('00:21')

		// 19.9 s to go
		advanceClockTo(NOW + 600)
		expect(countdown()).toBe('00:20')
	})
})

describe('Presenter screen on-air countdown', () => {
	beforeEach(() => {
		currentTime = NOW
		publishedPlaylistTiming = undefined
		publishedPartTimings = []
		pagePlaylist = undefined
		pagePartInstances = []
		pageSegments = []
	})

	it("shows the on-air part's remaining time", () => {
		publishedPlaylistTiming = makeDoc({
			currentPartInstanceId: TAKEN_PART,
			remainingOnCurrentPart: { paused: false, zeroTime: NOW + 8_000 },
		})

		const partCountdown = renderWithPartOnAir(TAKEN_PART)

		expect(partCountdown.textContent).toBe('00:08')
	})

	it('shows the segment budget when the on-air segment counts one', () => {
		publishedPlaylistTiming = makeDoc({
			currentPartInstanceId: TAKEN_PART,
			remainingOnCurrentPart: { paused: false, zeroTime: NOW + 8_000 },
			remainingBudgetOnCurrentSegment: { paused: false, zeroTime: NOW + 50_000 },
		})

		const partCountdown = renderWithPartOnAir(TAKEN_PART)

		expect(partCountdown.textContent).toBe('00:50')
	})

	it("shows the taken part's planned length right after a take, not the previous part's countdown", () => {
		// The screen already shows the taken part, the published values still describe the previous one
		setUpRightAfterTake(PREVIOUS_SEGMENT)
		// a segment with no budget
		publishedPlaylistTiming = makeDoc({
			currentPartInstanceId: PREVIOUS_PART,
			currentSegmentId: PREVIOUS_SEGMENT,
			remainingOnCurrentPart: { paused: false, zeroTime: NOW + 2_000 },
		})

		const partCountdown = renderWithPartOnAir(TAKEN_PART)

		expect(partCountdown.textContent).toBe('00:10')
	})

	it("shows the taken part's planned length right after a take into a segment with no budget, not the previous segment's budget", () => {
		setUpRightAfterTake(NEXT_SEGMENT)
		pageSegments = [{ _id: NEXT_SEGMENT, segmentTiming: undefined }]

		const partCountdown = renderWithPartOnAir(TAKEN_PART)

		expect(partCountdown.textContent).toBe('00:10')
	})

	it("shows the next segment's budget right after a take into a segment that counts one", () => {
		setUpRightAfterTake(NEXT_SEGMENT)
		pageSegments = [
			{
				_id: NEXT_SEGMENT,
				segmentTiming: { budgetDuration: 60_000, countdownType: CountdownType.SEGMENT_BUDGET_DURATION },
			},
		]

		const partCountdown = renderWithPartOnAir(TAKEN_PART)

		expect(partCountdown.textContent).toBe('01:00')
	})

	it('shows nothing rather than 00:00 while no timing is published at all', () => {
		setUpRightAfterTake(PREVIOUS_SEGMENT)
		publishedPlaylistTiming = undefined

		const partCountdown = renderWithPartOnAir(TAKEN_PART)

		expect(partCountdown.textContent).toBe('')
	})
})
