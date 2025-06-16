import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { BucketId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IngestAdlib } from '@sofie-automation/blueprints-integration'

export interface BucketsRestAPI {
	/**
	 * Get all available Buckets.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param inputs Migration data to apply
	 */
	getAllBuckets(
		connection: Meteor.Connection,
		event: string
	): Promise<ClientAPI.ClientResponse<Array<APIBucketComplete>>>

	/**
	 * Get a Bucket.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param inputs Migration data to apply
	 */
	getBucket(
		connection: Meteor.Connection,
		event: string,
		bucketId: BucketId
	): Promise<ClientAPI.ClientResponse<APIBucketComplete>>

	/**
	 * Adds a new Bucket, returns the Id of the newly created Bucket.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param bucket Bucket to add
	 */
	addBucket(
		connection: Meteor.Connection,
		event: string,
		bucket: APIBucket
	): Promise<ClientAPI.ClientResponse<BucketId>>

	/**
	 * Deletes a Bucket.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param bucketId Id of the bucket to delete
	 */
	deleteBucket(
		connection: Meteor.Connection,
		event: string,
		bucketId: BucketId
	): Promise<ClientAPI.ClientResponse<void>>

	/**
	 * Empties a Bucket.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param bucketId Id of the bucket to empty
	 */
	emptyBucket(
		connection: Meteor.Connection,
		event: string,
		bucketId: BucketId
	): Promise<ClientAPI.ClientResponse<void>>

	/**
	 * Deletes a Bucket AdLib.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param adLibId Id of the bucket adlib to delete
	 */
	deleteBucketAdLib(
		connection: Meteor.Connection,
		event: string,
		externalId: string
	): Promise<ClientAPI.ClientResponse<void>>

	/**
	 * Imports a Bucket AdLib.
	 * If adlibs with the same `ingestItem.externalId` already exist in the bucket, they will be replaced.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param bucketId Id of the bucket where to import the adlib
	 * @param showStyleBaseId Id of the showStyle to use when importing the adlib
	 * @param ingestItem Adlib to be imported
	 */
	importAdLibToBucket(
		connection: Meteor.Connection,
		event: string,
		bucketId: BucketId,
		showStyleBaseId: ShowStyleBaseId,
		ingestItem: IngestAdlib
	): Promise<ClientAPI.ClientResponse<void>>
}

export interface APIBucket {
	name: string
	studioId: string
}

export interface APIBucketComplete extends APIBucket {
	id: string
}

// Based on the IngestAdlib interface
export interface APIImportAdlib {
	externalId: string
	name: string
	payloadType: string
	payload: unknown | undefined

	showStyleBaseId: string
}
