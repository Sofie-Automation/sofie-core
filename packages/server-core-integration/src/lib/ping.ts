export class CorePinger {
	private _pingTimeout: NodeJS.Timeout | null = null
	private _connected = false
	private _destroyed = false

	constructor(
		private readonly emitError: (err: string) => void,
		private readonly doPing: () => Promise<void>
	) {}

	public setConnectedAndTriggerPing(connected: boolean): void {
		this._connected = connected

		this.triggerPing()
	}

	public destroy(): void {
		this._destroyed = true
		if (this._pingTimeout) {
			clearTimeout(this._pingTimeout)
			this._pingTimeout = null
		}
	}

	public triggerPing(): void {
		if (this._destroyed) return

		if (!this._pingTimeout) {
			this._pingTimeout = setTimeout(() => {
				this._pingTimeout = null
				this._ping()
			}, 90 * 1000)
		}
	}
	public triggerDelayPing(): void {
		// delay the ping:
		if (this._pingTimeout) {
			clearTimeout(this._pingTimeout)
			this._pingTimeout = null
		}
		this.triggerPing()
	}
	private _ping() {
		if (this._destroyed) return

		try {
			if (this._connected) {
				this.doPing().catch((e) => this.emitError('_ping' + e))
			}
		} catch (e) {
			this.emitError('_ping2 ' + e)
		}
		if (this._connected) {
			this.triggerPing()
		}
	}
}
