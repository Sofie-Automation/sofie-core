import { WebSocket, RawData } from 'ws'
import type { IncomingMessage } from 'http'
import { logger } from '../logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { MethodRegistry } from '../methodRegistry'
import { PublicationRegistry } from '../publicationRegistry'
import {
	AddedMessage,
	ChangedMessage,
	ClientMessage,
	ConnectMessage,
	DDPError,
	ServerMessage,
	SubMessage,
} from '@sofie-automation/shared-lib/dist/ddp/messageTypes'
import { decodeMessage, encodeMessage } from './wireCodec'
import { Heartbeat } from './Heartbeat'
import { makeDdpConnection } from './DdpConnection'
import { DdpConnectionRegistry, DdpSessionDebugData, TrackedDdpSession } from './ConnectionRegistry'
import { handleMethodMessage, wrapError } from './methodDispatch'
import { isCursorLike } from './subscriptionDispatch'
import { driveSubscriptionFromCursor } from '../publications/lib/lib'
import type { MinimalMongoCursor } from '../collections/collection'
import { SUPPORTED_DDP_VERSIONS } from './config'
import { SessionCollectionView } from './SessionCollectionView'
import { DdpPublicationContext, SessionPublicationApi } from './DdpPublicationContext'
import type { DDPClientConnection } from './types'

export interface DdpSessionOptions {
	heartbeatInterval: number
	heartbeatTimeout: number
}

/**
 * A single client connection to the standalone DDP server.
 *
 * Ports Meteor's `Session`: a per-session message queue with strictly serial ordering, where a method
 * may opt into concurrency by calling `this.unblock()`. It also owns the per-session **merge box** (one
 * `SessionCollectionView` per collection) so documents shared across subscriptions are deduplicated
 * before being sent to the client — matching what the client's minimongo expects.
 */
export class DdpSession implements SessionPublicationApi, TrackedDdpSession {
	readonly connection: DDPClientConnection
	private readonly fireClose: () => void
	private readonly socket: WebSocket
	private readonly registry: MethodRegistry
	private readonly publications: PublicationRegistry
	private readonly connections: DdpConnectionRegistry
	private readonly heartbeat: Heartbeat

	private initialized = false
	private closed = false
	private readonly inQueue: ClientMessage[] = []
	private workerRunning = false

	/** Active subscriptions on this session, by client subscription id. */
	private readonly subscriptions = new Map<string, DdpPublicationContext>()
	/** The merge box: one view per collection, deduplicating documents across subscriptions. */
	private readonly collectionViews = new Map<string, SessionCollectionView>()

	constructor(
		socket: WebSocket,
		request: IncomingMessage,
		registry: MethodRegistry,
		publications: PublicationRegistry,
		connections: DdpConnectionRegistry,
		options: DdpSessionOptions
	) {
		this.socket = socket
		this.registry = registry
		this.publications = publications
		this.connections = connections

		const { connection, fireClose } = makeDdpConnection(request, () => this.close())
		this.connection = connection
		this.fireClose = fireClose

		this.heartbeat = new Heartbeat({
			heartbeatInterval: options.heartbeatInterval,
			heartbeatTimeout: options.heartbeatTimeout,
			onTimeout: () => {
				logger.debug(`DDP session "${this.connection.id}" timed out`)
				this.close()
			},
			sendPing: () => this.send({ msg: 'ping' }),
		})

		socket.on('message', (data) => this.onMessage(data))
		socket.on('close', () => this.close())
		socket.on('error', (err) => {
			logger.warn(`DDP session "${this.connection.id}" socket error: ${stringifyError(err)}`)
		})
	}

	send(msg: ServerMessage): void {
		if (this.closed || this.socket.readyState !== WebSocket.OPEN) return
		this.socket.send(encodeMessage(msg))
	}

	sendError(reason: string, offendingMessage?: ClientMessage): void {
		this.send({ msg: 'error', reason, offendingMessage })
	}

	close(): void {
		if (this.closed) return
		this.closed = true
		this.heartbeat.stop()
		this.connections.remove(this)

		// Tear down all subscriptions (observers etc.); no `nosub` needed as the socket is going away.
		for (const context of this.subscriptions.values()) context.stop()
		this.subscriptions.clear()
		this.collectionViews.clear()

		this.fireClose()
		try {
			this.socket.close()
		} catch {
			// ignore errors closing an already-broken socket
		}
	}

