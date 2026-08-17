import { IngestPart, IngestSegment } from '@sofie-automation/blueprints-integration'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { IngestRundown } from '@sofie-automation/blueprints-integration'
import type { DDPClientConnection } from '../../../ddp-server/types'

/* *************************************************************************
This file contains types and interfaces that are used by the REST API.
When making changes to these types, you should be aware of any breaking changes
and update packages/openapi accordingly if needed.
************************************************************************* */

export interface IngestRestAPI {
	// Playlists

	getPlaylists(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<Array<PlaylistResponse>>>

	getPlaylist(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string // Internal or external ID
	): Promise<ClientAPI.ClientResponse<PlaylistResponse>>

	deletePlaylists(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<void>>

	deletePlaylist(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string // Internal or external ID
	): Promise<ClientAPI.ClientResponse<void>>

	// Rundowns

	getRundowns(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string
	): Promise<ClientAPI.ClientResponse<Array<RundownResponse>>>

	getRundown(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string
	): Promise<ClientAPI.ClientResponse<RundownResponse>>

	postRundown(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string | undefined,
		ingestRundown: RestApiIngestRundown
	): Promise<ClientAPI.ClientResponse<void>>

	putRundowns(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		ingestRundowns: RestApiIngestRundown[]
	): Promise<ClientAPI.ClientResponse<void>>

	putRundown(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		ingestRundown: RestApiIngestRundown
	): Promise<ClientAPI.ClientResponse<void>>

	deleteRundowns(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string
	): Promise<ClientAPI.ClientResponse<void>>

	deleteRundown(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string
	): Promise<ClientAPI.ClientResponse<void>>

	// Segments

	getSegments(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string
	): Promise<ClientAPI.ClientResponse<Array<SegmentResponse>>>

	getSegment(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string
	): Promise<ClientAPI.ClientResponse<SegmentResponse>>

	postSegment(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		ingestSegment: IngestSegment
	): Promise<ClientAPI.ClientResponse<void>>

	putSegments(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		ingestSegments: IngestSegment[]
	): Promise<ClientAPI.ClientResponse<void>>

	putSegment(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		ingestSegment: IngestSegment
	): Promise<ClientAPI.ClientResponse<void>>

	deleteSegments(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string
	): Promise<ClientAPI.ClientResponse<void>>

	deleteSegment(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string
	): Promise<ClientAPI.ClientResponse<void>>

	// Parts

	getParts(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string
	): Promise<ClientAPI.ClientResponse<Array<PartResponse>>>

	getPart(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		partId: string
	): Promise<ClientAPI.ClientResponse<PartResponse>>

	postPart(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		ingestPart: IngestPart
	): Promise<ClientAPI.ClientResponse<void>>

	putParts(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		ingestParts: IngestPart[]
	): Promise<ClientAPI.ClientResponse<void>>

	putPart(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		partId: string,
		ingestPart: IngestPart
	): Promise<ClientAPI.ClientResponse<void>>

	deleteParts(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string
	): Promise<ClientAPI.ClientResponse<void>>

	deletePart(
		_connection: DDPClientConnection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		partId: string
	): Promise<ClientAPI.ClientResponse<void>>
}

export type RestApiIngestRundown = IngestRundown & {
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
	type?: string
	timing?: {
		type: string
		expectedStart?: number
		expectedDuration?: number
		expectedEnd?: number
	}
}

export type SegmentResponse = {
	id: string
	externalId: string
	rundownId: string
	name: string
	rank: number
	isHidden?: boolean
	timing?: {
		budgetDuration?: number
		countdownType?: string
	}
}

export type PartResponse = {
	id: string
	externalId: string
	rundownId: string
	segmentId: string
	name: string
	expectedDuration?: number
	autoNext?: boolean
	rank: number
}
