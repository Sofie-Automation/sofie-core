import { IngestPart, IngestSegment } from '@sofie-automation/blueprints-integration'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { IngestRundown } from '@sofie-automation/blueprints-integration'

/* *************************************************************************
This file contains types and interfaces that are used by the REST API.
When making changes to these types, you should be aware of any breaking changes
and update packages/openapi accordingly if needed.
************************************************************************* */

export interface IngestRestAPI {
	// Playlists

	getPlaylists(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<Array<PlaylistResponse>>>

	getPlaylist(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string // Internal or external ID
	): Promise<ClientAPI.ClientResponse<PlaylistResponse>>

	deletePlaylists(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<void>>

	deletePlaylist(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string // Internal or external ID
	): Promise<ClientAPI.ClientResponse<void>>

	// Rundowns

	getRundowns(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string
	): Promise<ClientAPI.ClientResponse<Array<RundownResponse>>>

	getRundown(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string
	): Promise<ClientAPI.ClientResponse<RundownResponse>>

	postRundown(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		ingestRundown: HttpIngestRundown
	): Promise<ClientAPI.ClientResponse<void>>

	putRundowns(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		ingestRundowns: HttpIngestRundown[]
	): Promise<ClientAPI.ClientResponse<void>>

	putRundown(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		ingestRundown: HttpIngestRundown
	): Promise<ClientAPI.ClientResponse<void>>

	deleteRundowns(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string
	): Promise<ClientAPI.ClientResponse<void>>

	deleteRundown(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string
	): Promise<ClientAPI.ClientResponse<void>>

	// Segments

	getSegments(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string
	): Promise<ClientAPI.ClientResponse<Array<SegmentResponse>>>

	getSegment(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string
	): Promise<ClientAPI.ClientResponse<SegmentResponse>>

	postSegment(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		ingestSegment: IngestSegment
	): Promise<ClientAPI.ClientResponse<void>>

	putSegments(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		ingestSegments: IngestSegment[]
	): Promise<ClientAPI.ClientResponse<void>>

	putSegment(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		ingestSegment: IngestSegment
	): Promise<ClientAPI.ClientResponse<void>>

	deleteSegments(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string
	): Promise<ClientAPI.ClientResponse<void>>

	deleteSegment(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string
	): Promise<ClientAPI.ClientResponse<void>>

	// Parts

	getParts(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string
	): Promise<ClientAPI.ClientResponse<Array<PartResponse>>>

	getPart(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		partId: string
	): Promise<ClientAPI.ClientResponse<PartResponse>>

	postPart(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		ingestPart: IngestPart
	): Promise<ClientAPI.ClientResponse<void>>

	putParts(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		ingestParts: IngestPart[]
	): Promise<ClientAPI.ClientResponse<void>>

	putPart(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		partId: string,
		ingestPart: IngestPart
	): Promise<ClientAPI.ClientResponse<void>>

	deleteParts(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string
	): Promise<ClientAPI.ClientResponse<void>>

	deletePart(
		_connection: Meteor.Connection,
		_event: string,
		studioId: StudioId,
		playlistId: string,
		rundownId: string,
		segmentId: string,
		partId: string
	): Promise<ClientAPI.ClientResponse<void>>
}

export type HttpIngestRundown = Omit<IngestRundown, 'playlistExternalId'> & {
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
	name: string
	expectedDuration?: number
	autoNext?: boolean
	rank: number
}
