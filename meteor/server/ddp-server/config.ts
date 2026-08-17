/**
 * Configuration for the standalone DDP server.
 *
 * For now the server is mounted on Meteor's own HTTP server under a subpath, gated behind
 * an environment variable and defaulting to OFF, so it can run side-by-side with Meteor's
 * DDP server during the transition.
 */

/** Enable the standalone DDP server. Off unless `SOFIE_STANDALONE_DDP_SERVER` is set to `1`/`true`. */
export const STANDALONE_DDP_SERVER_ENABLED =
	process.env.SOFIE_STANDALONE_DDP_SERVER === '1' || process.env.SOFIE_STANDALONE_DDP_SERVER === 'true'

/** The WebSocket path the standalone DDP server listens on (mounted on Meteor's HTTP server). */
export const STANDALONE_DDP_SERVER_PATH = process.env.SOFIE_STANDALONE_DDP_SERVER_PATH || '/ddp-next/websocket'

/** How often (ms) to send a heartbeat ping when the connection is otherwise idle. */
export const DDP_HEARTBEAT_INTERVAL = 30 * 1000
/** How long (ms) to wait for any message after a ping before considering the connection dead. */
export const DDP_HEARTBEAT_TIMEOUT = 15 * 1000

/** DDP protocol versions we support, most-preferred first. Fixed to the latest for now, to simplify version negotiation. */
export const SUPPORTED_DDP_VERSIONS = ['1']
