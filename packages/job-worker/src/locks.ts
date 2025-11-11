import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { logger } from './logging.js'
import { AnyLockEvent } from './workers/locks.js'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'

type OwnerAndLockIds = [string, string]

class LockResource {
	holder: OwnerAndLockIds | null = null
	waitingWorkers: Array<OwnerAndLockIds> = []

	constructor(readonly id: string) {}
}

export type ThreadLockChanged = (threadId: string, lockId: string, locked: boolean) => Promise<boolean>
// type Unsub = () => void
export class LocksManager {
	readonly #resources = new Map<string, LockResource>()

	readonly #lockChanged: ThreadLockChanged

	constructor(lockChanged: ThreadLockChanged) {
		this.#lockChanged = lockChanged
	}

	private getResource(resourceId: string): LockResource {
		let resource = this.#resources.get(resourceId)
		if (!resource) {
			resource = new LockResource(resourceId)
			this.#resources.set(resourceId, resource)
		}
		return resource
	}

	private lockNextWorker(resource: LockResource): void {
		logger.silly(
			`Resource: ${resource.id} has holder "${resource.holder?.[0]}" and ${resource.waitingWorkers.length} waiting`
		)
		if (resource.holder === null) {
			const nextWorker = resource.waitingWorkers.shift()
			if (nextWorker) {
				// Assume it will be locked
				resource.holder = nextWorker

				logger.silly(
					`Resource: ${resource.id} giving to "${nextWorker[0]}". ${resource.waitingWorkers.length} waiting`
				)

				this.#lockChanged(nextWorker[0], nextWorker[1], true)
					.catch(async (e) => {
						logger.error(`Failed to report lock to worker: ${stringifyError(e)}`)

						// It failed, so next worker should be attempted
						return Promise.resolve(false)
					})
					.then((success) => {
						if (!success) {
							// Lock wasnt successful, so try the next
							if (
								resource.holder &&
								resource.holder[0] === nextWorker[0] &&
								resource.holder[1] === nextWorker[1]
							) {
								// free it as the aquire was 'rejected'
								resource.holder = null
								this.lockNextWorker(resource)
							}
						}
					})
					.catch((e) => {
						logger.error(`Failed to lock next worker: ${stringifyError(e)}`)
					})
			}
		}
	}

	async handleLockEvent(threadId: string, e: AnyLockEvent): Promise<void> {
		// Don't block the worker who called this
		setImmediate(() => {
			try {
				const resource = this.getResource(e.resourceId)

				switch (e.event) {
					case 'lock':
						resource.waitingWorkers.push([threadId, e.lockId])

						// Check if we can lock it
						this.lockNextWorker(resource)

						break
					case 'unlock':
						if (resource.holder && resource.holder[0] === threadId && resource.holder[1] === e.lockId) {
							resource.holder = null

							logger.silly(
								`Resource: ${resource.id} releasing from "${threadId}". ${resource.waitingWorkers.length} waiting`
							)

							this.#lockChanged(threadId, e.lockId, false).catch((e) => {
								logger.error(`Failed to report lock change back to worker: ${stringifyError(e)}`)
							})
						} else {
							logger.warn(`Worker tried to unlock a lock it doesnt own`)
						}

						this.lockNextWorker(resource)
						break
					default:
						assertNever(e)
						break
				}
			} catch (e) {
				logger.error(`Unexpected error in lock handler: ${stringifyError(e)}`)
			}
		})
	}

	/** Unsubscribe a worker from the lock channels */
	async releaseAllForThread(threadId: string): Promise<void> {
		// ensure all locks are freed
		for (const resource of this.#resources.values()) {
			if (resource.waitingWorkers.length > 0) {
				// Remove this worker from any waiting orders
				resource.waitingWorkers = resource.waitingWorkers.filter((r) => r[0] !== threadId)
			}

			if (resource.holder && resource.holder[0] === threadId) {
				// Remove this worker from any held locks
				resource.holder = null
				this.lockNextWorker(resource)
			}
		}
	}
}
