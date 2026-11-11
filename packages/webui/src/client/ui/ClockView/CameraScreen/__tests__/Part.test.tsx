import { render, act } from '@testing-library/react'
import type React from 'react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { PartId, PartInstanceId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import type { PieceExtended } from '@sofie-automation/corelib/src/dataModel/Piece.js'
import {
	getPartTimingStateDocId,
	getPlaylistTimingStateDocId,
	type PartTimingStateDoc,
	type PlaylistTimingStateDoc,
	type TimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import type { PartUi } from '../../../SegmentContainer/withResolvedSegment.js'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const PART_ID = protectString<PartId>('part1')
/** 70 ms after a full second of the clock, as a part starts some milliseconds after its take */
const NOW = 100070

/** What the mocked system clock reads */
let currentTime = NOW

/** The documents the mocked collection holds, by id */
const publishedDocs = new Map<unknown, TimingStateDoc>()

jest.mock('../../../Collections.js', () => ({
	PlaylistTimingStates: {
		findOne: (id: unknown) => publishedDocs.get(id),
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../../lib/systemTime.js', () => ({
	getCurrentTime: () => currentTime,
}))
// The camera screen itself, of which the part needs only its zoom
jest.mock('../index.js', () => {
	const { createContext } = jest.requireActual<typeof React>('react')
	return { AreaZoom: createContext(1) }
})
/** Where the piece is drawn, each time it is drawn */
const mockPieceDraws: Array<{ left: number; width: number | null }> = []
// The piece itself is not what is under test here, only where the part draws it
jest.mock('../Piece.js', () => ({
	Piece: ({ left, width }: { left: number; width: number | null }) => {
		mockPieceDraws.push({ left, width })
		return null
	},
}))
// Count how often the part's countdown and its duration are drawn: each formats its number once when drawn
jest.mock('../../../../lib/rundown.js', () => {
	const actual = jest.requireActual('../../../../lib/rundown.js')
	return {
		...actual,
		RundownUtils: {
			...actual.RundownUtils,
			formatTimeToShortTime: jest.fn(actual.RundownUtils.formatTimeToShortTime),
			formatDiffToTimecodeCountdown: jest.fn(actual.RundownUtils.formatDiffToTimecodeCountdown),
		},
	}
})

import { Part } from '../Part.js'
import { RundownTiming } from '../../../RundownView/RundownTiming/RundownTiming.js'
import { RundownUtils } from '../../../../lib/rundown.js'

const PLAYLIST_DOC: PlaylistTimingStateDoc = {
	_id: getPlaylistTimingStateDocId(PLAYLIST_ID),
	type: 'playlist',
	playlistId: PLAYLIST_ID,
	timingType: PlaylistTimingType.None,
	currentPartWillAutoNext: false,
	currentPartInstanceId: protectString<PartInstanceId>('partInstance0'),
	// the part before is on air, with 9.93 s to go
	remainingOnCurrentPart: { paused: false, zeroTime: NOW + 9930 },
	partCountdownBase: { paused: false, zeroTime: NOW + 9930 },
}

/** A part after the on-air one: its countdown runs, and its played time and length hold until it is on air */
const PART_DOC: PartTimingStateDoc = {
	_id: getPartTimingStateDocId(PART_ID),
	type: 'part',
	playlistId: PLAYLIST_ID,
	segmentId: protectString<SegmentId>('segment0'),
	partId: PART_ID,
	rank: 1,
	isInQuickLoop: false,
	countsTowardsTiming: true,
	expectedDuration: 10000,
	countdownOffset: 0,
	played: { paused: true, duration: 0 },
	liveDisplayDuration: { paused: true, duration: -10000 },
}

const PART = {
	partId: PART_ID,
	instance: {
		_id: protectString<PartInstanceId>('partInstance1'),
		part: { _id: PART_ID, expectedDuration: 10000, untimed: false },
		orphaned: undefined,
	},
} as unknown as PartUi

const PLAYLIST = { _id: PLAYLIST_ID, activationId: protectString('active') } as unknown as DBRundownPlaylist

/** Move the clock on, and send the high-resolution tick that RundownTimingProvider sends on each frame */
function advanceClockTo(time: number): void {
	currentTime = time
	act(() => {
		window.dispatchEvent(
			new CustomEvent(RundownTiming.Events.timeupdateHighResolution, { detail: { currentTime: time } })
		)
	})
}

const FRAMES_IN_A_SECOND = 60

/** One second of frames at 60 Hz */
function runOneSecondOfFrames(): void {
	for (let frame = 1; frame <= FRAMES_IN_A_SECOND; frame++) {
		advanceClockTo(NOW + Math.round((frame * 1000) / FRAMES_IN_A_SECOND))
	}
}

function renderPart(isLive: boolean): HTMLElement {
	const { container } = render(
		<Part playlist={PLAYLIST} part={PART} piece={{} as PieceExtended} isLive={isLive} isNext={!isLive} />
	)
	mockPieceDraws.length = 0
	jest.mocked(RundownUtils.formatTimeToShortTime).mockClear()
	jest.mocked(RundownUtils.formatDiffToTimecodeCountdown).mockClear()
	return container
}

describe('the camera screen Part', () => {
	beforeEach(() => {
		currentTime = NOW
		publishedDocs.clear()
		publishedDocs.set(PLAYLIST_DOC._id, PLAYLIST_DOC)
		publishedDocs.set(PART_DOC._id, PART_DOC)
	})

	it('moves its piece on each frame while its countdown runs', () => {
		renderPart(false)

		runOneSecondOfFrames()

		expect(mockPieceDraws).toHaveLength(FRAMES_IN_A_SECOND)
		// the piece starts where the countdown is, and comes 1 s closer in the second
		expect(mockPieceDraws[FRAMES_IN_A_SECOND - 1]).toEqual({ left: 9930 - 1000, width: 10000 })
	})

	it('moves the live piece on each frame while the On Air countdown runs', () => {
		const livePart = { ...PART, instance: { ...PART.instance, _id: PLAYLIST_DOC.currentPartInstanceId } } as PartUi
		render(<Part playlist={PLAYLIST} part={livePart} piece={{} as PieceExtended} isLive={true} isNext={false} />)
		mockPieceDraws.length = 0

		runOneSecondOfFrames()

		expect(mockPieceDraws).toHaveLength(FRAMES_IN_A_SECOND)
		expect(mockPieceDraws[FRAMES_IN_A_SECOND - 1]).toEqual({ left: 0, width: 9930 - 1000 })
	})

	it('is not drawn again while nothing that it draws from moves', () => {
		// the on-air part overruns, so the countdowns of the parts after it hold
		publishedDocs.set(PLAYLIST_DOC._id, { ...PLAYLIST_DOC, partCountdownBase: { paused: true, duration: 0 } })
		renderPart(false)

		runOneSecondOfFrames()

		expect(mockPieceDraws).toEqual([])
	})

	it('draws its countdown and its duration when their second changes, not on each frame as its piece moves', () => {
		const container = renderPart(false)

		// in the second of frames, the countdown passes one whole second
		runOneSecondOfFrames()

		// the countdown changes its second once; the duration holds, as the part is not on air
		expect(jest.mocked(RundownUtils.formatTimeToShortTime).mock.calls.length).toBeLessThanOrEqual(2)
		expect(jest.mocked(RundownUtils.formatDiffToTimecodeCountdown).mock.calls).toEqual([])
		expect(container.querySelector('.camera-screen__countdown [role="timer"]')?.textContent).toBe(
			RundownUtils.formatTimeToShortTime(9930 - 1000)
		)
	})
})
