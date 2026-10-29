import { projectedZeroTime } from '../timerState.js'

describe('projectedZeroTime', () => {
	const now = 1600000059000
	const duration = 10000

	it('projects a paused timer that resumes later from when it resumes', () => {
		const resumesAt = now + 1000

		expect(projectedZeroTime({ paused: true, duration, resumesAt }, now)).toBe(resumesAt + duration)
	})

	it('projects a paused timer that resumed earlier from when it resumed', () => {
		const resumesAt = now - 1000

		expect(projectedZeroTime({ paused: true, duration, resumesAt }, now)).toBe(resumesAt + duration)
	})

	it('projects a paused timer with no scheduled start as if it resumed now', () => {
		expect(projectedZeroTime({ paused: true, duration }, now)).toBe(now + duration)
	})

	it('projects a running timer at its zero time', () => {
		const zeroTime = now + duration

		expect(projectedZeroTime({ paused: false, zeroTime }, now)).toBe(zeroTime)
	})
})
