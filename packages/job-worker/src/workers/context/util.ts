export type QueueJobFunc = (queueName: string, jobName: string, jobData: unknown) => Promise<void>
