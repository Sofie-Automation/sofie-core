/**
 * DDP client. Based on:
 *
 * * https://github.com/nytamin/node-ddp-client
 * * https://github.com/oortcloud/node-ddp-client
 *
 * Brought into this project for maintenance reasons, including conversion to Typescript.
 */
import WebSocket from 'ws'
import EJSON from 'ejson'
import { EventEmitter } from 'events'
import type { ProtectedString } from '@sofie-automation/shared-lib/dist/lib/protectedString.js'

export interface DDPTLSOptions {
	// Described in https://nodejs.org/api/tls.html#tls_tls_connect_options_callback

	/* Necessary only if the server uses a self-signed certificate.*/
	ca?: Buffer[] // example: [ fs.readFileSync('server-cert.pem') ]

	/* Necessary only if the server requires client certificate authentication.*/
	key?: Buffer // example: fs.readFileSync('client-key.pem'),
	cert?: Buffer // example: fs.readFileSync('client-cert.pem'),

	/* Necessary only if the server's cert isn't for "localhost". */
	checkServerIdentity?: (hostname: string, cert: object) => Error | undefined // () => { }, // Returns <Error> object, populating it with reason, host, and cert on failure. On success, returns <undefined>.

	/* If true, the server certificate is automatically rejected if it is not valid. The default value is true. */
	rejectUnauthorized?: boolean
}

/**
 * Options set when creating a new DDP client connection.
 */
export interface DDPConnectorOptions {
	host: string
	port: number
	headers?: { [header: string]: string }
	path?: string
	ssl?: boolean
	debug?: boolean
	autoReconnect?: boolean // default: true
	autoReconnectTimer?: number
	tlsOpts?: DDPTLSOptions
	url?: string
	maintainCollections?: boolean
	ddpVersion?: '1' | 'pre2' | 'pre1'
}

/**
 * Observer watching for changes to a collection.
 */
export interface Observer<Doc extends { _id: ProtectedString<any> | string }> {
	/** Name of the collection being observed */
	readonly name: string
	/** Identifier of this observer */
	readonly id: Doc['_id']
	/**
	 * Callback when a document is added to a collection.
	 * @callback
	 * @param id Identifier of the document added
	 * @param fields The added document
	 */
	added: (id: Doc['_id'], fields?: Partial<Doc>) => void
	/** Callback when a document is changed in a collection. */
	changed: (id: Doc['_id'], oldFields: Partial<Doc>, clearedFields: Array<keyof Doc>, newFields: Partial<Doc>) => void
	/** Callback when a document is removed from a collection. */
	removed: (id: Doc['_id'], oldValue: Partial<Doc>) => void
	/** Request to stop observing the collection */
	stop: () => void
}

// The DDP message types are defined canonically in shared-lib, so this client and Sofie's standalone
// DDP server share one definition and cannot drift. Import the shapes used in this client's
// implementation, and re-export the subset that was previously part of this module's public API.
import type {
	ClientServer,
	ServerClient,
	MessageType,
	DDPError,
	ConnectedMessage,
	FailedMessage,
	PingMessage,
	PongMessage,
	NoSubMessage,
	AddedMessage,
	ChangedMessage,
	RemovedMessage,
	ReadyMessage,
	ResultMessage,
	UpdatedMessage,
	ClientMessage,
	ServerMessage,
} from '@sofie-automation/shared-lib/dist/ddp/messageTypes.js'

export type { ClientServer, ServerClient, MessageType, DDPError }

export type DDPClientEvents = {
	failed: [error: Error]
	'socket-error': [error: Error]
	'socket-close': [code: number, reason: string]
	message: [data: string]
	connected: []
}

/**
 * Class reprsenting a DDP client and its connection.
 */
export class DDPClient extends EventEmitter<DDPClientEvents> {
	// very very simple collections (name -> [{id -> document}])
	public collections: {
		[collectionName: string]: {
			[id: string]: {
				_id: string
				[attr: string]: unknown
			}
		}
	} = {}

	public socket: WebSocket | undefined
	public session: string | undefined

	private hostInt!: string
	public get host(): string {
		return this.hostInt
	}
	private portInt!: number
	public get port(): number {
		return this.portInt
	}
	private headersInt: { [header: string]: string } = {}
	public get headers(): { [header: string]: string } {
		return this.headersInt
	}
	private pathInt?: string
	public get path(): string | undefined {
		return this.pathInt
	}
	private sslInt!: boolean
	public get ssl(): boolean {
		return this.sslInt
	}
	private autoReconnectInt!: boolean
	public get autoReconnect(): boolean {
		return this.autoReconnectInt
	}
	private autoReconnectTimerInt!: number
	public get autoReconnectTimer(): number {
		return this.autoReconnectTimerInt
	}
	private ddpVersionInt: '1' | 'pre2' | 'pre1'
	public get ddpVersion(): '1' | 'pre2' | 'pre1' {
		return this.ddpVersionInt
	}
	private urlInt?: string
	public get url(): string | undefined {
		return this.urlInt
	}
	private maintainCollectionsInt!: boolean
	public get maintainCollections(): boolean {
		return this.maintainCollectionsInt
	}

