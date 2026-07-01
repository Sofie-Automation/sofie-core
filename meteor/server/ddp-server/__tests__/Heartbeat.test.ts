import { Heartbeat } from '../Heartbeat'

describe('Heartbeat', () => {
	beforeEach(() => jest.useFakeTimers())
	afterEach(() => jest.useRealTimers())

	function setup() {
		const sendPing = jest.fn()
		const onTimeout = jest.fn()
		const hb = new Heartbeat({ heartbeatInterval: 1000, heartbeatTimeout: 500, onTimeout, sendPing })
		return { hb, sendPing, onTimeout }
	}

	test('sends a ping when an interval elapses with no traffic', () => {
		const { hb, sendPing } = setup()
		hb.start()
		expect(sendPing).not.toHaveBeenCalled()

		jest.advanceTimersByTime(1000)
		expect(sendPing).toHaveBeenCalledTimes(1)
		hb.stop()
	})

	test('a received message suppresses the next ping', () => {
		const { hb, sendPing } = setup()
		hb.start()

		hb.messageReceived() // traffic seen this interval
		jest.advanceTimersByTime(1000)
		expect(sendPing).not.toHaveBeenCalled() // no ping needed

		jest.advanceTimersByTime(1000) // next interval, still no traffic
		expect(sendPing).toHaveBeenCalledTimes(1)
		hb.stop()
	})

	test('fires onTimeout if no message arrives after a ping', () => {
		const { hb, onTimeout } = setup()
		hb.start()

		jest.advanceTimersByTime(1000) // interval -> ping + arm timeout
		expect(onTimeout).not.toHaveBeenCalled()

		jest.advanceTimersByTime(500) // timeout elapses with no traffic
		expect(onTimeout).toHaveBeenCalledTimes(1)
		hb.stop()
	})

	test('a message received after a ping cancels the timeout', () => {
		const { hb, onTimeout } = setup()
		hb.start()

		jest.advanceTimersByTime(1000) // ping + arm timeout
		hb.messageReceived() // client responded in time
		jest.advanceTimersByTime(500)
		expect(onTimeout).not.toHaveBeenCalled()
		hb.stop()
	})

	test('stop() prevents any further pings or timeouts', () => {
		const { hb, sendPing, onTimeout } = setup()
		hb.start()
		hb.stop()

		jest.advanceTimersByTime(10000)
		expect(sendPing).not.toHaveBeenCalled()
		expect(onTimeout).not.toHaveBeenCalled()
	})
})
