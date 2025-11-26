import { TimeSync } from '../timeSync.js'

test('timeSync', async () => {
	const serverDiff = -5000

	const getServerTime = jest.fn(async (): Promise<number> => {
		return new Promise<number>((resolve) => {
			// simulate delay to the server:
			setTimeout(() => {
				const serverTime = Date.now() + serverDiff // simulate that the server is 5 seconds ahead
				// simulate delay back from the server:
				setTimeout(() => {
					resolve(serverTime)
				}, 5)
			}, 5)
		})
	})

	const ts = new TimeSync({}, getServerTime)

	const syncPossible = await ts.init()

	expect(syncPossible).toEqual(true)
	expect(getServerTime).toHaveBeenCalledTimes(4)

	expect(ts.quality).toBeLessThanOrEqual(20)
	expect(Math.abs(-5000 - ts.diff)).toBeLessThan(10)
	expect(Math.abs(ts.currentTime() - (Date.now() + serverDiff))).toBeLessThan(5)

	ts.stop()
})
