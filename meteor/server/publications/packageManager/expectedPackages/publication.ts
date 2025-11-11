import { DBStudio, StudioPackageContainer } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	TriggerUpdate,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	CustomPublishCollection,
	SetupObserversResult,
} from '../../../lib/customPublication'
import { literal, omit, protectString } from '../../../lib/tempLib'
import { logger } from '../../../logging'
import { ReadonlyDeep } from 'type-fest'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import {
	ExpectedPackageId,
	PeripheralDeviceId,
	PieceInstanceId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Studios } from '../../../collections'
import { check, Match } from 'meteor/check'
import { PackageManagerExpectedPackage } from '@sofie-automation/shared-lib/dist/package-manager/publications'
import { ExpectedPackagesContentObserver } from './contentObserver'
import { createReactiveContentCache, ExpectedPackagesContentCache } from './contentCache'
import { buildMappingsToDeviceIdMap } from './util'
import { updateCollectionForExpectedPackageIds, updateCollectionForPieceInstanceIds } from './generate'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { checkAccessAndGetPeripheralDevice } from '../../../security/check'

interface ExpectedPackagesPublicationArgs {
	readonly studioId: StudioId
	readonly deviceId: PeripheralDeviceId
	readonly filterPlayoutDeviceIds: PeripheralDeviceId[] | undefined
}

interface ExpectedPackagesPublicationUpdateProps {
	invalidateStudio?: boolean

	newCache: ExpectedPackagesContentCache

	invalidateExpectedPackageIds?: ExpectedPackageId[]
	invalidatePieceInstanceIds?: PieceInstanceId[]
}

interface ExpectedPackagesPublicationState {
	studio: Pick<DBStudio, StudioFields> | undefined
	layerNameToDeviceIds: Map<string, PeripheralDeviceId[]>
	packageContainers: Record<string, StudioPackageContainer>

	contentCache: ReadonlyDeep<ExpectedPackagesContentCache>
}

export type StudioFields =
	| '_id'
	| 'routeSetsWithOverrides'
	| 'mappingsWithOverrides'
	| 'packageContainersWithOverrides'
	| 'previewContainerIds'
	| 'thumbnailContainerIds'
const studioFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBStudio, StudioFields>>>({
	_id: 1,
	routeSetsWithOverrides: 1,
	mappingsWithOverrides: 1,
	packageContainersWithOverrides: 1,
	previewContainerIds: 1,
	thumbnailContainerIds: 1,
})

async function setupExpectedPackagesPublicationObservers(
	args: ReadonlyDeep<ExpectedPackagesPublicationArgs>,
	triggerUpdate: TriggerUpdate<ExpectedPackagesPublicationUpdateProps>
): Promise<SetupObserversResult> {
	const contentCache = createReactiveContentCache()

	// Push update
	triggerUpdate({ newCache: contentCache })

	// Set up observers:
	return [
		ExpectedPackagesContentObserver.create(args.studioId, contentCache),

		contentCache.ExpectedPackages.find({}).observeChanges({
			added: (id) => triggerUpdate({ invalidateExpectedPackageIds: [protectString<ExpectedPackageId>(id)] }),
			changed: (id) => triggerUpdate({ invalidateExpectedPackageIds: [protectString<ExpectedPackageId>(id)] }),
			removed: (id) => triggerUpdate({ invalidateExpectedPackageIds: [protectString<ExpectedPackageId>(id)] }),
		}),
		contentCache.PieceInstances.find({}).observeChanges({
			added: (id) => triggerUpdate({ invalidatePieceInstanceIds: [protectString<PieceInstanceId>(id)] }),
			changed: (id) => triggerUpdate({ invalidatePieceInstanceIds: [protectString<PieceInstanceId>(id)] }),
			removed: (id) => triggerUpdate({ invalidatePieceInstanceIds: [protectString<PieceInstanceId>(id)] }),
		}),

		Studios.observeChanges(
			args.studioId,
			{
				added: () => triggerUpdate({ invalidateStudio: true }),
				changed: () => triggerUpdate({ invalidateStudio: true }),
				removed: () => triggerUpdate({ invalidateStudio: true }),
			},
			{
				projection: {
					// mappingsHash gets updated when either of these omitted fields changes
					...omit(studioFieldSpecifier, 'mappingsWithOverrides', 'routeSetsWithOverrides'),
					mappingsHash: 1,
				},
			}
		),
	]
}

