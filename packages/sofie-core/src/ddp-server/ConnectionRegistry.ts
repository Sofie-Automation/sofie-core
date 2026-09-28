/** Side-effects to run as standalone-DDP connections open and close (metrics, device online/offline). */
export interface ConnectionLifecycleHooks {
	onOpen(connectionId: string, clientAddress: string): void
	onClose(connectionId: string, clientAddress: string): void
}

/** A snapshot of a single subscription, for debugging/diagnostics. */
export interface DdpSubscriptionDebugData {
	name: string
	/** Number of documents this subscription has published, by collection name. */
	documents: Record<string, number>
}

/** A snapshot of a single session, for debugging/diagnostics. */
export interface DdpSessionDebugData {
	id: string
	clientAddress: string
	subscriptions: DdpSubscriptionDebugData[]
	/** Number of documents in this session's merge box (deduplicated across subscriptions). */
	mergedDocumentCount: number
}

/** The slice of a session the registry needs: identity, plus a diagnostics snapshot. */
export interface TrackedDdpSession {
	readonly connection: {
		readonly id: string
		readonly clientAddress: string
	}
	getDebugData(): DdpSessionDebugData
}

/**
 * Tracks the live sessions on the standalone DDP server, and (in production) drives the shared
 * connection lifecycle side-effects — the `sofie_meteor_ddp_connections_total` gauge and marking
 * PeripheralDevices offline on close — via injected hooks. The hooks are injected (rather than imported
 * directly) so unit tests can exercise the session lifecycle without the DB/metrics machinery.
 */
export class DdpConnectionRegistry {
	private readonly sessions = new Map<string, TrackedDdpSession>()

	constructor(private readonly hooks: ConnectionLifecycleHooks) {}

	add(session: TrackedDdpSession): void {
		this.sessions.set(session.connection.id, session)
		this.hooks.onOpen(session.connection.id, session.connection.clientAddress)
	}

	remove(session: TrackedDdpSession): void {
		if (!this.sessions.delete(session.connection.id)) return
		this.hooks.onClose(session.connection.id, session.connection.clientAddress)
	}

	get size(): number {
		return this.sessions.size
	}

	/** Snapshot every live session, for the performance monitor's debugging dump. */
	getDebugData(): DdpSessionDebugData[] {
		return Array.from(this.sessions.values(), (session) => session.getDebugData())
	}
}
