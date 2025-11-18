import { JobContext } from '../../jobs/index.js'
import { EventsJobFunc, EventsJobs } from '@sofie-automation/corelib/dist/worker/events'
import { handlePartInstanceTimings, handleRundownDataHasChanged } from '../../events/handle.js'

type ExecutableFunction<T extends keyof EventsJobFunc> = (
	context: JobContext,
	data: Parameters<EventsJobFunc[T]>[0]
) => Promise<ReturnType<EventsJobFunc[T]>>

export type EventsJobHandlers = {
	[T in keyof EventsJobFunc]: ExecutableFunction<T>
}

export const eventJobHandlers: EventsJobHandlers = {
	[EventsJobs.PartInstanceTimings]: handlePartInstanceTimings,
	[EventsJobs.RundownDataChanged]: handleRundownDataHasChanged,
}
