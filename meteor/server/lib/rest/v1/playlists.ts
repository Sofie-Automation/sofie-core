import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import {
	AdLibActionId,
	BucketAdLibId,
	BucketId,
	PartId,
	PartInstanceId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { QueueNextSegmentResult, TakeNextPartResult } from '@sofie-automation/corelib/dist/worker/studio'
import { Meteor } from 'meteor/meteor'

/* *************************************************************************
This file contains types and interfaces that are used by the REST API.
When making changes to these types, you should be aware of any breaking changes
and update packages/openapi accordingly if needed.
************************************************************************* */

export interface PlaylistsRestAPI {
	/**
	 * Gets all available RundownPlaylists.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	getAllRundownPlaylists(
		connection: Meteor.Connection,
		event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>>
	/**
	 * Activates a Playlist.
	 *
	 * Throws if there is already an active Playlist for the studio that the Playlist belongs to.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to activate.
	 * @param rehearsal Whether to activate into rehearsal mode.
	 */
	activate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Activates AdLibs testing mode.
	 */
	activateAdLibTesting(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		rundownId: RundownId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Deactivates a Playlist.
	 *
	 * Throws if the Playlist is not currently active.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to deactivate.
	 */
	deactivate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Executes the requested AdLib/AdLib Action. This is a "planned" AdLib (Action) that has been produced by the blueprints during the ingest process.
	 *
	 * Throws if the target Playlist is not active.
	 * Throws if there is not an on-at part instance.
	 * @returns a `ClientResponseError` if an adLib for the provided `adLibId` cannot be found.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to execute adLib in.
	 * @param adLibId AdLib to execute.
	 * @param triggerMode A string to specify a particular variation for the AdLibAction, valid actionType strings are to be read from the status API.
	 */
	executeAdLib(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		adLibId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId,
		triggerMode?: string,
		adLibOptions?: any
	): Promise<ClientAPI.ClientResponse<object>>
	/**
	 * Executes the requested Bucket AdLib/AdLib Action. This is a Bucket AdLib (Action) that has been previously inserted into a Bucket.
	 * It will automatically find the variation matching the showStyleBaseId and showStyleVariantId of the current Rundown.
	 *
	 * Throws if the target Playlist is not active.
	 * Throws if there is not an on-air part instance.
	 * @returns a `ClientResponseError` if a bucket or adlib for the provided ids cannot be found.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to execute adLib in.
	 * @param bucketId Bucket to execute the adlib from
	 * @param externalId External Id of the Bucket AdLib to execute.
	 * @param triggerMode A string to specify a particular variation for the AdLibAction, valid actionType strings are to be read from the status API.
	 */
	executeBucketAdLib(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		bucketId: BucketId,
		externalId: string,
		triggerMode?: string
	): Promise<ClientAPI.ClientResponse<object>>
	/**
	 * Moves the next point by `delta` places. Negative values are allowed to move "backwards" in the script.
	 *
	 * Throws if the target Playlist is not active.
	 * Throws if there is both no current or next Part.
	 * If delta results in an index that is greater than the number of Parts available, no action will be taken.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to target.
	 * @param delta Amount to move next point by (+/-)
	 * @param ignoreQuickLoop When moving the next part it should ignore any of the boundaries set by the QuickLoop feature
	 */
	moveNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number,
		ignoreQuickLoop?: boolean
	): Promise<ClientAPI.ClientResponse<PartId | null>>
	/**
	 * Moves the next Segment point by `delta` places. Negative values are allowed to move "backwards" in the script.
	 *
	 * Throws if the target Playlist is not active.
	 * Throws if there is both no current or next Part.
	 * If delta results in an index that is greater than the number of Segments available, no action will be taken.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to target.
	 * @param delta Amount to move next Segment point by (+/-)
	 */
	moveNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>>
	/**
	 * Reloads a Playlist from its ingest source (e.g. MOS/Spreadsheet etc.)
	 *
	 * Throws if the target Playlist is currently active.
	 * @returns a `ClientResponseError` if the playlist fails to reload
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to reload.
	 */
	reloadPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Resets a Playlist back to its pre-played state.
	 *
	 * Throws if the target Playlist is currently active unless reset while on-air is enabled in settings.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to reset.
	 */
	resetPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Sets the next Part to a given PartId.
	 *
	 * Throws if the target playlist is not currently active.
	 * Throws if the specified Part does not exist.
	 * Throws if the specified Part is not playable.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target rundown playlist.
	 * @param partId Part to set as next.
	 */
	setNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Sets the next Segment to a given SegmentId.
	 *
	 * Throws if the target Playlist is not currently active.
	 * Throws if the specified Segment does not exist.
	 * Throws if the specified Segment does not contain any playable parts.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target Playlist.
	 * @param segmentId Segment to set as next.
	 */
	setNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		segmentId: SegmentId
	): Promise<ClientAPI.ClientResponse<PartId | null>>
	/**
	 * Queues the Segment to a given SegmentId.
	 *
	 * Throws if the target Playlist is not currently active.
	 * Throws if the specified Segment does not exist.
	 * Throws if the specified Segment does not contain any playable parts.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target Playlist.
	 * @param segmentId Segment to set as next.
	 */
	queueNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		segmentId: SegmentId
	): Promise<ClientAPI.ClientResponse<QueueNextSegmentResult>>
	/**
	 * Performs a take in the given Playlist.
	 *
	 * Throws if spcified Playlist is not active.
	 * Throws if specified Playlist does not have a next Part.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target Playlist.
	 * @param fromPartInstanceId Part instance this take is for, used as a safety guard against performing multiple takes when only one was intended.
	 */
	take(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		fromPartInstanceId: PartInstanceId | undefined
	): Promise<ClientAPI.ClientResponse<TakeNextPartResult>>
	/**
	 * Clears the specified SourceLayers.
	 *
	 * Throws if specified playlist is not active.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target Playlist.
	 * @param sourceLayerIds Target SourceLayers.
	 */
	clearSourceLayers(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerIds: string[]
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Recalls the last sticky Piece on the specified SourceLayer, if there is any.
	 *
	 * Throws if specified playlist is not active.
	 * Throws if specified SourceLayer is not sticky.
	 * Throws if there is no sticky piece for this SourceLayer.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target Playlist.
	 * @param sourceLayerId Target SourceLayer.
	 */
	recallStickyPiece(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	): Promise<ClientAPI.ClientResponse<void>>
}
