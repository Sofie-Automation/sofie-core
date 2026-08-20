import { UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { ClientAPI } from '@sofie-automation/meteor-lib/dist/api/client'
import { MethodContextAPI } from '../../methodContext'
import type { DDPClientConnection } from '../../../ddp-server/types'

export type APIHandler<T, Params, Body, Response> = (
	serverAPI: T,
	connection: DDPClientConnection,
	event: string,
	params: Params,
	body: Body
) => Promise<ClientAPI.ClientResponse<Response>>

export type APIRegisterHook<T> = <Params, Body, Response>(
	method: 'get' | 'post' | 'put' | 'delete',
	route: string,
	errMsgs: Map<number, UserErrorMessage[]>,
	serverAPIFactory: APIFactory<T>,
	handler: (
		serverAPI: T,
		connection: DDPClientConnection,
		event: string,
		params: Params,
		body: Body
	) => Promise<ClientAPI.ClientResponse<Response>>
) => void

export interface APIFactory<T> {
	createServerAPI(context: ServerAPIContext): T
}

export interface ServerAPIContext {
	getMethodContext(connection: DDPClientConnection): MethodContextAPI
}
