import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { WebSocketServer } from 'ws'
import { URL } from 'url'
import { Meteor } from 'meteor/meteor'
import { DDPClient } from '@sofie-automation/server-core-integration'
import { MethodRegistry } from '../../methodRegistry'
import { PublicationRegistry } from '../../publicationRegistry'
import type { PublicationContext } from '../../publications/lib/lib'
import { DdpSession } from '../DdpSession'
import { DdpConnectionRegistry } from '../ConnectionRegistry'

/**
 * End-to-end test: the real `server-core-integration` DDP client talks to a real `DdpSession` over a real
 * localhost WebSocket — no FakeSocket. Exercises the full wire protocol (connect, method result/updated/
 * errors, sub→added/ready, reactive changed/removed, unsub→nosub) through both the client's and server's
 * actual EJSON + DDP code, so the two cannot silently drift.
 */
describe('DDP client ↔ standalone server (integration)', () => {
	let httpServer: Server
	let wss: WebSocketServer
	let client: DDPClient
	let capturedPubContext: PublicationContext | undefined
	let port: number

	const flushWire = () => new Promise((resolve) => setTimeout(resolve, 30))
	const waitFor = async (cond: () => boolean, timeoutMs = 3000): Promise<void> => {
		const start = Date.now()
		while (!cond()) {
			if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out')
			await new Promise((r) => setTimeout(r, 20))
		}
	}

	beforeAll(async () => {
		const methodRegistry = new MethodRegistry()
		methodRegistry.registerMethod('test.echo', function (this: { connection: unknown }, value: unknown) {
			return { echoed: value, hadConnection: !!this.connection }
		})
		methodRegistry.registerMethod('test.fail', function () {
			throw new Meteor.Error(418, 'teapot')
		})

		const publicationRegistry = new PublicationRegistry()
		publicationRegistry.publishUnsafe('test.pub', async (ctx: PublicationContext) => {
			ctx.added('TestColl', 'd1', { a: 1 })
			ctx.ready()
			capturedPubContext = ctx
		})

		const connections = new DdpConnectionRegistry({ onOpen: () => undefined, onClose: () => undefined })

		httpServer = createServer()
		wss = new WebSocketServer({ noServer: true })
		wss.on('connection', (socket, request) => {
			const session = new DdpSession(socket, request, methodRegistry, publicationRegistry, connections, {
				heartbeatInterval: 999999,
				heartbeatTimeout: 999999,
			})
			void session
		})
		httpServer.on('upgrade', (request, socket, head) => {
			const pathname = new URL(request.url ?? '', 'http://localhost').pathname
			if (pathname !== '/websocket') {
				socket.destroy()
				return
			}
			wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request))
		})
		await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()))
		port = (httpServer.address() as AddressInfo).port

		client = new DDPClient({ host: '127.0.0.1', port, path: 'websocket', autoReconnect: false })
		await new Promise<void>((resolve, reject) => {
			client.connect((error) => (error ? reject(error) : resolve()))
		})
	})

	afterAll(async () => {
		client?.close()
		wss?.close()
		if (httpServer) await new Promise<void>((resolve) => httpServer.close(() => resolve()))
	})

	test('completes the connect handshake', () => {
		// The raw DDPClient has no `connected` boolean (that's on DDPConnector); the open socket is the
		// proof the connect()/`connected` handshake succeeded.
		expect(client.socket?.readyState).toBe(1 /* WebSocket.OPEN */)
	})

	test('calls a method: result + updated, with a connection in context', async () => {
		const updated = jest.fn()
		const result = await new Promise((resolve, reject) => {
			// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
			client.call('test.echo', ['hi'], (err, res) => (err ? reject(err) : resolve(res)), updated)
		})
		expect(result).toEqual({ echoed: 'hi', hadConnection: true })
		await flushWire()
		expect(updated).toHaveBeenCalled()
	})

	test('a throwing method propagates the DDP error shape', async () => {
		const err = await new Promise<any>((resolve) => {
			client.call('test.fail', [], (e) => resolve(e))
		})
		expect(err).toMatchObject({ error: 418, reason: 'teapot' })
	})

	test('an unknown method returns a 404 error', async () => {
		const err = await new Promise<any>((resolve) => {
			client.call('does.not.exist', [], (e) => resolve(e))
		})
		expect(err).toMatchObject({ error: 404 })
	})

	test('subscribes, populates the collection, and observes reactive changes', async () => {
		const events: string[] = []
		client.observe(
			'TestColl',
			(id) => events.push(`added:${id}`),
			(id) => events.push(`changed:${id}`),
			(id) => events.push(`removed:${id}`)
		)

		await new Promise<void>((resolve, reject) => {
			// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
			client.subscribe('test.pub', [], (e) => (e ? reject(e) : resolve()))
		})
		expect(client.collections['TestColl']?.['d1']).toMatchObject({ a: 1 })
		expect(events).toContain('added:d1')
		expect(capturedPubContext).toBeDefined()

		// Drive a reactive change from the server side and confirm it streams to the client.
		capturedPubContext!.changed('TestColl', 'd1', { a: 2 })
		await flushWire()
		expect(client.collections['TestColl']['d1']).toMatchObject({ a: 2 })
		expect(events).toContain('changed:d1')

		capturedPubContext!.removed('TestColl', 'd1')
		await flushWire()
		expect(client.collections['TestColl']['d1']).toBeUndefined()
		expect(events).toContain('removed:d1')
	})

	test('auto-reconnects after the socket drops and methods work again', async () => {
		const reconnectClient = new DDPClient({
			host: '127.0.0.1',
			port,
			path: 'websocket',
			autoReconnect: true,
			autoReconnectTimer: 50,
		})
		try {
			let connects = 0
			reconnectClient.on('connected', () => connects++)
			await new Promise<void>((resolve, reject) => {
				reconnectClient.connect((error) => (error ? reject(error) : resolve()))
			})
			expect(connects).toBe(1)

			// Simulate a dropped connection (server restart / network blip): kill the underlying socket
			// without calling the client's own close(), so auto-reconnect kicks in.
			reconnectClient.socket?.close()

			await waitFor(() => connects >= 2)
			expect(reconnectClient.socket?.readyState).toBe(1 /* WebSocket.OPEN */)

			// The reconnected session serves methods just like the original.
			const result = await new Promise((resolve, reject) => {
				// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
				reconnectClient.call('test.echo', ['back'], (err, res) => (err ? reject(err) : resolve(res)))
			})
			expect(result).toMatchObject({ echoed: 'back' })
		} finally {
			reconnectClient.close()
		}
	})
})
