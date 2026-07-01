import { DdpPublicationContext, SessionPublicationApi } from '../DdpPublicationContext'

function fakeSession() {
	const calls: any[][] = []
	const api: SessionPublicationApi = {
		connection: null,
		mergeAdded: (_h, c, id, f) => calls.push(['added', c, id, f]),
		mergeChanged: (_h, c, id, f) => calls.push(['changed', c, id, f]),
		mergeRemoved: (_h, c, id) => calls.push(['removed', c, id]),
		sendReady: (subId) => calls.push(['ready', subId]),
	}
	return { calls, api }
}

describe('DdpPublicationContext', () => {
	test('routes added/changed through the merge box and removes tracked docs on stop', () => {
		const { calls, api } = fakeSession()
		const ctx = new DdpPublicationContext(api, 's1', 'N-s1', 'pub')

		ctx.added('C', 'a', { x: 1 })
		ctx.added('C', 'b', { x: 2 })
		ctx.changed('C', 'a', { x: 9 })
		calls.length = 0

		ctx.stop()
		// both still-present docs are removed from the merge box (order not asserted)
		expect(calls).toContainEqual(['removed', 'C', 'a'])
		expect(calls).toContainEqual(['removed', 'C', 'b'])
		expect(calls).toHaveLength(2)
	})

	test('a doc explicitly removed is not removed again on stop', () => {
		const { calls, api } = fakeSession()
		const ctx = new DdpPublicationContext(api, 's1', 'N-s1', 'pub')
		ctx.added('C', 'a', { x: 1 })
		ctx.removed('C', 'a')
		calls.length = 0

		ctx.stop()
		expect(calls).toHaveLength(0)
	})

	test('ready() sends exactly once and flips isReady', () => {
		const { calls, api } = fakeSession()
		const ctx = new DdpPublicationContext(api, 's1', 'N-s1', 'pub')

		expect(ctx.isReady).toBe(false)
		ctx.ready()
		ctx.ready()
		expect(ctx.isReady).toBe(true)
		expect(calls.filter((c) => c[0] === 'ready')).toEqual([['ready', 's1']])
	})

	test('onStop callbacks run in order on stop, and a throwing one does not block the others', () => {
		const { api } = fakeSession()
		const ctx = new DdpPublicationContext(api, 's1', 'N-s1', 'pub')
		const order: number[] = []
		ctx.onStop(() => order.push(1))
		ctx.onStop(() => {
			order.push(2)
			throw new Error('boom')
		})
		ctx.onStop(() => order.push(3))

		expect(() => ctx.stop()).not.toThrow()
		expect(order).toEqual([1, 2, 3])
	})

	test('stop() is idempotent', () => {
		const { api } = fakeSession()
		const ctx = new DdpPublicationContext(api, 's1', 'N-s1', 'pub')
		const cb = jest.fn()
		ctx.onStop(cb)
		ctx.stop()
		ctx.stop()
		expect(cb).toHaveBeenCalledTimes(1)
	})

	test('an onStop registered after stop fires on the next microtask', async () => {
		const { api } = fakeSession()
		const ctx = new DdpPublicationContext(api, 's1', 'N-s1', 'pub')
		ctx.stop()

		const cb = jest.fn()
		ctx.onStop(cb)
		expect(cb).not.toHaveBeenCalled()
		await Promise.resolve()
		expect(cb).toHaveBeenCalledTimes(1)
	})

	test('added/changed/removed are no-ops after stop', () => {
		const { calls, api } = fakeSession()
		const ctx = new DdpPublicationContext(api, 's1', 'N-s1', 'pub')
		ctx.stop()
		calls.length = 0

		ctx.added('C', 'a', { x: 1 })
		ctx.changed('C', 'a', { x: 2 })
		ctx.removed('C', 'a')
		expect(calls).toHaveLength(0)
	})
})
