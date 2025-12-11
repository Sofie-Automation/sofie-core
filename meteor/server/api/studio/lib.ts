import { RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PackageInfoDB } from '@sofie-automation/corelib/dist/dataModel/PackageInfos'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { getCurrentTime } from '../../lib/lib'
import { ExpectedPackages, PackageInfos, PeripheralDevices, RundownPlaylists } from '../../collections'
import { logger } from '../../logging'

export async function getActiveRundownPlaylistsInStudioFromDb(
	studioId: StudioId,
	excludeRundownPlaylistId?: RundownPlaylistId
): Promise<DBRundownPlaylist[]> {
	return RundownPlaylists.findFetchAsync({
		studioId: studioId,
		activationId: { $exists: true },
		_id: {
			$ne: excludeRundownPlaylistId || protectString(''),
		},
	})
}

/** Returns a list of PackageInfos which have reached their removeTime */
export async function getExpiredRemovedPackageInfos(): Promise<PackageInfoDB['_id'][]> {
	const docs = await PackageInfos.findFetchAsync(
		{
			// Marked for delayed removal, and that time has passed
			removeTime: { $lte: getCurrentTime() },
		},
		{
			projection: {
				_id: 1,
			},
		}
	)
	return docs.map((p) => p._id)
}

/** Returns a list of PackageInfos which are missing their parent ExpectedPackage */
export async function getOrphanedPackageInfos(): Promise<PackageInfoDB['_id'][]> {
	const knownExpectedPackageIds = (await ExpectedPackages.findFetchAsync({}, { projection: { _id: 1 } })).map(
		(pkg) => pkg._id
	)

	const docs = await PackageInfos.findFetchAsync(
		{
			// Not marked for delayed removal, and the expectedPackage has been deleted
			packageId: { $nin: knownExpectedPackageIds },
			removeTime: { $exists: false },
		},
		{
			projection: {
				_id: 1,
			},
		}
	)
	return docs.map((p) => p._id)
}

/** Remove or mark for delayed removal some PackageInfos by id */
export async function removePackageInfos(ids: PackageInfoDB['_id'][], mode: 'defer' | 'purge'): Promise<void> {
	if (mode === 'defer') {
		// Mark for later removal
		const removeDelay = 3600 * 24 // Arbitrary value of 24 hours

		logger.info(`PackageInfo cleanup, mark for later removal: ${JSON.stringify(ids)}`)
		await PackageInfos.updateAsync(
			{
				_id: { $in: ids },
			},
			{
				$set: {
					removeTime: getCurrentTime() + removeDelay,
				},
			},
			{ multi: true }
		)
	} else {
		// Remove now
		await PackageInfos.removeAsync({
			_id: { $in: ids },
		})
	}
}

export async function getStudioIdFromDevice(peripheralDevice: PeripheralDevice): Promise<StudioId | undefined> {
	if (peripheralDevice.studioAndConfigId?.studioId) {
		return peripheralDevice.studioAndConfigId.studioId
	}
	if (peripheralDevice.parentDeviceId) {
		// Also check the parent device:
		const parentDevice = (await PeripheralDevices.findOneAsync(peripheralDevice.parentDeviceId, {
			projection: {
				_id: 1,
				studioAndConfigId: 1,
			},
		})) as Pick<PeripheralDevice, '_id' | 'studioAndConfigId'> | undefined
		if (parentDevice) {
			return parentDevice.studioAndConfigId?.studioId
		}
	}
	return undefined
}
