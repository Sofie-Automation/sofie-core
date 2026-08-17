/**
 * Configuration for the standalone DDP server.
 */

/** The WebSocket path the standalone DDP server listens on (mounted on Meteor's HTTP server). */
export const STANDALONE_DDP_SERVER_PATH = '/websocket'

/** How often (ms) to send a heartbeat ping when the connection is otherwise idle. */
export const DDP_HEARTBEAT_INTERVAL = 30 * 1000
/** How long (ms) to wait for any message after a ping before considering the connection dead. */
export const DDP_HEARTBEAT_TIMEOUT = 15 * 1000

/** DDP protocol versions we support, most-preferred first. Fixed to the latest for now, to simplify version negotiation. */
export const SUPPORTED_DDP_VERSIONS = ['1']
