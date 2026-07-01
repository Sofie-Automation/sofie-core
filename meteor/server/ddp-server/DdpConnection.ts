import { Meteor } from 'meteor/meteor'
import type { IncomingMessage } from 'http'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { getClientAddress } from '../lib/clientAddress'

/**
 * Build the `this.connection` handle for a DDP session, structurally a `Meteor.Connection` so it
 * drops into the existing method/auth code unchanged (`auth.ts` reads `httpHeaders`, `Connections.ts`
 * reads `id`/`clientAddress`/`onClose`, `client.ts` reads `clientAddress`).
 *
 * Returns the handle plus a `fireClose()` to be called once when the underlying socket closes.
 */
export function makeDdpConnection(
	request: IncomingMessage,
	requestClose: () => void
): { connection: Meteor.Connection; fireClose: () => void } {
	const closeCallbacks: Array<() => void> = []
	let closed = false

	const connection: Meteor.Connection = {
		id: getRandomString(),
		clientAddress: getClientAddress(request.headers, request.socket.remoteAddress),
		httpHeaders: request.headers as Record<string, string>,
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
