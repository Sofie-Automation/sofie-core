import { EventEmitter } from 'events'

export type WatchDogCheckFunction = () => Promise<any>
export type WatchDogEvents = {
	message: [message: string]
	exit: []
}

/**
 * Watchdog is used to make sure there is a working connection with Core.
 * Usage: in the function provided to addCheck, we should send a message to core
 * and resolve the returned promise when we've got a good reply.
 * If the Watchdog doesn't get it's checkFunctions resolved withing a certain time
 * it will forcefully quit the Node process (or emit the 'exit' event.
 */
export class WatchDog extends EventEmitter<WatchDogEvents> {
	public timeout: number
	private _checkTimeout: NodeJS.Timeout | null = null
	private _dieTimeout: NodeJS.Timeout | null = null
	private _watching = false
	private _checkFunctions: WatchDogCheckFunction[] = []
	private _runningChecks = false

	constructor(_timeout?: number) {
		super()
		this.timeout = _timeout || 60 * 1000
	}
	public startWatching(): void {
		if (!this._watching) {
			this._watch()
		}
		this._watching = true
	}
	public stopWatching(): void {
		if (this._watching) {
			if (this._dieTimeout) clearTimeout(this._dieTimeout)
			if (this._checkTimeout) clearTimeout(this._checkTimeout)
		}
		this._watching = false
	}
	public addCheck(fcn: () => Promise<any>): void {
		this._checkFunctions.push(fcn)
	}
	public removeCheck(fcn: () => Promise<any>): void {
		const i = this._checkFunctions.indexOf(fcn)
		if (i !== -1) this._checkFunctions.splice(i, 1)
	}
	public receivedData(): void {
		if (this._watching && !this._runningChecks) {
			this._watch()
		}
	}

	private _everythingIsOk() {
		if (this._watching) {
			this._watch()
		}
	}
	private _watch() {
		if (this._dieTimeout) clearTimeout(this._dieTimeout)
		if (this._checkTimeout) clearTimeout(this._checkTimeout)

		this._checkTimeout = setTimeout(() => {
			this._runningChecks = true

			Promise.all(this._checkFunctions.map(async (fcn) => fcn()))
				.then(() => {
					// console.log('all promises have resolved')
					// all promises have resolved
					this._everythingIsOk()
					this._runningChecks = false
				})
				.catch(() => {
					// do nothing, the die-timeout will trigger soon
				})

			this._dieTimeout = setTimeout(() => {
				// This timeout SHOULD have been aborted by .everythingIsOk
				// but since it's not, it is our job to quit gracefully, triggering a reset
				if (this.listenerCount('message') > 0) {
					this.emit('message', 'Watchdog: Quitting process!')
				} else {
					console.log('Watchdog: Quitting!')
				}
				if (this.listenerCount('exit') > 0) {
					this.emit('exit')
				} else {
					// eslint-disable-next-line n/no-process-exit
					process.exit(42)
				}
			}, 5000)
		}, this.timeout)
	}
}
