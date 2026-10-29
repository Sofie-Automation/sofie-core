import { render, act } from '@testing-library/react'
import moment from 'moment'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { PartId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import {
	getPartTimingStateDocId,
	getPlaylistTimingStateDocId,
	type PartTimingStateDoc,
	type PlaylistTimingStateDoc,
	type TimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const PART_ID = protectString<PartId>('part0')
const NOW = 100000

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

import { PartCountdown } from '../PartCountdown.js'
import { RundownTiming } from '../RundownTiming.js'

const PLAYLIST_DOC: PlaylistTimingStateDoc = {
	_id: getPlaylistTimingStateDocId(PLAYLIST_ID),
	type: 'playlist',
	playlistId: PLAYLIST_ID,
	timingType: PlaylistTimingType.None,
	currentPartWillAutoNext: false,
	// the countdown to the end of the last part: 1:00 to go, running
	partCountdownBase: { paused: false, zeroTime: NOW + 60000 },
}

/** The part's document, which says how far its countdown is from the playlist's base */
function partDoc(countdownOffset: number | undefined): PartTimingStateDoc {
	const doc: PartTimingStateDoc = {
		_id: getPartTimingStateDocId(PART_ID),
		type: 'part',
		playlistId: PLAYLIST_ID,
		segmentId: protectString<SegmentId>('segment0'),
		partId: PART_ID,
		rank: 3,
		isInQuickLoop: false,
		countsTowardsTiming: true,
		untimed: false,
		orphaned: false,
	}
	if (countdownOffset !== undefined) doc.countdownOffset = countdownOffset
	return doc
}

function renderCountdown(useWallClock?: boolean): HTMLElement | null {
	const playlist = { _id: PLAYLIST_ID, activationId: protectString('activation0') } as DBRundownPlaylist
	const { container } = render(<PartCountdown partId={PART_ID} playlist={playlist} useWallClock={useWallClock} />)
	return container.querySelector<HTMLElement>('[role="timer"]')
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

describe('PartCountdown', () => {
	beforeEach(() => {
		currentTime = NOW
		publishedDocs.clear()
		publishedDocs.set(PLAYLIST_DOC._id, PLAYLIST_DOC)
	})

	it("shows the playlist's base shifted by the part's offset", () => {
		// the part starts 0:40 before the end of the last part, so in 0:20
		publishedDocs.set(getPartTimingStateDocId(PART_ID), partDoc(-40000))

		expect(renderCountdown()?.textContent).toBe('00:20')
	})

	it('shows the time of day the part starts, which holds while its countdown runs', () => {
		// the part starts 0:40 before the end of the last part, so in 0:20
		publishedDocs.set(getPartTimingStateDocId(PART_ID), partDoc(-40000))
		const expectedTimeOfDay = moment(NOW + 20000).format('HH:mm:ss')

		const timer = renderCountdown(true)
		expect(timer?.textContent).toBe(expectedTimeOfDay)

		// the countdown changes its whole second between two full seconds of the clock
		advanceClockTo(NOW + 1500)
		expect(timer?.textContent).toBe(expectedTimeOfDay)
		advanceClockTo(NOW + 2500)
		expect(timer?.textContent).toBe(expectedTimeOfDay)
	})

	it('shows nothing for a part without an offset, which will not be played in order', () => {
		publishedDocs.set(getPartTimingStateDocId(PART_ID), partDoc(undefined))

		expect(renderCountdown()).toBeNull()
	})
})
