import { render, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import {
	getPlaylistTimingStateDocId,
	type PlaylistTimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
/** The planned start: on a whole second of the clock */
const PLANNED_START = 120000

/** What the mocked system clock reads */
let currentTime = 100500

const PLAYLIST_DOC: PlaylistTimingStateDoc = {
	_id: getPlaylistTimingStateDocId(PLAYLIST_ID),
	type: 'playlist',
	playlistId: PLAYLIST_ID,
	timingType: PlaylistTimingType.ForwardTime,
	currentPartWillAutoNext: false,
	partCountdownBase: { paused: true, duration: 0 },
	plannedStart: { paused: false, zeroTime: PLANNED_START },
}

jest.mock('../../../Collections.js', () => ({
	PlaylistTimingStates: {
		findOne: (id: unknown) => (id === PLAYLIST_DOC._id ? PLAYLIST_DOC : undefined),
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../../lib/systemTime.js', () => ({
	getCurrentTime: () => currentTime,
}))
jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))
import { RundownHeaderPlannedStart } from '../RundownHeaderPlannedStart.js'
import { RundownTiming } from '../../RundownTiming/RundownTiming.js'

/** Move the clock on, and send the high-resolution tick that RundownTimingProvider sends on each frame */
function advanceClockTo(time: number): void {
	currentTime = time
	act(() => {
		window.dispatchEvent(
			new CustomEvent(RundownTiming.Events.timeupdateHighResolution, { detail: { currentTime: time } })
		)
	})
}

/** The value a countdown shows, found by its label */
function countdownValue(container: HTMLElement, label: string): HTMLElement | null {
	const labels = Array.from(container.querySelectorAll<HTMLElement>('.countdown__label'))
	const countdown = labels.find((element) => element.textContent === label)?.closest('.countdown')
	return countdown?.querySelector<HTMLElement>('.countdown__counter') ?? null
}

function renderStartIn(): HTMLElement | null {
	const playlist = { _id: PLAYLIST_ID } as DBRundownPlaylist
	const { container } = render(<RundownHeaderPlannedStart playlist={playlist} />)
	return countdownValue(container, 'Start In')
}

describe('RundownHeaderPlannedStart', () => {
	beforeEach(() => {
		currentTime = 100500
	})

	it('rounds the time until the planned start up, so the clock plus Start In is the planned start', () => {
		// 19.5 s to go, and the wall clock shows the whole second before: 100 s
		const startIn = renderStartIn()
		expect(startIn?.textContent).toBe('00:20')

		// 0.5 s to go
		advanceClockTo(119500)
		expect(startIn?.textContent).toBe('00:01')
	})

	it('rounds the time since the planned start down, with a plus', () => {
		const startIn = renderStartIn()

		advanceClockTo(120500)
		expect(startIn?.textContent).toBe('+00:00')

		advanceClockTo(121500)
		expect(startIn?.textContent).toBe('+00:01')
	})
})
