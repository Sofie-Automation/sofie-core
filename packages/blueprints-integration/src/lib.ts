import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { SubdeviceAction } from '@sofie-automation/shared-lib/dist/core/deviceConfigManifest'
import { TSR } from './timeline.js'

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

export interface ObjId {
	_id: string
}
export type OmitId<T> = Omit<T & ObjId, '_id'>

export enum NoteSeverity {
	WARNING = 1,
	ERROR = 2,
	INFO = 3,
}

export interface IBlueprintPlayoutDevice {
	deviceId: PeripheralDeviceId

	deviceType: TSR.DeviceType

	/** Available actions for the device */
	actions: SubdeviceAction[] | undefined
}
