import { FindOptions } from '@sofie-automation/meteor-lib/dist/collections/lib'
import { meteorPublish } from './lib/lib'
import { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket'
import { BucketAdLibActions, BucketAdLibs, Buckets } from '../collections'
import { check, Match } from 'meteor/check'
import { StudioId, BucketId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'

meteorPublish(
	CorelibPubSub.buckets,
	async function (studioId: StudioId, bucketId: BucketId | null, _token: string | undefined) {
		check(studioId, String)
		check(bucketId, Match.Maybe(String))

		triggerWriteAccessBecauseNoCheckNecessary()

		const modifier: FindOptions<Bucket> = {
			projection: {},
		}

		const selector: MongoQuery<Bucket> = {
			studioId,
		}
		if (bucketId) selector._id = bucketId

		return Buckets.findWithCursor(selector, modifier)
	}
)

meteorPublish(
	CorelibPubSub.bucketAdLibPieces,
	async function (studioId: StudioId, bucketId: BucketId | null, showStyleVariantIds: ShowStyleVariantId[]) {
		check(studioId, String)
		check(bucketId, Match.Maybe(String))
		check(showStyleVariantIds, Array)

		triggerWriteAccessBecauseNoCheckNecessary()

		const selector: MongoQuery<BucketAdLib> = {
			studioId: studioId,
			showStyleVariantId: {
				$in: [null, ...showStyleVariantIds], // null = valid for all variants
			},
		}
		if (bucketId) selector.bucketId = bucketId

		return BucketAdLibs.findWithCursor(selector, {
			projection: {
				ingestInfo: 0, // This is a large blob, and is not of interest to the UI
				privateData: 0,
			},
		})
	}
)

meteorPublish(
	CorelibPubSub.bucketAdLibActions,
	async function (studioId: StudioId, bucketId: BucketId | null, showStyleVariantIds: ShowStyleVariantId[]) {
		check(studioId, String)
		check(bucketId, Match.Maybe(String))
		check(showStyleVariantIds, Array)

		triggerWriteAccessBecauseNoCheckNecessary()

		const selector: MongoQuery<BucketAdLibAction> = {
			studioId: studioId,
			showStyleVariantId: {
				$in: [null, ...showStyleVariantIds], // null = valid for all variants
			},
		}
		if (bucketId) selector.bucketId = bucketId

		return BucketAdLibActions.findWithCursor(selector, {
			projection: {
				ingestInfo: 0, // This is a large blob, and is not of interest to the UI
				privateData: 0,
			},
		})
	}
)
