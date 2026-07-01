/** Side-effects to run as standalone-DDP connections open and close (metrics, device online/offline). */
export interface ConnectionLifecycleHooks {
	onOpen(connectionId: string, clientAddress: string): void
	onClose(connectionId: string, clientAddress: string): void
}

/**
 * Tracks the live sessions on the standalone DDP server, and (in production) drives the shared
 * connection lifecycle side-effects — the `sofie_meteor_ddp_connections_total` gauge and marking
 * PeripheralDevices offline on close — via injected hooks. The hooks are injected (rather than imported
 * directly) so unit tests can exercise the session lifecycle without the DB/metrics machinery.
 */
export class DdpConnectionRegistry {
	private readonly sessions = new Set<string>()

	constructor(private readonly hooks: ConnectionLifecycleHooks) {}

	add(sessionId: string, clientAddress: string): void {
		this.sessions.add(sessionId)
		this.hooks.onOpen(sessionId, clientAddress)
	}

	remove(sessionId: string, clientAddress: string): void {
		if (!this.sessions.delete(sessionId)) return
		this.hooks.onClose(sessionId, clientAddress)
	}

	get size(): number {
		return this.sessions.size
	}
}
