import { UserError } from '@sofie-automation/corelib/dist/error'
import { MetricsCounter } from '@sofie-automation/corelib/dist/prometheus'
import type { JobSpec } from '@sofie-automation/job-worker/dist/main'
import { Meteor } from 'meteor/meteor'
import type { JobTimings, WorkerJob } from './worker'
import type { Time } from '@sofie-automation/shared-lib/dist/lib/lib'
import type { QueueJobOptions } from '@sofie-automation/job-worker/dist/jobs'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../logging'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { getCurrentTime } from '../lib/lib'
import _ from 'underscore'

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
	// A null job is an interruption of the queue; to ensure that something waiting is woken up
	jobsHighPriority: Array<JobEntry | null>
	jobsLowPriority: Array<JobEntry>

	/** Notify that there is a job waiting (aka worker is long-polling) */
	notifyWorker: PromiseWithResolvers<void> | null

	metricsTotal: MetricsCounter.Internal
	metricsSuccess: MetricsCounter.Internal
	metricsErrors: MetricsCounter.Internal
}

type JobCompletionHandler = (startedTime: number, finishedTime: number, err: any, result: any) => void

interface RunningJob {
	queueName: string
	completionHandler: JobCompletionHandler | null
}

interface JobEntry {
	spec: JobSpec
	/** The completionHandler is called when a job is completed. null implies "shoot-and-forget" */
	completionHandler: JobCompletionHandler | null
	/** If set, the job should not be executed before this time (used for debouncing) */
	notBefore?: Time
	/** Timer handle for waking up workers when this job becomes ready */
	debounceTimer?: NodeJS.Timeout
}

export class WorkerJobQueueManager {
	readonly #queues = new Map<string, JobQueue>()
	/** Contains all jobs that are currently being executed by a Worker. */
	readonly #runningJobs = new Map<string, RunningJob>()

