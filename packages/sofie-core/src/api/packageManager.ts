import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	PERIPHERAL_SUBTYPE_PROCESS,
} from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { PeripheralDevices } from '../collections'
import { executePeripheralDeviceFunction } from './peripheralDevice/executeFunction'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export async function restartExpectation(deviceId: PeripheralDeviceId, workId: string): Promise<void> {
	await executePeripheralDeviceFunction(deviceId, 'restartExpectation', workId)
}
export async function abortExpectation(deviceId: PeripheralDeviceId, workId: string): Promise<any> {
	await executePeripheralDeviceFunction(deviceId, 'abortExpectation', workId)
}

export async function restartAllExpectationsInStudio(studioId: StudioId): Promise<void> {
	const packageManagerDevices = await PeripheralDevices.findFetchAsync({
		'studioAndConfigId.studioId': studioId,
		category: PeripheralDeviceCategory.PACKAGE_MANAGER,
		type: PeripheralDeviceType.PACKAGE_MANAGER,
		subType: PERIPHERAL_SUBTYPE_PROCESS,
	})

	await Promise.all(
		packageManagerDevices.map(async (packageManagerDevice) => {
			return executePeripheralDeviceFunction(packageManagerDevice._id, 'restartAllExpectations')
		})
	)
}
export async function restartPackageContainer(deviceId: PeripheralDeviceId, containerId: string): Promise<void> {
	await executePeripheralDeviceFunction(deviceId, 'restartPackageContainer', containerId)
}