	/** A snapshot of this session's subscriptions and document counts, for diagnostics. */
	getDebugData(): DdpSessionDebugData {
		let mergedDocumentCount = 0
		for (const view of this.collectionViews.values()) {
			mergedDocumentCount += view.size
		}

		return {
			id: this.connection.id,
			clientAddress: this.connection.clientAddress,
			subscriptions: Array.from(this.subscriptions.values(), (context) => ({
				name: context.publicationName,
				documents: context.getDocumentCounts(),
			})),
			mergedDocumentCount,
		}
	}

	// --- SessionPublicationApi (the merge box, used by DdpPublicationContext) ---

	mergeAdded(subscriptionHandle: string, collection: string, id: string, fields: Record<string, unknown>): void {
		this.getCollectionView(collection).added(subscriptionHandle, id, fields)
	}

	mergeChanged(subscriptionHandle: string, collection: string, id: string, fields: Record<string, unknown>): void {
		// A `changed` for a doc we never `added` is a no-op (the doc isn't in the view).
		this.collectionViews.get(collection)?.changed(subscriptionHandle, id, fields)
	}

	mergeRemoved(subscriptionHandle: string, collection: string, id: string): void {
		const view = this.collectionViews.get(collection)
		if (!view) return
		view.removed(subscriptionHandle, id)
		if (view.isEmpty()) this.collectionViews.delete(collection)
	}

	sendReady(subscriptionId: string): void {
		this.send({ msg: 'ready', subs: [subscriptionId] })
	}

	private getCollectionView(collection: string): SessionCollectionView {
		let view = this.collectionViews.get(collection)
		if (!view) {
			view = new SessionCollectionView(collection, {
				added: (c, id, fields) => this.sendDdpAdded(c, id, fields),
				changed: (c, id, fields) => this.sendDdpChanged(c, id, fields),
				removed: (c, id) => this.send({ msg: 'removed', collection: c, id }),
			})
			this.collectionViews.set(collection, view)
		}
		return view
	}

	private sendDdpAdded(collection: string, id: string, fields: Record<string, unknown>): void {
		const msg: AddedMessage = { msg: 'added', collection, id }
		const definedFields: Record<string, unknown> = {}
		for (const [key, value] of Object.entries<unknown>(fields)) {
			if (value !== undefined) definedFields[key] = value
		}
		if (Object.keys(definedFields).length) msg.fields = definedFields
		this.send(msg)
	}

	private sendDdpChanged(collection: string, id: string, fields: Record<string, unknown>): void {
		// DDP carries cleared fields separately from changed values; EJSON won't do this for us.
		const definedFields: Record<string, unknown> = {}
		const cleared: string[] = []
		for (const [key, value] of Object.entries<unknown>(fields)) {
			if (value === undefined) cleared.push(key)
			else definedFields[key] = value
		}
		if (Object.keys(definedFields).length === 0 && cleared.length === 0) return

		const msg: ChangedMessage = { msg: 'changed', collection, id }
		if (Object.keys(definedFields).length) msg.fields = definedFields
		if (cleared.length) msg.cleared = cleared
		this.send(msg)
	}

	// --- Message handling ---

	private onMessage(data: RawData): void {
		const msg = decodeMessage(data)
		if (!msg) {
			this.sendError('Failed to parse DDP message')
			return
		}
		this.heartbeat.messageReceived()

		if (!this.initialized) {
			if (msg.msg === 'connect') {
				this.handleConnect(msg)
			} else {
				this.sendError('Must connect first', msg)
			}
			return
		}

		switch (msg.msg) {
			case 'connect':
				// already connected; ignore duplicate connect
				return
			case 'ping':
				this.send({ msg: 'pong', id: msg.id })
				return
			case 'pong':
				// Any message already counts as a heartbeat; nothing else to do
				return
			default:
				this.enqueue(msg)
		}
	}