	#getOrCreateQueue(queueName: string): JobQueue {
		let queue = this.#queues.get(queueName)
		if (!queue) {
			queue = {
				jobsHighPriority: [],
				jobsLowPriority: [],
				notifyWorker: null,
				metricsTotal: metricsQueueTotalCounter.labels(queueName),
				metricsSuccess: metricsQueueSuccessCounter.labels(queueName),
				metricsErrors: metricsQueueErrorsCounter.labels(queueName),
			}
			this.#queues.set(queueName, queue)
		}
		return queue
	}

	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	async jobFinished(id: string, startedTime: number, finishedTime: number, err: any, result: any): Promise<void> {
		const job = this.#runningJobs.get(id)
		if (job) {
			this.#runningJobs.delete(id)

			// Update metrics
			const queue = this.#queues.get(job.queueName)
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
	async waitForNextJob(queueName: string): Promise<void> {
		const queue = this.#getOrCreateQueue(queueName)
		const now = getCurrentTime()

		// Helper to check if a job is ready to execute
		const isJobReady = (job: JobEntry | null): boolean => {
			if (!job) return true // null jobs (interrupts) are always "ready"
			return !job.notBefore || job.notBefore <= now
		}

		// Check if there is a ready job waiting
		if (queue.jobsHighPriority.some(isJobReady) || queue.jobsLowPriority.some(isJobReady)) {
			return
		}
		// No ready job, do a long-poll

		// Already a worker waiting? Reject it, as we replace it
		if (queue.notifyWorker) {
			const oldNotify = queue.notifyWorker

			Meteor.defer(() => {
				try {
					// Notify the worker in the background
					oldNotify.reject(new Error('new workerThread, replacing the old'))
				} catch (_e) {
					// Ignore
				}
			})
		}

		// Wait to be notified about a job
		queue.notifyWorker = Promise.withResolvers()
		return queue.notifyWorker.promise
	}
	/** This is called by each Worker Thread, when it thinks there is a job to execute */
	async getNextJob(queueName: string): Promise<JobSpec | null> {
		const queue = this.#getOrCreateQueue(queueName)
		const now = getCurrentTime()

		// Helper to check if a job is ready to execute
		const isJobReady = (job: JobEntry | null): boolean => {
			if (!job) return true // null jobs (interrupts) are always "ready"
			return !job.notBefore || job.notBefore <= now
		}

		// Prefer high priority jobs - find first ready job
		const highPriorityIndex = queue.jobsHighPriority.findIndex(isJobReady)
		if (highPriorityIndex !== -1) {
			const job = queue.jobsHighPriority.splice(highPriorityIndex, 1)[0]
			if (job) {
				this.#runningJobs.set(job.spec.id, {
					queueName,
					completionHandler: job.completionHandler,
				})
				return job.spec
			}
			// null job (interrupt) - return null
			return null
		}

		// Check low priority jobs
		const lowPriorityIndex = queue.jobsLowPriority.findIndex(isJobReady)
		if (lowPriorityIndex !== -1) {
			const job = queue.jobsLowPriority.splice(lowPriorityIndex, 1)[0]
			this.#runningJobs.set(job.spec.id, {
				queueName,
				completionHandler: job.completionHandler,
			})
			return job.spec
		}

		// No ready job
		return null
	}
	/** This is called when something restarts, to ensure the `queue.notifyWorker` doesnt get stuck */
	async interruptJobStream(queueName: string): Promise<void> {
		// Check if there is a job waiting:
		const queue = this.#getOrCreateQueue(queueName)
		if (queue.notifyWorker) {
			const oldNotify = queue.notifyWorker
			queue.notifyWorker = null

			Meteor.defer(() => {
				try {
					// Notify the worker in the background
					oldNotify.resolve()
				} catch (_e) {
					// Ignore
				}
			})
		} else {
			// There should be a worker waiting, its `getNextJob` might not have reached us yet
			// So we psuh a `null` job at the start so that it interrupts immediately
			queue.jobsHighPriority.unshift(null)
		}
	}

	async queueJobWithoutResult(
		queueName: string,
		jobName: string,
		jobData: unknown,
		options: QueueJobOptions | undefined
	): Promise<void> {
		this.#queueJobInner(
			queueName,
			{
				spec: {
					id: getRandomString(),
					name: jobName,
					data: jobData,
				},
				completionHandler: null,
			},
			options
		)
	}

	queueJobAndWrapResult<TRes>(
		queueName: string,
		jobName: string,
		jobData: unknown,
		now: Time,
		options?: QueueJobOptions
	): WorkerJob<TRes> {
		const jobId = getRandomString()
		const { result, completionHandler } = generateCompletionHandler<TRes>(jobId, now)

		this.#queueJobInner(
			queueName,
			{
				spec: {
					id: jobId,
					name: jobName,
					data: jobData,
				},
				completionHandler: completionHandler,
			},
			options
		)

		return result
	}

	#queueJobInner(queueName: string, jobToQueue: JobEntry, options?: QueueJobOptions): void {
		const queue = this.#getOrCreateQueue(queueName)
		const isLowPriority = options?.lowPriority ?? false
		const debounceTime = options?.debounce

		// Debounce: check if an identical job is already queued in either priority queue
		if (debounceTime) {
			const matchJob = (job: JobEntry | null): job is JobEntry =>
				job !== null && job.spec.name === jobToQueue.spec.name && _.isEqual(job.spec.data, jobToQueue.spec.data)

			// Check high priority queue
			const existingHighPriorityIndex = queue.jobsHighPriority.findIndex(matchJob)
			if (existingHighPriorityIndex !== -1) {
				// Job exists in high priority - just extend the notBefore time
				const existingJob = queue.jobsHighPriority[existingHighPriorityIndex] as JobEntry
				existingJob.notBefore = getCurrentTime() + debounceTime

				logger.debug(`Debounced duplicate job "${jobToQueue.spec.name}" in queue "${queueName}" (extended)`)
				this.#scheduleDebounceWakeup(queue, existingJob)
				return
			}

			// Check low priority queue
			const existingLowPriorityIndex = queue.jobsLowPriority.findIndex(matchJob)
			if (existingLowPriorityIndex !== -1) {
				const existingJob = queue.jobsLowPriority[existingLowPriorityIndex]
				if (isLowPriority) {
					// Job exists in low priority, new job is also low priority - just extend notBefore
					existingJob.notBefore = getCurrentTime() + debounceTime

					logger.debug(`Debounced duplicate job "${jobToQueue.spec.name}" in queue "${queueName}" (extended)`)
					this.#scheduleDebounceWakeup(queue, existingJob)
					return
				} else {
					// Job exists in low priority, but new job is high priority - upgrade it
					queue.jobsLowPriority.splice(existingLowPriorityIndex, 1)
					existingJob.notBefore = getCurrentTime() + debounceTime
					queue.jobsHighPriority.push(existingJob)
					logger.debug(
						`Debounced duplicate job "${jobToQueue.spec.name}" in queue "${queueName}" (upgraded to high priority)`
					)
					this.#scheduleDebounceWakeup(queue, existingJob)
					return
				}
			}

			// No existing job found, set notBefore on the new job
			jobToQueue.notBefore = getCurrentTime() + debounceTime
		}

		// Queue the job based on priority
		if (isLowPriority) {
			queue.jobsLowPriority.push(jobToQueue)
		} else {
			queue.jobsHighPriority.push(jobToQueue)
		}

		queue.metricsTotal.inc()

		// If there is a worker waiting to pick up a job
		if (jobToQueue.notBefore) {
			// Schedule a wakeup for when the debounce time expires
			this.#scheduleDebounceWakeup(queue, jobToQueue)
		} else {
			// Ensure a waiting worker is notified
			this.#notifyWorker(queue)
		}
	}

	#scheduleDebounceWakeup(queue: JobQueue, job: JobEntry): void {
		// Clear any existing timer for this job to avoid accumulating timers
		if (job.debounceTimer) {
			clearTimeout(job.debounceTimer)
			delete job.debounceTimer
		}

		if (job.notBefore) {
			const delay = Math.max(0, job.notBefore - getCurrentTime())
			job.debounceTimer = setTimeout(() => {
				delete job.debounceTimer
				// Ensure a waiting worker is notified
				this.#notifyWorker(queue)
			}, delay)
		}
	}

	#notifyWorker(queue: JobQueue): void {
		if (queue.notifyWorker) {
			const notify = queue.notifyWorker

			// Worker is about to be notified, so clear the handle:
			queue.notifyWorker = null
			Meteor.defer(() => {
				try {
					// Notify the worker in the background
					notify.resolve()
				} catch (e) {
					// Queue failed
					logger.error(`Error in notifyWorker: ${stringifyError(e)}`)
				}
			})
		}
	}

	rejectAllRunning(): void {
		const now = getCurrentTime()
		for (const job of this.#runningJobs.values()) {
			const queue = this.#queues.get(job.queueName)
			if (queue) queue.metricsErrors.inc()

			if (job.completionHandler) {
				job.completionHandler(now, now, new Error('Thread closed'), null)
			}
		}
		this.#runningJobs.clear()
	}
}

function generateCompletionHandler<TRes>(
	jobId: string,
	queueTime: Time
): { result: WorkerJob<TRes>; completionHandler: JobCompletionHandler } {
	// logger.debug(`Queued job #${job.id} of "${name}" to "${queue.name}"`)

	const complete = Promise.withResolvers<TRes>()
	const getTimings = Promise.withResolvers<JobTimings>()

	// TODO: Worker - timeouts

	/** The handler is called upon a completion */
	const completionHandler: JobCompletionHandler = (startedTime: number, finishedTime: number, err: any, res: any) => {
		try {
			if (err) {
				logger.debug(`Completed job #${jobId} with error`)
				complete.reject(err)
			} else {
				logger.debug(`Completed job #${jobId} with success`)
				complete.resolve(res)
			}
		} catch (e) {
			logger.error(`Job completion failed: ${stringifyError(e)}`)
		}

		try {
			getTimings.resolve({
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
			complete: complete.promise,
			getTimings: getTimings.promise,
		},
		completionHandler,
	}
}
