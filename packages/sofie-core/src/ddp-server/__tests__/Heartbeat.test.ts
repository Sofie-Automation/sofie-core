import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { Heartbeat } from '../Heartbeat'

describe('Heartbeat', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	function setup() {
		const sendPing = vi.fn()
		const onTimeout = vi.fn()
		const hb = new Heartbeat({ heartbeatInterval: 1000, heartbeatTimeout: 500, onTimeout, sendPing })
		return { hb, sendPing, onTimeout }
	}

	test('sends a ping when an interval elapses with no traffic', () => {
		const { hb, sendPing } = setup()
		hb.start()
		expect(sendPing).not.toHaveBeenCalled()

		vi.advanceTimersByTime(1000)
		expect(sendPing).toHaveBeenCalledTimes(1)
		hb.stop()
	})

	test('a received message suppresses the next ping', () => {
		const { hb, sendPing } = setup()
		hb.start()

		hb.messageReceived() // traffic seen this interval
		vi.advanceTimersByTime(1000)
		expect(sendPing).not.toHaveBeenCalled() // no ping needed

		vi.advanceTimersByTime(1000) // next interval, still no traffic
		expect(sendPing).toHaveBeenCalledTimes(1)
		hb.stop()
	})

	test('fires onTimeout if no message arrives after a ping', () => {
		const { hb, onTimeout } = setup()
		hb.start()

		vi.advanceTimersByTime(1000) // interval -> ping + arm timeout
		expect(onTimeout).not.toHaveBeenCalled()

		vi.advanceTimersByTime(500) // timeout elapses with no traffic
		expect(onTimeout).toHaveBeenCalledTimes(1)
		hb.stop()
	})

	test('a message received after a ping cancels the timeout', () => {
		const { hb, onTimeout } = setup()
		hb.start()

		vi.advanceTimersByTime(1000) // ping + arm timeout
		hb.messageReceived() // client responded in time
		vi.advanceTimersByTime(500)
		expect(onTimeout).not.toHaveBeenCalled()
		hb.stop()
	})

	test('stop() prevents any further pings or timeouts', () => {
		const { hb, sendPing, onTimeout } = setup()
		hb.start()
		hb.stop()

		vi.advanceTimersByTime(10000)
		expect(sendPing).not.toHaveBeenCalled()
		expect(onTimeout).not.toHaveBeenCalled()
	})
})
