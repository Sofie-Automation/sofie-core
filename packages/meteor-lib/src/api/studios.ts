import { PeripheralDeviceId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export interface NewStudiosAPI {
	insertStudio(): Promise<StudioId>
	removeStudio(studioId: StudioId): Promise<void>

	assignConfigToPeripheralDevice(
		studioId: StudioId,
		configId: string,
		deviceId: PeripheralDeviceId | null
	): Promise<void>
}

export enum StudiosAPIMethods {
	'insertStudio' = 'studio.insertStudio',
	'removeStudio' = 'studio.removeStudio',

	'assignConfigToPeripheralDevice' = 'studio.assignConfigToPeripheralDevice',
}
