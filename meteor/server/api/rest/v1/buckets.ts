import { Meteor } from 'meteor/meteor'
import { APIBucket, APIBucketComplete, APIImportAdlib, BucketsRestAPI } from '../../../lib/rest/v1/buckets'
import { BucketAdLibActions, BucketAdLibs, Buckets } from '../../../collections'
import { APIBucketFrom } from './typeConversion'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { BucketId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ServerClientAPI } from '../../client'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { getCurrentTime } from '../../../lib/lib'
import { check } from 'meteor/check'
import { BucketsAPI } from '../../buckets'
import { APIFactory, APIRegisterHook, ServerAPIContext } from './types'
import { logger } from '../../../logging'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { IngestAdlib } from '@sofie-automation/blueprints-integration'
import { assertConnectionHasOneOfPermissions } from '../../../security/auth'
import { UserPermissions } from '@sofie-automation/meteor-lib/dist/userPermissions'

const PERMISSIONS_FOR_BUCKET_MODIFICATION: Array<keyof UserPermissions> = ['studio']

export class BucketsServerAPI implements BucketsRestAPI {
	constructor(private context: ServerAPIContext) {}

	async getAllBuckets(
		_connection: Meteor.Connection,
		_event: string
	): Promise<ClientAPI.ClientResponse<Array<APIBucketComplete>>> {
		const buckets = await Buckets.findFetchAsync({}, { projection: { _id: 1, name: 1, studioId: 1 } })
		return ClientAPI.responseSuccess(buckets.map(APIBucketFrom))
	}

	async getBucket(
		_connection: Meteor.Connection,
		_event: string,
		bucketId: BucketId
	): Promise<ClientAPI.ClientResponse<APIBucketComplete>> {
		const bucket = await Buckets.findOneAsync(bucketId, { projection: { _id: 1, name: 1, studioId: 1 } })
		if (!bucket) {
			return ClientAPI.responseError(
				UserError.from(
					new Error(`Bucket ${bucketId} not found`),
					UserErrorMessage.BucketNotFound,
					undefined,
					404
				)
			)
		}
		return ClientAPI.responseSuccess(APIBucketFrom(bucket))
	}

	async addBucket(
		connection: Meteor.Connection,
		event: string,
		bucket: APIBucket
	): Promise<ClientAPI.ClientResponse<BucketId>> {
		const createdBucketResponse = await ServerClientAPI.runUserActionInLog(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			'bucketsCreateNewBucket',
			{ bucket },
			async () => {
				check(bucket.studioId, String)
				check(bucket.name, String)

				assertConnectionHasOneOfPermissions(connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)

				return BucketsAPI.createNewBucket(protectString(bucket.studioId), bucket.name)
			}
		)
		if (ClientAPI.isClientResponseSuccess(createdBucketResponse)) {
			return ClientAPI.responseSuccess(createdBucketResponse.result._id)
		}
		return createdBucketResponse
	}

	async deleteBucket(
		connection: Meteor.Connection,
		event: string,
		bucketId: BucketId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			'bucketsRemoveBucket',
			{ bucketId },
			async () => {
				check(bucketId, String)

				assertConnectionHasOneOfPermissions(connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)

				return BucketsAPI.removeBucket(bucketId)
			}
		)
	}

	async emptyBucket(
		connection: Meteor.Connection,
		event: string,
		bucketId: BucketId
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			'bucketsEmptyBucket',
			{ bucketId },
			async () => {
				check(bucketId, String)

				assertConnectionHasOneOfPermissions(connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)

				return BucketsAPI.emptyBucket(bucketId)
			}
		)
	}

	async deleteBucketAdLib(
		connection: Meteor.Connection,
		event: string,
		externalId: string
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			'bucketsRemoveBucketAdLib',
			{ externalId },
			async () => {
				assertConnectionHasOneOfPermissions(connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)

				const bucketAdLibPiecePromise = BucketAdLibs.findOneAsync(
					{ externalId },
					{
						projection: { _id: 1 },
					}
				)
				const bucketAdLibActionPromise = BucketAdLibActions.findOneAsync(
					{ externalId },
					{
						projection: { _id: 1 },
					}
				)
				const [bucketAdLibPiece, bucketAdLibAction] = await Promise.all([
					bucketAdLibPiecePromise,
					bucketAdLibActionPromise,
				])
				if (bucketAdLibPiece) {
					return BucketsAPI.removeBucketAdLib(bucketAdLibPiece._id)
				} else if (bucketAdLibAction) {
					return BucketsAPI.removeBucketAdLibAction(bucketAdLibAction._id)
				}
			}
		)
	}

	async importAdLibToBucket(
		connection: Meteor.Connection,
		event: string,
		bucketId: BucketId,
		showStyleBaseId: ShowStyleBaseId,
		ingestItem: IngestAdlib
	): Promise<ClientAPI.ClientResponse<void>> {
		return ServerClientAPI.runUserActionInLog(
			this.context.getMethodContext(connection),
			event,
			getCurrentTime(),
			'bucketAdlibImport',
			{ bucketId, showStyleBaseId, ingestItem },
			async () => {
				check(bucketId, String)
				check(showStyleBaseId, String)
				check(ingestItem, Object)

				assertConnectionHasOneOfPermissions(connection, ...PERMISSIONS_FOR_BUCKET_MODIFICATION)

				return BucketsAPI.importAdlibToBucket(bucketId, showStyleBaseId, undefined, ingestItem)
			}
		)
	}
}

