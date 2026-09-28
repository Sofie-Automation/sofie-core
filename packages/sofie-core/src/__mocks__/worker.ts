// import { IngestJobFunc } from '@sofie-automation/corelib/dist/worker/ingest'
// import { StudioJobFunc } from '@sofie-automation/corelib/dist/worker/studio'
// import { StudioId } from '../lib/collections/Studios'
import { QueueForceClearAllCaches, QueueIngestJob, QueueStudioJob, WorkerJob } from '../server/worker/worker'

export function CreateFakeResult<T>(result: Promise<T>): WorkerJob<T> {
	return {
		complete: result,
		getTimings: Promise.resolve({
			// Note: this is mocked for typings, not for good numbers
			queueTime: 0,
			startedTime: undefined,
			finishedTime: undefined,
			completedTime: 0,
		}),
	}
}

export const QueueForceClearAllCachesSpy = jest.fn<
	ReturnType<typeof QueueForceClearAllCaches>,
	Parameters<typeof QueueForceClearAllCaches>
>(async () => {
	throw new Error('Not implemented')
})
export const QueueStudioJobSpy = jest.fn<ReturnType<typeof QueueStudioJob>, Parameters<typeof QueueStudioJob>>(
	async () => {
		throw new Error('Not implemented')
	}
)
export const QueueIngestJobSpy = jest.fn<ReturnType<typeof QueueIngestJob>, Parameters<typeof QueueIngestJob>>(
	async () => {
		throw new Error('Not implemented')
	}
)

export function setup(): any {
	return {
		QueueForceClearAllCaches: QueueForceClearAllCachesSpy,
		QueueStudioJob: QueueStudioJobSpy,
		QueueIngestJob: QueueIngestJobSpy,
	}
}