	public static readonly ERRORS: { [name: string]: DDPError } = {
		DISCONNECTED: {
			error: 'DISCONNECTED',
			message: 'DDPClient: Disconnected from DDP server',
			errorType: 'Meteor.Error',
		},
	}
	public static readonly supportedDdpVersions = ['1', 'pre2', 'pre1']

	private tlsOpts!: DDPTLSOptions
	private isConnecting = false
	private isReconnecting = false
	private isClosing = false
	private connectionFailed = false
	private nextId = 0
	private callbacks: { [id: string]: (error?: DDPError, result?: unknown) => void } = {}
	private updatedCallbacks: { [name: string]: () => void } = {}
	private pendingMethods: { [id: string]: boolean } = {}
	private observers: { [name: string]: { [_id: string]: Observer<any> } } = {}
	private reconnectTimeout: NodeJS.Timeout | null = null

	constructor(opts?: DDPConnectorOptions) {
		super()

		opts = opts || { host: '127.0.0.1', port: 3000, tlsOpts: {} }

		this.resetOptions(opts)
		this.ddpVersionInt = opts.ddpVersion || '1'
	}

	resetOptions(opts: DDPConnectorOptions): void {
		// console.log(opts)
		this.hostInt = opts.host || '127.0.0.1'
		this.portInt = opts.port || 3000
		this.headersInt = opts.headers || {}
		this.pathInt = opts.path
		this.sslInt = opts.ssl || this.port === 443
		this.tlsOpts = opts.tlsOpts || {}
		this.autoReconnectInt = opts.autoReconnect === false ? false : true
		this.autoReconnectTimerInt = opts.autoReconnectTimer || 500
		this.maintainCollectionsInt = opts.maintainCollections || true
		this.urlInt = opts.url
		this.ddpVersionInt = opts.ddpVersion || '1'
	}