async function manipulateExpectedPackagesPublicationData(
	args: ReadonlyDeep<ExpectedPackagesPublicationArgs>,
	state: Partial<ExpectedPackagesPublicationState>,
	collection: CustomPublishCollection<PackageManagerExpectedPackage>,
	updateProps: ReadonlyDeep<Partial<ExpectedPackagesPublicationUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	// Ensure the cached studio/showstyle id are updated
	const invalidateAllItems = !updateProps || updateProps.newCache || updateProps.invalidateStudio

	if (!state.layerNameToDeviceIds) state.layerNameToDeviceIds = new Map()
	if (!state.packageContainers) state.packageContainers = {}

	if (invalidateAllItems) {
		// Everything is invalid, reset everything
		collection.remove(null)
	}

	// Received a new cache object from the tracker
	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache
	}

	// Reload the studio, and the layerNameToDeviceIds lookup
	if (!updateProps || updateProps.invalidateStudio) {
		state.studio = (await Studios.findOneAsync(args.studioId, { projection: studioFieldSpecifier })) as
			| Pick<DBStudio, StudioFields>
			| undefined
		if (!state.studio) {
			logger.warn(`Pub.expectedPackagesForDevice: studio "${args.studioId}" not found!`)
			state.layerNameToDeviceIds = new Map()
			state.packageContainers = {}
		} else {
			const studioMappings = applyAndValidateOverrides(state.studio.mappingsWithOverrides).obj
			state.layerNameToDeviceIds = buildMappingsToDeviceIdMap(
				applyAndValidateOverrides(state.studio.routeSetsWithOverrides).obj,
				studioMappings
			)
			state.packageContainers = applyAndValidateOverrides(state.studio.packageContainersWithOverrides).obj
		}
	}

	// If we are missing either of these, the publication can't run so clear everything
	if (!state.studio || !state.contentCache) {
		collection.remove(null)
		return
	}

	let regenerateExpectedPackageIds: Set<ExpectedPackageId>
	let regeneratePieceInstanceIds: Set<PieceInstanceId>
	if (invalidateAllItems) {
		// force every piece to be regenerated
		collection.remove(null)
		regenerateExpectedPackageIds = new Set(state.contentCache.ExpectedPackages.find({}).map((p) => p._id))
		regeneratePieceInstanceIds = new Set(state.contentCache.PieceInstances.find({}).map((p) => p._id))
	} else {
		// only regenerate the reported changes
		regenerateExpectedPackageIds = new Set(updateProps.invalidateExpectedPackageIds)
		regeneratePieceInstanceIds = new Set(updateProps.invalidatePieceInstanceIds)
	}

	await updateCollectionForExpectedPackageIds(
		state.contentCache,
		state.studio,
		state.layerNameToDeviceIds,
		state.packageContainers,
		collection,
		args.filterPlayoutDeviceIds,
		regenerateExpectedPackageIds
	)
	await updateCollectionForPieceInstanceIds(
		state.contentCache,
		state.studio,
		state.layerNameToDeviceIds,
		state.packageContainers,
		collection,
		args.filterPlayoutDeviceIds,
		regeneratePieceInstanceIds
	)
}

meteorCustomPublish(
	PeripheralDevicePubSub.packageManagerExpectedPackages,
	PeripheralDevicePubSubCollectionsNames.packageManagerExpectedPackages,
	async function (
		pub,
		deviceId: PeripheralDeviceId,
		filterPlayoutDeviceIds: PeripheralDeviceId[] | undefined,
		token: string | undefined
	) {
		check(deviceId, String)
		check(filterPlayoutDeviceIds, Match.Maybe([String]))

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, this)

		const studioId = peripheralDevice.studioAndConfigId?.studioId
		if (!studioId) {
			logger.warn(`Pub.packageManagerExpectedPackages: device "${peripheralDevice._id}" has no studioId`)
			return this.ready()
		}

		await setUpCollectionOptimizedObserver<
			PackageManagerExpectedPackage,
			ExpectedPackagesPublicationArgs,
			ExpectedPackagesPublicationState,
			ExpectedPackagesPublicationUpdateProps
		>(
			`${PeripheralDevicePubSub.packageManagerExpectedPackages}_${studioId}_${deviceId}_${JSON.stringify(
				(filterPlayoutDeviceIds || []).sort()
			)}`,
			{ studioId, deviceId, filterPlayoutDeviceIds },
			setupExpectedPackagesPublicationObservers,
			manipulateExpectedPackagesPublicationData,
			pub,
			500 // ms, wait this time before sending an update
		)
	}
)
