import { PartInstanceId, RundownId, RundownPlaylistId, StudioId } from '../dataModel/Ids.js'

export enum EventsJobs {
	PartInstanceTimings = 'partInstanceTimings',
	RundownDataChanged = 'rundownDataChanged',
	NotifyCurrentlyPlayingPart = 'notifyCurrentlyPlayingPart',
}

export interface PartInstanceTimingsProps {
	playlistId: RundownPlaylistId
	partInstanceId: PartInstanceId
}

export interface RundownDataChangedProps {
	playlistId: RundownPlaylistId
	rundownId: RundownId
}

export interface NotifyCurrentlyPlayingPartProps {
	rundownId: RundownId
	isRehearsal: boolean
	partExternalId: string | null
}

/**
 * Set of valid functions, of form:
 * `id: (data) => return`
 */
export type EventsJobFunc = {
	[EventsJobs.PartInstanceTimings]: (data: PartInstanceTimingsProps) => void
	[EventsJobs.RundownDataChanged]: (data: RundownDataChangedProps) => void
	[EventsJobs.NotifyCurrentlyPlayingPart]: (data: NotifyCurrentlyPlayingPartProps) => void
}

export function getEventsQueueName(id: StudioId): string {
	return `events:${id}`
}
