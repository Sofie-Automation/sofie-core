import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBStudio, StudioPackageContainer } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { PackageContainer } from '@sofie-automation/shared-lib/dist/package-manager/package'
import { PackageManagerPackageContainers } from '@sofie-automation/shared-lib/dist/package-manager/publications'
import { check } from 'meteor/check'
import { ReadonlyDeep } from 'type-fest'
import { Studios } from '../../collections'
import {
	meteorCustomPublish,
	SetupObserversResult,
	setUpOptimizedObserverArray,
	TriggerUpdate,
} from '../../lib/customPublication'
import { logger } from '../../logging'
import {
	PeripheralDevicePubSub,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { checkAccessAndGetPeripheralDevice } from '../../security/check'

type StudioFields = '_id' | 'packageContainersWithOverrides'
const studioFieldSpecifier = literal<MongoFieldSpecifierOnesStrict<Pick<DBStudio, StudioFields>>>({
	_id: 1,
	packageContainersWithOverrides: 1,
})

interface PackageManagerPackageContainersArgs {
	readonly studioId: StudioId
	readonly deviceId: PeripheralDeviceId
}

type PackageManagerPackageContainersUpdateProps = Record<string, never>

type PackageManagerPackageContainersState = Record<string, never>

async function setupExpectedPackagesPublicationObservers(
	args: ReadonlyDeep<PackageManagerPackageContainersArgs>,
	triggerUpdate: TriggerUpdate<PackageManagerPackageContainersUpdateProps>
): Promise<SetupObserversResult> {
	// Set up observers:
	return [
		Studios.observeChanges(
			{
				studioId: args.studioId,
			},
			{
				added: () => triggerUpdate({}),
				changed: () => triggerUpdate({}),
				removed: () => triggerUpdate({}),
			},
			{
				projection: studioFieldSpecifier,
			}
		),
	]
}

async function manipulateExpectedPackagesPublicationData(
	args: ReadonlyDeep<PackageManagerPackageContainersArgs>,
	_state: Partial<PackageManagerPackageContainersState>,
	_updateProps: Partial<PackageManagerPackageContainersUpdateProps> | undefined
): Promise<PackageManagerPackageContainers[] | null> {
	// Prepare data for publication:

	// Future: this may want to cache on the state, but with only a single observer there feels little point

	const studio = (await Studios.findOneAsync(args.studioId, { projection: studioFieldSpecifier })) as
		| Pick<DBStudio, StudioFields>
		| undefined

	const packageContainers: { [containerId: string]: PackageContainer } = {}
	if (studio) {
		const studioPackageContainers = applyAndValidateOverrides(studio.packageContainersWithOverrides).obj
		for (const [containerId, studioPackageContainer] of Object.entries<StudioPackageContainer>(
			studioPackageContainers
		)) {
			packageContainers[containerId] = studioPackageContainer.container
		}
	}

	return literal<PackageManagerPackageContainers[]>([
		{
			_id: args.deviceId,
			packageContainers,
		},
	])
}

meteorCustomPublish(
	PeripheralDevicePubSub.packageManagerPackageContainers,
	PeripheralDevicePubSubCollectionsNames.packageManagerPackageContainers,
	async function (pub, deviceId: PeripheralDeviceId, token: string | undefined) {
		check(deviceId, String)

		const peripheralDevice = await checkAccessAndGetPeripheralDevice(deviceId, token, this)

		const studioId = peripheralDevice.studioAndConfigId?.studioId
		if (!studioId) {
			logger.warn(`Pub.packageManagerPackageContainers: device "${peripheralDevice._id}" has no studioId`)
			return this.ready()
		}

		await setUpOptimizedObserverArray<
			PackageManagerPackageContainers,
			PackageManagerPackageContainersArgs,
			PackageManagerPackageContainersState,
			PackageManagerPackageContainersUpdateProps
		>(
			`${PeripheralDevicePubSub.packageManagerPackageContainers}_${studioId}_${deviceId}`,
			{ studioId, deviceId },
			setupExpectedPackagesPublicationObservers,
			manipulateExpectedPackagesPublicationData,
			pub,
			500 // ms, wait this time before sending an update
		)
	}
)
