import _ from 'underscore'
import { Meteor } from 'meteor/meteor'
import { Bucket } from '@sofie-automation/corelib/dist/dataModel/Bucket'
import { getRandomId, getRandomString, literal } from '@sofie-automation/corelib/dist/lib'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { AdLibAction, AdLibActionCommon } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { BucketAdLibActions, BucketAdLibs, Buckets, Rundowns, ShowStyleVariants, Studios } from '../collections'
import { runIngestOperation } from './ingest/lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { IngestAdlib } from '@sofie-automation/blueprints-integration'
import { getShowStyleCompound } from './showStyles'
import {
	BucketAdLibActionId,
	BucketAdLibId,
	BucketId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { fetchStudioLight } from '../optimizations'

const DEFAULT_BUCKET_WIDTH = undefined

function isBucketAdLibAction(action: AdLibActionCommon | BucketAdLibAction): action is BucketAdLibAction {
	if ('showStyleVariantId' in action && action['showStyleVariantId'] && action['studioId']) {
		return true
	}
	return false
}

export namespace BucketsAPI {
	export async function removeBucketAdLib(adLibId: BucketAdLibId): Promise<void> {
		const adlib = (await BucketAdLibs.findOneAsync(adLibId, {
			projection: {
				_id: 1,
				studioId: 1,
			},
		})) as Pick<BucketAdLib, '_id' | 'studioId'> | undefined
		if (!adlib) throw new Meteor.Error(404, `BucketAdLib "${adLibId}" not found`)

		await runIngestOperation(adlib.studioId, IngestJobs.BucketRemoveAdlibPiece, {
			pieceId: adlib._id,
		})
	}

	export async function removeBucketAdLibAction(adLibActionId: BucketAdLibActionId): Promise<void> {
		const adlib = (await BucketAdLibActions.findOneAsync(adLibActionId, {
			projection: {
				_id: 1,
				studioId: 1,
			},
		})) as Pick<BucketAdLibAction, '_id' | 'studioId'> | undefined
		if (!adlib) throw new Meteor.Error(404, `BucketAdLibAction "${adLibActionId}" not found`)

		await runIngestOperation(adlib.studioId, IngestJobs.BucketRemoveAdlibAction, {
			actionId: adlib._id,
		})
	}

	export async function modifyBucket(
		bucketId: BucketId,
		bucketProps: Partial<Omit<Bucket, '_id' | 'studioId'>>
	): Promise<void> {
		await Buckets.updateAsync(bucketId, {
			$set: _.omit(bucketProps, ['_id', 'studioId']),
		})
	}

	export async function emptyBucket(bucketId: BucketId): Promise<void> {
		const bucket = await Buckets.findOneAsync(bucketId)
		if (!bucket) throw new Meteor.Error(404, `Bucket "${bucketId}" not found`)

		await runIngestOperation(bucket.studioId, IngestJobs.BucketEmpty, {
			bucketId: bucket._id,
		})
	}

	export async function createNewBucket(studioId: StudioId, name: string): Promise<Bucket> {
		const studio = await fetchStudioLight(studioId)
		if (!studio) throw new Meteor.Error(404, `Studio "${studioId}" not found`)

		const heaviestBucket = (
			await Buckets.findFetchAsync(
				{
					studioId: studio._id,
				},
				{
					sort: {
						_rank: 1,
					},
					projection: {
						_rank: 1,
					},
				}
			)
		).reverse()[0]

		let rank = 1
		if (heaviestBucket) {
			rank = heaviestBucket._rank + 1
		}

		const newBucket = literal<Bucket>({
			_id: getRandomId(),
			_rank: rank,
			name: name,
			studioId: studio._id,
			// userId,
			width: DEFAULT_BUCKET_WIDTH,
			buttonWidthScale: 1,
			buttonHeightScale: 1,
		})

		await Buckets.insertAsync(newBucket)

		return newBucket
	}

	export async function modifyBucketAdLibAction(
		adLibActionId: BucketAdLibActionId,
		actionProps: Partial<Omit<BucketAdLibAction, '_id'>>
	): Promise<void> {
		const oldAction = await BucketAdLibActions.findOneAsync(adLibActionId)
		if (!oldAction) throw new Meteor.Error(404, `BucketAdLibAction "${adLibActionId}" not found`)

		if (actionProps.bucketId && actionProps.bucketId !== oldAction.bucketId) {
			const moveIntoBucket = await Buckets.countDocuments(actionProps.bucketId)
			if (moveIntoBucket === 0) throw new Meteor.Error(`Could not find bucket: "${actionProps.bucketId}"`)
		}

		if (actionProps.studioId && actionProps.studioId !== oldAction.studioId) {
			const newStudioCount = await Studios.countDocuments(actionProps.studioId)
			if (newStudioCount === 0) throw new Meteor.Error(`Could not find studio: "${actionProps.studioId}"`)
		}

		await runIngestOperation(oldAction.studioId, IngestJobs.BucketActionModify, {
			actionId: oldAction._id,
			props: actionProps,
		})
	}

	export async function saveAdLibActionIntoBucket(
		bucketId: BucketId,
		action: AdLibActionCommon | BucketAdLibAction
	): Promise<BucketAdLibAction> {
		const targetBucket = (await Buckets.findOneAsync(bucketId, { projection: { _id: 1, studioId: 1 } })) as
			| Pick<Bucket, '_id' | 'studioId'>
			| undefined
		if (!targetBucket) throw new Meteor.Error(404, `Bucket "${bucketId}" not found`)

		let adLibAction: BucketAdLibAction
		if (isBucketAdLibAction(action)) {
			if (action.showStyleVariantId && !(await ShowStyleVariants.findOneAsync(action.showStyleVariantId))) {
				throw new Meteor.Error(`Could not find show style variant: "${action.showStyleVariantId}"`)
			}

			if (targetBucket.studioId !== action.studioId) {
				throw new Meteor.Error(
					`studioId is different than Action's studioId: "${targetBucket.studioId}" - "${action.studioId}"`
				)
			}

			adLibAction = {
				...action,
				_id: getRandomId(),
				bucketId: targetBucket._id,
			}
		} else {
			const rundown = await Rundowns.findOneAsync(action.rundownId)
			if (!rundown) {
				throw new Meteor.Error(`Could not find rundown: "${action.rundownId}"`)
			}

			if (targetBucket.studioId !== rundown.studioId) {
				throw new Meteor.Error(
					`studioId is different than Rundown's studioId: "${targetBucket.studioId}" - "${rundown.studioId}"`
				)
			}

			adLibAction = {
				...(_.omit(action, ['partId', 'rundownId']) as Omit<AdLibAction, 'partId' | 'rundownId'>),
				_id: getRandomId(),
				externalId: getRandomString(), // This needs to be something unique, so that the regenerate logic doesn't get it mixed up with something else
				bucketId: targetBucket._id,
				studioId: targetBucket.studioId,
				showStyleBaseId: rundown.showStyleBaseId,
				showStyleVariantId: action.allVariants ? null : rundown.showStyleVariantId,
				importVersions: rundown.importVersions,
				ingestInfo: undefined,
			}
		}

		// We can insert it here, as it is a creation with a new id, so the only race risk we have is the bucket being deleted
		await BucketAdLibActions.insertAsync(adLibAction)

		await runIngestOperation(targetBucket.studioId, IngestJobs.BucketActionRegenerateExpectedPackages, {
			actionId: adLibAction._id,
		})

		return adLibAction
	}

	export async function modifyBucketAdLib(
		adLibId: BucketAdLibId,
		adlibProps: Partial<Omit<BucketAdLib, '_id'>>
	): Promise<void> {
		const oldAdLib = await BucketAdLibs.findOneAsync(adLibId)
		if (!oldAdLib) throw new Meteor.Error(404, `BucketAdLib "${adLibId}" not found`)

		if (adlibProps.bucketId && adlibProps.bucketId !== oldAdLib.bucketId) {
			const moveIntoBucket = await Buckets.countDocuments(adlibProps.bucketId)
			if (moveIntoBucket === 0) throw new Meteor.Error(`Could not find bucket: "${adlibProps.bucketId}"`)
		}

		if (adlibProps.studioId && adlibProps.studioId !== oldAdLib.studioId) {
			const newStudioCount = await Studios.countDocuments(adlibProps.studioId)
			if (newStudioCount === 0) throw new Meteor.Error(`Could not find studio: "${adlibProps.studioId}"`)
		}

		await runIngestOperation(oldAdLib.studioId, IngestJobs.BucketPieceModify, {
			pieceId: oldAdLib._id,
			props: adlibProps,
		})
	}

	export async function removeBucket(bucketId: BucketId): Promise<void> {
		const bucket = await Buckets.findOneAsync(bucketId)
		if (!bucket) throw new Meteor.Error(404, `Bucket "${bucketId}" not found`)

		await Promise.all([
			Buckets.removeAsync(bucket._id),
			await runIngestOperation(bucket.studioId, IngestJobs.BucketEmpty, {
				bucketId: bucket._id,
			}),
		])
	}

	export async function importAdlibToBucket(
		bucketId: BucketId,
		showStyleBaseId: ShowStyleBaseId,
		/** Optional: if set, only create adlib for this variant (otherwise: for all variants in ShowStyleBase)*/
		showStyleVariantId: ShowStyleVariantId | undefined,
		ingestItem: IngestAdlib
	): Promise<void> {
		const bucket = await Buckets.findOneAsync(bucketId)
		if (!bucket) throw new Meteor.Error(404, `Bucket "${bucketId}" not found`)

		const studioLight = await fetchStudioLight(bucket.studioId)
		if (!studioLight) throw new Meteor.Error(404, `Studio "${bucket.studioId}" not found`)

		if (showStyleVariantId) {
			const showStyleCompound = await getShowStyleCompound(showStyleVariantId)
			if (!showStyleCompound) throw new Meteor.Error(404, `ShowStyle Variant "${showStyleVariantId}" not found`)
			if (showStyleCompound._id !== showStyleBaseId) {
				throw new Meteor.Error(
					500,
					`ShowStyle Variant "${showStyleVariantId}" is not part of ShowStyleBase "${showStyleBaseId}"`
				)
			}
		}

		if (studioLight.supportedShowStyleBase.indexOf(showStyleBaseId) === -1) {
			throw new Meteor.Error(
				500,
				`ShowStyle base "${showStyleBaseId}" not supported by studio "${bucket.studioId}"`
			)
		}

		await runIngestOperation(bucket.studioId, IngestJobs.BucketItemImport, {
			bucketId: bucket._id,
			showStyleBaseId: showStyleBaseId,
			showStyleVariantIds: showStyleVariantId ? [showStyleVariantId] : undefined,
			payload: ingestItem,
		})
	}
}
