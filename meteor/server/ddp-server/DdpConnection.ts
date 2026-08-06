import type { IncomingMessage } from 'http'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { getClientAddress } from '../lib/clientAddress'
import type { DDPClientConnection } from './types'

/**
 * Build the `this.connection` handle for a DDP session.
 *
 * Returns the handle plus a `fireClose()` to be called once when the underlying socket closes.
 */
export function makeDdpConnection(
	request: IncomingMessage,
	requestClose: () => void
): { connection: DDPClientConnection; fireClose: () => void } {
	const closeCallbacks: Array<() => void> = []
	let closed = false

	const abortController = new AbortController()

	const connection: DDPClientConnection = {
		id: getRandomString(),
		clientAddress: getClientAddress(request.headers, request.socket.remoteAddress),
		httpHeaders: request.headers,
		signal: abortController.signal,
		close: () => requestClose(),
		onClose: (callback: () => void) => {
			if (closed) {
				// Already closed — defer-call, matching Meteor's behaviour
				queueMicrotask(callback)
				return
			}
			closeCallbacks.push(callback)
		},
	}

	const fireClose = () => {
		if (closed) return
		closed = true

		try {
			abortController.abort()
		} catch {
			// Ignore errors from aborting the signal
		}

		for (const callback of closeCallbacks) {
			try {
				callback()
			} catch {
				// onClose handlers must not break teardown of other handlers
			}
		}
	}

	return { connection, fireClose }
}
