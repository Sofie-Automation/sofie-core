import type { Server as HttpServer } from 'http'
import { WebSocketServer } from 'ws'
import { URL } from 'url'
import { logger } from '../logging'
import { MethodRegistry } from '../methodRegistry'
import { PublicationRegistry } from '../publicationRegistry'
import { DdpSession } from './DdpSession'
import { DdpConnectionRegistry } from './ConnectionRegistry'
import { DDP_HEARTBEAT_INTERVAL, DDP_HEARTBEAT_TIMEOUT, STANDALONE_DDP_SERVER_PATH } from './config'
import { getRootSubpath } from '../lib'
import { trackConnectionOpen, trackConnectionClose } from '../Connections'

/**
 * Create the registry of live standalone-DDP sessions, wired up to the production connection lifecycle
 * side-effects. Created separately from the server so other startup steps (e.g. the performance monitor)
 * can hold onto it before the server itself is started.
 */
export function createDdpConnectionRegistry(): DdpConnectionRegistry {
	return new DdpConnectionRegistry({ onOpen: trackConnectionOpen, onClose: trackConnectionClose })
}

/**
 * Start the standalone DDP server, sharing the given method + publication registries with the Meteor path.
 *
 * It mounts on the app's HTTP server under a subpath via a `noServer` WebSocket server, only claiming
 * `upgrade` requests for our path and leaving everything else untouched. Call before the server begins
 * listening, so that no upgrade request can arrive before the handler is attached.
 */
export function startStandaloneDdpServer(
	registry: MethodRegistry,
	publications: PublicationRegistry,
	connections: DdpConnectionRegistry,
	httpServer: HttpServer
): void {
	const path = getRootSubpath() + STANDALONE_DDP_SERVER_PATH
	const wss = new WebSocketServer({ noServer: true })

	wss.on('connection', (socket, request) => {
		// The session registers itself (socket listeners + connection registry); no need to retain it here.
		const session = new DdpSession(socket, request, registry, publications, connections, {
			heartbeatInterval: DDP_HEARTBEAT_INTERVAL,
			heartbeatTimeout: DDP_HEARTBEAT_TIMEOUT,
		})
		void session
	})

	httpServer.on('upgrade', (request, socket, head) => {
		let pathname: string
		try {
			pathname = new URL(request.url ?? '', 'http://localhost').pathname
		} catch {
			return
		}
		// Only claim our subpath; let all other upgrades (e.g. Meteor's SockJS) be handled elsewhere.
		if (pathname !== path) return

		wss.handleUpgrade(request, socket, head, (ws) => {
			wss.emit('connection', ws, request)
		})
	})

	logger.info(`Standalone DDP server listening on path "${path}"`)
}
