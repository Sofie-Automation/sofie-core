import { Profiler } from 'react'
import { render, act } from '@testing-library/react'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import type { PartId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import { getPartTimingStateDocId, type PartTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'

const PLAYLIST_ID = protectString<RundownPlaylistId>('playlist0')
const SEGMENT_ID = protectString<SegmentId>('segment0')
const ON_AIR_PART_ID = protectString<PartId>('onAirPart')
const PLAYED_PART_ID = protectString<PartId>('playedPart')
const UPCOMING_PART_ID = protectString<PartId>('upcomingPart')
const NOW = 100000
/** Sixty high-resolution ticks a frame apart, from NOW + 16, end at this time */
const LAST_TICK_TIME = NOW + 16 + 59 * 16
/** The on-air part has played for 7.5s at the last tick, a quarter of its timeline */
const ON_AIR_STARTED_AT = LAST_TICK_TIME - 7500
/** The played part played for 9s, and is done */
const PLAYED_PART_PLAYED = 9000
/** Each part's timeline is 30s long, so a shadow drawn out to 3s is drawn to 10% */
const TIMELINE_BASE = 30000
const PART_RENDERED_DURATION = 3000

/** The part documents the mocked collection will return */
let publishedDocs: PartTimingStateDoc[] = []
/** What the mocked system clock reads */
let currentTime = NOW

jest.mock('../../Collections.js', () => ({
	PlaylistTimingStates: {
		findOne: (id: unknown) => publishedDocs.find((doc) => doc._id === id),
	},
}))
// The reactive layer is not what is under test here, so run the tracked function directly
jest.mock('../../../lib/ReactMeteorData/ReactMeteorData.js', () => ({
	useTracker: (fn: () => unknown) => fn(),
}))
jest.mock('../../../lib/systemTime.js', () => ({
	getCurrentTime: () => currentTime,
}))

import { OvertimeShadow } from '../OvertimeShadow.js'
import { RundownTiming } from '../../RundownView/RundownTiming/RundownTiming.js'

/** A value that holds at `staticValue` and grows from `growsFrom`, published negated as the part documents are */
function countUp(staticValue: number, growsFrom: number | null): TimerState {
	return { paused: true, duration: 0 - staticValue, resumesAt: growsFrom }
}

function makeDoc(partId: PartId, rank: number, played: TimerState): PartTimingStateDoc {
	return {
		_id: getPartTimingStateDocId(partId),
		type: 'part',
		playlistId: PLAYLIST_ID,
		segmentId: SEGMENT_ID,
		partId,
		rank,
		isInQuickLoop: false,
		countsTowardsTiming: true,
		untimed: false,
		orphaned: false,
		played,
	}
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

describe('OvertimeShadow', () => {
	/** How many times each part's shadow has been drawn */
	let draws: Map<PartId, number>

	function renderShadow(partId: PartId, isLive: boolean, hasAlreadyPlayed: boolean): JSX.Element {
		return (
			<Profiler
				key={String(partId)}
				id={String(partId)}
				onRender={() => draws.set(partId, (draws.get(partId) ?? 0) + 1)}
			>
				<div data-testid={String(partId)}>
					<OvertimeShadow
						partId={partId}
						maxDuration={TIMELINE_BASE}
						timelineBase={TIMELINE_BASE}
						mainSourceEnd={PART_RENDERED_DURATION}
						endsInFreeze={false}
						partRenderedDuration={PART_RENDERED_DURATION}
						partActualDuration={undefined}
						isPartZeroBudget={false}
						isLive={isLive}
						hasAlreadyPlayed={hasAlreadyPlayed}
					/>
				</div>
			</Profiler>
		)
	}

	function drawnShadowLeft(container: HTMLElement, partId: PartId): string | undefined {
		const shadow = container.querySelector<HTMLElement>(
			`[data-testid="${String(partId)}"] .segment-opl__overtime-shadow`
		)
		return shadow?.style.left
	}

	beforeEach(() => {
		currentTime = NOW
		publishedDocs = [
			makeDoc(PLAYED_PART_ID, 0, countUp(PLAYED_PART_PLAYED, null)),
			makeDoc(ON_AIR_PART_ID, 1, countUp(0, ON_AIR_STARTED_AT)),
			makeDoc(UPCOMING_PART_ID, 2, countUp(0, null)),
		]
		draws = new Map()
	})

	it('redraws the on-air part on every high-resolution tick, and a played or upcoming part on none of them', () => {
		render(
			<>
				{renderShadow(PLAYED_PART_ID, false, true)}
				{renderShadow(ON_AIR_PART_ID, true, false)}
				{renderShadow(UPCOMING_PART_ID, false, false)}
			</>
		)
		const drawsBeforeTicks = new Map(draws)

		dispatchHighResolutionTicks(60, NOW + 16)

		expect((draws.get(ON_AIR_PART_ID) ?? 0) - (drawsBeforeTicks.get(ON_AIR_PART_ID) ?? 0)).toBe(60)
		expect((draws.get(PLAYED_PART_ID) ?? 0) - (drawsBeforeTicks.get(PLAYED_PART_ID) ?? 0)).toBe(0)
		expect((draws.get(UPCOMING_PART_ID) ?? 0) - (drawsBeforeTicks.get(UPCOMING_PART_ID) ?? 0)).toBe(0)
	})

	it('draws each shadow out to where the part has played to, the on-air part as of the last tick', () => {
		const { container } = render(
			<>
				{renderShadow(PLAYED_PART_ID, false, true)}
				{renderShadow(ON_AIR_PART_ID, true, false)}
				{renderShadow(UPCOMING_PART_ID, false, false)}
			</>
		)

		dispatchHighResolutionTicks(60, NOW + 16)

		expect(drawnShadowLeft(container, PLAYED_PART_ID)).toBe('30%')
		expect(drawnShadowLeft(container, ON_AIR_PART_ID)).toBe('25%')
		// not played yet, so drawn to the end of its planned duration
		expect(drawnShadowLeft(container, UPCOMING_PART_ID)).toBe('10%')
	})

	it('draws a part that is taken on air out to where it has played to from its very first draw', () => {
		const { container, rerender } = render(renderShadow(UPCOMING_PART_ID, false, false))

		// a minute later, with the clock ticking all along, the publication says the part has been
		// playing for 6s
		currentTime = NOW + 60000
		dispatchHighResolutionTicks(1, currentTime)
		publishedDocs = [makeDoc(UPCOMING_PART_ID, 2, countUp(0, currentTime - 6000))]
		rerender(renderShadow(UPCOMING_PART_ID, true, false))

		expect(drawnShadowLeft(container, UPCOMING_PART_ID)).toBe('20%')
	})
})

describe('OvertimeShadow freeze marker', () => {
	/** The clip ends 12.5 s into the part; the part is planned for 10 s, so it ends in a freeze */
	const CLIP_END = 12500
	const PART_LENGTH = 10000
	const STARTED_AT = NOW

	beforeEach(() => {
		currentTime = NOW
		publishedDocs = [makeDoc(ON_AIR_PART_ID, 0, countUp(0, STARTED_AT))]
	})

	function renderFreezeMarker(): HTMLElement {
		const { container } = render(
			<OvertimeShadow
				partId={ON_AIR_PART_ID}
				maxDuration={TIMELINE_BASE}
				timelineBase={TIMELINE_BASE}
				mainSourceEnd={CLIP_END}
				endsInFreeze={true}
				partRenderedDuration={PART_LENGTH}
				partActualDuration={undefined}
				isPartZeroBudget={false}
				isLive={true}
				hasAlreadyPlayed={false}
			/>
		)
		return container
	}

	it('rounds the time left until the freeze up, and shows it until the freeze', () => {
		const container = renderFreezeMarker()

		// 0.7 s until the freeze: the countdown shows 00:01, as every countdown does in its last second
		dispatchHighResolutionTicks(1, STARTED_AT + 11800)
		expect(container.querySelector('.segment-opl__freeze-marker-timer')?.textContent).toBe('00:01')

		// 1.7 s until the freeze
		dispatchHighResolutionTicks(1, STARTED_AT + 10800)
		expect(container.querySelector('.segment-opl__freeze-marker-timer')?.textContent).toBe('00:02')
	})
})