	private clearReconnectTimeout(): void {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout)
			this.reconnectTimeout = null
		}
	}

	private recoverNetworkError(err?: any): void {
		// console.log('autoReconnect', this.autoReconnect, 'connectionFailed', this.connectionFailed, 'isClosing', this.isClosing)
		if (this.autoReconnect && !this.connectionFailed && !this.isClosing) {
			this.clearReconnectTimeout()
			this.reconnectTimeout = setTimeout(() => {
				this.connect()
			}, this.autoReconnectTimer)
			this.isReconnecting = true
		} else {
			if (err) {
				throw err
			}
		}
	}

	///////////////////////////////////////////////////////////////////////////
	// RAW, low level functions
	private send(data: ClientMessage): void {
		if (data.msg !== 'connect' && this.isConnecting) {
			this.endPendingMethodCalls()
		} else {
			if (!this.socket) throw new Error('Not connected')
			this.socket.send(EJSON.stringify(data))
		}
	}

	private failed(data: FailedMessage): void {
		if (DDPClient.supportedDdpVersions.indexOf(data.version) !== -1) {
			this.ddpVersionInt = data.version as '1' | 'pre2' | 'pre1'
			this.connect()
		} else {
			this.autoReconnectInt = false
			this.emit('failed', new Error('Cannot negotiate DDP version'))
		}
	}

	private connected(data: ConnectedMessage): void {
		this.session = data.session
		this.isConnecting = false
		this.isReconnecting = false
		this.emit('connected')
	}

	private result(data: ResultMessage): void {
		if (data.id) {
			// console.log('Received result', data, this.callbacks, this.callbacks[data.id])
			const cb = this.callbacks[data.id] || undefined
			if (cb) {
				delete this.callbacks[data.id]

				cb(data.error, data.result)
			}
		}
	}

	private updated(data: UpdatedMessage): void {
		if (data.methods) {
			data.methods.forEach((method) => {
				const cb = this.updatedCallbacks[method]
				if (cb) {
					delete this.updatedCallbacks[method]
					cb()
				}
			})
		}
	}

	private nosub(data: NoSubMessage): void {
		if (data.id) {
			const cb = this.callbacks[data.id]
			if (cb) {
				delete this.callbacks[data.id]

				cb(data.error)
			}
		}
	}

	private added(data: AddedMessage): void {
		// console.log('Received added', data, this.maintainCollections)
		if (this.maintainCollections) {
			const name = data.collection
			const id = data.id || 'unknown'

			if (!this.collections[name]) {
				this.collections[name] = {}
			}

			const addedDocument = this.collections[name][id] ? { ...this.collections[name][id] } : { _id: id }

			if (data.fields) {
				Object.entries<unknown>(data.fields).forEach(([key, value]) => {
					addedDocument[key] = value
				})
			}

			this.collections[name][id] = addedDocument

			if (this.observers[name]) {
				Object.values<Observer<any>>(this.observers[name]).forEach((ob) => ob.added(id, data.fields))
			}
		}
	}

	private removed(data: RemovedMessage): void {
		if (this.maintainCollections) {
			const name = data.collection
			const id = data.id || 'unknown'

			if (!this.collections[name][id]) {
				return
			}

			const oldValue = this.collections[name][id]

			delete this.collections[name][id]

			if (this.observers[name]) {
				Object.values<Observer<any>>(this.observers[name]).forEach((ob) => ob.removed(id, oldValue))
			}
		}
	}

	private changed(data: ChangedMessage): void {
		if (this.maintainCollections) {
			const name = data.collection
			const id = data.id || 'unknown'

			if (!this.collections[name]) {
				return
			}
			if (!this.collections[name][id]) {
				return
			}

			const oldFields: { [attr: string]: unknown } = {}
			const clearedFields = data.cleared || []
			const newFields: { [attr: string]: unknown } = {}

			// cloning allows detection of changed objects in `find` results using shallow comparison
			const updatedDocument = { ...this.collections[name][id] }

			if (data.fields) {
				Object.entries<unknown>(data.fields).forEach(([key, value]) => {
					oldFields[key] = updatedDocument[key]
					newFields[key] = value
					updatedDocument[key] = value
				})
			}

			if (data.cleared) {
				data.cleared.forEach((value) => {
					delete updatedDocument[value]
				})
			}

			this.collections[name][id] = updatedDocument

			if (this.observers[name]) {
				Object.values<Observer<any>>(this.observers[name]).forEach((ob) =>
					ob.changed(id, oldFields, clearedFields, newFields)
				)
			}
		}
	}

	private ready(data: ReadyMessage): void {
		// console.log('Received ready', data, this.callbacks)
		data.subs.forEach((id) => {
			const cb = this.callbacks[id]
			if (cb) {
				cb()
				delete this.callbacks[id]
			}
		})
	}

	private ping(data: PingMessage): void {
		this.send((data.id && ({ msg: 'pong', id: data.id } as PongMessage)) || ({ msg: 'pong' } as PongMessage))
	}

	private messageWork: { [name in ServerClient]: (data: any) => void } = {
		failed: this.failed.bind(this),
		connected: this.connected.bind(this),
		result: this.result.bind(this),
		updated: this.updated.bind(this),
		nosub: this.nosub.bind(this),
		added: this.added.bind(this),
		removed: this.removed.bind(this),
		changed: this.changed.bind(this),
		ready: this.ready.bind(this),
		ping: this.ping.bind(this),
		pong: () => {
			/* Do nothing */
		},
		error: () => {
			/* Do nothing */
		}, // TODO - really do nothing!?!
	}

	// handle a message from the server
	private message(rawData: string): void {
		// console.log('Received message', rawData)
		const data: ServerMessage = EJSON.parse(rawData)

		this.messageWork[data.msg]?.(data)
	}

	private getNextId(): string {
		return (this.nextId += 1).toString()
	}

	private addObserver(observer: Observer<any>): void {
		if (!this.observers[observer.name]) {
			this.observers[observer.name] = {}
		}
		this.observers[observer.name][observer.id] = observer
	}

	private removeObserver(observer: Observer<any>): void {
		if (!this.observers[observer.name]) {
			return
		}

		delete this.observers[observer.name][observer.id]
	}

	//////////////////////////////////////////////////////////////////////////
	// USER functions -- use these to control the client

	/* open the connection to the server
	 *
	 *  connected(): Called when the 'connected' message is received
	 *               If autoReconnect is true (default), the callback will be
	 *               called each time the connection is opened.
	 */
	connect(connected?: (error?: Error, wasReconnect?: boolean) => void): void {
		this.isConnecting = true
		this.connectionFailed = false
		this.isClosing = false

		if (connected) {
			this.addListener('connected', () => {
				this.clearReconnectTimeout()

				this.isConnecting = false
				this.isReconnecting = false
				connected(undefined, this.isReconnecting)
			})
			this.addListener('failed', (error) => {
				this.isConnecting = false
				this.connectionFailed = true
				connected(error, this.isReconnecting)
			})
		}

		this.makeWebSocketConnection(this.buildWsUrl())
	}

	private endPendingMethodCalls(): void {
		const ids = Object.keys(this.pendingMethods)
		this.pendingMethods = {}

		ids.forEach((id) => {
			if (this.callbacks[id]) {
				this.callbacks[id](DDPClient.ERRORS.DISCONNECTED)
				delete this.callbacks[id]
			}

			if (this.updatedCallbacks[id]) {
				this.updatedCallbacks[id]()
				delete this.updatedCallbacks[id]
			}
		})
	}

	private getHeadersWithDefaults(): { [header: string]: string } {
		return {
			dnt: 'gateway', // Provide the header needed for the header based auth to work when not connected through a reverse proxy
			...this.headers,
		}
	}

	private buildWsUrl(): string {
		if (this.url) {
			return this.url
		} else {
			const path = this.path || 'websocket'
			const protocol = this.ssl ? 'wss://' : 'ws://'
			return `${protocol}${this.host}:${this.port}${path.indexOf('/') === 0 ? path : '/' + path}`
		}
	}

	private makeWebSocketConnection(url: string): void {
		// console.log('About to create WebSocket client')
		this.socket = new WebSocket(url, { ...this.tlsOpts, headers: this.getHeadersWithDefaults() })

		this.socket.on('open', () => {
			// just go ahead and open the connection on connect
			this.send({
				msg: 'connect',
				version: this.ddpVersion,
				support: DDPClient.supportedDdpVersions,
			})
		})

		this.socket.on('error', (error: Error) => {
			// error received before connection was established
			if (this.isConnecting) {
				this.emit('failed', error)
			}

			this.emit('socket-error', error)
		})

		this.socket.on('close', (code, reason) => {
			this.emit('socket-close', code, reason.toString())
			this.endPendingMethodCalls()
			this.recoverNetworkError()
		})

		this.socket.on('message', (data) => {
			const str =
				typeof data === 'string'
					? data
					: Array.isArray(data)
						? Buffer.concat(data).toString('utf-8')
						: Buffer.from(data as ArrayBuffer).toString('utf-8')
			this.message(str)
			this.emit('message', str)
		})
	}

	close(): void {
		this.isClosing = true
		this.socket?.close() // with mockJS connection, might not get created
		this.removeAllListeners('connected')
		this.removeAllListeners('failed')
	}

	call(
		methodName: string,
		data: Array<unknown>,
		callback: (err: DDPError | undefined, result: unknown | undefined) => void,
		updatedCallback?: () => void
	): void {
		// console.log('Call', methodName, 'with this.isConnecting = ', this.isConnecting)
		const id = this.getNextId()

		this.callbacks[id] = (error?: DDPError, result?: unknown) => {
			delete this.pendingMethods[id]

			if (callback) {
				callback.apply(this, [error, result])
			}
		}

		this.updatedCallbacks[id] = () => {
			delete this.pendingMethods[id]

			if (updatedCallback) {
				updatedCallback.apply(this, [])
			}
		}

		this.pendingMethods[id] = true

		this.send({
			msg: 'method',
			id: id,
			method: methodName,
			params: data,
		})
	}

	// open a subscription on the server, callback should handle on ready and nosub
	subscribe(
		subscriptionName: string,
		data: Array<unknown>,
		callback: (error?: DDPError) => void,
		reuseId?: string
	): string {
		const id = reuseId || this.getNextId()

		if (callback) {
			this.callbacks[id] = callback
		}

		this.send({
			msg: 'sub',
			id: id,
			name: subscriptionName,
			params: data,
		})

		return id
	}

	unsubscribe(subscriptionId: string): void {
		this.send({
			msg: 'unsub',
			id: subscriptionId,
		})
	}

	/**
	 * Adds an observer to a collection and returns the observer.
	 * Observation can be stopped by calling the stop() method on the observer.
	 * Functions for added, changed and removed can be added to the observer
	 * afterward.
	 */
	observe(
		collectionName: string,
		added?: Observer<any>['added'],
		changed?: Observer<any>['changed'],
		removed?: Observer<any>['removed']
	): Observer<any> {
		const observer: Observer<any> = {
			id: this.getNextId(),
			name: collectionName,
			added:
				added ||
				(() => {
					/* Do nothing */
				}),
			changed:
				changed ||
				(() => {
					/* Do nothing */
				}),
			removed:
				removed ||
				(() => {
					/* Do nothing */
				}),
			stop: () => {
				this.removeObserver(observer)
			},
		}

		this.addObserver(observer)
		return observer
	}
}
