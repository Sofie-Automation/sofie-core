import { getRandomId } from '../../lib/tempLib'

import '../../collections' // include this in order to get all of the collection set up
import { cleanupOldDataInner } from '../cleanup'
import {
	DefaultEnvironment,
	setupDefaultRundownPlaylist,
	setupDefaultStudioEnvironment,
} from '../../../__mocks__/helpers/database'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	RundownPlaylists,
	Rundowns,
	Studios,
	ShowStyleBases,
	Blueprints,
	PeripheralDevices,
	Workers,
	TriggeredActions,
	PartInstances,
	PieceInstances,
	Segments,
	Parts,
	Pieces,
	AdLibActions,
	Buckets,
	BucketAdLibActions,
	BucketAdLibs,
	Evaluations,
	ExpectedPackages,
	ExpectedPackageWorkStatuses,
	ExpectedPlayoutItems,
	ExternalMessageQueue,
	NrcsIngestDataCache,
	PackageContainerPackageStatuses,
	PackageInfos,
	PeripheralDeviceCommands,
	RundownBaselineAdLibActions,
	RundownBaselineObjs,
	RundownLayouts,
	Snapshots,
	UserActionsLog,
	Timeline,
	TranslationsBundles,
	PackageContainerStatuses,
	TimelineDatastore,
	Notifications,
	SofieIngestDataCache,
} from '../../collections'
import { Collections } from '../../collections/lib'
import { generateTranslationBundleOriginId } from '../translationsBundles'
import { CollectionCleanupResult } from '@sofie-automation/meteor-lib/dist/api/system'
import { DBNotificationTargetType } from '@sofie-automation/corelib/dist/dataModel/Notifications'

describe('Cleanup', () => {
	let env: DefaultEnvironment

	beforeEach(async () => {
		await clearAllDBCollections()
		env = await setupDefaultStudioEnvironment()
	})

	test('Check that all collections are covered', async () => {
		expect(Collections.size).toBeGreaterThan(10)

		const result = await cleanupOldDataInner(false)
		expect(typeof result).not.toBe('string')

		for (const name of Collections.keys()) {
			// Check that the collection has been handled in the function cleanupOldDataInner:
			expect(result).toHaveProperty(name)
		}
	})

	test('No bad removals', async () => {
		// Check that cleanupOldDataInner() doesn't remove any data when the default data set is in the DB.

		await setDefaultDatatoDB(env, Date.now())

		const results = await cleanupOldDataInner(true)

		expect(typeof results).not.toBe('string')
		if (typeof results === 'string') throw new Error(results)

		for (const result of Object.values<CollectionCleanupResult[0]>(results)) {
			try {
				expect(result.docsToRemove).toBe(0)
			} catch (e) {
				throw new Error(`${result.collectionName} ${e}`)
			}
		}

		expect(await RundownPlaylists.countDocuments()).toBe(1)
		expect(await Rundowns.countDocuments()).toBe(1)
	})
	test('All dependants should be removed', async () => {
		// Check that cleanupOldDataInner() cleans up all data from the database.

		await setDefaultDatatoDB(env, 0)

		// Pre-check, just to check that there is data in the DB:
		expect(await RundownPlaylists.countDocuments()).toBeGreaterThanOrEqual(1)
		expect(await Rundowns.countDocuments()).toBeGreaterThanOrEqual(1)

		// Remove top-level documents, so that dependants will be removed in cleanup:
		await Studios.removeAsync({})
		await ShowStyleBases.removeAsync({})
		await Blueprints.removeAsync({})
		await PeripheralDevices.removeAsync({})

		// Manually clean up things that aren't cleaned up in cleanupOldDataInner:
		await Workers.removeAsync({})
		await TriggeredActions.removeAsync({
			showStyleBaseId: null,
		})

		const results = await cleanupOldDataInner(true)

		expect(typeof results).not.toBe('string')
		if (typeof results === 'string') throw new Error(results)

		for (const [collectionName, collection] of Collections.entries()) {
			if (
				[
					// Ignore these:
					'coreSystem',
					'workers',
				].includes(collectionName)
			)
				continue

			try {
				expect(await collection.countDocuments()).toBe(0)
			} catch (e) {
				throw new Error(`${collectionName} ${e}`)
			}
		}
	})
	test('PieceInstance should be removed when PartInstance is removed', async () => {
		// Check that cleanupOldDataInner() cleans up all data from the database.

		await setDefaultDatatoDB(env, 0)

		// Pre-check, just to check that there is data in the DB:
		expect(await PartInstances.countDocuments()).toBeGreaterThanOrEqual(1)
		expect(await PieceInstances.countDocuments()).toBeGreaterThanOrEqual(1)

		// Remove PartInstances, so that dependants will be removed in cleanup:
		await PartInstances.mutableCollection.removeAsync({})

		const results = await cleanupOldDataInner(true)

		expect(typeof results).not.toBe('string')
		if (typeof results === 'string') throw new Error(results)

		expect(await PartInstances.countDocuments()).toBeGreaterThanOrEqual(0)
		expect(await PieceInstances.countDocuments()).toBeGreaterThanOrEqual(0)
	})
})

