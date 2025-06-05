import { StudioId, WorkerId, WorkerThreadId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	ManualPromise,
	createManualPromise,
	assertNever,
	getRandomString,
	deferAsync,
} from '@sofie-automation/corelib/dist/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { startTransaction } from '../profiler.js'
import { MongoClient } from 'mongodb'
import { createInvalidateWorkerDataCache, InvalidateWorkerDataCache } from './caches.js'
import { logger } from '../logging.js'
import { LocksManager } from '../locks.js'
import { FORCE_CLEAR_CACHES_JOB } from '@sofie-automation/corelib/dist/worker/shared'
import { JobManager, JobStream } from '../manager.js'
import { Promisify, ThreadedClassManager } from 'threadedclass'
import { StatusCode } from '@sofie-automation/blueprints-integration'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { WorkerThreadStatus } from '@sofie-automation/corelib/dist/dataModel/WorkerThreads'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { sleep } from '@sofie-automation/shared-lib/dist/lib/lib'

export enum ThreadStatus {
	Closed = 0,
	PendingInit = 1,
	Ready = 2,
	/** This is _manual_, in the sense that it's not being handled by threadedClass, but by the worker-parent */
	ManualRestarting = 3,
}

/** How often to check the job for reaching the max duration */
const WATCHDOG_INTERVAL = 5 * 1000
/** The maximum duration a job is allowed to run for before the thread is killed */
const WATCHDOG_KILL_DURATION = 30 * 1000
const WATCHDOG_WARN_DURATION = 10 * 1000

export interface WorkerParentOptions {
	workerId: WorkerId
	studioId: StudioId
	mongoClient: MongoClient
	/** The name of the MongoDB database */
	mongoDbName: string
	locksManager: LocksManager
	jobManager: JobManager
	enableFreezeLimit: boolean
}
export interface WorkerParentBaseOptions extends WorkerParentOptions {
	/** The internal job-queue */
	queueName: string
	/** User-facing label */
	prettyName: string
}

/**
 * Wrap up the result of a job to an object. This allows us to use special types in the error, as anything thrown can get mangled by threadedClass or other wrappings
 */
export interface WorkerJobResult {
	error: string | null // string must be formatted as a UserError
	result: any
}

export abstract class WorkerParentBase {
	readonly #workerId: WorkerId
	readonly #studioId: StudioId
	readonly #queueName: string
	readonly #prettyName: string

	readonly #mongoClient: MongoClient
	readonly #mongoDbName: string
	readonly #locksManager: LocksManager

	#terminate: ManualPromise<void> | undefined

	readonly #jobManager: JobManager
	readonly #jobStream: JobStream

	#pendingInvalidations: InvalidateWorkerDataCache | null = null

	#threadStatus = ThreadStatus.Closed

	#watchdog: NodeJS.Timeout | undefined
	#watchdogJobStarted: number | undefined

	#reportedStatusCode: StatusCode = StatusCode.BAD
	#reportedReason = 'N/A'
	#threadInstanceId: string

	public get threadId(): string {
		return this.#queueName
	}

	protected constructor(options: WorkerParentBaseOptions) {
		this.#workerId = options.workerId
		this.#studioId = options.studioId
		this.#queueName = options.queueName
		this.#mongoClient = options.mongoClient
		this.#mongoDbName = options.mongoDbName
		this.#locksManager = options.locksManager
		this.#prettyName = options.prettyName

		this.#jobManager = options.jobManager
		this.#jobStream = this.#jobManager.subscribeToQueue(this.#queueName, this.#workerId)

		this.#threadStatus = ThreadStatus.PendingInit
		this.#threadInstanceId = getRandomString()
	}

	protected registerStatusEvents(workerThread: Promisify<any>): void {
		ThreadedClassManager.onEvent(workerThread, 'error', (e0: any) => {
			logger.error(`Error in Worker ${this.#prettyName}: `, e0)
		})
		ThreadedClassManager.onEvent(workerThread, 'restarted', () => {
			logger.info(`Worker ${this.#prettyName} restarted`)
			this.#threadStatus = ThreadStatus.PendingInit
			this.#threadInstanceId = getRandomString()
			this.#jobStream.interrupt()
		})
		ThreadedClassManager.onEvent(workerThread, 'thread_closed', () => {
			if (this.#threadStatus === ThreadStatus.ManualRestarting) {
				// ignore closed events when manually restarting
				return
			}
			logger.info(`Worker ${this.#prettyName} closed`)
			this.#threadStatus = ThreadStatus.Closed
			this.#jobStream.interrupt()
		})
	}

