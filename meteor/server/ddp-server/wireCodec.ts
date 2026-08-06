import EJSON from 'ejson'
import type { RawData } from 'ws'
import { ClientMessage, ServerMessage } from '@sofie-automation/shared-lib/dist/ddp/messageTypes'

/** Encode a server->client message for the wire (EJSON-encoded JSON). */
export function encodeMessage(msg: ServerMessage): string {
	return EJSON.stringify(msg)
}

/** Decode a raw WebSocket frame into a client->server message, or `undefined` if it can't be parsed. */
export function decodeMessage(data: RawData): ClientMessage | undefined {
	let raw: string
	if (typeof data === 'string') {
		raw = data
	} else if (Buffer.isBuffer(data)) {
		raw = data.toString('utf8')
	} else if (Array.isArray(data)) {
		raw = Buffer.concat(data).toString('utf8')
	} else {
		raw = Buffer.from(data).toString('utf8')
	}

	try {
		return EJSON.parse(raw) as ClientMessage
	} catch {
		return undefined
	}
}
