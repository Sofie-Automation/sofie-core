import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import type { PartTimingStateDoc, PlaylistTimingStateDoc } from '@sofie-automation/corelib/dist/dataModel/TimingState'
import type { TimerState } from '@sofie-automation/corelib/dist/dataModel/TimerState'
import type { PartId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { toPartTiming } from '../partTiming.js'

describe('toPartTiming', () => {
	const playlistId = protectString<RundownPlaylistId>('playlist0')

	function partTiming(timing: Partial<PartTimingStateDoc> = {}): PartTimingStateDoc {
		return {
			type: 'part',
			playlistId,
			segmentId: protectString<SegmentId>('segment0'),
			partId: protectString<PartId>('part0'),
			rank: 4,
			isInQuickLoop: false,
			countsTowardsTiming: true,
			...timing,
		} as PartTimingStateDoc
	}

	/** The playlist's timing document, with this base for the part countdowns */
	function playlistTiming(
		partCountdownBase: TimerState,
		ofPlaylist: RundownPlaylistId = playlistId
	): PlaylistTimingStateDoc {
		return { type: 'playlist', playlistId: ofPlaylist, partCountdownBase } as PlaylistTimingStateDoc
	}

	it('identifies the part, and the part instance that the timing describes', () => {
		expect(toPartTiming(partTiming({ partInstanceId: protectString('partInstance0') }), undefined)).toMatchObject({
			id: 'part0',
			instanceId: 'partInstance0',
			segmentId: 'segment0',
			rank: 4,
		})

		expect(toPartTiming(partTiming(), undefined).instanceId).toBeNull()
	})

	it('forwards the published timers untouched, so the client evaluates them itself', () => {
		const played: TimerState = { paused: true, duration: 0, resumesAt: 1600000060000 }
		const duration: TimerState = { paused: true, duration: -10000, resumesAt: 1600000070000 }
		const liveDisplayDuration: TimerState = { paused: false, zeroTime: 1600000070000 }

		const result = toPartTiming(partTiming({ played, duration, liveDisplayDuration }), undefined)

		expect(result).toMatchObject({ played, duration, liveDisplayDuration })
	})

	it("sends the countdown as the playlist's base shifted by the part's offset, so the client evaluates it itself", () => {
		const base: TimerState = { paused: false, zeroTime: 1600000100000, pauseTime: 1600000060000 }

		const result = toPartTiming(partTiming({ countdownOffset: -30000 }), playlistTiming(base))

		expect(result.countdown).toEqual({ paused: false, zeroTime: 1600000070000, pauseTime: 1600000060000 })
	})

	it('sends no countdown for a part without an offset, which will probably not be played in order', () => {
		const result = toPartTiming(partTiming(), playlistTiming({ paused: true, duration: 60000 }))

		expect(result.countdown).toBeUndefined()
	})

	it("sends no countdown while the playlist's timing has not arrived", () => {
		expect(toPartTiming(partTiming({ countdownOffset: -30000 }), undefined).countdown).toBeUndefined()
	})

	it('sends no countdown from the timing of another playlist, still held after a switch of playlist', () => {
		const previousPlaylistTiming = playlistTiming(
			{ paused: true, duration: 60000 },
			protectString<RundownPlaylistId>('previousPlaylist')
		)

		const result = toPartTiming(partTiming({ countdownOffset: -30000 }), previousPlaylistTiming)

		expect(result.countdown).toBeUndefined()
	})

	it('sends the resolved durations, which are constant, and zeroes for those Sofie has not resolved', () => {
		expect(
			toPartTiming(
				partTiming({ expectedDuration: 10000, displayDuration: 12000, isInQuickLoop: true }),
				undefined
			)
		).toMatchObject({ expectedDurationMs: 10000, displayDurationMs: 12000, isInQuickLoop: true })

		expect(toPartTiming(partTiming(), undefined)).toMatchObject({ expectedDurationMs: 0, displayDurationMs: 0 })
	})
})
