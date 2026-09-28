import { z } from 'zod'
import { FindOptions } from '@sofie-automation/meteor-lib/dist/collections/lib'
import { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket'
import { BucketAdLibActions, BucketAdLibs, Buckets } from '../collections'
import { check, zAnyArray } from '../lib/check'
import { StudioId, BucketId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import type { PublicationRegistry } from '../publicationRegistry'

export function registerBucketsPublications(registry: PublicationRegistry): void {
	registry.publish(
		CorelibPubSub.buckets,
		async (_context, studioId: StudioId, bucketId: BucketId | null, _token: string | undefined) => {
			check(studioId, z.string())
			check(bucketId, z.string().nullish())

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

	registry.publish(
		CorelibPubSub.bucketAdLibPieces,
		async (_context, studioId: StudioId, bucketId: BucketId | null, showStyleVariantIds: ShowStyleVariantId[]) => {
			check(studioId, z.string())
			check(bucketId, z.string().nullish())
			check(showStyleVariantIds, zAnyArray)

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

	registry.publish(
		CorelibPubSub.bucketAdLibActions,
		async (_context, studioId: StudioId, bucketId: BucketId | null, showStyleVariantIds: ShowStyleVariantId[]) => {
			check(studioId, z.string())
			check(bucketId, z.string().nullish())
			check(showStyleVariantIds, zAnyArray)

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
}
