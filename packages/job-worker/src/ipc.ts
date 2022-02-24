import { LogEntry } from 'winston'
import { addThreadNameToLogLine, interceptLogging } from './logging'
import { FastTrackTimelineFunc, JobSpec, JobWorkerBase } from './main'
import { JobManager, JobStream } from './manager'
import { WorkerId } from '@sofie-automation/corelib/dist/dataModel/Ids'

/**
 * A very simple implementation of JobManager, that is designed to work via threadedClass over IPC
 */
class IpcJobManager implements JobManager {
	constructor(
		public readonly jobFinished: (
			id: string,
			startedTime: number,
			finishedTime: number,
			error: any,
			result: any
		) => Promise<void>,
		public readonly queueJob: (queueName: string, jobName: string, jobData: unknown) => Promise<void>,
		private readonly getNextJob: (queueName: string) => Promise<JobSpec>
	) {}

	public subscribeToQueue(queueName: string, _workerId: WorkerId): JobStream {
		return {
			next: async () => this.getNextJob(queueName),
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
		jobFinished: (id: string, startedTime: number, finishedTime: number, error: any, result: any) => Promise<void>,
		getNextJob: (queueName: string) => Promise<JobSpec>,
		queueJob: (queueName: string, jobName: string, jobData: unknown) => Promise<void>,
		logLine: (msg: LogEntry) => Promise<void>,
		fastTrackTimeline: FastTrackTimelineFunc
	) {
		// Intercept winston to pipe back over ipc
		interceptLogging(async (...args) => logLine(addThreadNameToLogLine('worker-parent', ...args)))

		const jobManager = new IpcJobManager(jobFinished, queueJob, getNextJob)
		super(workerId, jobManager, logLine, fastTrackTimeline)
	}
}
