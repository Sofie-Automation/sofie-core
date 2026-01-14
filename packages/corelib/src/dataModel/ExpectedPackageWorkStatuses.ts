import { ExpectedPackageStatusAPI, Time } from '@sofie-automation/blueprints-integration'
import { ExpectedPackageId, ExpectedPackageWorkStatusId, PeripheralDeviceId, StudioId } from './Ids.js'

/**
 * ExpectedPackageWorkStatus contains statuses about Work that is being performed on expected packages
 * This collection is populated by a Package Manager-device.
 */

export interface ExpectedPackageWorkStatus extends Omit<ExpectedPackageStatusAPI.WorkStatus, 'fromPackages'> {
	_id: ExpectedPackageWorkStatusId

	studioId: StudioId
	fromPackages: ExpectedPackageWorkStatusFromPackage[]

	/** Which PeripheralDevice this update came from */
	deviceId: PeripheralDeviceId

	modified: Time
}
export interface ExpectedPackageWorkStatusFromPackage
	extends Omit<ExpectedPackageStatusAPI.WorkBaseInfoFromPackage, 'id'> {
	id: ExpectedPackageId
}
