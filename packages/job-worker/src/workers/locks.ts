import { logger } from '../logging.js'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

export type AnyLockEvent = LockEvent | UnLockEvent
export interface LockEvent {
	event: 'lock'
	resourceId: string
	lockId: string
}
export interface UnLockEvent {
	event: 'unlock'
	resourceId: string
	lockId: string
}

const TimeoutAquireLock = 30000
const TimeoutReleaseLock = 5000

export class LocksManager {
	readonly #emitLockEvent: (event: AnyLockEvent) => Promise<void>
	/** These are locks that we are waiting to aquire/release */
	readonly pendingLocks: Map<string, PromiseWithResolvers<boolean>>

	constructor(emitLockEvent: (event: AnyLockEvent) => Promise<void>) {
		this.#emitLockEvent = emitLockEvent
		this.pendingLocks = new Map()
	}

	changeEvent(lockId: string, locked: boolean): void {
		// defer to not block the call in the parent
		setImmediate(() => {
			try {
				const lock = this.pendingLocks.get(lockId)
				if (!lock) throw new Error('Lock not waiting!')

				// Pass on the result for processing
				lock.resolve(locked)
			} catch (e) {
				logger.error(`LockChange "${lockId}":${locked} failed: ${stringifyError(e)}`)
			}
		})
	}

	async aquire(lockId: string, resourceId: string): Promise<void> {
		if (this.pendingLocks.has(lockId)) throw new Error(`Lock "${lockId}" is already pending`)

		const completedPromise = Promise.withResolvers<boolean>()
		this.pendingLocks.set(lockId, completedPromise)

		// inform parent
		await this.#emitLockEvent({
			event: 'lock',
			lockId,
			resourceId,
		})

		const timeout = setTimeout(() => {
			try {
				// Aquire timed out!
				this.pendingLocks.delete(lockId)
				completedPromise.reject(new Error('Lock aquire timed out!'))
			} catch (e) {
				logger.error(`Unexpected error when timing out acquiring a lock: "${lockId}": ${stringifyError(e)}`)
			}
		}, TimeoutAquireLock)

		return completedPromise.promise.then((locked) => {
			clearTimeout(timeout)

			this.pendingLocks.delete(lockId)

			if (!locked) throw new Error(`Lock "${lockId}" wanted lock but got unlock!`)
		})
	}

	async release(lockId: string, resourceId: string): Promise<void> {
		if (this.pendingLocks.has(lockId)) throw new Error(`Lock "${lockId}" is already pending`)

		const completedPromise = Promise.withResolvers<boolean>()
		this.pendingLocks.set(lockId, completedPromise)

		// inform parent
		await this.#emitLockEvent({
			event: 'unlock',
			lockId,
			resourceId,
		})

		const timeout = setTimeout(() => {
			try {
				// Release timed out
				completedPromise.resolve(true)
			} catch (e) {
				logger.error(`Unexpected error when timing out releasing a lock: "${lockId}": ${stringifyError(e)}`)
			}
		}, TimeoutReleaseLock)

		return completedPromise.promise.then((locked) => {
			clearTimeout(timeout)

			this.pendingLocks.delete(lockId)

			if (locked) throw new Error(`Lock "${lockId}" wanted unlock but got lock!`)
		})
	}
}
