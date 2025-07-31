import { ProtectedString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { getCurrentTime } from '../lib/lib'
import { CollectionCleanupResult } from '@sofie-automation/meteor-lib/dist/api/system'
import { MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import {
	getActiveRundownPlaylistsInStudioFromDb,
	getExpiredRemovedPackageInfos,
	getOrphanedPackageInfos,
	removePackageInfos,
} from './studio/lib'
import { Settings } from '../Settings'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import {
	BlueprintId,
	BucketId,
	MediaWorkFlowId,
	OrganizationId,
	PartId,
	PartInstanceId,
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	AdLibActions,
	AdLibPieces,
	Blueprints,
	BucketAdLibActions,
	BucketAdLibs,
	Buckets,
	Evaluations,
	ExpectedMediaItems,
	ExpectedPackages,
	ExpectedPackageWorkStatuses,
	ExpectedPlayoutItems,
	ExternalMessageQueue,
	NrcsIngestDataCache,
	MediaObjects,
	MediaWorkFlows,
	MediaWorkFlowSteps,
	Organizations,
	PackageContainerPackageStatuses,
	PackageContainerStatuses,
	PackageInfos,
	PartInstances,
	Parts,
	PeripheralDeviceCommands,
	PeripheralDevices,
	PieceInstances,
	Pieces,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	RundownBaselineObjs,
	RundownLayouts,
	RundownPlaylists,
	Rundowns,
	Segments,
	ShowStyleBases,
	ShowStyleVariants,
	Snapshots,
	Studios,
	Timeline,
	TimelineDatastore,
	TranslationsBundles,
	TriggeredActions,
	UserActionsLog,
	Workers,
	WorkerThreadStatuses,
	Notifications,
	SofieIngestDataCache,
} from '../collections'
import { AsyncOnlyMongoCollection, AsyncOnlyReadOnlyMongoCollection } from '../collections/collection'
import { getCollectionKey } from '../collections/lib'
import { generateTranslationBundleOriginId } from './translationsBundles'
import { DBNotificationTargetType } from '@sofie-automation/corelib/dist/dataModel/Notifications'

/**
 * If actuallyCleanup=true, cleans up old data. Otherwise just checks what old data there is
 * @returns A string if there is an issue preventing cleanup. CollectionCleanupResult otherwise
 */
export async function cleanupOldDataInner(actuallyCleanup = false): Promise<CollectionCleanupResult | string> {
	if (actuallyCleanup) {
		const notAllowedReason = await isAllowedToRunCleanup()
		if (notAllowedReason) return `Could not run the cleanup function due to: ${notAllowedReason}`
	}

	const result: CollectionCleanupResult = {}
	const addToResult = (collectionName: CollectionName, docsToRemove: number) => {
		if (!result[collectionName]) {
			result[collectionName] = {
				collectionName: collectionName,
				docsToRemove: 0,
			}
		}
		result[collectionName].docsToRemove += docsToRemove
	}

	// Preparations: ------------------------------------------------------------------------------

	const removeByQuery = async <DBInterface extends { _id: ID }, ID extends ProtectedString<any>>(
		// collectionName: string,
		collection: AsyncOnlyReadOnlyMongoCollection<DBInterface>,
		query: MongoQuery<DBInterface>
	): Promise<ID[]> => {
		const collectionName = getCollectionKey(collection)

		const ids = (await collection.findFetchAsync(query, { projection: { _id: 1 } })).map((doc) => doc._id)
		const count = ids.length
		if (actuallyCleanup) {
			await collection.mutableCollection.removeAsync(query)
		}
		addToResult(collectionName, count)

		return ids
	}

	// Go through and removing old data: --------------------------------------------------

	// CoreSystem:
	{
		addToResult(CollectionName.CoreSystem, 0) // Do nothing
	}
	// Organizations
	{
		addToResult(CollectionName.Organizations, 0) // Do nothing
	}

	// Documents owned by Organizations:
	const organizationIds = await getAllIdsInCollection(Organizations)
	const removedStudioIds = new Set<StudioId>()
	const removedShowStyleBases = new Set<ShowStyleBaseId>()
	const removedBlueprints = new Set<BlueprintId>()
	const removedDeviceIds = new Set<PeripheralDeviceId>()
	{
		const ownedByOrganizationId = async <
			DBInterface extends { _id: ID; organizationId: OrganizationId | null | undefined },
			ID extends ProtectedString<any>,
		>(
			collection: AsyncOnlyReadOnlyMongoCollection<DBInterface>
		): Promise<ID[]> => {
			return await removeByQuery(collection.mutableCollection as AsyncOnlyMongoCollection<any>, {
				$and: [
					{
						organizationId: { $nin: organizationIds },
					},
					{
						organizationId: { $exists: true },
					},
					{
						organizationId: { $ne: null },
					},
				],
			})
		}
		;(await ownedByOrganizationId(Studios)).forEach((id) => removedStudioIds.add(id))
		;(await ownedByOrganizationId(ShowStyleBases)).forEach((id) => removedShowStyleBases.add(id))
		;(await ownedByOrganizationId(Blueprints)).forEach((id) => removedBlueprints.add(id))
		;(await ownedByOrganizationId(PeripheralDevices)).forEach((id) => removedDeviceIds.add(id))
	}

	// Documents owned by PeripheralDevices:
	const removedMediaWorkFlows = new Set<MediaWorkFlowId>()
	const deviceIds = await getAllIdsInCollection(PeripheralDevices, removedDeviceIds)
	{
		const ownedByDeviceId = async <
			DBInterface extends { _id: ID; deviceId: PeripheralDeviceId },
			ID extends ProtectedString<any>,
		>(
			collection: AsyncOnlyReadOnlyMongoCollection<DBInterface>
		): Promise<ID[]> => {
			return await removeByQuery(collection.mutableCollection as AsyncOnlyMongoCollection<any>, {
				deviceId: { $nin: deviceIds },
			})
		}
		await ownedByDeviceId(ExpectedPackageWorkStatuses)
		;(await ownedByDeviceId(MediaWorkFlows)).forEach((id) => removedMediaWorkFlows.add(id))
		await ownedByDeviceId(PackageContainerPackageStatuses)
		await ownedByDeviceId(PackageContainerStatuses)
		await ownedByDeviceId(PackageInfos)
		await ownedByDeviceId(PeripheralDeviceCommands)
	}

	// Documents owned by Studios:
	const studioIds = await getAllIdsInCollection(Studios, removedStudioIds)
	const removedRundownPlaylists = new Set<RundownPlaylistId>()
	const removedBuckets = new Set<BucketId>()
	{
		const ownedByStudioId = async <
			DBInterface extends { _id: ID; studioId: StudioId },
			ID extends ProtectedString<any>,
		>(
			collection: AsyncOnlyReadOnlyMongoCollection<DBInterface>
		): Promise<ID[]> => {
			return await removeByQuery(collection.mutableCollection as AsyncOnlyMongoCollection<any>, {
				studioId: { $nin: studioIds },
			})
		}
		;(await ownedByStudioId(RundownPlaylists)).forEach((id) => removedRundownPlaylists.add(id))
		await ownedByStudioId(BucketAdLibs)
		await ownedByStudioId(BucketAdLibActions)
		;(await ownedByStudioId(Buckets)).forEach((id) => removedBuckets.add(id))
		await ownedByStudioId(ExpectedPackages)
		await ownedByStudioId(ExpectedPackageWorkStatuses)
		await ownedByStudioId(MediaObjects)
		await ownedByStudioId(PackageContainerStatuses)
		await ownedByStudioId(PackageContainerPackageStatuses)
		await ownedByStudioId(PackageInfos)
		await ownedByStudioId(TimelineDatastore)

		await removeByQuery(Timeline, {
			_id: { $nin: studioIds },
		})
	}
	// Documents owned by ShowStyleBases:
	const showStyleBaseIds = await getAllIdsInCollection(ShowStyleBases, removedShowStyleBases)
	{
		await removeByQuery(RundownLayouts, {
			showStyleBaseId: { $nin: showStyleBaseIds },
		})
		await removeByQuery(ShowStyleVariants, {
			showStyleBaseId: { $nin: showStyleBaseIds },
		})
		await removeByQuery(TriggeredActions, {
			showStyleBaseId: { $nin: [...showStyleBaseIds, null] },
		})
	}

	// Documents owned by Blueprints:
	const blueprintIds = await getAllIdsInCollection(Blueprints, removedBlueprints)
	{
		await removeByQuery(TranslationsBundles, {
			originId: {
				$nin: [
					...blueprintIds.map((id) => generateTranslationBundleOriginId(id, 'blueprints')),
					...deviceIds.map((id) => generateTranslationBundleOriginId(id, 'peripheralDevice')),
				],
			},
		})
	}

	// Documents owned by RundownPlaylists:
	const playlistIds = await getAllIdsInCollection(RundownPlaylists, removedRundownPlaylists)
	const removedRundowns = new Set<RundownId>()

	{
		const ownedByRundownPlaylistId = async <
			DBInterface extends { _id: ID; playlistId: RundownPlaylistId },
			ID extends ProtectedString<any>,
		>(
			collection: AsyncOnlyReadOnlyMongoCollection<DBInterface>
		): Promise<ID[]> => {
			return await removeByQuery(collection.mutableCollection as AsyncOnlyMongoCollection<any>, {
				playlistId: { $nin: playlistIds },
			})
		}
		;(await ownedByRundownPlaylistId(Rundowns)).forEach((id) => removedRundowns.add(id))
	}

	// Documents owned by Rundowns:
	const rundownIds = await getAllIdsInCollection(Rundowns, removedRundowns)
	const removedParts = new Set<PartId>()
	{
		const ownedByRundownId = async <
			DBInterface extends { _id: ID; rundownId: RundownId },
			ID extends ProtectedString<any>,
		>(
			collection: AsyncOnlyReadOnlyMongoCollection<DBInterface>
		): Promise<ID[]> => {
			return await removeByQuery(collection.mutableCollection as AsyncOnlyMongoCollection<any>, {
				rundownId: { $nin: rundownIds },
			})
		}
		await ownedByRundownId(AdLibActions)
		await ownedByRundownId(AdLibPieces)
		await ownedByRundownId(SofieIngestDataCache)
		await ownedByRundownId(NrcsIngestDataCache)
		;(await ownedByRundownId(Parts)).forEach((id) => removedParts.add(id))
		await ownedByRundownId(RundownBaselineAdLibActions)
		await ownedByRundownId(RundownBaselineAdLibPieces)
		await ownedByRundownId(RundownBaselineObjs)
		await ownedByRundownId(Segments)
		// Owned by RundownId Or StudioId:
		{
			await removeByQuery(ExpectedPlayoutItems, {
				$or: [
					{
						rundownId: { $exists: true, $nin: rundownIds },
					},
					{
						rundownId: { $exists: false },
						studioId: { $nin: studioIds },
					},
				],
			})
		}
		await removeByQuery(Pieces, {
			startRundownId: { $nin: rundownIds },
		})
		await ownedByRundownId(PieceInstances)
	}

	// Documents owned by Parts:
	const removedPartInstances = new Set<PartInstanceId>()
	{
		const partIds = await getAllIdsInCollection(Parts, removedParts)
		;(
			await removeByQuery(PartInstances, {
				$or: [
					{
						// Where the parent Rundown is missing:
						rundownId: { $nin: rundownIds },
					},
					{
						// Remove any from long running rundowns where they have long since expired:
						reset: true,
						'timings.plannedStoppedPlayback': { $lt: getCurrentTime() - Settings.maximumDataAge },
						'part._id': { $nin: partIds },
					},
				],
			})
		).forEach((id) => removedPartInstances.add(id))
	}

	// Other documents:

	// PieceInstances
	{
		const partInstanceIds = await getAllIdsInCollection(PartInstances, removedPartInstances)
		await removeByQuery(PieceInstances, {
			partInstanceId: { $nin: partInstanceIds },
		})
	}
	// Evaluations
	{
		await removeByQuery(Evaluations, {
			timestamp: { $lt: getCurrentTime() - Settings.maximumDataAge },
		})
	}
	// ExpectedMediaItems
	{
		const bucketIds = await getAllIdsInCollection(Buckets, removedBuckets)
		const emiFromBuckets = await ExpectedMediaItems.findFetchAsync(
			{
				$and: [
					{
						bucketId: { $exists: true },
						rundownId: { $exists: false },
					},
					{
						bucketId: { $nin: bucketIds },
					},
				],
			},
			{ projection: { _id: 1 } }
		)
		const emiFromRundowns = await ExpectedMediaItems.findFetchAsync(
			{
				$and: [
					{
						bucketId: { $exists: false },
						rundownId: { $exists: true },
					},
					{
						rundownId: { $nin: rundownIds },
					},
				],
			},
			{ projection: { _id: 1 } }
		)
		addToResult(CollectionName.ExpectedMediaItems, emiFromBuckets.length)
		addToResult(CollectionName.ExpectedMediaItems, emiFromRundowns.length)
		if (actuallyCleanup) {
			await ExpectedMediaItems.mutableCollection.removeAsync({
				_id: { $in: [...emiFromBuckets, ...emiFromRundowns].map((o) => o._id) },
			})
		}
	}
	// ExternalMessageQueue
	{
		await removeByQuery(ExternalMessageQueue, {
			$or: [
				{ created: { $lt: getCurrentTime() - Settings.maximumDataAge } },
				{ expires: { $lt: getCurrentTime() } },
			],
		})
	}
	// MediaWorkFlowSteps
	{
		const mediaWorkFlowIds = await getAllIdsInCollection(MediaWorkFlows, removedMediaWorkFlows)
		await removeByQuery(MediaWorkFlowSteps, {
			workFlowId: { $nin: mediaWorkFlowIds },
		})
	}
	// PackageInfos
	{
		// Future: there should be a way to force removal of the non-expired packageinfos

		// PackageInfos which are missing the parent ExpectedPackage should be marked for removal (later)
		const orphanedPackageInfoIds = await getOrphanedPackageInfos()
		if (actuallyCleanup && orphanedPackageInfoIds.length) {
			await removePackageInfos(orphanedPackageInfoIds, 'defer')
		}

		// PackageInfos which have expired should be removed
		const expiredPackageInfoIds = await getExpiredRemovedPackageInfos()
		addToResult(CollectionName.PackageInfos, expiredPackageInfoIds.length)
		if (actuallyCleanup && expiredPackageInfoIds.length) {
			await removePackageInfos(expiredPackageInfoIds, 'purge') // Remove now
		}
	}

	// Snapshots
	{
		await removeByQuery(Snapshots, {
			created: { $lt: getCurrentTime() - Settings.maximumDataAge },
		})
	}

	// UserActionsLog
	{
		await removeByQuery(UserActionsLog, {
			timestamp: { $lt: getCurrentTime() - Settings.maximumDataAge },
		})
	}
	// Workers
	{
		addToResult(getCollectionKey(Workers), 0)
	}
	// WorkerThreadStatuses
	{
		const workerIds = await getAllIdsInCollection(Workers)
		await removeByQuery(WorkerThreadStatuses, {
			workerId: { $nin: workerIds },
		})
	}
	// Workers
	{
		// Not supported
		addToResult(getCollectionKey(Workers), 0)
	}
	// WorkerThreadStatuses
	{
		// Not supported
		addToResult(getCollectionKey(WorkerThreadStatuses), 0)
	}

	// Notifications
	{
		const rundownIds = await getAllIdsInCollection(Rundowns)
		const playlistIds = await getAllIdsInCollection(RundownPlaylists)
		await removeByQuery(Notifications, {
			studioId: { $nin: studioIds },
			$or: [
				// {
				// 	'relatedTo.type': DBNotificationTargetType.EVERYWHERE,
				// },
				{
					'relatedTo.type': DBNotificationTargetType.PLAYLIST,
					'relatedTo.playlistId': { $nin: playlistIds },
				},
				{
					'relatedTo.type': {
						$in: [
							DBNotificationTargetType.RUNDOWN,
							DBNotificationTargetType.PARTINSTANCE,
							DBNotificationTargetType.PIECEINSTANCE,
						],
					},
					'relatedTo.rundownId': { $nin: rundownIds },
				},
			],
		})
	}

	return result
}
async function isAllowedToRunCleanup(): Promise<string | void> {
	// HACK: TODO - should we check this?
	// if (isAnyQueuedWorkRunning()) return `Another sync-function is running, try again later`

	const studios = await Studios.findFetchAsync({}, { projection: { _id: 1 } })
	for (const studio of studios) {
		const activePlaylist: DBRundownPlaylist | undefined = (
			await getActiveRundownPlaylistsInStudioFromDb(studio._id)
		)[0]
		if (activePlaylist) {
			return `There is an active RundownPlaylist: "${activePlaylist.name}" in studio "${studio.name}" (${activePlaylist._id}, ${studio._id})`
		}
	}
}
/** Returns a list of the ids of all documents in a collection */
async function getAllIdsInCollection<DBInterface extends { _id: ID }, ID extends ProtectedString<any>>(
	collection: AsyncOnlyReadOnlyMongoCollection<DBInterface>,
	excludeIds?: Set<ID>
): Promise<DBInterface['_id'][]> {
	let ids = (
		await collection.findFetchAsync(
			{},
			{
				projection: {
					_id: 1,
				},
			}
		)
	).map((o) => o._id)
	if (excludeIds) ids = ids.filter((id) => !excludeIds.has(id))
	return ids
}
