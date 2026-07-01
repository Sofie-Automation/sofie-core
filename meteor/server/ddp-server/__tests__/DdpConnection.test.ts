import { makeDdpConnection } from '../DdpConnection'

function fakeRequest(headers: Record<string, any>, remoteAddress?: string): any {
	return { headers, socket: { remoteAddress } }
}

describe('makeDdpConnection', () => {
	test('exposes a random id and the raw http headers (for auth)', () => {
		const headers = { dnt: 'gateway', 'x-custom': 'v' }
		const { connection } = makeDdpConnection(fakeRequest(headers, '127.0.0.1'), () => undefined)

		expect(typeof connection.id).toBe('string')
		expect(connection.id.length).toBeGreaterThan(0)
		expect(connection.httpHeaders).toBe(headers)
	})

	test('derives clientAddress from X-Forwarded-For, falling back to the socket address', () => {
		const fromXff = makeDdpConnection(
			fakeRequest({ 'x-forwarded-for': '203.0.113.1, 10.0.0.1' }, '127.0.0.1'),
			() => undefined
		).connection
		expect(fromXff.clientAddress).toBe('203.0.113.1')

		const fromSocket = makeDdpConnection(fakeRequest({}, '198.51.100.7'), () => undefined).connection
		expect(fromSocket.clientAddress).toBe('198.51.100.7')

		const unknown = makeDdpConnection(fakeRequest({}, undefined), () => undefined).connection
		expect(unknown.clientAddress).toBe('unknown')
	})

	test('close() asks the owner to close', () => {
		const requestClose = jest.fn()
		const { connection } = makeDdpConnection(fakeRequest({}, '127.0.0.1'), requestClose)
		connection.close()
		expect(requestClose).toHaveBeenCalledTimes(1)
	})

	test('fireClose runs all onClose callbacks in order, even if one throws', () => {
		const { connection, fireClose } = makeDdpConnection(fakeRequest({}, '127.0.0.1'), () => undefined)
		const order: number[] = []
		connection.onClose(() => order.push(1))
		connection.onClose(() => {
			order.push(2)
			throw new Error('boom')
		})
		connection.onClose(() => order.push(3))

		expect(() => fireClose()).not.toThrow()
		expect(order).toEqual([1, 2, 3])
	})

	test('fireClose is idempotent (callbacks fire at most once)', () => {
		const { connection, fireClose } = makeDdpConnection(fakeRequest({}, '127.0.0.1'), () => undefined)
		const cb = jest.fn()
		connection.onClose(cb)
		fireClose()
		fireClose()
		expect(cb).toHaveBeenCalledTimes(1)
	})

	test('an onClose registered after close fires on the next microtask', async () => {
		const { connection, fireClose } = makeDdpConnection(fakeRequest({}, '127.0.0.1'), () => undefined)
		fireClose()

		const cb = jest.fn()
		connection.onClose(cb)
		expect(cb).not.toHaveBeenCalled() // not synchronously
		await Promise.resolve()
		expect(cb).toHaveBeenCalledTimes(1)
	})
})
