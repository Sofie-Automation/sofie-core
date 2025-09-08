import { EventsWorkerChild } from './child.js'
import { InvalidateWorkerDataCache } from '../caches.js'
import { WorkerJobResult, WorkerParentBase, WorkerParentBaseOptions, WorkerParentOptions } from '../parent-base.js'
import { AnyLockEvent } from '../locks.js'
import { getEventsQueueName } from '@sofie-automation/corelib/dist/worker/events'
import { Promisify, threadedClass, ThreadedClassManager } from 'threadedclass'
import { FastTrackTimelineFunc, LogLineWithSourceFunc } from '../../main.js'

const FREEZE_LIMIT = 1000 // how long to wait for a response to a Ping
const RESTART_TIMEOUT = 10000 // how long to wait for a restart to complete before throwing an error
const KILL_TIMEOUT = 10000 // how long to wait for a thread to terminate before throwing an error

export class EventsWorkerParent extends WorkerParentBase {
	readonly #thread: Promisify<EventsWorkerChild>

	private constructor(baseOptions: WorkerParentBaseOptions, thread: Promisify<EventsWorkerChild>) {
		super(baseOptions)
		this.#thread = thread
	}

	static async start(
		baseOptions: WorkerParentOptions,
		mongoUri: string,
		logLine: LogLineWithSourceFunc,
		fastTrackTimeline: FastTrackTimelineFunc | null
	): Promise<EventsWorkerParent> {
		const queueName = getEventsQueueName(baseOptions.studioId)
		const prettyName = queueName

		const emitLockEvent = async (e: AnyLockEvent) => baseOptions.locksManager.handleLockEvent(queueName, e)

		const workerThread = await threadedClass<EventsWorkerChild, typeof EventsWorkerChild>(
			'./child',
			'EventsWorkerChild',
			[baseOptions.studioId, emitLockEvent, baseOptions.jobManager.queueJob, logLine, fastTrackTimeline],
			{
				instanceName: `Events: ${baseOptions.studioId}`,
				autoRestart: true,
				freezeLimit: baseOptions.enableFreezeLimit ? FREEZE_LIMIT : 0,
				restartTimeout: RESTART_TIMEOUT,
				killTimeout: KILL_TIMEOUT,
			}
		)

		// create and start the worker
		const parent = new EventsWorkerParent({ ...baseOptions, queueName, prettyName }, workerThread)

		parent.registerStatusEvents(workerThread)

		parent.startWorkerLoop(mongoUri)
		return parent
	}

	protected async initWorker(mongoUri: string, dbName: string): Promise<void> {
		return this.#thread.init(mongoUri, dbName)
	}
	protected async invalidateWorkerCaches(invalidations: InvalidateWorkerDataCache): Promise<void> {
		return this.#thread.invalidateCaches(invalidations)
	}
	protected async runJobInWorker(name: string, data: unknown): Promise<WorkerJobResult> {
		return this.#thread.runJob(name, data)
	}
	protected async terminateWorkerThread(): Promise<void> {
		return ThreadedClassManager.destroy(this.#thread)
	}
	protected async restartWorkerThread(): Promise<void> {
		return ThreadedClassManager.restart(this.#thread, true)
	}
	public async workerLockChange(lockId: string, locked: boolean): Promise<void> {
		return this.#thread.lockChange(lockId, locked)
	}
	public async collectMetrics(): Promise<string> {
		return this.#thread.collectMetrics()
	}
}
