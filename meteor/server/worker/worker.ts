import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getStudioQueueName, StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
import { getIngestQueueName, IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
import { getEventsQueueName } from '@sofie-automation/corelib/dist/worker/events'
import { logger } from '../logging'
import { Meteor } from 'meteor/meteor'
import { FORCE_CLEAR_CACHES_JOB, IS_INSPECTOR_ENABLED } from '@sofie-automation/corelib/dist/worker/shared'
import { threadedClass, Promisify, ThreadedClassManager } from 'threadedclass'
import type { JobSpec } from '@sofie-automation/job-worker/dist/main'
import type { IpcJobWorker } from '@sofie-automation/job-worker/dist/ipc'
import { createManualPromise, getRandomString, ManualPromise, Time } from '../lib/tempLib'
import { getCurrentTime } from '../lib/lib'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { UserActionsLogItem } from '@sofie-automation/meteor-lib/dist/collections/UserActionsLog'
import { triggerFastTrackObserver, FastTrackObservers } from '../publications/fastTrack'
import { TimelineComplete } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { fetchStudioLight } from '../optimizations'
import * as path from 'path'
import { LogEntry } from 'winston'
import { initializeWorkerStatus, setWorkerStatus } from './workerStatus'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { UserActionsLog } from '../collections'
import { MetricsCounter } from '@sofie-automation/corelib/dist/prometheus'
import { isInTestWrite } from '../security/securityVerify'
import { UserError } from '@sofie-automation/corelib/dist/error'

const FREEZE_LIMIT = 1000 // how long to wait for a response to a Ping
const RESTART_TIMEOUT = 30000 // how long to wait for a restart to complete before throwing an error
const KILL_TIMEOUT = 30000 // how long to wait for a thread to terminate before throwing an error

interface JobEntry {
	spec: JobSpec
	/** The completionHandler is called when a job is completed. null implies "shoot-and-forget" */
	completionHandler: JobCompletionHandler | null
}

const metricsQueueTotalCounter = new MetricsCounter({
	name: 'sofie_meteor_jobqueue_queue_total',
	help: 'Number of jobs put into each worker job queues',
	labelNames: ['threadName'],
})
const metricsQueueSuccessCounter = new MetricsCounter({
	name: 'sofie_meteor_jobqueue_success',
	help: 'Number of successful jobs from each worker',
	labelNames: ['threadName'],
})
const metricsQueueErrorsCounter = new MetricsCounter({
	name: 'sofie_meteor_jobqueue_queue_errors',
	help: 'Number of failed jobs from each worker',
	labelNames: ['threadName'],
})

interface JobQueue {
	jobs: Array<JobEntry | null>
	/** Notify that there is a job waiting (aka worker is long-polling) */
	notifyWorker: ManualPromise<void> | null

	metricsTotal: MetricsCounter.Internal
	metricsSuccess: MetricsCounter.Internal
	metricsErrors: MetricsCounter.Internal
}

type JobCompletionHandler = (startedTime: number, finishedTime: number, err: any, result: any) => void

interface RunningJob {
	queueName: string
	completionHandler: JobCompletionHandler | null
}

const queues = new Map<string, JobQueue>()
/** Contains all jobs that are currently being executed by a Worker. */
const runningJobs = new Map<string, RunningJob>()

function getOrCreateQueue(queueName: string): JobQueue {
	let queue = queues.get(queueName)
	if (!queue) {
		queue = {
			jobs: [],
			notifyWorker: null,
			metricsTotal: metricsQueueTotalCounter.labels(queueName),
			metricsSuccess: metricsQueueSuccessCounter.labels(queueName),
			metricsErrors: metricsQueueErrorsCounter.labels(queueName),
		}
		queues.set(queueName, queue)
	}
	return queue
}

async function jobFinished(
	id: string,
	startedTime: number,
	finishedTime: number,
	err: any,
	result: any
): Promise<void> {
	const job = runningJobs.get(id)
	if (job) {
		runningJobs.delete(id)

		// Update metrics
		const queue = queues.get(job.queueName)
		if (queue) {
			if (err) {
				queue.metricsErrors.inc()
			} else {
				queue.metricsSuccess.inc()
			}
		}

		if (job.completionHandler) {
			const userError = err ? UserError.tryFromJSON(err) || new Error(err) : undefined
			job.completionHandler(startedTime, finishedTime, userError, result)
		}
	}
}
/** This is called by each Worker Thread, when it is idle and wants another job */
async function waitForNextJob(queueName: string): Promise<void> {
	// Check if there is a job waiting:
	const queue = getOrCreateQueue(queueName)
	if (queue.jobs.length > 0) {
		return
	}
	// No job ready, do a long-poll

	// Already a worker waiting? Reject it, as we replace it
	if (queue.notifyWorker) {
		const oldNotify = queue.notifyWorker

		Meteor.defer(() => {
			try {
				// Notify the worker in the background
				oldNotify.manualReject(new Error('new workerThread, replacing the old'))
			} catch (_e) {
				// Ignore
			}
		})
	}

	// Wait to be notified about a job
	queue.notifyWorker = createManualPromise()
	return queue.notifyWorker
}
/** This is called by each Worker Thread, when it thinks there is a job to execute */
async function getNextJob(queueName: string): Promise<JobSpec | null> {
	// Check if there is a job waiting:
	const queue = getOrCreateQueue(queueName)
	const job = queue.jobs.shift()
	if (job) {
		// If there is a completion handler, register it for execution
		runningJobs.set(job.spec.id, {
			queueName,
			completionHandler: job.completionHandler,
		})

		// Pass the job to the worker
		return job.spec
	}

	// No job ready
	return null
}
/** This is called by each Worker Thread, when it is idle and wants another job */
async function interruptJobStream(queueName: string): Promise<void> {
	// Check if there is a job waiting:
	const queue = getOrCreateQueue(queueName)
	if (queue.notifyWorker) {
		const oldNotify = queue.notifyWorker
		queue.notifyWorker = null

		Meteor.defer(() => {
			try {
				// Notify the worker in the background
				oldNotify.manualResolve()
			} catch (_e) {
				// Ignore
			}
		})
	} else {
		queue.jobs.unshift(null)
	}
}
async function queueJobWithoutResult(queueName: string, jobName: string, jobData: unknown): Promise<void> {
	queueJobInner(queueName, {
		spec: {
			id: getRandomString(),
			name: jobName,
			data: jobData,
		},
		completionHandler: null,
	})
}

function queueJobInner(queueName: string, jobToQueue: JobEntry): void {
	// Put the job at the end of the queue:
	const queue = getOrCreateQueue(queueName)
	queue.jobs.push(jobToQueue)
	queue.metricsTotal.inc()

	// If there is a worker waiting to pick up a job
	if (queue.notifyWorker) {
		const notify = queue.notifyWorker

		// Worker is about to be notified, so clear the handle:
		queue.notifyWorker = null
		Meteor.defer(() => {
			try {
				// Notify the worker in the background
				notify.manualResolve()
			} catch (e) {
				// Queue failed
				logger.error(`Error in notifyWorker: ${stringifyError(e)}`)
			}
		})
	}
}

function queueJobAndWrapResult<TRes>(queueName: string, job: JobSpec, now: Time): WorkerJob<TRes> {
	const { result, completionHandler } = generateCompletionHandler<TRes>(job.id, now)

	queueJobInner(queueName, {
		spec: job,
		completionHandler: completionHandler,
	})

	return result
}

async function fastTrackTimeline(newTimeline: TimelineComplete): Promise<void> {
	const studio = await fetchStudioLight(newTimeline._id)
	if (!studio) throw new Error(`Studio "${newTimeline._id}" was not found for timeline fast-track`)

	// Also do a fast-track for the timeline to be published faster:
	triggerFastTrackObserver(FastTrackObservers.TIMELINE, [studio._id], newTimeline)

	// Store the timelineHash to the latest UserLog,
	// so that it can be looked up later to set .gatewayDuration:
	const selector: MongoQuery<UserActionsLogItem> = {
		// Try to match the latest userActionLogItem:
		success: { $exists: false },
		// This could be improved (as it relies on that the internal execution takes no longer than 3000 ms),
		// but should be good enough for now..
		timestamp: { $gt: getCurrentTime() - 3000 },

		// Only set the timelineHash once:
		timelineHash: { $exists: false },
	}
	if (studio.organizationId) {
		selector.organizationId = studio.organizationId
	}

	await UserActionsLog.updateAsync(
		selector,
		{
			$set: {
				timelineHash: newTimeline.timelineHash,
				timelineGenerated: newTimeline.generated,
			},
		},
		{ multi: false }
	)
}

async function logLine(msg: LogEntry): Promise<void> {
	logger.log(msg)
}

let worker: Promisify<IpcJobWorker> | undefined
Meteor.startup(async () => {
	if (Meteor.isTest) return // Don't start the worker

	if (Meteor.isDevelopment) {
		// Ensure meteor restarts when the _force_restart file changes
		try {
			require('../_force_restart')
		} catch (_e) {
			// ignore
		}
	}

	if (!process.env.MONGO_URL) throw new Error('MONGO_URL must be defined to launch Sofie')
	// Note: MONGO_OPLOG_URL isn't required for the worker, but is required for meteor to not lag badly
	if (!process.env.MONGO_OPLOG_URL) throw new Error('MONGO_OPLOG_URL must be defined to launch Sofie')

	// Meteor wants the dbname as the path of the mongo url, but the mongodb driver needs it separate
	const rawUrl = new URL(process.env.MONGO_URL)
	const dbName = rawUrl.pathname.substring(1) // Trim off first '/'
	rawUrl.pathname = ''
	const mongoUri = rawUrl.toString()

	// In dev, the path is predictable. In bundled meteor the path will be different, so take it from an env variable
	let workerEntrypoint = '@sofie-automation/job-worker/dist/ipc.js'
	if (process.env.WORKER_EXEC_DIR) {
		workerEntrypoint = path.join(process.env.WORKER_EXEC_DIR, 'dist/ipc.js')
	}

	logger.info('Worker threads initializing')
	const workerInstanceId = `${Date.now()}_${getRandomString(4)}`
	const workerId = await initializeWorkerStatus(workerInstanceId, 'Default')
	// Startup the worker 'parent' at startup
	worker = await threadedClass<IpcJobWorker, typeof IpcJobWorker>(
		workerEntrypoint,
		'IpcJobWorker',
		[
			workerId,
			jobFinished,
			interruptJobStream,
			waitForNextJob,
			getNextJob,
			queueJobWithoutResult,
			logLine,
			fastTrackTimeline,
			!IS_INSPECTOR_ENABLED,
		],
		{
			autoRestart: true,
			freezeLimit: IS_INSPECTOR_ENABLED ? 0 : FREEZE_LIMIT,
			restartTimeout: RESTART_TIMEOUT,
			killTimeout: KILL_TIMEOUT,
		}
	)

	ThreadedClassManager.onEvent(
		worker,
		'error',
		Meteor.bindEnvironment((e0: unknown) => {
			logger.error(`Error in Worker threads IPC: ${stringifyError(e0)}`)
		})
	)
	ThreadedClassManager.onEvent(
		worker,
		'restarted',
		Meteor.bindEnvironment(() => {
			logger.warn(`Worker threads restarted`)

			worker!.run(mongoUri, dbName).catch((e) => {
				logger.error(`Failed to reinit worker threads after restart: ${stringifyError(e)}`)
			})
			setWorkerStatus(workerId, true, 'restarted', true).catch((e) => {
				logger.error(`Failed to update worker threads status after restart: ${stringifyError(e)}`)
			})
		})
	)
	ThreadedClassManager.onEvent(
		worker,
		'thread_closed',
		Meteor.bindEnvironment(() => {
			// Thread closed, reject all jobs
			const now = getCurrentTime()
			for (const job of runningJobs.values()) {
				const queue = queues.get(job.queueName)
				if (queue) queue.metricsErrors.inc()

				if (job.completionHandler) {
					job.completionHandler(now, now, new Error('Thread closed'), null)
				}
			}
			runningJobs.clear()

			setWorkerStatus(workerId, false, 'Closed').catch((e) => {
				logger.error(`Failed to update worker threads status: ${stringifyError(e)}`)
			})
		})
	)

	await setWorkerStatus(workerId, true, 'Initializing...')

	logger.info('Worker threads starting')
	await worker.run(mongoUri, dbName)
	await setWorkerStatus(workerId, true, 'OK')
	logger.info('Worker threads ready')
})

export interface JobTimings {
	queueTime: number
	startedTime: number | undefined
	finishedTime: number | undefined
	completedTime: number
}

export interface WorkerJob<TRes> {
	/** Promise returning the result. Resolved upon completion of the job */
	complete: Promise<TRes>
	/** Promise returning the timings of an execution */
	getTimings: Promise<JobTimings>
	// abort: () => Promise<boolean> // Attempt to abort the job. Returns whether it was successful
}

/**
 * Collect all the prometheus metrics across all the worker threads
 */
export async function collectWorkerPrometheusMetrics(): Promise<string[]> {
	if (!worker) return []

	return worker.collectMetrics()
}

/**
 * Queue a force clear caches job for all workers
 * @param studioIds Studios to clear caches for
 */
export async function QueueForceClearAllCaches(studioIds: StudioId[]): Promise<void> {
	const jobs: Array<WorkerJob<any>> = []

	if (!worker) throw new Meteor.Error(500, `Worker hasn't been initialized!`)

	// TODO - can we push these higher priority?
	const now = getCurrentTime()

	for (const studioId of studioIds) {
		// Clear studio
		jobs.push(
			queueJobAndWrapResult(
				getStudioQueueName(studioId),
				{
					id: getRandomString(),
					name: FORCE_CLEAR_CACHES_JOB,
					data: undefined,
				},
				now
			)
		)

		// Clear ingest
		jobs.push(
			queueJobAndWrapResult(
				getIngestQueueName(studioId),
				{
					id: getRandomString(),
					name: FORCE_CLEAR_CACHES_JOB,
					data: undefined,
				},
				now
			)
		)

		// Clear events
		jobs.push(
			queueJobAndWrapResult(
				getEventsQueueName(studioId),
				{
					id: getRandomString(),
					name: FORCE_CLEAR_CACHES_JOB,
					data: undefined,
				},
				now
			)
		)
	}

	// Wait for the completion
	await Promise.allSettled(jobs.map(async (job) => job.complete))
}

/**
 * Queue a job for a studio
 * @param jobName Job name
 * @param studioId Id of the studio
 * @param jobParameters Job payload
 * @returns Promise resolving once job has been queued successfully
 */
export async function QueueStudioJob<T extends keyof StudioJobFunc>(
	jobName: T,
	studioId: StudioId,
	jobParameters: Parameters<StudioJobFunc[T]>[0]
): Promise<WorkerJob<ReturnType<StudioJobFunc[T]>>> {
	if (isInTestWrite()) throw new Meteor.Error(404, 'Should not be reachable during startup tests')
	if (!studioId) throw new Meteor.Error(500, 'Missing studioId')

	const now = getCurrentTime()
	return queueJobAndWrapResult(
		getStudioQueueName(studioId),
		{
			id: getRandomString(),
			name: jobName,
			data: jobParameters,
		},
		now
	)
}

/**
 * Queue a job for ingest
 * @param jobName Job name
 * @param studioId Id of the studio
 * @param jobParameters Job payload
 * @returns Promise resolving once job has been queued successfully
 */
export async function QueueIngestJob<T extends keyof IngestJobFunc>(
	jobName: T,
	studioId: StudioId,
	jobParameters: Parameters<IngestJobFunc[T]>[0]
): Promise<WorkerJob<ReturnType<IngestJobFunc[T]>>> {
	if (!studioId) throw new Meteor.Error(500, 'Missing studioId')

	const now = getCurrentTime()
	return queueJobAndWrapResult(
		getIngestQueueName(studioId),
		{
			id: getRandomString(),
			name: jobName,
			data: jobParameters,
		},
		now
	)
}

function generateCompletionHandler<TRes>(
	jobId: string,
	queueTime: Time
): { result: WorkerJob<TRes>; completionHandler: JobCompletionHandler } {
	// logger.debug(`Queued job #${job.id} of "${name}" to "${queue.name}"`)

	const complete = createManualPromise<TRes>()
	const getTimings = createManualPromise<JobTimings>()

	// TODO: Worker - timeouts

	/** The handler is called upon a completion */
	const completionHandler: JobCompletionHandler = (startedTime: number, finishedTime: number, err: any, res: any) => {
		try {
			if (err) {
				logger.debug(`Completed job #${jobId} with error`)
				complete.manualReject(err)
			} else {
				logger.debug(`Completed job #${jobId} with success`)
				complete.manualResolve(res)
			}
		} catch (e) {
			logger.error(`Job completion failed: ${stringifyError(e)}`)
		}

		try {
			getTimings.manualResolve({
				queueTime,
				startedTime,

				finishedTime,
				completedTime: getCurrentTime(),
			})
		} catch (e) {
			logger.error(`Job timing resolve failed: ${stringifyError(e)}`)
		}
	}

	return {
		result: {
			complete,
			getTimings,
		},
		completionHandler,
	}
}
