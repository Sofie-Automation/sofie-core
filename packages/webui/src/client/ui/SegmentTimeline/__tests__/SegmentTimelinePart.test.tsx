import type React from 'react'
import { render, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type {
	PartId,
	PartInstanceId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import { getPartTimingStateDocId, type PartTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
import type { UIStudio } from '@sofie-automation/corelib/src/dataModel/Studio.js'
import type { RundownViewPlaylist } from '../../../lib/rundownPlaylistProjection.js'
import type { PartUi, SegmentUi } from '../SegmentTimelineContainer.js'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const ON_AIR_SEGMENT_ID = protectString<SegmentId>('onAirSegment')
const OTHER_SEGMENT_ID = protectString<SegmentId>('otherSegment')
const ON_AIR_PART_ID = protectString<PartId>('onAirPart')
const FOLLOWING_PART_ID = protectString<PartId>('followingPart')
const OTHER_PART_ID = protectString<PartId>('otherPart')
const NOW = 100000
/** The on-air part was planned to last 5s, started 6s ago, and so has been overrunning for 1s */
const ON_AIR_PLANNED_DURATION = 5000
const ON_AIR_STARTED_AT = NOW - 6000
/** At this scale the live line padding is 150px / 0.03px per ms = 5s */
const TIME_TO_PIXEL_RATIO = 0.03
const LIVE_LINE_PADDING_TIME = 5000

/** The part documents the mocked collection will return */
let publishedDocs: PartTimingStateDoc[] = []
/** What the mocked system clock reads */
let currentTime = NOW

jest.mock('../../Collections.js', () => ({
	PlaylistTimingStates: {
		find: (selector: { segmentId: SegmentId }) => ({
			fetch: () => publishedDocs.filter((doc) => doc.segmentId === selector.segmentId),
		}),
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../lib/systemTime.js', () => ({
	getCurrentTime: () => currentTime,
}))
// Only when and where a part is drawn is under test, not what it draws inside itself
jest.mock('../../../lib/ui/icons/looping.js', () => ({ LoopingIcon: () => null }))
jest.mock('../Parts/OutputGroup.js', () => ({ OutputGroup: () => null }))
jest.mock('../Parts/InvalidPartCover.js', () => ({ InvalidPartCover: () => null }))

import { SegmentTimelinePart, SegmentTimelinePartClass } from '../Parts/SegmentTimelinePart.js'
import { RundownTiming } from '../../RundownView/RundownTiming/RundownTiming.js'

/** A value that holds at `staticValue` and grows from `growsFrom`, published negated as the part documents are */
function countUp(staticValue: number, growsFrom: number | null): TimerState {
	return { paused: true, duration: 0 - staticValue, resumesAt: growsFrom }
}

function makeDoc(segmentId: SegmentId, partId: PartId, rank: number, displayDuration: TimerState): PartTimingStateDoc {
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
		liveDisplayDuration: displayDuration,
		duration: displayDuration,
	}
}

function makePart(segmentId: SegmentId, partId: PartId, plannedStartedPlayback: number | undefined): PartUi {
	return {
		partId,
		instance: {
			_id: protectString<PartInstanceId>(`${partId}_instance`),
			segmentId,
			part: { _id: partId, segmentId, title: String(partId) },
			timings: { plannedStartedPlayback },
		},
		pieces: [],
		renderedDuration: 5000,
		startsAt: 0,
	} as unknown as PartUi
}

const onAirPart = makePart(ON_AIR_SEGMENT_ID, ON_AIR_PART_ID, ON_AIR_STARTED_AT)
const followingPart = makePart(ON_AIR_SEGMENT_ID, FOLLOWING_PART_ID, undefined)
const otherPart = makePart(OTHER_SEGMENT_ID, OTHER_PART_ID, undefined)

const playlist = {
	_id: PLAYLIST_ID,
	activationId: protectString<RundownPlaylistActivationId>('activation0'),
	currentPartInfo: { partInstanceId: onAirPart.instance._id },
	nextPartInfo: null,
	previousPartsInfo: [],
} as unknown as RundownViewPlaylist

function renderPart(
	segmentId: SegmentId,
	part: PartUi,
	firstPartInSegment: PartUi,
	playlistToRender: RundownViewPlaylist = playlist
): JSX.Element {
	const props: React.ComponentProps<typeof SegmentTimelinePart> = {
		segment: { _id: segmentId } as SegmentUi,
		playlist: playlistToRender,
		studio: { settings: {} } as UIStudio,
		part,
		firstPartInSegment,
		timeToPixelRatio: TIME_TO_PIXEL_RATIO,
		collapsedOutputs: {},
		scrollLeft: 0,
		scrollWidth: 100000,
		followLiveLine: false,
		autoNextPart: false,
		liveLineHistorySize: 100,
		livePosition: 0,
		isLastInSegment: false,
		isAfterLastValidInSegmentAndItsLive: false,
		isLastSegment: false,
		isLiveSegment: segmentId === ON_AIR_SEGMENT_ID,
		anyPriorPartWasLive: false,
		livePartStartsAt: 0,
		livePartDisplayDuration: 0,
		budgetDuration: undefined,
	}
	return <SegmentTimelinePart key={String(part.partId)} {...props} />
}

/** Dispatch high-resolution ticks a frame apart, as RundownTimingProvider does */
function dispatchHighResolutionTicks(count: number, startingAt: number): void {
	for (let i = 0; i < count; i++) {
		act(() => {
			window.dispatchEvent(
				new CustomEvent(RundownTiming.Events.timeupdateHighResolution, {
					detail: { currentTime: startingAt + i * 16 },
				})
			)
		})
	}
}

describe('SegmentTimelinePart', () => {
	/** How many times each part has been drawn, how far out it was drawn each time, and where it was last drawn */
	let draws: Map<PartId, number>
	let drawnLiveDurations: Map<PartId, number[]>
	let lastDrawnLiveDuration: Map<PartId, number>
	let lastDrawnStartsAt: Map<PartId, number>

	beforeEach(() => {
		currentTime = NOW
		// the on-air part grows once it passes its planned end; the others hold their durations
		publishedDocs = [
			makeDoc(
				ON_AIR_SEGMENT_ID,
				ON_AIR_PART_ID,
				0,
				countUp(ON_AIR_PLANNED_DURATION, ON_AIR_STARTED_AT + ON_AIR_PLANNED_DURATION)
			),
			makeDoc(ON_AIR_SEGMENT_ID, FOLLOWING_PART_ID, 1, countUp(3000, null)),
			makeDoc(OTHER_SEGMENT_ID, OTHER_PART_ID, 0, countUp(4000, null)),
		]

		draws = new Map()
		drawnLiveDurations = new Map()
		lastDrawnLiveDuration = new Map()
		lastDrawnStartsAt = new Map()
		jest.spyOn(SegmentTimelinePartClass.prototype, 'render').mockImplementation(function (
			this: SegmentTimelinePartClass
		) {
			const partId = this.props.part.partId
			draws.set(partId, (draws.get(partId) ?? 0) + 1)
			drawnLiveDurations.set(partId, [...(drawnLiveDurations.get(partId) ?? []), this.state.liveDuration])
			lastDrawnLiveDuration.set(partId, this.state.liveDuration)
			lastDrawnStartsAt.set(partId, SegmentTimelinePartClass.getPartStartsAt(this.props))
			return null
		})
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	it('redraws the on-air part on every high-resolution tick, and a part elsewhere on none of them', () => {
		render(
			<>
				{renderPart(ON_AIR_SEGMENT_ID, onAirPart, onAirPart)}
				{renderPart(OTHER_SEGMENT_ID, otherPart, otherPart)}
			</>
		)
		const drawsBeforeTicks = new Map(draws)

		dispatchHighResolutionTicks(60, NOW + 16)

		expect((draws.get(ON_AIR_PART_ID) ?? 0) - (drawsBeforeTicks.get(ON_AIR_PART_ID) ?? 0)).toBe(60)
		expect((draws.get(OTHER_PART_ID) ?? 0) - (drawsBeforeTicks.get(OTHER_PART_ID) ?? 0)).toBe(0)
	})

	it('draws the on-air part out to its live line at the time of the last tick', () => {
		render(renderPart(ON_AIR_SEGMENT_ID, onAirPart, onAirPart))

		dispatchHighResolutionTicks(60, NOW + 16)

		// the last tick was at 100960, so the live line is 6960ms into the part
		const lastTickTime = NOW + 16 + 59 * 16
		expect(lastDrawnLiveDuration.get(ON_AIR_PART_ID)).toBe(lastTickTime - ON_AIR_STARTED_AT + LIVE_LINE_PADDING_TIME)
	})

	it('draws a part that is taken on air out to its live line from its very first draw', () => {
		const playlistBeforeTake = {
			...playlist,
			currentPartInfo: { partInstanceId: otherPart.instance._id },
		} as RundownViewPlaylist
		const { rerender } = render(renderPart(ON_AIR_SEGMENT_ID, onAirPart, onAirPart, playlistBeforeTake))

		// a minute later, with the clock ticking all along, the part is taken
		currentTime = NOW + 60000
		dispatchHighResolutionTicks(1, currentTime)
		const drawsBeforeTake = (drawnLiveDurations.get(ON_AIR_PART_ID) ?? []).length
		rerender(renderPart(ON_AIR_SEGMENT_ID, onAirPart, onAirPart, playlist))

		const firstDrawnLiveDurationAfterTake = drawnLiveDurations.get(ON_AIR_PART_ID)?.[drawsBeforeTake]
		expect(firstDrawnLiveDurationAfterTake).toBe(currentTime - ON_AIR_STARTED_AT + LIVE_LINE_PADDING_TIME)
	})

	it('redraws a part after the on-air part with it, since that part is pushed along as the on-air part overruns', () => {
		render(
			<>
				{renderPart(ON_AIR_SEGMENT_ID, onAirPart, onAirPart)}
				{renderPart(ON_AIR_SEGMENT_ID, followingPart, onAirPart)}
			</>
		)
		const drawsBeforeTicks = new Map(draws)

		dispatchHighResolutionTicks(60, NOW + 16)

		expect((draws.get(FOLLOWING_PART_ID) ?? 0) - (drawsBeforeTicks.get(FOLLOWING_PART_ID) ?? 0)).toBe(60)
		// at the last tick, 100960, the on-air part had run 1960ms past its planned 5s
		expect(lastDrawnStartsAt.get(FOLLOWING_PART_ID)).toBe(ON_AIR_PLANNED_DURATION + 1960)
	})
})
