import { render } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type {
	PartId,
	PartInstanceId,
	RundownPlaylistId,
	SegmentId,
	SegmentPlayoutId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import type { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist/RundownPlaylist'
import {
	getPlaylistTimingStateDocId,
	type PlaylistTimingStateDoc,
} from '@sofie-automation/corelib/dist/dataModel/TimingState'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import type { PartUi } from '../../SegmentTimeline/SegmentTimelineContainer.js'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const NOW = 100000
const PREVIOUS_PART = protectString<PartInstanceId>('previousPartInstance')
const TAKEN_PART = protectString<PartInstanceId>('takenPartInstance')
const SEGMENT = protectString<SegmentId>('segment0')

/** The document the mocked collection will return */
let publishedDoc: PlaylistTimingStateDoc | undefined
/** The part instance the mocked screen data has on air, undefined while nothing is on air */
let onAirPartInstance: PartUi | undefined
/** What the page has of the playlist and its part instances */
let pagePlaylist: Pick<DBRundownPlaylist, '_id' | 'currentPartInfo'> | undefined
let pagePartInstances: DBPartInstance[]

jest.mock('../../Collections.js', () => ({
	PlaylistTimingStates: {
		findOne: (id: unknown) => (publishedDoc && publishedDoc._id === id ? publishedDoc : undefined),
	},
	UIPartInstances: {
		findOne: (id: unknown) => pagePartInstances.find((partInstance) => partInstance._id === id),
	},
}))
jest.mock('../../../collections/index.js', () => ({
	...jest.requireActual('../../../collections/index.js'),
	RundownPlaylists: {
		findOne: (id: unknown) => (pagePlaylist && pagePlaylist._id === id ? pagePlaylist : undefined),
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../lib/systemTime.js', () => ({
	getCurrentTime: () => NOW,
}))
jest.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (str: string) => str }),
}))

// Only the on-air countdown is under test: the screen's data is a fixture, and the next part's
// icon and name are mocked away
jest.mock('../PresenterScreen.js', () => ({
	usePresenterScreenSubscriptions: () => undefined,
	getPresenterScreenReactive: () => ({
		playlist: { _id: PLAYLIST_ID },
		segments: [],
		currentPartInstance: onAirPartInstance,
		nextPartInstance: undefined,
		nextShowStyleBaseId: undefined,
		rundownIds: [],
	}),
}))
jest.mock('../../PieceIcons/PieceIcon.js', () => ({ PieceIconContainer: () => null }))
jest.mock('../../PieceIcons/PieceName.js', () => ({ PieceNameContainer: () => null }))

import { OverlayScreen } from '../OverlayScreen.js'

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

function makePartInstance(partInstanceId: PartInstanceId, takeCount: number, expectedDuration: number): DBPartInstance {
	return {
		_id: partInstanceId,
		segmentId: SEGMENT,
		segmentPlayoutId: protectString<SegmentPlayoutId>('playOfSegment0'),
		takeCount,
		part: {
			_id: protectString<PartId>(`partOf_${partInstanceId}`),
			segmentId: SEGMENT,
			expectedDuration,
			// with no transition
			expectedDurationWithTransition: expectedDuration,
		},
	} as DBPartInstance
}

/**
 * The page right after a take of a 10s part, and the published values, which still describe the previous
 * part: 2s left of it
 */
function setUpRightAfterTake(): void {
	onAirPartInstance = makeOnAirPartInstance(TAKEN_PART)
	pagePartInstances = [makePartInstance(PREVIOUS_PART, 1, 20_000), makePartInstance(TAKEN_PART, 2, 10_000)]
	pagePlaylist = {
		_id: PLAYLIST_ID,
		currentPartInfo: { partInstanceId: TAKEN_PART } as DBRundownPlaylist['currentPartInfo'],
	}
	publishedDoc = makeDoc({
		currentPartInstanceId: PREVIOUS_PART,
		remainingOnCurrentPart: { paused: false, zeroTime: NOW + 2_000 },
	})
}

function makeOnAirPartInstance(partInstanceId: PartInstanceId): PartUi {
	return {
		instance: {
			_id: partInstanceId,
			part: { title: 'Taken part', autoNext: false },
		},
	} as PartUi
}

/** Render the Overlay screen and return its on-air countdown */
function renderOverlay(): HTMLElement {
	const { container } = render(<OverlayScreen studioId={protectString<StudioId>('studio0')} playlistId={PLAYLIST_ID} />)

	const countdown = container.querySelector<HTMLElement>('.clocks-current-segment-countdown')
	if (!countdown) throw new Error('The on-air countdown was not rendered')
	return countdown
}

describe('Overlay screen on-air countdown', () => {
	beforeEach(() => {
		publishedDoc = undefined
		onAirPartInstance = undefined
		pagePlaylist = undefined
		pagePartInstances = []
	})

	it("shows the on-air part's remaining time", () => {
		onAirPartInstance = makeOnAirPartInstance(TAKEN_PART)
		publishedDoc = makeDoc({
			currentPartInstanceId: TAKEN_PART,
			remainingOnCurrentPart: { paused: false, zeroTime: NOW + 8_000 },
		})

		const countdown = renderOverlay()

		expect(countdown.textContent).toBe('00:08')
	})

	it("shows the taken part's planned length right after a take, not the previous part's countdown", () => {
		// The screen already has the taken part on air, the published values still describe the previous one
		setUpRightAfterTake()

		const countdown = renderOverlay()

		expect(countdown.textContent).toBe('00:10')
	})

	it('shows nothing rather than 00:00 while no timing is published at all', () => {
		setUpRightAfterTake()
		publishedDoc = undefined

		const countdown = renderOverlay()

		expect(countdown.textContent).toBe('')
	})

	it('shows Next while no part is on air', () => {
		onAirPartInstance = undefined
		publishedDoc = makeDoc({})

		const countdown = renderOverlay()

		expect(countdown.textContent).toBe('Next')
	})
})
