/**
 * DDP heartbeat, ported from Meteor's `ddp-common` heartbeat to plain timers.
 *
 * The server periodically checks whether any packet has been seen since the last interval; if not it
 * sends a `ping` and starts a timeout. Any received message (`messageReceived`) clears that timeout.
 * If the timeout elapses with no traffic, `onTimeout` fires and the session is closed.
 */
export interface HeartbeatOptions {
	heartbeatInterval: number
	heartbeatTimeout: number
	onTimeout: () => void
	sendPing: () => void
}

export class Heartbeat {
	private readonly options: HeartbeatOptions
	private intervalHandle: NodeJS.Timeout | undefined
	private timeoutHandle: NodeJS.Timeout | undefined
	private seenPacket = false

	constructor(options: HeartbeatOptions) {
		this.options = options
	}

	start(): void {
		this.intervalHandle = setInterval(() => this.intervalFired(), this.options.heartbeatInterval)
	}

	stop(): void {
		if (this.intervalHandle) {
			clearInterval(this.intervalHandle)
			this.intervalHandle = undefined
		}
		this.clearTimeoutTimer()
	}

	messageReceived(): void {
		this.seenPacket = true
		this.clearTimeoutTimer()
	}

	private intervalFired(): void {
		if (!this.seenPacket && !this.timeoutHandle) {
			this.sendPing()
		}
		this.seenPacket = false
	}

	private sendPing(): void {
		this.options.sendPing()
		if (!this.timeoutHandle) {
			this.timeoutHandle = setTimeout(() => this.timeoutFired(), this.options.heartbeatTimeout)
		}
	}

	private timeoutFired(): void {
		this.timeoutHandle = undefined
		this.options.onTimeout()
	}

	private clearTimeoutTimer(): void {
		if (this.timeoutHandle) {
			clearTimeout(this.timeoutHandle)
			this.timeoutHandle = undefined
		}
	}
}
