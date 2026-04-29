import type { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status.js'

export interface IConnector {
	initialized: boolean
	initializedError: string | undefined
}

export interface ICoreHandler {
	getCoreStatus: () => { statusCode: StatusCode; messages: string[] }
	connectedToCore: boolean
}
