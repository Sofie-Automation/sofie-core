/**
 * DDP wire-protocol message shapes (DDP v1).
 *
 * These are the canonical definitions shared between the DDP client
 * (`@sofie-automation/server-core-integration`) and Sofie's standalone DDP server, so the two cannot
 * drift. All messages are EJSON-encoded JSON over a WebSocket.
 */

/** DDP message type for client requests to servers */
export type ClientServer = 'connect' | 'ping' | 'pong' | 'method' | 'sub' | 'unsub'
/** DDP message type for server requests to clients */
export type ServerClient =
	| 'failed'
	| 'connected'
	| 'result'
	| 'updated'
	| 'nosub'
	| 'added'
	| 'removed'
	| 'changed'
	| 'ready'
	| 'ping'
	| 'pong'
	| 'error'
/** All types of DDP messages */
export type MessageType = ClientServer | ServerClient

/**
 * Represents any DDP message sent from as a request or response from a server to a client.
 */
export interface BaseMessage {
	/** Kind of meteor message */
	msg: MessageType
}

/**
 * DDP-specified error.
 * Note. Different fields to a Javascript error.
 */
export interface DDPError {
	/**
	 * Note: `string` is allowed because this type also describes errors *received* from other DDP
	 * peers, which may use string codes. Errors thrown by Sofie use `SofieError`, whose code is
	 * always a number.
	 */
	error: string | number
	reason?: string
	message?: string
	/** Extra structured detail carried by the error; the client reconstructs it as `Meteor.Error.details`. */
	details?: string
	/**
	 * Signifies that the error was deliberately thrown to be sent to the client, rather than being a
	 * sanitized internal error. Emitted for parity with Meteor, which always set it; no known client
	 * reads it. Optional because a non-Meteor DDP peer need not send it.
	 */
	isClientSafe?: true
	/**
	 * Protocol constant. This retains the `Meteor.Error` name even though Sofie no longer uses Meteor:
	 * it is part of the DDP wire format, and is read by external gateways (via
	 * `@sofie-automation/server-core-integration`) and by the web UI's DDP client. Do not rename it.
	 */
	errorType: 'Meteor.Error'
}

/**
 * Request message to initiate a connection from a client to a server.
 */
export interface ConnectMessage extends BaseMessage {
	msg: 'connect'
	/** If trying to reconnect to an existing DDP session */
	session?: string
	/** The proposed protocol version */
	version: string
	/** Protocol versions supported by the client, in order of preference */
	support: Array<string>
}

/**
 * Response message sent when a client's connection request was successful.
 */
export interface ConnectedMessage extends BaseMessage {
	msg: 'connected'
	/** An identifier for the DDP session */
	session: string
}

/**
 * Response message when a client's connection request was unsuccessful.
 */
export interface FailedMessage extends BaseMessage {
	msg: 'failed'
	/** A suggested protocol version to connect with */
	version: string
}

/**
 * Heartbeat request message. Can be sent from server to client or client to server.
 */
export interface PingMessage extends BaseMessage {
	msg: 'ping'
	/** Identifier used to correlate with response */
	id?: string
}

/**
 * Heartbeat response message.
 */
export interface PongMessage extends BaseMessage {
	msg: 'pong'
	/** Same as received in the `ping` message */
	id?: string
}

/**
 * Message from the client specifying the sets of information it is interested in.
 * The server should then send `added`, `changed` and `removed` messages matching
 * the subscribed types.
 */
export interface SubMessage extends BaseMessage {
	msg: 'sub'
	/** An arbitrary client-determined identifier for this subscription */
	id: string
	/** Name of the subscription */
	name: string
	/** Parameters to the subscription. Most be serializable to EJSON. */
	params?: Array<unknown>
}

/**
 * Request to unsubscribe from messages related to an existing subscription.
 */
export interface UnSubMessage extends BaseMessage {
	msg: 'unsub'
	/** The `id` passed to `sub` */
	id: string
}

/**
 * Message sent when a subscription is unsubscribed. Contains an optional error if a
 * problem occurred.
 */
export interface NoSubMessage extends BaseMessage {
	msg: 'nosub'
	/** The client `id` passed to `sub` for this subscription. */
	id: string
	/** An error raised by the subscription as it concludes, or sub-not-found */
	error?: DDPError
}

/**
 * Notification that a document has been added to a collection.
 */
export interface AddedMessage extends BaseMessage {
	msg: 'added'
	/** Collection name */
	collection: string
	/** Document identifier */
	id: string
	/** Document values - serializable with EJSON */
	fields?: { [attr: string]: unknown }
}

/**
 * Notification that a document has changed within a collection.
 */
export interface ChangedMessage extends BaseMessage {
	msg: 'changed'
	/** Collection name */
	collection: string
	/** Document identifier */
	id: string
	/** Document values - serializable with EJSON */
	fields?: { [attr: string]: unknown }
	/** Field names to delete */
	cleared?: Array<string>
}

/**
 * Notification that a document has been removed from a collection.
 */
export interface RemovedMessage extends BaseMessage {
	msg: 'removed'
	/** Collection name */
	collection: string
	/** Document identifier */
	id: string
}

/**
 * Message sent to client after an initial salvo of updates have sent a
 * complete set of initial data.
 */
export interface ReadyMessage extends BaseMessage {
	msg: 'ready'
	/** Identifiers passed to `sub` which have sent their initial batch of data */
	subs: Array<string>
}

/**
 * Remote procedure call request request.
 */
export interface MethodMessage extends BaseMessage {
	msg: 'method'
	/** Method name */
	method: string
	/** Parameters to the method */
	params?: Array<unknown>
	/** An arbitrary client-determined identifier for this method call */
	id: string
	/** An arbitrary client-determined seed for pseudo-random generators  */
	randomSeed?: string
}

/**
 * Remote procedure call response message, either an error or a return value _result_.
 */
export interface ResultMessage extends BaseMessage {
	msg: 'result'
	/** Method name */
	id: string
	/** An error thrown by the method, or method nor found */
	error?: DDPError
	/** Return value of the method */
	result?: unknown
}

/**
 * Message sent to indicate that all side-effect changes to subscribed data caused by
 * a method have completed.
 */
export interface UpdatedMessage extends BaseMessage {
	msg: 'updated'
	/** Identifiers passed to `method`, all of whose writes have been reflected in data messages */
	methods: Array<string>
}

/**
 * Erroneous messages sent from the client to the server can result in receiving a top-level
 * `error` message in response.
 */
export interface ErrorMessage extends BaseMessage {
	msg: 'error'
	/** Description of the error */
	reason: string
	/** If the original message parsed properly, it is included here */
	offendingMessage?: BaseMessage
}

/** Any message a client can send the server. */
export type ClientMessage = ConnectMessage | MethodMessage | SubMessage | UnSubMessage | PingMessage | PongMessage

/** Any message the server can send a client. */
export type ServerMessage =
	| ConnectedMessage
	| FailedMessage
	| ResultMessage
	| UpdatedMessage
	| NoSubMessage
	| ChangedMessage
	| AddedMessage
	| RemovedMessage
	| ReadyMessage
	| PingMessage
	| PongMessage
	| ErrorMessage
