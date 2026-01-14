import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { interceptLogging, LogEntry, logger } from './logging.js'
import { FastTrackTimelineFunc, JobSpec, JobWorkerBase } from './main.js'
import { JobManager, JobStream } from './manager.js'
import { WorkerId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getPrometheusMetricsString, setupPrometheusMetrics } from '@sofie-automation/corelib/dist/prometheus'

/**
 * A very simple implementation of JobManager, that is designed to work via threadedClass over IPC
 */
class IpcJobManager implements JobManager {
	constructor(
		public readonly jobFinished: JobManager['jobFinished'],
		public readonly queueJob: JobManager['queueJob'],
		private readonly interruptJobStream: (queueName: string) => Promise<void>,
		private readonly waitForNextJob: (queueName: string) => Promise<void>,
		private readonly getNextJob: (queueName: string) => Promise<JobSpec | null>
	) {}

	public subscribeToQueue(queueName: string, _workerId: WorkerId): JobStream {
		return {
			wait: async () => this.waitForNextJob(queueName),
			pop: async () => this.getNextJob(queueName),
			interrupt: () => {
				this.interruptJobStream(queueName).catch((e) =>
					logger.error(`Failed to interupt job queue ${queueName}: ${stringifyError(e)}`)
				)
			},
			close: async () => Promise.resolve(),
		}
	}
}

/**
 * Entrypoint for threadedClass
 */
export class IpcJobWorker extends JobWorkerBase {
	constructor(
		workerId: WorkerId,
		jobFinished: JobManager['jobFinished'],
		interruptJobStream: (queueName: string) => Promise<void>,
		waitForNextJob: (queueName: string) => Promise<void>,
		getNextJob: (queueName: string) => Promise<JobSpec | null>,
		queueJob: JobManager['queueJob'],
		logLine: (msg: LogEntry) => Promise<void>,
		fastTrackTimeline: FastTrackTimelineFunc,
		enableFreezeLimit: boolean
	) {
		// Intercept logging to pipe back over ipc
		interceptLogging('worker-parent', async (msg) => logLine(msg))
		setupPrometheusMetrics('worker-parent')

		const jobManager = new IpcJobManager(jobFinished, queueJob, interruptJobStream, waitForNextJob, getNextJob)
		super(workerId, jobManager, logLine, fastTrackTimeline, enableFreezeLimit)
	}

	public async collectMetrics(): Promise<string[]> {
		return Promise.all([getPrometheusMetricsString(), ...this.collectWorkerSetMetrics()])
	}
}
