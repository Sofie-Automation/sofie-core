import { WorkerId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UserError } from '@sofie-automation/corelib/dist/error'
import { JobSpec } from './main.js'

export interface JobManager {
	jobFinished: (
		id: string,
		startedTime: number,
		finishedTime: number,
		error: null | Error | UserError,
		result: any
	) => Promise<void>
	// getNextJob: (queueName: string) => Promise<JobSpec>
	queueJob: (queueName: string, jobName: string, jobData: unknown) => Promise<void>
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
