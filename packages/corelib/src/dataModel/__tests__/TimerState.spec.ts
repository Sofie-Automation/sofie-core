import { type TimerState, timerStateToDuration, timerStateToZeroTime } from '../TimerState.js'

/**
 * A TimerState is a piecewise-linear function of wall-clock time with at most one breakpoint:
 * - a running timer counts down, and (with `pauseTime`) freezes at that point
 * - a paused timer is frozen, and (with `resumesAt`) starts counting down at that point
 *
 * Note there is no notion of direction: the value always *decreases* with time. Count-up timers
 * (freeRun) are represented in negative territory and negated by the display layer, so they need
 * no special handling here - see the "count-up (freeRun) timers" block below.
 *
 * These tests pin both readings (duration and zeroTime) of every shape, either side of the
 * breakpoint, since consumers rely on both.
 */
describe('TimerState', () => {
	describe('running (paused: false)', () => {
		const state: TimerState = { paused: false, zeroTime: 10000 }

		it('counts down towards zeroTime, and onwards into negative', () => {
			expect(timerStateToDuration(state, 4000)).toBe(6000)
			expect(timerStateToDuration(state, 10000)).toBe(0)
			expect(timerStateToDuration(state, 12000)).toBe(-2000)
		})

		it('has a constant zeroTime', () => {
			expect(timerStateToZeroTime(state, 4000)).toBe(10000)
			expect(timerStateToZeroTime(state, 12000)).toBe(10000)
		})
	})

	describe('running with a pauseTime', () => {
		// counts down to 10000, but freezes when the current part ends at 8000
		const state: TimerState = { paused: false, zeroTime: 10000, pauseTime: 8000 }

		it('counts down until pauseTime, then freezes', () => {
			expect(timerStateToDuration(state, 4000)).toBe(6000)
			expect(timerStateToDuration(state, 7999)).toBe(2001)
			// at and after the breakpoint, frozen at the value it had there
			expect(timerStateToDuration(state, 8000)).toBe(2000)
			expect(timerStateToDuration(state, 20000)).toBe(2000)
		})

		it('has a constant zeroTime until pauseTime, then pushes 1:1', () => {
			expect(timerStateToZeroTime(state, 4000)).toBe(10000)
			expect(timerStateToZeroTime(state, 7999)).toBe(10000)
			expect(timerStateToZeroTime(state, 8000)).toBe(10000)
			expect(timerStateToZeroTime(state, 9000)).toBe(11000)
			expect(timerStateToZeroTime(state, 20000)).toBe(22000)
		})

		it('is continuous at the breakpoint in both readings', () => {
			expect(timerStateToDuration(state, 8000)).toBe(timerStateToDuration(state, 7999) - 1)
			expect(timerStateToZeroTime(state, 8000)).toBe(timerStateToZeroTime(state, 7999))
		})

		it('behaves as fully frozen when the breakpoint is already long past', () => {
			const alreadyPushing: TimerState = { paused: false, zeroTime: 10000, pauseTime: 8000 }
			expect(timerStateToDuration(alreadyPushing, 500000)).toBe(2000)
			// zeroTime keeps pushing 1:1 with now
			expect(timerStateToZeroTime(alreadyPushing, 500000)).toBe(502000)
		})
	})

	describe('paused (paused: true)', () => {
		const state: TimerState = { paused: true, duration: 5000 }

		it('stays frozen at duration', () => {
			expect(timerStateToDuration(state, 0)).toBe(5000)
			expect(timerStateToDuration(state, 100000)).toBe(5000)
		})

		it('reports the zeroTime it would have if resumed now, so it pushes 1:1', () => {
			expect(timerStateToZeroTime(state, 0)).toBe(5000)
			expect(timerStateToZeroTime(state, 1000)).toBe(6000)
		})

		it('handles a zero duration', () => {
			const zero: TimerState = { paused: true, duration: 0 }
			expect(timerStateToDuration(zero, 4000)).toBe(0)
			expect(timerStateToZeroTime(zero, 4000)).toBe(4000)
		})
	})

	describe('paused with a resumesAt', () => {
		// frozen at 5000, scheduled to start running at 8000
		const state: TimerState = { paused: true, duration: 5000, resumesAt: 8000 }

		it('stays frozen until resumesAt, then counts down', () => {
			expect(timerStateToDuration(state, 0)).toBe(5000)
			expect(timerStateToDuration(state, 7999)).toBe(5000)
			// from the breakpoint it runs, reaching zero at resumesAt + duration
			expect(timerStateToDuration(state, 8000)).toBe(5000)
			expect(timerStateToDuration(state, 9000)).toBe(4000)
			expect(timerStateToDuration(state, 13000)).toBe(0)
			expect(timerStateToDuration(state, 14000)).toBe(-1000)
		})

		it('pushes 1:1 until resumesAt, then has a constant zeroTime', () => {
			expect(timerStateToZeroTime(state, 0)).toBe(5000)
			expect(timerStateToZeroTime(state, 7999)).toBe(12999)
			expect(timerStateToZeroTime(state, 8000)).toBe(13000)
			expect(timerStateToZeroTime(state, 9000)).toBe(13000)
			expect(timerStateToZeroTime(state, 20000)).toBe(13000)
		})

		it('is continuous at the breakpoint in both readings', () => {
			expect(timerStateToDuration(state, 8000)).toBe(timerStateToDuration(state, 7999))
			expect(timerStateToZeroTime(state, 8000)).toBe(timerStateToZeroTime(state, 7999) + 1)
		})

		it('behaves as fully running when the scheduled start is already long past', () => {
			expect(timerStateToDuration(state, 500000)).toBe(5000 - (500000 - 8000))
			expect(timerStateToZeroTime(state, 500000)).toBe(13000)
		})
	})

	/**
	 * `resumesAt` must produce exactly the trajectory that resuming at that instant would, so that
	 * a scheduled start needs no direction flag and no special-casing per timer mode.
	 * The immediate resume (see `resumeTTimer`) produces `{paused: false, zeroTime: duration + now}`.
	 */
	describe('resumesAt is equivalent to resuming at that instant', () => {
		function resumedAt(duration: number, resumeTime: number): TimerState {
			return { paused: false, zeroTime: duration + resumeTime }
		}

		it.each([
			['a countdown', 5000],
			['a zeroed countdown', 0],
			['a count-up (freeRun) timer, which sits in negative territory', -5000],
		])('matches an immediate resume for %s', (_label, duration) => {
			const resumeTime = 8000
			const scheduled: TimerState = { paused: true, duration, resumesAt: resumeTime }
			const resumed = resumedAt(duration, resumeTime)

			for (const t of [8000, 8001, 9000, 20000, 500000]) {
				expect(timerStateToDuration(scheduled, t)).toBe(timerStateToDuration(resumed, t))
				expect(timerStateToZeroTime(scheduled, t)).toBe(timerStateToZeroTime(resumed, t))
			}
		})
	})

	/**
	 * freeRun timers count upwards, which is represented by the value going negative
	 * (the display layer negates it - see `calculateTTimerDiff`).
	 */
	describe('count-up (freeRun) timers', () => {
		it('goes steadily more negative while running', () => {
			// started at 1000, so `zeroTime` is the start rather than an end
			const running: TimerState = { paused: false, zeroTime: 1000 }
			expect(timerStateToDuration(running, 1000)).toBe(0)
			expect(timerStateToDuration(running, 4000)).toBe(-3000)
			expect(timerStateToDuration(running, 9000)).toBe(-8000)
		})

		it('holds its elapsed value while paused', () => {
			// paused after 3s elapsed
			const paused: TimerState = { paused: true, duration: -3000 }
			expect(timerStateToDuration(paused, 4000)).toBe(-3000)
			expect(timerStateToDuration(paused, 90000)).toBe(-3000)
		})

		it('continues counting up from its elapsed value at a scheduled start', () => {
			const scheduled: TimerState = { paused: true, duration: -3000, resumesAt: 8000 }
			expect(timerStateToDuration(scheduled, 7999)).toBe(-3000)
			expect(timerStateToDuration(scheduled, 8000)).toBe(-3000)
			// 2s after the scheduled start it has accumulated 2s more
			expect(timerStateToDuration(scheduled, 10000)).toBe(-5000)
		})
	})

	describe('the inapplicable transition field is ignored', () => {
		it('ignores a null resumesAt on a running timer', () => {
			const state: TimerState = { paused: false, zeroTime: 10000, resumesAt: null }
			expect(timerStateToDuration(state, 4000)).toBe(6000)
			expect(timerStateToZeroTime(state, 4000)).toBe(10000)
		})

		it('ignores a null pauseTime on a paused timer', () => {
			const state: TimerState = { paused: true, duration: 5000, pauseTime: null }
			expect(timerStateToDuration(state, 4000)).toBe(5000)
			expect(timerStateToZeroTime(state, 4000)).toBe(9000)
		})
	})

	describe('breakpoint at timestamp 0', () => {
		// Unreachable in practice (these are unix-ms timestamps), but the two evaluators must at
		// least agree with each other on how they treat it.
		it('treats a pauseTime of 0 consistently across both readings', () => {
			const state: TimerState = { paused: false, zeroTime: 10000, pauseTime: 0 }
			// frozen since 0, so the duration is fixed at the value it had then
			expect(timerStateToDuration(state, 4000)).toBe(10000)
			// and the zeroTime pushes 1:1 from there
			expect(timerStateToZeroTime(state, 4000)).toBe(14000)
		})

		it('treats a resumesAt of 0 consistently across both readings', () => {
			const state: TimerState = { paused: true, duration: 5000, resumesAt: 0 }
			// running since 0
			expect(timerStateToDuration(state, 4000)).toBe(1000)
			expect(timerStateToZeroTime(state, 4000)).toBe(5000)
		})
	})
})
