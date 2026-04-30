import { PeripheralDeviceStatusObject } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'

export interface IConnector {
	initialized: boolean
	initializedError: string | undefined
}

export interface ICoreHandler {
	getCoreStatus: () => PeripheralDeviceStatusObject
	connectedToCore: boolean
}
