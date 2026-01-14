import { PackageInfo, Time } from '@sofie-automation/blueprints-integration'
import { protectString } from '../protectedString.js'
import { ExpectedPackageId, PackageInfoId, PeripheralDeviceId, StudioId } from './Ids.js'

/**
 * The PackageInfos collection contains information related to Packages.
 * This collection is populated from a Package Manager-device.
 */

export interface PackageInfoDB extends PackageInfo.Base {
	_id: PackageInfoId

	/** Reference to the Package this document has info about */
	packageId: ExpectedPackageId
	/** Reference to the contentVersionHash of the ExpectedPackage, used to reference the expected content+version of the Package */
	expectedContentVersionHash: string
	/** Referring to the actual contentVersionHash of the Package, used to reference the exact content+version of the Package */
	actualContentVersionHash: string

	/** The studio this Package is in */
	studioId: StudioId

	/** Which PeripheralDevice this info comes from */
	deviceId: PeripheralDeviceId

	type: PackageInfo.Type
	payload: any

	/** If set, the package is invalid and will be removed after this time (unix timestamp) */
	removeTime?: Time | null
}

export function getPackageInfoId(packageId: ExpectedPackageId, type: string): PackageInfoId {
	return protectString(`${packageId}_${type}`)
}