	/** Queue a cache invalidation for the thread */
	public queueCacheInvalidation(invalidatorFcn: (invalidations: InvalidateWorkerDataCache) => void): void {
		if (!this.#pendingInvalidations) this.#pendingInvalidations = createInvalidateWorkerDataCache()
		invalidatorFcn(this.#pendingInvalidations)
	}

	/** Initialise the worker thread */
	protected abstract initWorker(mongoUri: string, dbName: string): Promise<void>
	/** Invalidate caches in the worker thread */
	protected abstract invalidateWorkerCaches(invalidations: InvalidateWorkerDataCache): Promise<void>
	/** Run a job in the worker thread */
	protected abstract runJobInWorker(name: string, data: unknown): Promise<WorkerJobResult>
	/** Terminate the worker thread */
	protected abstract terminateWorkerThread(): Promise<void>
	/** Restart the worker thread */
	protected abstract restartWorkerThread(): Promise<void>
	/** Inform the worker thread about a lock change */
	public abstract workerLockChange(lockId: string, locked: boolean): Promise<void>
	/** Collect prometheus metrics from the worker thread */
	public abstract collectMetrics(): Promise<string>

	private async tryRestartThread() {
		// Ensure that the status is set to manual restart so that if this fails, we'll retry later:

		this.#threadStatus = ThreadStatus.ManualRestarting
		logger.info(`Worker ${this.#prettyName} manually restarting child`)

		try {
			await this.restartWorkerThread()
			// Note: the 'restarted' event isn't fired when we are the ones restarting the worker.

			// At this point we have successfully restarted.
			logger.info(`Worker ${this.#prettyName} manually restarted`)
			this.#threadInstanceId = getRandomString()

			this.#threadStatus = ThreadStatus.PendingInit
		} catch (error) {
			logger.error(`Error when trying to restart worker thread ${this.#prettyName}: ${stringifyError(error)}`)
		}
	}

	/** Start the loop feeding work to the worker */
	protected startWorkerLoop(mongoUri: string): void {
		if (!this.#watchdog) {
			// Start a watchdog, to detect if a job has been running for longer than a max threshold. If it has, then we forcefully kill it
			// ThreadedClass will propagate the completion error through the usual route
			this.#watchdog = setInterval(() => {
				if (this.#watchdogJobStarted && this.#watchdogJobStarted + WATCHDOG_KILL_DURATION < Date.now()) {
					// A job has been running for too long.

					logger.warn(`Force restarting worker thread: "${this.#queueName}"`)
					this.#watchdogJobStarted = undefined

					// Force a restart now, to kill the running job
					this.tryRestartThread().catch((e) => {
						logger.warn(`Restarting worker thread "${this.#queueName}" error: ${stringifyError(e)}`)
					})
				}
			}, WATCHDOG_INTERVAL)
		}

		// Monitor statuses:
		const statusMonitorInterval = setInterval(() => {
			this.updatesThreadStatus()

			if (this.#terminate) {
				clearInterval(statusMonitorInterval)
			}
		}, 1000)

		setImmediate(() =>
			deferAsync(
				async () => {
					this.#pendingInvalidations = null

					// Future: subscribe to worker specific cache invalidations here
					// this.subscribeToCacheInvalidations(dbName)

					// Run until told to terminate
					while (!this.#terminate) {
						try {
							switch (this.#threadStatus) {
								case ThreadStatus.Closed:
									// Wait for the thread
									await sleep(100)
									// Check again
									continue
								case ThreadStatus.ManualRestarting:
									await this.tryRestartThread()

									// Make sure the loop doesn't run as fast as possible:
									await sleep(5000)

									continue
								case ThreadStatus.PendingInit:
									logger.debug(`Re-initialising worker thread: "${this.#queueName}"`)
									// Reinitialize the worker
									try {
										await this.initWorker(mongoUri, this.#mongoDbName)
										logger.info(`Worker ${this.#prettyName} ready`)
										this.#threadStatus = ThreadStatus.Ready
									} catch (error) {
										// Initializing failed, restart the child:
										logger.error(
											`Worker ${this.#prettyName} failed to initialize: ${stringifyError(error)}`
										)

										this.#threadStatus = ThreadStatus.ManualRestarting
										// Make sure the loop doesn't run as fast as possible:
										await sleep(5000)
									}

									continue
								case ThreadStatus.Ready:
									// Thread is happy to accept a job
									break
								default:
									assertNever(this.#threadStatus)
							}

							// Wait for a job to appear in the queue:
							await this.#jobStream.wait() // Note: this blocks

							// Handle any invalidations
							if (this.#pendingInvalidations) {
								logger.debug(
									`Invalidating worker caches: ${JSON.stringify(this.#pendingInvalidations)}`
								)
								const invalidations = this.#pendingInvalidations
								this.#pendingInvalidations = null

								await this.invalidateWorkerCaches(invalidations)
							}

							// fetch the job, if there was one
							const job = await this.#jobStream.pop()
							if (job) {
								// Ensure the lock is still good
								// await job.extendLock(this.#workerId, 10000) // Future - ensure the job is locked for enough to process

								const transaction = startTransaction(job.name, 'worker-parent')
								if (transaction) {
									transaction.setLabel('studioId', unprotectString(this.#studioId))
								}

								const startTime = Date.now()
								this.#watchdogJobStarted = startTime

								try {
									logger.verbose(`Starting work ${job.id}: "${job.name}"`)
									logger.silly(
										`Starting work ${job.id}: "${job.name}", payload ${job.id}: ${JSON.stringify(
											job.data
										)}`
									)

									// Future - extend the job lock on an interval
									let result: WorkerJobResult
									if (job.name === FORCE_CLEAR_CACHES_JOB) {
										const invalidations =
											this.#pendingInvalidations ?? createInvalidateWorkerDataCache()
										this.#pendingInvalidations = null

										invalidations.forceAll = true
										await this.invalidateWorkerCaches(invalidations)

										result = { result: undefined, error: null }
									} else {
										result = await this.runJobInWorker(job.name, job.data)
									}

									const endTime = Date.now()
									this.#watchdogJobStarted = undefined

									await this.#jobManager.jobFinished(
										job.id,
										startTime,
										endTime,
										result.error
											? (UserError.tryFromJSON(result.error) ?? new Error(result.error))
											: null,
										result.result
									)

									logger.verbose(`Completed work ${job.id} in ${endTime - startTime}ms`)
								} catch (e: unknown) {
									let error: Error
									if (e instanceof Error) {
										error = e
									} else {
										error = new Error(typeof e === 'string' ? e : `${e}`)
									}

									logger.error(`Job errored ${job.id} "${job.name}": ${stringifyError(e)}`)

									this.#watchdogJobStarted = undefined
									await this.#jobManager.jobFinished(job.id, startTime, Date.now(), error, null)
								}

								// Ensure all locks have been freed after the job
								await this.#locksManager.releaseAllForThread(this.#queueName)

								transaction?.end()
							}
						} catch (e) {
							logger.error(`Uncaught error in worker loop for ${this.#prettyName}: ${stringifyError(e)}`)

							// To avoid flooding logs when re-running the loop, wait a little bit:
							await sleep(5000)
						}
					}

					// Mark completed
					this.#terminate.manualResolve()
				},
				(e: unknown) => {
					deferAsync(
						async () => {
							logger.error(`Worker thread errored: ${stringifyError(e)}`)

							await this.#locksManager.releaseAllForThread(this.#queueName)

							// Ensure the termination is tracked
							if (!this.#terminate) {
								this.#terminate = createManualPromise()
							}

							// Mark completed
							this.#terminate.manualResolve()
						},
						(e2: unknown) => {
							logger.error(`Worker thread errored while terminating: ${stringifyError(e2)}`)
						}
					)
				}
			)
		)
	}

	private updatesThreadStatus() {
		let statusCode: StatusCode
		let reason: string
		switch (this.#threadStatus) {
			case ThreadStatus.Closed:
				statusCode = StatusCode.BAD
				reason = 'Closed'
				break
			case ThreadStatus.ManualRestarting:
			case ThreadStatus.PendingInit:
				statusCode = StatusCode.BAD
				reason = 'Thread restarting'
				break
			case ThreadStatus.Ready:
				statusCode = StatusCode.GOOD
				reason = 'OK'
				break
			default:
				statusCode = StatusCode.FATAL
				reason = `Unknown status: ${this.#threadStatus}`
				assertNever(this.#threadStatus)
		}

		if (statusCode === StatusCode.GOOD) {
			if (this.#watchdogJobStarted && Date.now() - this.#watchdogJobStarted > WATCHDOG_WARN_DURATION) {
				statusCode = StatusCode.WARNING_MINOR
				reason = 'Job is running slow'
			}
		}

		if (statusCode !== this.#reportedStatusCode || reason !== this.#reportedReason) {
			this.#reportedStatusCode = statusCode
			this.#reportedReason = reason

			this.saveStatusCode(statusCode, reason).catch((e) => {
				logger.error('Error updating thread status', e)
			})
		}
	}

	private async saveStatusCode(statusCode: StatusCode, reason: string) {
		const db = this.#mongoClient.db(this.#mongoDbName)
		const collection = db.collection<WorkerThreadStatus>(CollectionName.WorkerThreads)

		const workerThreadId: WorkerThreadId = protectString(`${this.#workerId}_${this.#queueName}`)

		const status: WorkerThreadStatus = {
			_id: workerThreadId,
			workerId: this.#workerId,

			instanceId: this.#threadInstanceId,
			name: this.#prettyName,
			statusCode: statusCode,
			reason: reason,
		}
		return collection
			.replaceOne({ _id: status._id }, status, {
				upsert: true,
			})
			.catch((e) => {
				logger.error(`Failed to update WorkerThreadStatus: ${stringifyError(e)}`)
			})
	}

	/** Terminate and cleanup the worker thread */
	async terminate(): Promise<void> {
		if (this.#watchdog) {
			clearInterval(this.#watchdog)
			this.#watchdog = undefined
		}

		await this.saveStatusCode(StatusCode.BAD, 'Shutting down')

		await this.#locksManager.releaseAllForThread(this.#queueName)

		if (!this.#terminate) {
			this.#terminate = createManualPromise()
		}
		// wait for the work loop to exit
		await this.#terminate

		// stop the thread
		await this.terminateWorkerThread()

		await this.#jobStream.close()
	}
}
