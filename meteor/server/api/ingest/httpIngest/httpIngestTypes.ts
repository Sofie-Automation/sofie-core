import { IngestRundown } from '@sofie-automation/blueprints-integration'

export type HttpIngestRundown = IngestRundown & {
	resyncUrl: string
}

export type PlaylistResponse = {
	id: string
	externalId: string
	rundownIds: string[]
	studioId: string
}

export type RundownResponse = {
	id: string
	externalId: string
	studioId: string
	playlistId: string
	playlistExternalId?: string
	name: string
}

export type SegmentResponse = {
	id: string
	externalId: string
	rundownId: string
	name: string
	rank: number
	isHidden?: boolean
}

export type PartResponse = {
	id: string
	externalId: string
	rundownId: string
	segmentId: string
	title: string
	expectedDuration?: number
	autoNext?: boolean
	rank: number
}