	private handleConnect(msg: ConnectMessage): void {
		if (!SUPPORTED_DDP_VERSIONS.includes(msg.version)) {
			this.send({ msg: 'failed', version: SUPPORTED_DDP_VERSIONS[0] })
			return
		}

		// We always assign a fresh session id and ignore any `msg.session` the client sent — i.e. no DDP
		// session resume. Meteor itself did't implement resume by the time we ejected (meteor/meteor#14051,
		// targeting ~3.5).
		// If resume is ever wanted, this is where a returning `msg.session` would be looked up and its
		// subscriptions re-attached instead of starting a new session.
		this.initialized = true
		this.connections.add(this)
		this.send({ msg: 'connected', session: this.connection.id })
		this.heartbeat.start()
		logger.debug(
			`DDP session "${this.connection.id}" connected (v${msg.version}) from ${this.connection.clientAddress}`
		)
	}

	private enqueue(msg: ClientMessage): void {
		this.inQueue.push(msg)
		if (!this.workerRunning) {
			this.workerRunning = true
			this.processNext()
		}
	}

	/** Process the next queued message. Public so the per-message `unblock()` can re-enter it. */
	processNext(): void {
		if (this.closed) {
			this.workerRunning = false
			return
		}
		const msg = this.inQueue.shift()
		if (msg === undefined) {
			this.workerRunning = false
			return
		}

		let blocked = true
		const unblock = () => {
			if (!blocked) return
			blocked = false
			setImmediate(() => this.processNext())
		}

		this.dispatch(msg, unblock)
			.catch((e) => logger.error(`DDP session "${this.connection.id}" dispatch error: ${stringifyError(e)}`))
			.finally(() => unblock())
	}

	private async dispatch(msg: ClientMessage, unblock: () => void): Promise<void> {
		switch (msg.msg) {
			case 'method':
				await handleMethodMessage(this, this.registry, msg, unblock)
				break
			case 'sub':
				// Subscriptions don't need to block subsequent messages.
				unblock()
				await this.handleSub(msg)
				break
			case 'unsub':
				unblock()
				this.stopSubscription(msg.id)
				break
			default:
				this.sendError('Unknown message type', msg)
				break
		}
	}

	// --- Subscriptions ---

	private async handleSub(msg: SubMessage): Promise<void> {
		if (
			typeof msg.id !== 'string' ||
			typeof msg.name !== 'string' ||
			(msg.params !== undefined && !Array.isArray(msg.params))
		) {
			this.sendError('Malformed subscription', msg)
			return
		}
		// Ignore a duplicate sub id (the client shouldn't reuse an active one).
		if (this.subscriptions.has(msg.id)) return

		const callback = this.publications.get(msg.name)
		if (!callback) {
			this.send({
				msg: 'nosub',
				id: msg.id,
				error: { error: 404, reason: `Subscription '${msg.name}' not found`, errorType: 'Meteor.Error' },
			})
			return
		}

		const context = new DdpPublicationContext(this, msg.id, 'N' + msg.id, msg.name)
		this.subscriptions.set(msg.id, context)

		try {
			const result = await callback(context, ...(msg.params ?? []))

			// A cursor-returning publication: observe it and forward changes through the merge box.
			// `driveSubscriptionFromCursor` throws if the cursor has no collection name (caught below).
			if (isCursorLike(result)) {
				await driveSubscriptionFromCursor(context, result as MinimalMongoCursor<any>)
			}

			// Either the handler drove the context itself (custom publications call ready() via init()) or
			// we just attached the cursor observer; if nothing marked it ready (e.g. an empty/null result),
			// mark it ready now — matching Meteor's empty-result behaviour.
			if (!context.isReady) context.ready()
		} catch (e) {
			this.stopSubscription(msg.id, wrapError(e))
		}
	}

	private stopSubscription(subscriptionId: string, error?: DDPError): void {
		const context = this.subscriptions.get(subscriptionId)
		// Only ack a subscription we actually have. This makes stop idempotent: a client that unsubscribes
		// a sub that already failed (auto-`nosub`) — or a duplicate unsub — won't get a second `nosub`.
		if (!context) return
		this.subscriptions.delete(subscriptionId)
		context.stop()
		this.send({ msg: 'nosub', id: subscriptionId, ...(error ? { error } : {}) })
	}
}
