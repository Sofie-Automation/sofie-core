import type { RundownId } from '../core/model/Ids.js'

export interface IngestRundownStatus {
	_id: RundownId

	/** Rundown external id */
	externalId: string

	active: IngestRundownActiveStatus

	segments: IngestSegmentStatus[]
}

export enum IngestRundownActiveStatus {
	ACTIVE = 'active',
	REHEARSAL = 'rehearsal',
	INACTIVE = 'inactive',
}

export interface IngestSegmentStatus {
	/** Segment external id */
	externalId: string

	parts: IngestPartStatus[]
}

export interface IngestPartStatus {
	/** Part external id */
	externalId: string

	isReady: boolean | null

	itemsReady: IngestPartNotifyItemReady[]

	playbackStatus: IngestPartPlaybackStatus
}

export enum IngestPartPlaybackStatus {
	UNKNOWN = 'unknown',
	PLAY = 'play',
	STOP = 'stop',
}

export interface IngestPartNotifyItemReady {
	externalId: string
	ready: boolean
}
