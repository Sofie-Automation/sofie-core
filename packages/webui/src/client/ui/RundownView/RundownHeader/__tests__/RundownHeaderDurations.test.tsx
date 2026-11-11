import { render } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import {
	getPlaylistTimingStateDocId,
	type PlaylistTimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const NOW = 100000

/** The published playlist document: 50 ms of the show left */
const PLAYLIST_DOC: PlaylistTimingStateDoc = {
	_id: getPlaylistTimingStateDocId(PLAYLIST_ID),
	type: 'playlist',
	playlistId: PLAYLIST_ID,
	timingType: PlaylistTimingType.ForwardTime,
	currentPartWillAutoNext: false,
	partCountdownBase: { paused: true, duration: 0 },
	remainingDuration: { paused: false, zeroTime: NOW + 50 },
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
	getCurrentTime: () => NOW,
}))
jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))
import { RundownHeaderDurations } from '../RundownHeaderDurations.js'

/** The value a countdown shows, found by its label */
function countdownValue(container: HTMLElement, label: string): HTMLElement | null {
	const labels = Array.from(container.querySelectorAll<HTMLElement>('.countdown__label'))
	const countdown = labels.find((element) => element.textContent === label)?.closest('.countdown')
	return countdown?.querySelector<HTMLElement>('.countdown__counter') ?? null
}

describe('RundownHeaderDurations', () => {
	it('shows Rem. Dur 00:00:01 in the last 0.1 s, as the time left rounds up', () => {
		const { container } = render(<RundownHeaderDurations playlist={{ _id: PLAYLIST_ID } as DBRundownPlaylist} />)
		expect(countdownValue(container, 'Rem. Dur')?.textContent).toBe('00:00:01')
	})
})
