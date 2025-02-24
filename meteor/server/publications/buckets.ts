import { FindOptions } from '@sofie-automation/meteor-lib/dist/collections/lib'
import { meteorPublish } from './lib/lib'
import { MeteorPubSub } from '@sofie-automation/meteor-lib/dist/api/pubsub'
import { Bucket } from '@sofie-automation/meteor-lib/dist/collections/Buckets'
import { BucketAdLibActions, BucketAdLibs, Buckets } from '../collections'
import { check, Match } from 'meteor/check'
import { StudioId, BucketId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/securityVerify'

meteorPublish(
	MeteorPubSub.buckets,
	async function (studioId: StudioId, bucketId: BucketId | null, _token: string | undefined) {
		check(studioId, String)
		check(bucketId, Match.Maybe(String))

		triggerWriteAccessBecauseNoCheckNecessary()

		const modifier: FindOptions<Bucket> = {
			fields: {},
		}

		return Buckets.findWithCursor(
			bucketId
				? {
						_id: bucketId,
						studioId,
				  }
				: {
						studioId,
				  },
			modifier
		)
	}
)

meteorPublish(
	CorelibPubSub.bucketAdLibPieces,
	async function (studioId: StudioId, bucketId: BucketId, showStyleVariantIds: ShowStyleVariantId[]) {
		check(studioId, String)
		check(bucketId, String)
		check(showStyleVariantIds, Array)

		triggerWriteAccessBecauseNoCheckNecessary()

		return BucketAdLibs.findWithCursor(
			{
				studioId: studioId,
				bucketId: bucketId,
				showStyleVariantId: {
					$in: [null, ...showStyleVariantIds], // null = valid for all variants
				},
			},
			{
				fields: {
					ingestInfo: 0, // This is a large blob, and is not of interest to the UI
					privateData: 0,
				},
			}
		)
	}
)

meteorPublish(
	CorelibPubSub.bucketAdLibActions,
	async function (studioId: StudioId, bucketId: BucketId, showStyleVariantIds: ShowStyleVariantId[]) {
		check(studioId, String)
		check(bucketId, String)
		check(showStyleVariantIds, Array)

		triggerWriteAccessBecauseNoCheckNecessary()

		return BucketAdLibActions.findWithCursor(
			{
				studioId: studioId,
				bucketId: bucketId,
				showStyleVariantId: {
					$in: [null, ...showStyleVariantIds], // null = valid for all variants
				},
			},
			{
				fields: {
					ingestInfo: 0, // This is a large blob, and is not of interest to the UI
					privateData: 0,
				},
			}
		)
	}
)
