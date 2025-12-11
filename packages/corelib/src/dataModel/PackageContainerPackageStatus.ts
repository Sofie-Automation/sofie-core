import { ExpectedPackageStatusAPI, Time } from '@sofie-automation/blueprints-integration'
import { protectString } from '../protectedString.js'
import { ExpectedPackageId, PackageContainerPackageId, PeripheralDeviceId, StudioId } from './Ids.js'

/**
 * The PackageContainerPackageStatuses-collection contains statuses about "a Package on a specific PackageContainer"
 * PackageContainerPackageStatuses are populated by the Package Manager-device and can be used to look up whether a Package
 * (that originally is specified in the ExpectedPackages collection) is present on a certain Package Container.
 *
 * Note: A "Package Container" is a generic term for "something that contains packages".
 * One  example of this could be a Media-folder (the "package container") which contains Media-files ("packages").
 */

export interface PackageContainerPackageStatusDB {
	_id: PackageContainerPackageId // unique id, see getPackageContainerPackageId()

	/** The studio this PackageContainer is defined in */
	studioId: StudioId

	/** The PackageContainer the package is in */
	containerId: string

	/** The Package this status is for */
	packageId: ExpectedPackageId

	/** Which PeripheralDevice this update came from */
	deviceId: PeripheralDeviceId

	/** The status of the Package */
	status: ExpectedPackageStatusAPI.PackageContainerPackageStatus

	modified: Time
}

export function getPackageContainerPackageId(
	studioId: StudioId,
	containerId: string,
	packageId: ExpectedPackageId
): PackageContainerPackageId {
	return protectString(`${studioId}_${containerId}_${packageId}`)
}
