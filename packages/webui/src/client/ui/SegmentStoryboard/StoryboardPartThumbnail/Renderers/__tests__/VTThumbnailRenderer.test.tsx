import { render, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { PartId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getPartTimingStateDocId, type PartTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
import type { PieceUi } from '@sofie-automation/corelib/src/dataModel/Piece.js'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const PART_ID = protectString<PartId>('part0')
/** The part started 70 ms after a full second of the clock */
const PART_START = 100070

/** What the mocked system clock reads */
let currentTime = PART_START

/** The on-air part: played since PART_START, and planned for 20 s */
const PART_DOC: PartTimingStateDoc = {
	_id: getPartTimingStateDocId(PART_ID),
	type: 'part',
	playlistId: PLAYLIST_ID,
	segmentId: protectString<SegmentId>('segment0'),
	partId: PART_ID,
	rank: 0,
	isInQuickLoop: false,
	countsTowardsTiming: true,
	untimed: false,
	orphaned: false,
	played: { paused: false, zeroTime: PART_START },
	liveDisplayDuration: { paused: true, duration: -20000 },
}

jest.mock('../../../../Collections.js', () => ({
	PlaylistTimingStates: {
		findOne: (id: unknown) => (id === PART_DOC._id ? PART_DOC : undefined),
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../../../lib/systemTime.js', () => ({
	getCurrentTime: () => currentTime,
}))

// Only the countdown is under test: the icons and the media status are mocked away
jest.mock('../../../../../lib/notifications/notifications.js', () => ({ getNoticeLevelForPieceStatus: () => null }))
jest.mock('../../../../../lib/ui/icons/freezeFrame.js', () => ({ FreezeFrameIcon: () => null }))
jest.mock('../../../../../lib/ui/PieceStatusIcon.js', () => ({ PieceStatusIcon: () => null }))
jest.mock('../../../../../lib/ui/icons/looping.js', () => ({ LoopingPieceIcon: () => null }))
jest.mock('../../../../SegmentTimeline/withMediaObjectStatus.js', () => ({
	useContentStatusForPieceInstance: () => undefined,
}))
jest.mock('../../../../SegmentContainer/withResolvedSegment.js', () => ({ FREEZE_FRAME_FLASH: 5000 }))

import { VTThumbnailRendererWithTiming } from '../VTThumbnailRenderer.js'
import { RundownTiming } from '../../../../RundownView/RundownTiming/RundownTiming.js'

/** Move the clock on, and send the high-resolution tick that RundownTimingProvider sends on each frame */
function advanceClockTo(time: number): void {
	currentTime = time
	act(() => {
		window.dispatchEvent(
			new CustomEvent(RundownTiming.Events.timeupdateHighResolution, { detail: { currentTime: time } })
		)
	})
}

describe('VTThumbnailRendererWithTiming', () => {
	beforeEach(() => {
		currentTime = PART_START
	})

	it("counts down the clip's content at the moment its own second changes", () => {
		// a clip of 10.5 s, so the content left is not a whole number of seconds when the played time is
		const pieceInstance = {
			instance: { piece: { content: { sourceDuration: 10500, seek: 0 } } },
			renderedInPoint: 0,
		} as unknown as PieceUi
		const { container } = render(
			<VTThumbnailRendererWithTiming
				partId={PART_ID}
				pieceInstance={pieceInstance}
				partAutoNext={false}
				partPlannedStoppedPlayback={undefined}
				isLive={true}
				hovering={false}
				contentStatus={undefined}
			/>
		)
		const countdown = () => container.querySelector('.segment-storyboard__thumbnail__countdown')?.textContent
		expect(countdown()).toBe('00:11')

		advanceClockTo(PART_START + 1100)
		expect(countdown()).toBe('00:10')

		// 8.9 s of content left: the shown second changed at 1.5 s played
		advanceClockTo(PART_START + 1600)
		expect(countdown()).toBe('00:09')
	})
})
