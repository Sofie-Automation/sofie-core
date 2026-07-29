import { logger } from '../logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { SofieError } from '@sofie-automation/corelib/dist/error'
import { MethodContext } from '../api/methodContext'
import { MethodRegistry } from '../methodRegistry'
import { DDPError, MethodMessage } from '@sofie-automation/shared-lib/dist/ddp/messageTypes'
import type { DdpSession } from './DdpSession'

/**
 * Map a thrown value to the `DDPError` shape the clients expect.
 *
 * This is the single serialization point for errors leaving the DDP server, and the field set below
 * is what Meteor used to emit - clients (including the web UI's DDP client and the gateways) parse
 * this, so it must not drift.
 */
export function wrapError(e: unknown): DDPError {
	if (e instanceof SofieError) {
		return {
			isClientSafe: true,
			error: e.error,
			reason: e.reason,
			// Carry `details` so the client can reconstruct the full error (it reads msg.error.details).
			details: e.details,
			message: e.message,
			errorType: 'Meteor.Error',
		}
	}
	// Sanitize unexpected exceptions (don't leak internals), but log the real error.
	logger.error(`Exception while invoking method: ${stringifyError(e)}`)
	return {
		isClientSafe: true,
		error: 500,
		reason: 'Internal server error',
		message: 'Internal server error [500]',
		errorType: 'Meteor.Error',
	}
}

/**
 * Handle a `method` message: look the handler up in the shared registry, run it with a
 * `Meteor`-shaped `this` (`connection` + `unblock`), then send `result` followed by `updated`.
 *
 * About the `updated` message: in DDP it tells the client that the server-side effects (the DB writes)
 * of this method `id` are complete — the client's signal to drop any optimistic stub it ran for the
 * call and accept the server's authoritative data.
 * Sofie does not use any client 'stubs', so we don't need an 'updated' signal to tell the client to drop
 * its temporary values. The client still expects it, so we send it immediately after `result`.
 */
export async function handleMethodMessage(
	session: DdpSession,
	registry: MethodRegistry,
	msg: MethodMessage,
	unblock: () => void
): Promise<void> {
	const { id, method, params } = msg
	if (typeof id !== 'string' || typeof method !== 'string' || (params !== undefined && !Array.isArray(params))) {
		session.sendError('Malformed method invocation', msg)
		return
	}

	const handler = registry.get(method)
	if (!handler) {
		session.send({
			msg: 'result',
			id,
			error: wrapError(new SofieError(404, `Method '${method}' not found`)),
		})
		session.send({ msg: 'updated', methods: [id] })
		return
	}

	const context: MethodContext = {
		connection: session.connection,
		unblock,
	}

	try {
		const result = await handler.apply(context, params ?? [])
		session.send({ msg: 'result', id, result })
	} catch (e) {
		session.send({ msg: 'result', id, error: wrapError(e) })
	}

	session.send({ msg: 'updated', methods: [id] })
}
