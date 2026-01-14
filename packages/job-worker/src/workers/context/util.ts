import type { QueueJobOptions } from '../../jobs/index.js'

export type QueueJobFunc = (
	queueName: string,
	jobName: string,
	jobData: unknown,
	options: QueueJobOptions | undefined
) => Promise<void>
