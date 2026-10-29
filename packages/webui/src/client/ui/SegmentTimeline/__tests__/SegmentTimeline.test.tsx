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
const LAST_PART_ID = protectString<PartId>('lastPart')
const OTHER_PART_ID = protectString<PartId>('otherPart')
const NOW = 100000
/** The on-air part was planned to last 5s, started 6s ago, and so has been overrunning for 1s */
const ON_AIR_PLANNED_DURATION = 5000
const ON_AIR_STARTED_AT = NOW - 6000
/** At this scale every part here is wide enough to be drawn as a part of its own, not as a small-part flag */
const TIME_SCALE = 0.03

/** The part documents the mocked collection will return */
let publishedDocs: PartTimingStateDoc[] = []
/** What the mocked system clock reads */
let currentTime = NOW
/**
 * The components that have queried the timing collection for a segment's parts. In the running app
 * each of them holds a live query that every changed timing document is matched against.
 */
let componentsQueryingPartTimings = new Set<object>()
/** The component whose tracked function is running, while it runs */
let componentRunningTrackedFunction: object | undefined

jest.mock('../../Collections.js', () => ({
	PlaylistTimingStates: {
		find: (selector: { type: string; segmentId: SegmentId }) => {
			const isPartTimingsQuery = selector.type === 'part'
			if (isPartTimingsQuery && componentRunningTrackedFunction) {
				componentsQueryingPartTimings.add(componentRunningTrackedFunction)
			}
			return {
				fetch: () => publishedDocs.filter((doc) => doc.segmentId === selector.segmentId),
			}
		},
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly, noting
// which component it is running for
jest.mock('../../../lib/ReactMeteorData/ReactMeteorData.js', () => {
	const { useRef } = jest.requireActual<typeof React>('react')
	return {
		useTracker: (fn: () => unknown) => {
			const component = useRef({}).current
			componentRunningTrackedFunction = component
			try {
				return fn()
			} finally {
				componentRunningTrackedFunction = undefined
			}
		},
	}
})
jest.mock('../../../lib/systemTime.js', () => ({
	getCurrentTime: () => currentTime,
}))
// Only how the parts get their timings and when they are drawn is under test. These read other timing
// values, measure the page, draw on a canvas or open menus, and are left out.
jest.mock('@jstarpl/react-contextmenu', () => ({ ContextMenuTrigger: () => null }))
jest.mock('../../../lib/lib.js', () => ({
	...jest.requireActual('../../../lib/lib.js'),
	contextMenuHoldToDisplayTime: () => -1,
}))
jest.mock('../../UserEditOperations/PropertiesPanel.js', () => ({ hasUserEditableContent: () => false }))
jest.mock('../../../lib/ui/icons/looping.js', () => ({ LoopingIcon: () => null }))
jest.mock('../Parts/OutputGroup.js', () => ({ OutputGroup: () => null }))
jest.mock('../Parts/InvalidPartCover.js', () => ({ InvalidPartCover: () => null }))
jest.mock('../TimelineGrid.js', () => ({ TimelineGrid: () => null }))
jest.mock('../SegmentTimelineZoomControls.js', () => ({ SegmentTimelineZoomControls: () => null }))
jest.mock('../SegmentTimelineZoomButtons.js', () => ({ SegmentTimelineZoomButtons: () => null }))
jest.mock('../../SegmentContainer/SwitchViewModeButton.js', () => ({ SwitchViewModeButton: () => null }))
jest.mock('../../RundownView/RundownTiming/SegmentDuration.js', () => ({ SegmentDuration: () => null }))
jest.mock('../../RundownView/RundownTiming/PartCountdown.js', () => ({ PartCountdown: () => null }))
jest.mock('../../RundownView/RundownHeader/CurrentPartOrSegmentRemaining.js', () => ({
	CurrentPartOrSegmentRemaining: () => null,
}))

import { SegmentTimeline } from '../SegmentTimeline.js'
import { SegmentTimelinePartClass } from '../Parts/SegmentTimelinePart.js'
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
const lastPart = makePart(ON_AIR_SEGMENT_ID, LAST_PART_ID, undefined)
const otherPart = makePart(OTHER_SEGMENT_ID, OTHER_PART_ID, undefined)

const playlist = {
	_id: PLAYLIST_ID,
	activationId: protectString<RundownPlaylistActivationId>('activation0'),
	currentPartInfo: { partInstanceId: onAirPart.instance._id },
	nextPartInfo: null,
	previousPartsInfo: [],
} as unknown as RundownViewPlaylist

function renderSegment(segmentId: SegmentId, parts: PartUi[], budgetDuration?: number): JSX.Element {
	const segment = {
		_id: segmentId,
		name: String(segmentId),
		externalId: String(segmentId),
		outputLayers: {},
		sourceLayers: {},
		segmentTiming: { budgetDuration },
	} as unknown as SegmentUi
	const isLiveSegment = segmentId === ON_AIR_SEGMENT_ID

	const props: Omit<React.ComponentProps<typeof SegmentTimeline>, 'key'> = {
		id: String(segmentId),
		segment,
		playlist,
		followLiveSegments: false,
		studio: { settings: {} } as UIStudio,
		parts,
		segmentNoteCounts: { criticial: 0, warning: 0 },
		timeScale: TIME_SCALE,
		maxTimeScale: TIME_SCALE,
		onRecalculateMaxTimeScale: async () => TIME_SCALE,
		showingAllSegment: true,
		collapsedOutputs: {},
		scrollLeft: 0,
		hasAlreadyPlayed: false,
		hasGuestItems: false,
		hasRemoteItems: false,
		isLiveSegment,
		isNextSegment: false,
		isQueuedSegment: false,
		followLiveLine: false,
		liveLineHistorySize: 100,
		livePosition: 0,
		displayLiveLineCounter: false,
		autoNextPart: false,
		onScroll: () => undefined,
		onZoomChange: () => undefined,
		isLastSegment: false,
		lastValidPartIndex: parts.length - 1,
		showCountdownToSegment: false,
		fixedSegmentDuration: undefined,
	}
	return <SegmentTimeline key={String(segmentId)} {...props} />
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

describe('SegmentTimeline', () => {
	/** How many times each part has been drawn, and where it was last drawn */
	let draws: Map<PartId, number>
	let lastDrawnStartsAt: Map<PartId, number>

	beforeEach(() => {
		currentTime = NOW
		componentsQueryingPartTimings = new Set()
		// the on-air part grows once it passes its planned end; the others hold their durations
		publishedDocs = [
			makeDoc(
				ON_AIR_SEGMENT_ID,
				ON_AIR_PART_ID,
				0,
				countUp(ON_AIR_PLANNED_DURATION, ON_AIR_STARTED_AT + ON_AIR_PLANNED_DURATION)
			),
			makeDoc(ON_AIR_SEGMENT_ID, FOLLOWING_PART_ID, 1, countUp(3000, null)),
			makeDoc(ON_AIR_SEGMENT_ID, LAST_PART_ID, 2, countUp(4000, null)),
			makeDoc(OTHER_SEGMENT_ID, OTHER_PART_ID, 0, countUp(4000, null)),
		]

		draws = new Map()
		lastDrawnStartsAt = new Map()
		jest.spyOn(SegmentTimelinePartClass.prototype, 'render').mockImplementation(function (
			this: SegmentTimelinePartClass
		) {
			const partId = this.props.part.partId
			draws.set(partId, (draws.get(partId) ?? 0) + 1)
			lastDrawnStartsAt.set(partId, SegmentTimelinePartClass.getPartStartsAt(this.props))
			return null
		})
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	it("queries the timing collection once for a segment's parts, rather than once for each of them", () => {
		render(renderSegment(ON_AIR_SEGMENT_ID, [onAirPart, followingPart, lastPart]))

		expect(draws.get(LAST_PART_ID)).toBeGreaterThan(0)
		expect(componentsQueryingPartTimings.size).toBe(1)
	})

	it("draws the gap up to a segment's budget from the same query as its parts", () => {
		const budgetDuration = 20000
		render(renderSegment(ON_AIR_SEGMENT_ID, [onAirPart, followingPart, lastPart], budgetDuration))

		const gapPartId = protectString<PartId>('gap')
		expect(draws.get(gapPartId)).toBeGreaterThan(0)
		expect(componentsQueryingPartTimings.size).toBe(1)
		// the gap starts where the last part ends: 6s of the on-air part, then 3s and 4s
		expect(lastDrawnStartsAt.get(gapPartId)).toBe(6000 + 3000 + 4000)
	})

	it('redraws the parts of the on-air segment on every high-resolution tick, and the parts of another segment on none of them', () => {
		render(
			<>
				{renderSegment(ON_AIR_SEGMENT_ID, [onAirPart, followingPart])}
				{renderSegment(OTHER_SEGMENT_ID, [otherPart])}
			</>
		)
		const drawsBeforeTicks = new Map(draws)

		dispatchHighResolutionTicks(60, NOW + 16)

		expect((draws.get(ON_AIR_PART_ID) ?? 0) - (drawsBeforeTicks.get(ON_AIR_PART_ID) ?? 0)).toBe(60)
		expect((draws.get(FOLLOWING_PART_ID) ?? 0) - (drawsBeforeTicks.get(FOLLOWING_PART_ID) ?? 0)).toBe(60)
		expect((draws.get(OTHER_PART_ID) ?? 0) - (drawsBeforeTicks.get(OTHER_PART_ID) ?? 0)).toBe(0)
	})

	it('draws the part after the on-air part where the overrun has pushed it at the time of the last tick', () => {
		render(renderSegment(ON_AIR_SEGMENT_ID, [onAirPart, followingPart]))

		dispatchHighResolutionTicks(60, NOW + 16)

		// at the last tick, 100960, the on-air part had run 1960ms past its planned 5s
		expect(lastDrawnStartsAt.get(FOLLOWING_PART_ID)).toBe(ON_AIR_PLANNED_DURATION + 1960)
	})
})
