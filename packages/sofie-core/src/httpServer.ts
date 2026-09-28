import type Koa from 'koa'
import http, { type Server as HttpServer } from 'http'
import { logger } from './logging'

/** Port the HTTP server listens on, when `SOFIE_PORT` is not set. */
const DEFAULT_PORT = 3000
/**
 * Address the HTTP server binds to, when `SOFIE_BIND_ADDRESS` is not set.
 * All interfaces, which is what a deployed instance wants. The dev script overrides this to loopback.
 */
const DEFAULT_BIND_ADDRESS = '0.0.0.0'

export function getHttpServerPort(): number {
	const raw = process.env.SOFIE_PORT
	if (!raw) return DEFAULT_PORT

	const port = Number.parseInt(raw, 10)
	if (!Number.isInteger(port) || port < 0 || port > 65535) {
		throw new Error(`Invalid SOFIE_PORT: "${raw}". Must be a port number between 0 and 65535`)
	}
	return port
}

export function getHttpServerBindAddress(): string {
	return process.env.SOFIE_BIND_ADDRESS || DEFAULT_BIND_ADDRESS
}

/**
 * Create the HTTP server for the koa app, without listening yet.
 * Listening is deferred until {@link listenHttpServer}, so that other startup steps (such as the
 * standalone DDP server, which adds an `upgrade` handler) can attach to the server before the first
 * request can arrive.
 */
export function createHttpServer(koaApp: Koa): HttpServer {
	return http.createServer(koaApp.callback())
}

/** Wrap an IPv6 address in brackets, so the result is a usable URL authority. */
function formatHost(host: string): string {
	return host.includes(':') ? `[${host}]` : host
}

/** Begin accepting requests, resolving once the server is listening. */
export async function listenHttpServer(server: HttpServer): Promise<void> {
	const port = getHttpServerPort()
	const bindAddress = getHttpServerBindAddress()

	await new Promise<void>((resolve, reject) => {
		const onListenError = (e: Error) => reject(e)

		server.once('error', onListenError)
		server.listen(port, bindAddress, () => {
			server.off('error', onListenError)
			resolve()
		})
	})

	// Prefer the address the server actually bound to, as `SOFIE_PORT=0` resolves to a random port
	const address = server.address()
	const boundTo =
		address && typeof address === 'object'
			? `${formatHost(address.address)}:${address.port}`
			: `${formatHost(bindAddress)}:${port}`

	logger.info(`HTTP server listening on http://${boundTo}`)
}
