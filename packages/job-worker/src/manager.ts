import type { WorkerId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import type { JobSpec } from './main.js'
import type { QueueJobOptions } from './jobs/index.js'

export interface JobManager {
	jobFinished: (
		id: string,
		startedTime: number,
		finishedTime: number,
		error: null | string, // Stringified UserError
		result: any
	) => Promise<void>
	// getNextJob: (queueName: string) => Promise<JobSpec>
	queueJob: (
		queueName: string,
		jobName: string,
		jobData: unknown,
		options: QueueJobOptions | undefined
	) => Promise<void>
	subscribeToQueue: (queueName: string, workerId: WorkerId) => JobStream
}

export interface JobStream {
	/** Wait for the job queue to notify */
	wait(): Promise<void>
	/** Get the next queued job */
	pop(): Promise<JobSpec | null>
	/** Make the next job returned be `null` */
	interrupt(): void
	/** Close the JobStream */
	close(): Promise<void>
}
