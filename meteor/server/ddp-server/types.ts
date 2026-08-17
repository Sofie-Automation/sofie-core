import type { IncomingHttpHeaders } from 'http'

export interface DDPClientConnection {
	/**
	 * Unique ID for this connection, used to identify the connection in logs and metrics.
	 */
	readonly id: string
	/**
	 * AbortSignal that is aborted when the connection is closed. This can be used to cancel any ongoing work related to this connection.
	 */
	readonly signal: AbortSignal
	/**
	 * Request the connection to be closed. This will trigger the `onClose` callbacks.
	 */
	readonly close: () => void
	/**
	 * Register a callback to be called when the connection is closed. If the connection is already closed, the callback will be called immediately (but asynchronously).
	 */
	readonly onClose: (callback: () => void) => void
	/**
	 * The resolved client address for this connection.
	 */
	readonly clientAddress: string
	/**
	 * The HTTP headers provided when the connection was established. This is a snapshot of the headers at the time of connection, and may not reflect any changes made to the headers after the connection was established.
	 */
	readonly httpHeaders: IncomingHttpHeaders
}