/**
 * Add "one of each" document into the database
 */
async function setDefaultDatatoDB(env: DefaultEnvironment, now: number) {
	const studioId = env.studio._id
	const showStyleBaseId = env.showStyleBaseId
	const showStyleVariantId = env.showStyleVariantId
	const deviceId = env.ingestDevice._id

	const { playlistId, rundownId } = await setupDefaultRundownPlaylist(env)

	const segment = await Segments.findOneAsync({ rundownId })
	if (!segment) throw new Error('No Segment found')
	const segmentId = segment._id

	const part = await Parts.findOneAsync({ rundownId })
	if (!part) throw new Error('No Part found')
	const partId = part._id

	const piece: Piece = {
		_id: getRandomId(),
		content: {} as any,
		enable: {} as any,
		externalId: '',
		invalid: false,
		lifespan: {} as any,
		name: 'mock',
		outputLayerId: '',
		sourceLayerId: '',
		pieceType: '' as any,
		startPartId: partId,
		startRundownId: rundownId,
		startSegmentId: segmentId,
		timelineObjectsString: '' as any,
	}
	const pieceId = await Pieces.mutableCollection.insertAsync(piece)

	await AdLibActions.mutableCollection.insertAsync({
		_id: getRandomId(),
		actionId: '',
		externalId: '',
		partId,
		rundownId,
		display: {} as any,
		userData: {} as any,
		userDataManifest: {} as any,
	})

	const bucketId = await Buckets.insertAsync({
		_id: getRandomId(),
		_rank: 0,
		buttonHeightScale: 0,
		buttonWidthScale: 0,
		name: 'mock',
		studioId,
	})
	await BucketAdLibActions.insertAsync({
		_id: getRandomId(),
		bucketId,
		externalId: '',
		studioId,
		showStyleBaseId: env.showStyleBaseId,
		actionId: '',
		display: {} as any,
		importVersions: {} as any,
		ingestInfo: undefined,
		showStyleVariantId,
		userData: {} as any,
		userDataManifest: {} as any,
	})
	await BucketAdLibs.insertAsync({
		_id: getRandomId(),
		bucketId,
		externalId: '',
		studioId,
		showStyleBaseId: env.showStyleBaseId,
		importVersions: {} as any,
		ingestInfo: undefined,
		showStyleVariantId,
		_rank: 0,
		content: {} as any,
		lifespan: {} as any,
		name: 'mock',
		outputLayerId: '',
		sourceLayerId: '',
		timelineObjectsString: '' as any,
	})
	await Evaluations.insertAsync({
		_id: getRandomId(),
		answers: {} as any,
		organizationId: null,
		playlistId,
		studioId,
		timestamp: now,
		userId: null,
	})
	const packageId = await ExpectedPackages.mutableCollection.insertAsync({
		_id: getRandomId(),
		blueprintPackageId: '',
		// @ts-expect-error bucketId is not a part of all ExpectedPackageDBs
		bucketId,
		content: {} as any,
		contentVersionHash: '',
		created: 0,
		fromPieceType: '' as any,
		layers: [],
		pieceId,
		rundownId,
		segmentId,
		sideEffect: {} as any,
		studioId,
		sources: {} as any,
		type: '' as any,
		version: {} as any,
	})
	await ExpectedPackageWorkStatuses.insertAsync({
		_id: getRandomId(),
		deviceId,
		studioId,
		description: '',
		fromPackages: [],
		label: '',
		modified: 0,
		priority: 0,
		status: {} as any,
		statusChanged: 0,
		statusReason: {} as any,
	})
	await ExpectedPlayoutItems.mutableCollection.insertAsync({
		_id: getRandomId(),
		content: {} as any,
		deviceSubType: {} as any,
		rundownId,
		studioId,
	})
	await ExternalMessageQueue.insertAsync({
		_id: getRandomId(),
		created: now,
		expires: now + 100000,
		message: '',
		receiver: {} as any,
		studioId,
		tryCount: 0,
		type: '' as any,
	})
	await NrcsIngestDataCache.mutableCollection.insertAsync({
		_id: getRandomId(),
		data: {} as any,
		modified: 0,
		rundownId,
		type: '' as any,
	})
	await SofieIngestDataCache.mutableCollection.insertAsync({
		_id: getRandomId(),
		data: {} as any,
		modified: 0,
		rundownId,
		type: '' as any,
	})
	await PackageContainerPackageStatuses.insertAsync({
		_id: getRandomId(),
		containerId: '',
		deviceId,
		modified: 0,
		packageId,
		status: '' as any,
		studioId,
	})
	await PackageContainerStatuses.insertAsync({
		_id: getRandomId(),
		containerId: '',
		deviceId,
		modified: now,
		status: {} as any,
		studioId,
	})
	await PackageInfos.insertAsync({
		_id: getRandomId(),
		actualContentVersionHash: '',
		deviceId,
		expectedContentVersionHash: '',
		packageId,
		payload: {} as any,
		studioId,
		type: '' as any,
	})

	const partInstanceId = await PartInstances.mutableCollection.insertAsync({
		_id: getRandomId(),
		isTemporary: false,
		part: part,
		playlistActivationId: getRandomId(),
		rehearsal: false,
		rundownId,
		segmentId,
		segmentPlayoutId: getRandomId(),
		takeCount: 0,
	})
	await PieceInstances.mutableCollection.insertAsync({
		_id: getRandomId(),
		partInstanceId,
		piece,
		playlistActivationId: getRandomId(),
		rundownId,
	})
	await PeripheralDeviceCommands.insertAsync({
		_id: getRandomId(),
		args: [],
		deviceId,
		functionName: '',
		hasReply: false,
		time: 0,
	})
	await RundownBaselineAdLibActions.mutableCollection.insertAsync({
		_id: getRandomId(),
		actionId: '',
		display: {} as any,
		externalId: '',
		rundownId,
		userData: {} as any,
		userDataManifest: {} as any,
	})
	await RundownBaselineObjs.mutableCollection.insertAsync({
		_id: getRandomId(),
		rundownId,
		timelineObjectsString: '' as any,
	})
	await RundownLayouts.insertAsync({
		_id: getRandomId(),
		icon: '',
		iconColor: '',
		isDefaultLayout: false,
		name: '',
		regionId: {} as any,
		showStyleBaseId,
		type: '' as any,
	})
	await Snapshots.insertAsync({
		_id: getRandomId(),
		comment: '',
		created: now,
		fileName: '',
		name: '',
		organizationId: null,
		type: '' as any,
		version: '',
	})
	await Timeline.mutableCollection.insertAsync({
		_id: studioId,
		generated: now,
		generationVersions: {} as any,
		timelineBlob: '' as any,
		timelineHash: '' as any,
		regenerateTimelineToken: undefined,
	})
	await TimelineDatastore.mutableCollection.insertAsync({
		_id: getRandomId(),
		key: '',
		mode: '' as any,
		modified: now,
		studioId,
		value: 0,
	})
	await UserActionsLog.insertAsync({
		_id: getRandomId(),
		args: '',
		clientAddress: '',
		context: '',
		method: '',
		organizationId: null,
		timestamp: now,
		userId: null,
	})

	await TranslationsBundles.insertAsync({
		_id: getRandomId(),
		data: [],
		hash: '',
		language: '',
		originId: generateTranslationBundleOriginId(env.studioBlueprint._id, 'blueprints'),
		type: '' as any,
	})
	await TranslationsBundles.insertAsync({
		_id: getRandomId(),
		data: [],
		hash: '',
		language: '',
		originId: generateTranslationBundleOriginId(deviceId, 'peripheralDevice'),
		type: '' as any,
	})

	await Notifications.insertAsync({
		_id: getRandomId(),
		category: '',
		created: now,
		localId: '',
		message: {} as any,
		severity: 0 as any,
		modified: now,
		relatedTo: {
			type: DBNotificationTargetType.RUNDOWN,
			studioId,
			rundownId,
		},
	})

	// Ensure that we have added one of everything:
	for (const [collectionName, collection] of Collections.entries()) {
		if (
			[
				// Ignore these:
				'organizations',
				'Users',
				// Deprecated:
				'expectedMediaItems',
				'mediaObjects',
				'mediaWorkFlows',
				'mediaWorkFlowSteps',
			].includes(collectionName)
		)
			continue

		try {
			expect(await collection.countDocuments()).toBeGreaterThanOrEqual(1)
		} catch (e) {
			throw new Error(`${collectionName} ${e}`)
		}
	}
}

async function clearAllDBCollections() {
	for (const collection of Collections.values()) {
		await collection.mutableCollection.removeAsync({})
	}
}
