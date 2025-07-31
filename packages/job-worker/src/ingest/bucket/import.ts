import { RundownImportVersions } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ShowStyleUserContext } from '../../blueprints/context/index.js'
import {
	IBlueprintActionManifest,
	IBlueprintAdLibPiece,
	IngestAdlib,
	NoteSeverity,
} from '@sofie-automation/blueprints-integration'
import { WatchedPackagesHelper } from '../../blueprints/context/watchedPackages.js'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs/index.js'
import { getSystemVersion } from '../../lib/index.js'
import { BucketItemImportProps, BucketItemRegenerateProps } from '@sofie-automation/corelib/dist/worker/ingest'
import {
	cleanUpExpectedPackagesForBucketAdLibs,
	cleanUpExpectedPackagesForBucketAdLibsActions,
	updateExpectedPackagesForBucketAdLibPiece,
	updateExpectedPackagesForBucketAdLibAction,
} from '../expectedPackages.js'
import {
	cleanUpExpectedMediaItemForBucketAdLibActions,
	cleanUpExpectedMediaItemForBucketAdLibPiece,
	updateExpectedMediaItemForBucketAdLibAction,
	updateExpectedMediaItemForBucketAdLibPiece,
} from '../expectedMediaItems.js'
import { postProcessBucketAction, postProcessBucketAdLib } from '../../blueprints/postProcess.js'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { BucketAdLib, BucketAdLibIngestInfo } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { BucketAdLibAction } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibAction'
import { logger } from '../../logging.js'
import { createShowStyleCompound } from '../../showStyles.js'
import { isAdlibAction } from './util.js'
import { WrappedShowStyleBlueprint } from '../../blueprints/cache.js'
import { ReadonlyDeep } from 'type-fest'
import { BucketId, ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { interpollateTranslation } from '@sofie-automation/corelib/dist/TranslatableMessage'

export async function handleBucketItemImport(context: JobContext, data: BucketItemImportProps): Promise<void> {
	await regenerateBucketItemFromIngestInfo(
		context,
		data.bucketId,
		data.showStyleBaseId,
		{
			limitToShowStyleVariantIds: data.showStyleVariantIds,
			payload: data.payload,
		},
		undefined,
		undefined
	)
}

export async function handleBucketItemRegenerate(context: JobContext, data: BucketItemRegenerateProps): Promise<void> {
	// These queries could match more than one document, but as they have the same `externalId` they all get regenerated together
	const [adlibPiece, adlibAction] = await Promise.all([
		context.directCollections.BucketAdLibPieces.findOne(
			{
				externalId: data.externalId,
				studioId: context.studio._id,
				bucketId: data.bucketId,
			},
			{
				projection: {
					showStyleBaseId: 1,
					ingestInfo: 1,
					name: 1,
					_rank: 1,
				},
			}
		) as Promise<Pick<BucketAdLib, 'showStyleBaseId' | 'ingestInfo' | 'name' | '_rank'>> | undefined,
		context.directCollections.BucketAdLibActions.findOne(
			{
				externalId: data.externalId,
				studioId: context.studio._id,
				bucketId: data.bucketId,
			},
			{
				projection: {
					showStyleBaseId: 1,
					ingestInfo: 1,
					display: 1,
				},
			}
		) as Promise<Pick<BucketAdLibAction, 'showStyleBaseId' | 'ingestInfo' | 'display'>> | undefined,
	])

	// TODO - UserErrors?
	if (adlibAction) {
		if (!adlibAction.ingestInfo) throw new Error(`Bucket AdLibAction cannot be resynced, it has no ingest data`)
		await regenerateBucketItemFromIngestInfo(
			context,
			data.bucketId,
			adlibAction.showStyleBaseId,
			adlibAction.ingestInfo,
			adlibAction.display._rank,
			typeof adlibAction.display.label === 'string' ? adlibAction.display.label : undefined
		)
	} else if (adlibPiece) {
		if (!adlibPiece.ingestInfo) throw new Error(`Bucket AdLibPiece cannot be resynced, it has no ingest data`)
		await regenerateBucketItemFromIngestInfo(
			context,
			data.bucketId,
			adlibPiece.showStyleBaseId,
			adlibPiece.ingestInfo,
			adlibPiece._rank,
			adlibPiece.name
		)
	} else {
		throw new Error(`No Bucket Items with externalId "${data.externalId}" were found`)
	}
}

async function regenerateBucketItemFromIngestInfo(
	context: JobContext,
	bucketId: BucketId,
	showStyleBaseId: ShowStyleBaseId,
	ingestInfo: BucketAdLibIngestInfo,
	oldRank: number | undefined,
	oldLabel: string | undefined
): Promise<void> {
	const [showStyleBase, allShowStyleVariants, allOldAdLibPieces, allOldAdLibActions, blueprint] = await Promise.all([
		context.getShowStyleBase(showStyleBaseId),
		context.getShowStyleVariants(showStyleBaseId),
		context.directCollections.BucketAdLibPieces.findFetch(
			{
				externalId: ingestInfo.payload.externalId,
				showStyleBaseId: showStyleBaseId,
				studioId: context.studio._id,
				bucketId: bucketId,
			},
			{ projection: { _id: 1 } }
		) as Promise<Pick<BucketAdLib, '_id'>[]>,
		context.directCollections.BucketAdLibActions.findFetch(
			{
				externalId: ingestInfo.payload.externalId,
				showStyleBaseId: showStyleBaseId,
				studioId: context.studio._id,
				bucketId: bucketId,
			},
			{ projection: { _id: 1 } }
		) as Promise<Pick<BucketAdLibAction, '_id'>[]>,
		context.getShowStyleBlueprint(showStyleBaseId),
	])

	if (!showStyleBase) throw new Error(`ShowStyleBase "${showStyleBaseId}" not found`)

	const showStyleVariants = allShowStyleVariants.filter(
		(v) => !ingestInfo.limitToShowStyleVariantIds || ingestInfo.limitToShowStyleVariantIds.includes(v._id)
	)
	if (showStyleVariants.length === 0) throw new Error(`No ShowStyleVariants found for ${showStyleBaseId}`)

	const adlibIdsToRemove = new Set(allOldAdLibPieces.map((p) => p._id))
	const actionIdsToRemove = new Set(allOldAdLibActions.map((p) => p._id))

	let isFirstShowStyleVariant = true
	const newRank: number | undefined = oldRank ?? (await calculateHighestRankInBucket(context, bucketId)) + 1
	let onlyGenerateOneItem = false

	const ps: Promise<any>[] = []
	for (const showStyleVariant of showStyleVariants) {
		const showStyleCompound = createShowStyleCompound(showStyleBase, showStyleVariant)
		if (!showStyleCompound)
			throw new Error(`Unable to create a ShowStyleCompound for ${showStyleBase._id}, ${showStyleVariant._id} `)

		const rawAdlib = await generateBucketAdlibForVariant(context, blueprint, showStyleCompound, ingestInfo.payload)

		if (rawAdlib) {
			const importVersions: RundownImportVersions = {
				studio: context.studio._rundownVersionHash,
				showStyleBase: showStyleCompound._rundownVersionHash,
				showStyleVariant: showStyleCompound._rundownVersionHashVariant,
				blueprint: blueprint.blueprint.blueprintVersion,
				core: getSystemVersion(),
			}

			if (isAdlibAction(rawAdlib)) {
				if (isFirstShowStyleVariant) {
					if (rawAdlib.allVariants) {
						// If the adlib can be used by all variants, we only should only generate it once.
						onlyGenerateOneItem = true
					}
				} else {
					delete rawAdlib.allVariants
				}
				const action: BucketAdLibAction = postProcessBucketAction(
					context,
					showStyleCompound,
					rawAdlib,
					ingestInfo,
					blueprint.blueprintId,
					bucketId,
					newRank,
					oldLabel,
					importVersions
				)

				ps.push(
					context.directCollections.BucketAdLibActions.replace(action),
					updateExpectedMediaItemForBucketAdLibAction(context, action),
					updateExpectedPackagesForBucketAdLibAction(context, action)
				)

				// Preserve this one
				actionIdsToRemove.delete(action._id)
			} else {
				const adlib = postProcessBucketAdLib(
					context,
					showStyleCompound,
					rawAdlib,
					ingestInfo,
					blueprint.blueprintId,
					bucketId,
					newRank,
					oldLabel,
					importVersions
				)

				ps.push(
					context.directCollections.BucketAdLibPieces.replace(adlib),
					updateExpectedMediaItemForBucketAdLibPiece(context, adlib),
					updateExpectedPackagesForBucketAdLibPiece(context, adlib)
				)

				// Preserve this one
				adlibIdsToRemove.delete(adlib._id)
			}

			if (onlyGenerateOneItem) {
				// We only need to generate one variant, so we can stop here
				break
			}
		}
		isFirstShowStyleVariant = false
	}

	// Cleanup old items:
	if (adlibIdsToRemove.size > 0) {
		const adlibIdsToRemoveArray = Array.from(adlibIdsToRemove)

		ps.push(
			cleanUpExpectedMediaItemForBucketAdLibPiece(context, adlibIdsToRemoveArray),
			cleanUpExpectedPackagesForBucketAdLibs(context, adlibIdsToRemoveArray),
			context.directCollections.BucketAdLibPieces.remove({ _id: { $in: adlibIdsToRemoveArray } })
		)
	}
	if (actionIdsToRemove.size > 0) {
		const actionIdsToRemoveArray = Array.from(actionIdsToRemove)

		ps.push(
			cleanUpExpectedMediaItemForBucketAdLibActions(context, actionIdsToRemoveArray),
			cleanUpExpectedPackagesForBucketAdLibsActions(context, actionIdsToRemoveArray),
			context.directCollections.BucketAdLibActions.remove({ _id: { $in: actionIdsToRemoveArray } })
		)
	}
	await Promise.all(ps)
}

async function generateBucketAdlibForVariant(
	context: JobContext,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
	// pieceId: BucketAdLibId | BucketAdLibActionId,
	payload: IngestAdlib
): Promise<IBlueprintAdLibPiece | IBlueprintActionManifest | null> {
	if (!blueprint.blueprint.getAdlibItem) return null

	const watchedPackages = await WatchedPackagesHelper.create(context, {
		// We don't know what the `pieceId` will be, but we do know the `externalId`
		pieceExternalId: payload.externalId,
		fromPieceType: {
			$in: [ExpectedPackageDBType.BUCKET_ADLIB, ExpectedPackageDBType.BUCKET_ADLIB_ACTION],
		},
	})

	const contextForVariant = new ShowStyleUserContext(
		{
			name: `Bucket Ad-Lib`,
			identifier: `studioId=${context.studioId},showStyleBaseId=${showStyleCompound._id},showStyleVariantId=${showStyleCompound.showStyleVariantId}`,
		},
		context,
		showStyleCompound,
		watchedPackages
	)

	try {
		const adlibItem = blueprint.blueprint.getAdlibItem(contextForVariant, payload)

		// Log any notes
		// Future: This should either be a context which doesn't support notes, or should do something better with them
		for (const note of contextForVariant.notes) {
			switch (note.type) {
				case NoteSeverity.ERROR:
					contextForVariant.logError(`UserNote: ${interpollateTranslation(note.message)}`)
					break
				case NoteSeverity.WARNING:
					contextForVariant.logWarning(`UserNote: ${interpollateTranslation(note.message)}`)
					break
				case NoteSeverity.INFO:
				default:
					contextForVariant.logInfo(`UserNote: ${interpollateTranslation(note.message)}`)
					break
			}
		}

		return adlibItem
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.getShowStyleVariantId: ${stringifyError(err)}`)
	}
	return null
}

async function calculateHighestRankInBucket(context: JobContext, bucketId: BucketId): Promise<number> {
	const [highestAdlib, highestAction] = await Promise.all([
		context.directCollections.BucketAdLibPieces.findFetch(
			{
				bucketId: bucketId,
			},
			{
				sort: {
					_rank: -1,
				},
				projection: {
					_rank: 1,
				},
				limit: 1,
			}
		) as Promise<Array<Pick<BucketAdLib, '_rank'>>>,
		context.directCollections.BucketAdLibActions.findFetch(
			{
				bucketId: bucketId,
			},
			{
				sort: {
					'display._rank': -1,
				},
				projection: {
					'display._rank': 1,
				},
				limit: 1,
			}
		) as Promise<Array<{ display: Pick<BucketAdLibAction['display'], '_rank'> }>>,
	])

	return Math.max(highestAdlib[0]?._rank ?? 0, highestAction[0]?.display?._rank ?? 0)
}
