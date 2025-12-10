import { PartInstanceId, RundownId, RundownPlaylistId, StudioId } from '../dataModel/Ids.js'

export enum EventsJobs {
	PartInstanceTimings = 'partInstanceTimings',
	RundownDataChanged = 'rundownDataChanged',
}

export interface PartInstanceTimingsProps {
	playlistId: RundownPlaylistId
	partInstanceId: PartInstanceId
}

export interface RundownDataChangedProps {
	playlistId: RundownPlaylistId
	rundownId: RundownId
}

/**
 * Set of valid functions, of form:
 * `id: (data) => return`
 */
export type EventsJobFunc = {
	[EventsJobs.PartInstanceTimings]: (data: PartInstanceTimingsProps) => void
	[EventsJobs.RundownDataChanged]: (data: RundownDataChangedProps) => void
}

export function getEventsQueueName(id: StudioId): string {
	return `events:${id}`
}
