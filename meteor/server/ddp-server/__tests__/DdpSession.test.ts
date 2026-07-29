import { EventEmitter } from 'events'
import { MethodRegistry } from '../../methodRegistry'
import { PublicationRegistry } from '../../publicationRegistry'
import { DdpSession } from '../DdpSession'
import { DdpConnectionRegistry } from '../ConnectionRegistry'
import { ServerMessage } from '@sofie-automation/shared-lib/dist/ddp/messageTypes'
import { makeDdpConnection } from '../DdpConnection'
import { SofieError } from '@sofie-automation/corelib/dist/error'

/** A minimal stand-in for a `ws` WebSocket that records sent messages and lets tests inject frames. */
class FakeSocket extends EventEmitter {
	readyState = 1 // WebSocket.OPEN
	sent: ServerMessage[] = []

	send(data: string): void {
		this.sent.push(JSON.parse(data) as ServerMessage)
	}
	close(): void {
		this.readyState = 3 // CLOSED
		this.emit('close')
	}

	/** Simulate the client sending a message (as a Buffer, like real `ws`). */
	receive(msg: unknown): void {
		this.emit('message', Buffer.from(JSON.stringify(msg)))
	}
}

const flush = () => new Promise((resolve) => setImmediate(resolve))

describe('DdpSession', () => {
	const openSessions: DdpSession[] = []

	function setup() {
		const registry = new MethodRegistry()
		registry.registerMethod('test.echo', function (this: { connection: unknown }, value: unknown) {
			return { echoed: value, hadConnection: !!this.connection }
		})
		registry.registerMethod('test.fail', function () {
			throw new SofieError(418, 'teapot')
		})

		const publications = new PublicationRegistry()
		const connections = new DdpConnectionRegistry({ onOpen: () => undefined, onClose: () => undefined })
		const socket = new FakeSocket()
		const request = { headers: {}, socket: { remoteAddress: '127.0.0.1' } }
		const session = new DdpSession(socket as any, request as any, registry, publications, connections, {
			heartbeatInterval: 999999,
			heartbeatTimeout: 999999,
		})
		openSessions.push(session)
		return { registry, publications, connections, socket, session }
	}

	afterEach(() => {
		// stop heartbeat timers so jest can exit cleanly
		while (openSessions.length) openSessions.pop()?.close()
	})

	test('connect handshake replies connected', () => {
		const { socket, connections } = setup()
		socket.receive({ msg: 'connect', version: '1', support: ['1'] })
		expect(socket.sent).toEqual([{ msg: 'connected', session: expect.any(String) }])
		expect(connections.size).toBe(1)
	})

	test('unsupported version is rejected with failed', () => {
		const { socket } = setup()
		socket.receive({ msg: 'connect', version: '99' })
		expect(socket.sent).toEqual([{ msg: 'failed', version: '1' }])
	})

	test('a message before connect is an error', () => {
		const { socket } = setup()
		socket.receive({ msg: 'method', id: 'm', method: 'test.echo' })
		expect(socket.sent[0]).toMatchObject({ msg: 'error', reason: 'Must connect first' })
	})

	test('ping is answered with pong (preserving id)', () => {
		const { socket } = setup()
		socket.receive({ msg: 'connect', version: '1' })
		socket.sent.length = 0
		socket.receive({ msg: 'ping', id: 'p1' })
		expect(socket.sent).toEqual([{ msg: 'pong', id: 'p1' }])
	})

	test('a successful method sends result then updated', async () => {
		const { socket } = setup()
		socket.receive({ msg: 'connect', version: '1' })
		socket.sent.length = 0
		socket.receive({ msg: 'method', id: 'm1', method: 'test.echo', params: ['hi'] })
		await flush()
		expect(socket.sent).toEqual([
			{ msg: 'result', id: 'm1', result: { echoed: 'hi', hadConnection: true } },
			{ msg: 'updated', methods: ['m1'] },
		])
	})

	test('a throwing method maps SofieError to the DDP error shape', async () => {
		const { socket } = setup()
		socket.receive({ msg: 'connect', version: '1' })
		socket.sent.length = 0
		socket.receive({ msg: 'method', id: 'm2', method: 'test.fail' })
		await flush()
		expect(socket.sent[0]).toMatchObject({
			msg: 'result',
			id: 'm2',
			error: { error: 418, reason: 'teapot', errorType: 'Meteor.Error' },
		})
		expect(socket.sent[1]).toEqual({ msg: 'updated', methods: ['m2'] })
	})

	describe('permissions header', () => {
		const ENV_KEYS = ['SOFIE_ENABLE_HEADER_AUTH', 'SOFIE_PERMISSIONS_HEADER'] as const
		const originalEnv: Record<string, string | undefined> = {}

		beforeAll(() => {
			for (const key of ENV_KEYS) originalEnv[key] = process.env[key]
		})
		afterAll(() => {
			for (const key of ENV_KEYS) {
				if (originalEnv[key] === undefined) delete process.env[key]
				else process.env[key] = originalEnv[key]
			}
			jest.resetModules()
		})

		/**
		 * `auth.ts` reads its env vars once, at import time, so each case re-imports it with the env it wants.
		 */
		function loadAuth(
			env: Partial<Record<(typeof ENV_KEYS)[number], string>>
		): typeof import('../../security/auth') {
			for (const key of ENV_KEYS) delete process.env[key]
			Object.assign(process.env, env)
			jest.resetModules()
			return require('../../security/auth')
		}

		/** Header names arrive lowercased from node's http parser. */
		function connectionWithHeaders(headers: Record<string, string>) {
			return makeDdpConnection({ headers, socket: { remoteAddress: '127.0.0.1' } } as any, () => undefined)
				.connection
		}

		test('the raw request headers reach auth, which reads the configured permissions header', () => {
			const { parseConnectionPermissions } = loadAuth({ SOFIE_ENABLE_HEADER_AUTH: '1' })
			// Headers pass through untouched; auth reads USER_PERMISSIONS_HEADER (default `dnt`).
			expect(parseConnectionPermissions(connectionWithHeaders({ dnt: 'gateway' })).gateway).toBe(true)
		})

		test('a request without the permissions header grants nothing', () => {
			const { parseConnectionPermissions } = loadAuth({ SOFIE_ENABLE_HEADER_AUTH: 'true' })
			const permissions = parseConnectionPermissions(connectionWithHeaders({ 'x-unrelated': 'admin' }))
			expect(permissions.gateway).toBe(false)
			expect(permissions.configure).toBe(false)
			expect(permissions.studio).toBe(false)
		})

		test('the header name is configurable via SOFIE_PERMISSIONS_HEADER', () => {
			const { parseConnectionPermissions } = loadAuth({
				SOFIE_ENABLE_HEADER_AUTH: '1',
				SOFIE_PERMISSIONS_HEADER: 'X-Sofie-Permissions', // lowercased by auth.ts to match node's headers
			})
			expect(
				parseConnectionPermissions(connectionWithHeaders({ 'x-sofie-permissions': 'gateway' })).gateway
			).toBe(true)
			// The default header is no longer consulted once overridden.
			expect(parseConnectionPermissions(connectionWithHeaders({ dnt: 'gateway' })).gateway).toBe(false)
		})

		test('with SOFIE_ENABLE_HEADER_AUTH unset, everything is granted and headers are ignored', () => {
			const { parseConnectionPermissions } = loadAuth({})
			expect(parseConnectionPermissions(connectionWithHeaders({}))).toEqual({
				studio: true,
				configure: true,
				developer: true,
				testing: true,
				service: true,
				gateway: true,
			})
		})
	})

	test('an unknown method returns a 404 result', async () => {
		const { socket } = setup()
		socket.receive({ msg: 'connect', version: '1' })
		socket.sent.length = 0
		socket.receive({ msg: 'method', id: 'm3', method: 'does.not.exist' })
		await flush()
		expect(socket.sent[0]).toMatchObject({ msg: 'result', id: 'm3', error: { error: 404 } })
	})

	describe('publications', () => {
		test('an unknown publication replies nosub 404', async () => {
			const { socket } = setup()
			socket.receive({ msg: 'connect', version: '1' })
			socket.sent.length = 0
			socket.receive({ msg: 'sub', id: 's1', name: 'doesNotExist' })
			await flush()
			expect(socket.sent[0]).toMatchObject({ msg: 'nosub', id: 's1', error: { error: 404 } })
		})

		test('a custom publication sends added then ready', async () => {
			const { publications, socket } = setup()
			publications.publishUnsafe('test.custom', async (ctx) => {
				ctx.added('TestCollection', 'doc1', { a: 1 })
				ctx.ready()
			})
			socket.receive({ msg: 'connect', version: '1' })
			socket.sent.length = 0
			socket.receive({ msg: 'sub', id: 's1', name: 'test.custom' })
			await flush()
			expect(socket.sent).toEqual([
				{ msg: 'added', collection: 'TestCollection', id: 'doc1', fields: { a: 1 } },
				{ msg: 'ready', subs: ['s1'] },
			])
		})

		test('unsubscribing removes the documents and replies nosub', async () => {
			const { publications, socket } = setup()
			publications.publishUnsafe('test.custom', async (ctx) => {
				ctx.added('TestCollection', 'doc1', { a: 1 })
				ctx.ready()
			})
			socket.receive({ msg: 'connect', version: '1' })
			socket.receive({ msg: 'sub', id: 's1', name: 'test.custom' })
			await flush()
			socket.sent.length = 0
			socket.receive({ msg: 'unsub', id: 's1' })
			await flush()
			expect(socket.sent).toEqual([
				{ msg: 'removed', collection: 'TestCollection', id: 'doc1' },
				{ msg: 'nosub', id: 's1' },
			])
		})

		test('a duplicate unsub does not send a second nosub', async () => {
			const { publications, socket } = setup()
			publications.publishUnsafe('test.custom', async (ctx) => {
				ctx.added('TestCollection', 'doc1', { a: 1 })
				ctx.ready()
			})
			socket.receive({ msg: 'connect', version: '1' })
			socket.receive({ msg: 'sub', id: 's1', name: 'test.custom' })
			await flush()
			socket.receive({ msg: 'unsub', id: 's1' })
			await flush()
			socket.sent.length = 0

			// Unsubscribing an already-stopped subscription is a no-op (no second nosub).
			socket.receive({ msg: 'unsub', id: 's1' })
			await flush()
			expect(socket.sent).toEqual([])
		})

		test('a cursor with no collection name cannot be published (nosub 500)', async () => {
			const { publications, socket } = setup()
			publications.publishUnsafe('test.cursorNull', async () => ({
				collectionName: null,
				observeChangesAsync: () => Promise.resolve({ stop: () => undefined }),
			}))
			socket.receive({ msg: 'connect', version: '1' })
			socket.sent.length = 0
			socket.receive({ msg: 'sub', id: 's1', name: 'test.cursorNull' })
			await flush()
			expect(socket.sent[0]).toMatchObject({ msg: 'nosub', id: 's1', error: { error: 500 } })
		})

		test('a cursor publication (Mongo-branch shape) observes and forwards changes, stopping on unsub', async () => {
			const { publications, socket } = setup()
			// Mimic `feat/replace-meteor-mongo`'s cursor: a `collectionName` plus an `observeChangesAsync`
			// that emits the initial set synchronously and lets the test drive later changes.
			let emit: any
			let stopped = false
			publications.publishUnsafe('test.cursorLive', async () => ({
				collectionName: 'TestCollection',
				observeChangesAsync: (callbacks: any) => {
					emit = callbacks
					callbacks.added('doc1', { a: 1 })
					return Promise.resolve({ stop: () => (stopped = true) })
				},
			}))
			socket.receive({ msg: 'connect', version: '1' })
			socket.sent.length = 0
			socket.receive({ msg: 'sub', id: 's1', name: 'test.cursorLive' })
			await flush()
			expect(socket.sent).toEqual([
				{ msg: 'added', collection: 'TestCollection', id: 'doc1', fields: { a: 1 } },
				{ msg: 'ready', subs: ['s1'] },
			])

			// A later change from the observer is forwarded reactively.
			socket.sent.length = 0
			emit.changed('doc1', { a: 2 })
			expect(socket.sent).toEqual([
				{ msg: 'changed', collection: 'TestCollection', id: 'doc1', fields: { a: 2 } },
			])

			// Unsubscribing stops the observe handle and removes the document.
			socket.sent.length = 0
			socket.receive({ msg: 'unsub', id: 's1' })
			await flush()
			expect(stopped).toBe(true)
			expect(socket.sent).toEqual([
				{ msg: 'removed', collection: 'TestCollection', id: 'doc1' },
				{ msg: 'nosub', id: 's1' },
			])
		})

		test('a field changed to undefined is sent as DDP `cleared`, not a JSON undefined', async () => {
			const { publications, socket } = setup()
			let emit: any
			publications.publishUnsafe('test.clear', async () => ({
				collectionName: 'C',
				observeChangesAsync: (callbacks: any) => {
					emit = callbacks
					callbacks.added('d1', { a: 1, b: 2 })
					return Promise.resolve({ stop: () => undefined })
				},
			}))
			socket.receive({ msg: 'connect', version: '1' })
			socket.receive({ msg: 'sub', id: 's1', name: 'test.clear' })
			await flush()

			// The publication reports `a` as removed (the diff convention: deleted field => undefined).
			socket.sent.length = 0
			emit.changed('d1', { a: undefined })
			expect(socket.sent).toEqual([{ msg: 'changed', collection: 'C', id: 'd1', cleared: ['a'] }])
		})

		test('overlapping subscriptions are merged — the client sees a single added', async () => {
			const { publications, socket } = setup()
			// Two publications that publish the same (collection, id).
			publications.publishUnsafe('test.a', async (ctx) => {
				ctx.added('Shared', 'x', { a: 1 })
				ctx.ready()
			})
			publications.publishUnsafe('test.b', async (ctx) => {
				ctx.added('Shared', 'x', { a: 1 })
				ctx.ready()
			})
			socket.receive({ msg: 'connect', version: '1' })
			socket.sent.length = 0
			socket.receive({ msg: 'sub', id: 's1', name: 'test.a' })
			await flush()
			socket.receive({ msg: 'sub', id: 's2', name: 'test.b' })
			await flush()

			const addedForX = socket.sent.filter((m) => m.msg === 'added' && (m as any).id === 'x')
			expect(addedForX).toHaveLength(1)
			// Both subscriptions still became ready.
			expect(socket.sent.filter((m) => m.msg === 'ready')).toHaveLength(2)
		})
	})

	describe('debug data', () => {
		test('the registry reports the live subscriptions and merged document counts', async () => {
			const { publications, socket, connections } = setup()
			publications.publishUnsafe('test.a', async (ctx) => {
				ctx.added('Shared', 'x', { a: 1 })
				ctx.added('Other', 'y', { a: 1 })
				ctx.ready()
			})
			// Publishes the same document as test.a, so the merge box holds it only once.
			publications.publishUnsafe('test.b', async (ctx) => {
				ctx.added('Shared', 'x', { a: 1 })
				ctx.ready()
			})
			socket.receive({ msg: 'connect', version: '1' })
			socket.receive({ msg: 'sub', id: 's1', name: 'test.a' })
			socket.receive({ msg: 'sub', id: 's2', name: 'test.b' })
			await flush()

			expect(connections.getDebugData()).toEqual([
				{
					id: expect.any(String),
					clientAddress: '127.0.0.1',
					mergedDocumentCount: 2,
					subscriptions: [
						{ name: 'test.a', documents: { Shared: 1, Other: 1 } },
						{ name: 'test.b', documents: { Shared: 1 } },
					],
				},
			])

			socket.receive({ msg: 'unsub', id: 's2' })
			await flush()

			expect(connections.getDebugData()[0]).toMatchObject({
				mergedDocumentCount: 2,
				subscriptions: [{ name: 'test.a', documents: { Shared: 1, Other: 1 } }],
			})
		})

		test('a closed session is no longer reported', () => {
			const { socket, session, connections } = setup()
			socket.receive({ msg: 'connect', version: '1' })
			expect(connections.getDebugData()).toHaveLength(1)

			session.close()
			expect(connections.getDebugData()).toHaveLength(0)
		})
	})

	test('an async method unblocks so it does not head-of-line block the next method', async () => {
		// Sofie's method wrapper calls this.unblock() as soon as a method returns a promise (the
		// historical "Meteor 2.7" behaviour), so a slow async method lets the next one start.
		const { registry, socket } = setup()
		const order: string[] = []
		registry.registerMethod('test.slow', async function () {
			await new Promise((r) => setTimeout(r, 20))
			order.push('slow')
		})
		registry.registerMethod('test.fast', function () {
			order.push('fast')
		})
		socket.receive({ msg: 'connect', version: '1' })
		socket.receive({ msg: 'method', id: 'a', method: 'test.slow' })
		socket.receive({ msg: 'method', id: 'b', method: 'test.fast' })
		await new Promise((r) => setTimeout(r, 60))
		expect(order).toEqual(['fast', 'slow'])
	})
})