class BucketsAPIFactory implements APIFactory<BucketsRestAPI> {
	createServerAPI(context: ServerAPIContext): BucketsRestAPI {
		return new BucketsServerAPI(context)
	}
}

export function registerRoutes(registerRoute: APIRegisterHook<BucketsRestAPI>): void {
	const bucketsApiFactory = new BucketsAPIFactory()

	registerRoute<never, never, Array<APIBucket>>(
		'get',
		'/buckets',
		new Map(),
		bucketsApiFactory,
		async (serverAPI, connection, event, _params, _body) => {
			logger.info(`API GET: Buckets`)
			return await serverAPI.getAllBuckets(connection, event)
		}
	)

	registerRoute<{ bucketId: string }, never, APIBucket>(
		'get',
		'/buckets/:bucketId',
		new Map(),
		bucketsApiFactory,
		async (serverAPI, connection, event, params, _body) => {
			logger.info(`API GET: Bucket`)
			const bucketId = protectString(params.bucketId)
			check(bucketId, String)
			return await serverAPI.getBucket(connection, event, bucketId)
		}
	)

	registerRoute<never, APIBucket, BucketId>(
		'post',
		'/buckets',
		new Map([[404, [UserErrorMessage.StudioNotFound]]]),
		bucketsApiFactory,
		async (serverAPI, connection, event, _params, body) => {
			logger.info(`API POST: Add Bucket`)
			return await serverAPI.addBucket(connection, event, body)
		}
	)

	registerRoute<{ bucketId: string }, never, void>(
		'delete',
		'/buckets/:bucketId',
		new Map([[404, [UserErrorMessage.BucketNotFound]]]),
		bucketsApiFactory,
		async (serverAPI, connection, event, params, _body) => {
			logger.info(`API DELETE: Bucket`)
			const bucketId = protectString(params.bucketId)
			return await serverAPI.deleteBucket(connection, event, bucketId)
		}
	)

	registerRoute<{ bucketId: string }, never, void>(
		'delete',
		'/buckets/:bucketId/adlibs',
		new Map([[404, [UserErrorMessage.BucketNotFound]]]),
		bucketsApiFactory,
		async (serverAPI, connection, event, params, _body) => {
			logger.info(`API DELETE: Empty Bucket`)
			const bucketId = protectString(params.bucketId)
			check(bucketId, String)
			return await serverAPI.emptyBucket(connection, event, bucketId)
		}
	)

	registerRoute<{ externalId: string }, never, void>(
		'delete',
		'/buckets/:bucketId/adlibs/:externalId',
		new Map([[404, [UserErrorMessage.BucketNotFound]]]),
		bucketsApiFactory,
		async (serverAPI, connection, event, params, _body) => {
			logger.info(`API DELETE: Remove Bucket AdLib`)
			const adLibId = protectString(params.externalId)
			check(adLibId, String)
			return await serverAPI.deleteBucketAdLib(connection, event, adLibId)
		}
	)

	registerRoute<{ bucketId: string }, APIImportAdlib, void>(
		'put',
		'/buckets/:bucketId/adlibs',
		new Map([[404, [UserErrorMessage.BucketNotFound]]]),
		bucketsApiFactory,
		async (serverAPI, connection, event, params, body) => {
			logger.info(`API POST: Add AdLib to Bucket`)
			const bucketId = protectString(params.bucketId)
			check(bucketId, String)
			check(body.externalId, String)
			check(body.name, String)
			check(body.payloadType, String)
			check(body.showStyleBaseId, String)
			const showStyleBaseId = protectString(body.showStyleBaseId)
			return await serverAPI.importAdLibToBucket(connection, event, bucketId, showStyleBaseId, body)
		}
	)
}
