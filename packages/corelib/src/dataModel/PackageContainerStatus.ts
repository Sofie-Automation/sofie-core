/**
 * The PackageContainerStatuses-collection contains statuses about PackageContainers
 * PackageContainerStatuses are populated by the Package Manager-device and are used to track
 * jobs that runs on the PackageContainer, such as cronjobs and monitors
 *
 * Note: A "Package Container" is a generic term for "something that contains packages".
 * One  example of this could be a Media-folder (the "package container") which contains Media-files ("packages").
 */

import { ExpectedPackageStatusAPI, Time } from '@sofie-automation/blueprints-integration'
import { protectString } from '../protectedString.js'
import { StudioId, PeripheralDeviceId, PackageContainerId } from './Ids.js'

export interface PackageContainerStatusDB {
	_id: PackageContainerId // unique id, see getPackageContainerId()

	/** The studio this PackageContainer is defined in */
	studioId: StudioId

	/** The id of the PackageContainer */
	containerId: string

	/** Which PeripheralDevice this update came from */
	deviceId: PeripheralDeviceId

	/** The status of the PackageContainer */
	status: ExpectedPackageStatusAPI.PackageContainerStatus

	modified: Time
}

export function getPackageContainerId(studioId: StudioId, containerId: string): PackageContainerId {
	return protectString(`${studioId}_${containerId}`)
}
